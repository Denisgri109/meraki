import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, ActivityIndicator } from 'react-native';
import NfcManager, { NfcTech, Ndef } from 'react-native-nfc-manager';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '../../theme';
import { ScreenBackground } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useModal } from '../../contexts/ModalContext';

export function NFCScannerScreen() {
    const navigation = useNavigation();
    const { user } = useAuth();
    const { showModal, hideModal, showAlert } = useModal();
    const [hasNfc, setHasNfc] = useState<boolean | null>(null);
    const [scanning, setScanning] = useState(false);

    useEffect(() => {
        const checkNfc = async () => {
            const supported = await NfcManager.isSupported();
            setHasNfc(supported);
            if (supported) {
                await NfcManager.start();
            }
        };
        checkNfc();

        return () => {
            NfcManager.cancelTechnologyRequest().catch(() => 0);
        };
    }, []);

    const readNdef = async () => {
        try {
            setScanning(true);
            // register for the NFC tag with NDEF in it
            await NfcManager.requestTechnology(NfcTech.Ndef);

            // the resolved tag object will contain `ndefMessage` property
            const tag = await NfcManager.getTag();

            if (tag) {
                await processTag(tag);
            }
        } catch (ex) {
            console.warn('Oops!', ex);
            setScanning(false);
            NfcManager.cancelTechnologyRequest().catch(() => 0);
        } finally {
            // stop the nfc scanning
            NfcManager.cancelTechnologyRequest().catch(() => 0);
            setScanning(false);
        }
    };

    const parseMasterId = (text: string): string | null => {
        if (!text) return null;
        const clean = text.trim();
        if (clean.includes('loyalty/stamp')) {
            const match = clean.match(/[?&]master_id=([^&]+)/);
            if (match && match[1]) return match[1];
        }
        if (clean.startsWith('stamp:')) {
            return clean.replace('stamp:', '').trim();
        }
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(clean)) return clean;
        return null;
    };

    const processTag = async (tag: any) => {
        if (!tag.ndefMessage && !tag.id) {
            showAlert('Error', 'Invalid Tag', 'error');
            return;
        }

        let payload = '';

        // Try to decode NDEF
        if (tag.ndefMessage && tag.ndefMessage.length > 0) {
            const ndefRecord = tag.ndefMessage[0];
            const text = Ndef.text.decodePayload(ndefRecord.payload);
            payload = text;
        } else {
            // Fallback to ID if no NDEF, though our stamps use NDEF text records
            // This might need adjustment based on how tags are written. 
            // For now assume NDEF text record "stamp:master_id"
            showAlert('Error', 'Empty or unsupported tag', 'error');
            return;
        }

        console.log('NFC Payload:', payload);

        const masterId = parseMasterId(payload);

        try {
            if (masterId) {
                const { data: result, error } = await (supabase as any).rpc('process_stamp_scan', {
                    p_master_id: masterId,
                    p_client_id: user?.id
                });

                if (error) throw error;
                handleScanResult(result);

            } else {
                showModal({
                    title: 'Scan Failed',
                    message: 'Invalid Tag Payload. Please tap a valid Merakí loyalty stamp tag.',
                    confirmText: 'Try Again',
                    hideCancel: true,
                    type: 'error',
                    onConfirm: hideModal
                });
            }

        } catch (error: any) {
            console.error('NFC Scan Error:', error);
            showModal({
                title: 'Scan Failed',
                message: error.message || 'Unable to process NFC tag',
                confirmText: 'OK',
                hideCancel: true,
                type: 'error',
                onConfirm: hideModal
            });
        }
    };

    const handleScanResult = (result: any) => {
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
                message: result.message || 'Invalid Tag',
                confirmText: 'Try Again',
                hideCancel: true,
                type: 'error',
                onConfirm: hideModal
            });
        }
    }


    if (hasNfc === null) {
        return <View />;
    }

    if (!hasNfc) {
        return (
            <ScreenBackground>
                <SafeAreaView style={styles.container}>
                    <View style={styles.content}>
                        <MaterialIcons name="error-outline" size={64} color={colors.textMuted} />

                        <Text style={styles.text}>NFC is not supported on this device</Text>
                        <TouchableOpacity style={styles.button} onPress={() => navigation.goBack()}>
                            <Text style={styles.buttonText}>Go Back</Text>
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </ScreenBackground>
        );
    }

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <MaterialIcons name="arrow-back" size={22} color="rgba(0, 0, 0, 0.55)" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Scan NFC Tag</Text>
                    <View style={{ width: 40 }} />
                </View>

                <View style={styles.content}>
                    <View style={[styles.circle, scanning && styles.scanningCircle]}>
                        <MaterialIcons name="nfc" size={80} color={scanning ? colors.primary : colors.text} />
                    </View>

                    <Text style={styles.title}>
                        {scanning ? 'Bring tag closer...' : 'Ready to Scan'}
                    </Text>
                    <Text style={styles.subtitle}>
                        Hold your phone near the Merakí tag to collect your stamp.
                    </Text>

                    {!scanning && (
                        <TouchableOpacity style={styles.scanButton} onPress={readNdef}>
                            <Text style={styles.scanButtonText}>Tap to Scan</Text>
                        </TouchableOpacity>
                    )}

                    {scanning && (
                        <TouchableOpacity style={styles.cancelButton} onPress={() => {
                            NfcManager.cancelTechnologyRequest().catch(() => 0);
                            setScanning(false);
                        }}>
                            <Text style={styles.cancelButtonText}>Cancel</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </SafeAreaView>
        </ScreenBackground>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.md,
    },
    backButton: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.03)',
        borderWidth: 1, borderColor: 'rgba(0, 0, 0, 0.06)',
        alignItems: 'center', justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 17, fontWeight: '600', color: '#1A1A1A',
    },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xl,
    },
    circle: {
        width: 160,
        height: 160,
        borderRadius: 80,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.xl,
        borderWidth: 2,
        borderColor: colors.border,
    },
    scanningCircle: {
        borderColor: colors.primary,
        backgroundColor: 'rgba(200, 160, 77, 0.1)',
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: colors.text,
        marginBottom: spacing.sm,
    },
    subtitle: {
        fontSize: 16,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: spacing.xl * 2,
        lineHeight: 24,
    },
    text: {
        fontSize: 18,
        color: colors.textSecondary,
        marginVertical: spacing.lg,
        textAlign: 'center',
    },
    button: {
        paddingVertical: spacing.md,
        paddingHorizontal: spacing.xl,
        backgroundColor: colors.surface,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
    },
    buttonText: {
        color: colors.text,
        fontSize: 16,
        fontWeight: '600',
    },
    scanButton: {
        backgroundColor: colors.primary,
        paddingVertical: spacing.lg,
        paddingHorizontal: spacing.xl * 2,
        borderRadius: 30,
        elevation: 4,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    scanButtonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: '700',
    },
    cancelButton: {
        padding: spacing.md,
        marginTop: spacing.md,
    },
    cancelButtonText: {
        color: colors.textSecondary,
        fontSize: 16,
    }
});
