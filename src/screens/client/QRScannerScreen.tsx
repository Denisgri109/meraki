import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert, Dimensions, ActivityIndicator } from 'react-native';
import { CameraView, CameraType, useCameraPermissions } from 'expo-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { colors, spacing, borderRadius } from '../../theme';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ScreenBackground } from '../../components/ui';
import { useModal } from '../../contexts/ModalContext';

const { width } = Dimensions.get('window');
const SCAN_AREA_SIZE = width * 0.7;

export function QRScannerScreen() {
    const navigation = useNavigation();
    const { user } = useAuth();
    const { showModal, hideModal } = useModal();
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);
    const [processing, setProcessing] = useState(false);

    useEffect(() => {
        if (permission && !permission.granted) {
            requestPermission();
        }
    }, [permission]);

    const handleBarCodeScanned = async ({ type, data }: { type: string; data: string }) => {
        if (scanned || processing) return;

        setScanned(true);
        setProcessing(true);

        try {
            // Check if this is a stamp card QR code (format: stamp:{master_id})
            if (data.startsWith('stamp:')) {
                const masterId = data.replace('stamp:', '');

                // Call stamp-specific RPC
                const { data: result, error } = await (supabase as any).rpc('process_stamp_scan', {
                    p_master_id: masterId,
                    p_client_id: user?.id
                });

                if (error) throw error;

                if (result.success) {
                    const progressText = result.reward_available
                        ? `${result.stamps_collected}/${result.stamps_required} stamps - REWARD READY!`
                        : `${result.stamps_collected}/${result.stamps_required} stamps`;

                    showModal({
                        title: result.reward_available ? '🎁 Reward Earned!' : '✓ Stamp Collected!',
                        message: `${result.card_name} from ${result.master_name}\n\n${progressText}\n\n${result.message}`,
                        confirmText: result.reward_available ? 'View My Cards' : 'Awesome',
                        hideCancel: true,
                        onConfirm: () => {
                            hideModal();
                            if (result.reward_available) {
                                navigation.navigate('StampCards' as never);
                            } else {
                                navigation.goBack();
                            }
                        }
                    });
                } else {
                    showModal({
                        title: 'Scan Failed',
                        message: result.message || 'Unable to process stamp',
                        confirmText: 'Try Again',
                        hideCancel: true,
                        type: 'error',
                        onConfirm: () => {
                            hideModal();
                            setScanned(false);
                            setProcessing(false);
                        }
                    });
                }
            } else {
                // Legacy: Call general loyalty points RPC for other QR codes
                const { data: result, error } = await (supabase as any).rpc('process_qr_scan', {
                    p_code: data,
                    p_client_id: user?.id
                });

                if (error) throw error;

                if (result.success) {
                    showModal({
                        title: 'Success!',
                        message: `You earned ${result.points} loyalty points!`,
                        confirmText: 'Awesome',
                        hideCancel: true,
                        type: 'success',
                        onConfirm: () => {
                            hideModal();
                            navigation.goBack();
                        }
                    });
                } else {
                    showModal({
                        title: 'Scan Failed',
                        message: result.message || 'Invalid QR Code',
                        confirmText: 'Try Again',
                        hideCancel: true,
                        type: 'error',
                        onConfirm: () => {
                            hideModal();
                            setScanned(false);
                            setProcessing(false);
                        }
                    });
                }
            }
        } catch (error: any) {
            console.error('Scan error:', error);
            showModal({
                title: 'Error',
                message: 'Something went wrong while processing the code.',
                confirmText: 'OK',
                hideCancel: true,
                type: 'error',
                onConfirm: () => {
                    hideModal();
                    setScanned(false);
                    setProcessing(false);
                }
            });
        }
    };

    if (!permission) {
        return <View />;
    }

    if (!permission.granted) {
        return (
            <ScreenBackground>
                <SafeAreaView style={styles.container}>
                    <View style={styles.permissionContainer}>
                        <Text style={styles.permissionText}>We need your permission to show the camera</Text>
                        <TouchableOpacity style={styles.button} onPress={requestPermission}>
                            <Text style={styles.buttonText}>Grant Permission</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                            <Text style={styles.backButtonText}>Cancel</Text>
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
                            <Text style={styles.closeButtonText}>✕</Text>
                        </TouchableOpacity>
                        <Text style={styles.title}>Scan QR Code</Text>
                        <View style={{ width: 44 }} />
                    </View>

                    <View style={styles.centerContainer}>
                        <View style={styles.scanFrame}>
                            <View style={[styles.corner, styles.topLeft]} />
                            <View style={[styles.corner, styles.topRight]} />
                            <View style={[styles.corner, styles.bottomLeft]} />
                            <View style={[styles.corner, styles.bottomRight]} />

                            {processing && (
                                <ActivityIndicator size="large" color={colors.primary} style={styles.spinner} />
                            )}
                        </View>
                        <Text style={styles.instructions}>
                            Align the Master's QR code within the frame to earn points
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
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.md,
    },
    closeButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(0, 0, 0, 0.12)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeButtonText: {
        fontSize: 24,
        color: 'white',
        lineHeight: 28,
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        color: 'white',
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scanFrame: {
        width: SCAN_AREA_SIZE,
        height: SCAN_AREA_SIZE,
        position: 'relative',
        backgroundColor: 'transparent',
    },
    corner: {
        position: 'absolute',
        width: 40,
        height: 40,
        borderColor: colors.primary,
        borderWidth: 4,
    },
    topLeft: {
        top: 0,
        left: 0,
        borderBottomWidth: 0,
        borderRightWidth: 0,
    },
    topRight: {
        top: 0,
        right: 0,
        borderBottomWidth: 0,
        borderLeftWidth: 0,
    },
    bottomLeft: {
        bottom: 0,
        left: 0,
        borderTopWidth: 0,
        borderRightWidth: 0,
    },
    bottomRight: {
        bottom: 0,
        right: 0,
        borderTopWidth: 0,
        borderLeftWidth: 0,
    },
    spinner: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
    },
    instructions: {
        marginTop: spacing.xl,
        color: 'white',
        fontSize: 16,
        textAlign: 'center',
        paddingHorizontal: spacing.xl,
        opacity: 0.8,
    },
    permissionContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xl,
    },
    permissionText: {
        fontSize: 18,
        color: colors.text,
        textAlign: 'center',
        marginBottom: spacing.xl,
    },
    button: {
        backgroundColor: colors.primary,
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.xl,
        borderRadius: borderRadius.md,
        marginBottom: spacing.md,
    },
    buttonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    backButton: {
        padding: spacing.md,
    },
    backButtonText: {
        color: colors.textSecondary,
        fontSize: 16,
    },
});

export default QRScannerScreen; // Export default as well just in case
