import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Dimensions, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import * as WebBrowser from 'expo-web-browser';
import { colors, spacing, borderRadius } from '../../theme';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ScreenBackground } from '../../components/ui';
import { useModal } from '../../contexts/ModalContext';
import { useTransactionListener } from '../../hooks/useTransactionListener';
import { MaterialIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';

const { width } = Dimensions.get('window');
const SCAN_AREA_SIZE = width * 0.7;

interface QRProductData {
    type?: string;
    productId: string;
    productName: string;
    priceInCents: number;
}

export function ScanToPayScreen() {
    const navigation = useNavigation();
    const { user } = useAuth();
    const { showModal, hideModal, showAlert } = useModal();
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);
    const [processing, setProcessing] = useState(false);

    // Realtime Listener state
    const [listenEnabled, setListenEnabled] = useState(false);
    const [currentSessionId, setCurrentSessionId] = useState<string | undefined>(undefined);
    const { completedTransaction } = useTransactionListener({
        enabled: listenEnabled,
        sessionId: currentSessionId,
    });

    useEffect(() => {
        if (permission && !permission.granted) {
            requestPermission();
        }
    }, [permission]);

    // Handle when transaction status updates to 'completed'
    useEffect(() => {
        if (completedTransaction) {
            setListenEnabled(false);
            setProcessing(false);
            
            showModal({
                title: '🎉 Payment Successful!',
                message: `Thank you for your purchase!\n\nProduct: ${completedTransaction.product_name || 'Item'}\nAmount: €${(completedTransaction.amount).toFixed(2)}\nDiscount Applied: €${(completedTransaction.discount_applied || 0).toFixed(2)}\n\nYour transaction has been recorded.`,
                confirmText: 'Done',
                hideCancel: true,
                onConfirm: () => {
                    hideModal();
                    navigation.goBack();
                }
            });
        }
    }, [completedTransaction]);

    const parseQRData = (text: string): QRProductData | null => {
        if (!text) return null;
        const clean = text.trim();

        // 1. Try JSON parsing
        try {
            const data = JSON.parse(clean);
            if (data.productId && data.priceInCents) {
                return {
                    productId: data.productId,
                    productName: data.productName || 'Merakí Item',
                    priceInCents: Number(data.priceInCents),
                };
            }
        } catch (_) {
            // ignore JSON error, fallback to URL/Scheme parsing
        }

        // 2. Try URL/Scheme parsing: e.g. meraki://pay?productId=socks-16&price=1600&name=Socks
        if (clean.startsWith('meraki://pay') || clean.includes('qr-payment')) {
            try {
                const url = new URL(clean.replace('meraki://', 'http://'));
                const productId = url.searchParams.get('productId');
                const priceInCents = url.searchParams.get('price') || url.searchParams.get('priceInCents');
                const productName = url.searchParams.get('name') || url.searchParams.get('productName');

                if (productId && priceInCents) {
                    return {
                        productId,
                        productName: productName || 'Merakí Item',
                        priceInCents: Number(priceInCents),
                    };
                }
            } catch (_) {
                // ignore url parsing error
            }
        }

        return null;
    };

    const handleBarCodeScanned = async ({ data }: { data: string }) => {
        if (scanned || processing) return;

        setScanned(true);
        setProcessing(true);

        try {
            const product = parseQRData(data);

            if (!product) {
                showModal({
                    title: 'Invalid QR Code',
                    message: 'Please scan a valid Merakí product QR code.',
                    confirmText: 'Try Again',
                    hideCancel: true,
                    type: 'error',
                    onConfirm: () => {
                        hideModal();
                        setScanned(false);
                        setProcessing(false);
                    }
                });
                return;
            }

            const isGuest = !user?.id;

            let sessionData: any;

            if (isGuest) {
                // Guest flow: call the edge function directly via fetch (no auth header).
                const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl
                    || process.env.EXPO_PUBLIC_SUPABASE_URL
                    || '';
                const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey
                    || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
                    || '';

                const res = await fetch(`${supabaseUrl}/functions/v1/create-stripe-session`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'apikey': supabaseAnonKey,
                    },
                    body: JSON.stringify({
                        productId: product.productId,
                        productName: product.productName,
                        priceInCents: product.priceInCents,
                        userId: 'guest',
                    }),
                });
                const json = await res.json();
                if (!res.ok) throw new Error(json.error || 'Could not create payment session.');
                sessionData = json;
            } else {
                // Authenticated flow: use supabase client (sends auth token automatically)
                const { data: invokeData, error: sessionError } = await supabase.functions.invoke('create-stripe-session', {
                    body: {
                        productId: product.productId,
                        productName: product.productName,
                        priceInCents: product.priceInCents,
                        userId: user.id,
                    }
                });

                if (sessionError) throw sessionError;
                if (invokeData?.error) throw new Error(invokeData.error);
                sessionData = invokeData;
            }

            const checkoutUrl = sessionData.url;
            const sessionId = sessionData.sessionId;

            if (!checkoutUrl) {
                throw new Error('Checkout URL not returned from server.');
            }

            setCurrentSessionId(sessionId);
            setListenEnabled(true); // Start listening to realtime updates

            // Open Stripe Checkout in WebBrowser
            // The checkout URL is a live payment link — never log its value.
            if (__DEV__) console.debug('Opening Stripe Checkout in the in-app browser');
            const browserResult = await WebBrowser.openBrowserAsync(checkoutUrl);

            // User closed the browser window manually
            if (browserResult.type === 'cancel') {
                if (__DEV__) console.debug('Checkout browser dismissed by the user');
                // We keep listening in the background just in case they paid right before closing
                // But allow rescan in case they cancelled
                setTimeout(() => {
                    setScanned(false);
                    // If no completion happened after 10s, stop loading/processing spinner
                    setProcessing(false);
                }, 5000);
            }

        } catch (error: any) {
            console.error('Scan to Pay error:', error);
            showModal({
                title: 'Checkout Failed',
                message: error.message || 'Something went wrong while setting up the payment session.',
                confirmText: 'Try Again',
                hideCancel: true,
                type: 'error',
                onConfirm: () => {
                    hideModal();
                    setScanned(false);
                    setProcessing(false);
                    setListenEnabled(false);
                }
            });
        }
    };

    if (!permission) {
        return <View style={styles.container} />;
    }

    if (!permission.granted) {
        return (
            <ScreenBackground>
                <SafeAreaView style={styles.container}>
                    <View style={styles.permissionContainer}>
                        <MaterialIcons name="camera-alt" size={60} color={colors.brandPink} style={styles.permissionIcon} />
                        <Text style={styles.permissionText}>We need camera permission to scan product QR codes.</Text>
                        <TouchableOpacity style={styles.grantButton} onPress={requestPermission}>
                            <Text style={styles.grantButtonText}>Grant Permission</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.backLink} onPress={() => navigation.goBack()}>
                            <Text style={styles.backLinkText}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </ScreenBackground>
        );
    }

    return (
        <View style={styles.container}>
            <CameraView
                style={StyleSheet.absoluteFillObject}
                facing="back"
                onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                barcodeScannerSettings={{
                    barcodeTypes: ["qr"],
                }}
            >
                <SafeAreaView style={styles.overlay}>
                    <View style={styles.header}>
                        <TouchableOpacity
                            style={styles.closeButton}
                            onPress={() => navigation.goBack()}
                        >
                            <MaterialIcons name="close" size={24} color={colors.textInvert} />
                        </TouchableOpacity>
                        <Text style={styles.title}>Scan to Pay</Text>
                        <View style={{ width: 44 }} />
                    </View>

                    <View style={styles.centerContainer}>
                        <View style={styles.scanFrame}>
                            <View style={[styles.corner, styles.topLeft]} />
                            <View style={[styles.corner, styles.topRight]} />
                            <View style={[styles.corner, styles.bottomLeft]} />
                            <View style={[styles.corner, styles.bottomRight]} />

                            {processing && (
                                <ActivityIndicator size="large" color={colors.brandPink} style={styles.spinner} />
                            )}
                        </View>
                        <Text style={styles.instructions}>
                            {processing
                                ? 'Creating secure Stripe session...'
                                : 'Align the product QR code on the admin panel to pay'}
                        </Text>
                    </View>
                </SafeAreaView>
            </CameraView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'black',
    },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.65)',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
    },
    closeButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        color: 'white',
        textAlign: 'center',
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingBottom: 80,
    },
    scanFrame: {
        width: SCAN_AREA_SIZE,
        height: SCAN_AREA_SIZE,
        position: 'relative',
        justifyContent: 'center',
        alignItems: 'center',
    },
    corner: {
        position: 'absolute',
        width: 24,
        height: 24,
        borderColor: colors.brandPink,
    },
    topLeft: {
        top: 0,
        left: 0,
        borderTopWidth: 4,
        borderLeftWidth: 4,
        borderTopLeftRadius: 12,
    },
    topRight: {
        top: 0,
        right: 0,
        borderTopWidth: 4,
        borderRightWidth: 4,
        borderTopRightRadius: 12,
    },
    bottomLeft: {
        bottom: 0,
        left: 0,
        borderBottomWidth: 4,
        borderLeftWidth: 4,
        borderBottomLeftRadius: 12,
    },
    bottomRight: {
        bottom: 0,
        right: 0,
        borderBottomWidth: 4,
        borderRightWidth: 4,
        borderBottomRightRadius: 12,
    },
    instructions: {
        color: 'rgba(255,255,255,0.85)',
        fontSize: 14,
        textAlign: 'center',
        marginTop: spacing.xl,
        paddingHorizontal: spacing.xl,
        lineHeight: 20,
    },
    spinner: {
        transform: [{ scale: 1.2 }],
    },
    permissionContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: spacing.xl,
    },
    permissionIcon: {
        marginBottom: spacing.lg,
    },
    permissionText: {
        color: colors.textPrimary,
        fontSize: 16,
        textAlign: 'center',
        marginBottom: spacing.xl,
        lineHeight: 24,
    },
    grantButton: {
        backgroundColor: colors.primary,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.xl,
        borderRadius: borderRadius.md || 12,
        width: '100%',
        alignItems: 'center',
    },
    grantButtonText: {
        color: colors.textInvert,
        fontWeight: '600',
        fontSize: 16,
    },
    backLink: {
        marginTop: spacing.md,
        padding: spacing.sm,
    },
    backLinkText: {
        color: colors.textSecondary,
        fontSize: 14,
        textDecorationLine: 'underline',
    },
});
