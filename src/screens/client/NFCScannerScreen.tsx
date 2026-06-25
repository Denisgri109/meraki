import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, ActivityIndicator, TextInput, ScrollView } from 'react-native';
let NfcManager: any = null;
let NfcTech: any = {};
let Ndef: any = {};
let nfcAvailable = false;

try {
    const nfcModule = require('react-native-nfc-manager');
    NfcManager = nfcModule.default;
    NfcTech = nfcModule.NfcTech;
    Ndef = nfcModule.Ndef;
    nfcAvailable = true;
} catch (error) {
    console.warn('[NFC] Native module not available in NFCScannerScreen. Running without NFC support.');
}
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { colors, spacing, borderRadius } from '../../theme';
import { ScreenBackground, Card, Button, MerakiText } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useModal } from '../../contexts/ModalContext';
import { fetchActiveMasters } from '../../services/masterManagementService';

export function NFCScannerScreen() {
    const navigation = useNavigation();
    const { user } = useAuth();
    const { showModal, hideModal, showAlert } = useModal();
    const [hasNfc, setHasNfc] = useState<boolean | null>(null);
    const [scanning, setScanning] = useState(false);

    // Simulator states
    const [activeMasters, setActiveMasters] = useState<any[]>([]);
    const [loadingMasters, setLoadingMasters] = useState(false);
    const [selectedMasterId, setSelectedMasterId] = useState<string>('');
    const [customMasterId, setCustomMasterId] = useState<string>('');

    useEffect(() => {
        const checkNfc = async () => {
            if (!NfcManager || typeof NfcManager.isSupported !== 'function') {
                setHasNfc(false);
                return;
            }
            try {
                const supported = await NfcManager.isSupported();
                setHasNfc(supported);
                if (supported) {
                    await NfcManager.start();
                }
            } catch (e) {
                console.warn('Error checking NFC support:', e);
                setHasNfc(false);
            }
        };
        checkNfc();

        return () => {
            if (NfcManager && typeof NfcManager.cancelTechnologyRequest === 'function') {
                NfcManager.cancelTechnologyRequest().catch(() => 0);
            }
        };
    }, []);

    useEffect(() => {
        if (hasNfc === false) {
            const loadMasters = async () => {
                setLoadingMasters(true);
                try {
                    const { data, error } = await fetchActiveMasters();
                    if (!error && data) {
                        setActiveMasters(data);
                        if (data.length > 0) {
                            setSelectedMasterId(data[0].id);
                        }
                    }
                } catch (e) {
                    console.error('Failed to load active masters for NFC simulator:', e);
                } finally {
                    setLoadingMasters(false);
                }
            };
            loadMasters();
        }
    }, [hasNfc]);

    const readNdef = async () => {
        if (!NfcManager || typeof NfcManager.requestTechnology !== 'function') {
            showAlert('NFC Not Available', 'NFC features require a physical device and a development build.', 'error');
            return;
        }
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
            if (NfcManager && typeof NfcManager.cancelTechnologyRequest === 'function') {
                NfcManager.cancelTechnologyRequest().catch(() => 0);
            }
        } finally {
            // stop the nfc scanning
            if (NfcManager && typeof NfcManager.cancelTechnologyRequest === 'function') {
                NfcManager.cancelTechnologyRequest().catch(() => 0);
            }
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

    const simulateScan = async () => {
        const targetMasterId = (customMasterId || selectedMasterId || '').trim();
        if (!targetMasterId) {
            showAlert('Validation Error', 'Please select a Master or enter a custom Master ID.', 'error');
            return;
        }

        try {
            setScanning(true);
            // Simulate brief scan delay
            await new Promise((resolve) => setTimeout(resolve, 800));

            const { data: result, error } = await (supabase as any).rpc('process_stamp_scan', {
                p_master_id: targetMasterId,
                p_client_id: user?.id
            });

            if (error) throw error;
            handleScanResult(result);

        } catch (error: any) {
            console.error('NFC Scan Simulation Error:', error);
            showModal({
                title: 'Scan Failed',
                message: error.message || 'Unable to process simulated NFC scan',
                confirmText: 'OK',
                hideCancel: true,
                type: 'error',
                onConfirm: hideModal
            });
        } finally {
            setScanning(false);
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
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                            <MaterialIcons name="arrow-back" size={22} color="rgba(0, 0, 0, 0.55)" />
                        </TouchableOpacity>
                        <Text style={styles.headerTitle}>NFC Simulator</Text>
                        <View style={{ width: 40 }} />
                    </View>

                    <ScrollView contentContainerStyle={styles.simulatorContent} showsVerticalScrollIndicator={false}>
                        <Card variant="glass" style={styles.simulatorNoticeCard}>
                            <View style={styles.sectionHeader}>
                                <MaterialIcons name="info-outline" size={20} color={colors.warning} style={{ marginRight: 6 }} />
                                <MerakiText variant="body" color={colors.text} style={{ fontWeight: '600' }}>
                                    Simulator / Expo Go Mode
                                </MerakiText>
                            </View>
                            <MerakiText variant="caption" color={colors.textSecondary} style={{ lineHeight: 18, marginTop: 4 }}>
                                Native NFC hardware is not detected. Use this panel to simulate tapping a Master's NFC loyalty sticker.
                            </MerakiText>
                        </Card>

                        {scanning ? (
                            <View style={styles.scanningContainer}>
                                <View style={[styles.circle, styles.scanningCircle]}>
                                    <MaterialIcons name="nfc" size={80} color={colors.primary} />
                                    <ActivityIndicator size="large" color={colors.primary} style={{ position: 'absolute' }} />
                                </View>
                                <MerakiText variant="h2" style={styles.title}>Simulating Scan...</MerakiText>
                                <MerakiText variant="body" color={colors.textSecondary} style={styles.subtitle}>
                                    Connecting to simulated NFC tag and communicating with database.
                                </MerakiText>
                            </View>
                        ) : (
                            <View style={styles.simulatorForm}>
                                <MerakiText variant="body" style={styles.formLabel}>
                                    Select Master to Scan Stamp From:
                                </MerakiText>

                                {loadingMasters ? (
                                    <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: spacing.md }} />
                                ) : activeMasters.length === 0 ? (
                                    <View style={styles.emptyContainer}>
                                        <MerakiText variant="caption" color={colors.textMuted}>
                                            No active beauty masters found in the database.
                                        </MerakiText>
                                    </View>
                                ) : (
                                    <ScrollView
                                        horizontal
                                        showsHorizontalScrollIndicator={false}
                                        style={styles.mastersScrollView}
                                        contentContainerStyle={styles.mastersScrollContent}
                                    >
                                        {activeMasters.map((master) => {
                                            const isSelected = selectedMasterId === master.id;
                                            return (
                                                <TouchableOpacity
                                                    key={master.id}
                                                    style={[
                                                        styles.masterCard,
                                                        isSelected && styles.selectedMasterCard
                                                    ]}
                                                    onPress={() => {
                                                        setSelectedMasterId(master.id);
                                                        setCustomMasterId(''); // Clear custom input when selecting from list
                                                    }}
                                                >
                                                    <View style={styles.masterInfo}>
                                                        <MerakiText
                                                            variant="body"
                                                            style={[
                                                                styles.masterName,
                                                                isSelected && styles.selectedMasterText
                                                            ]}
                                                            numberOfLines={1}
                                                        >
                                                            {master.full_name || 'Unnamed Master'}
                                                        </MerakiText>
                                                        <MerakiText
                                                            variant="caption"
                                                            color={isSelected ? 'rgba(255, 255, 255, 0.7)' : colors.textSecondary}
                                                            numberOfLines={1}
                                                        >
                                                            {master.specialties && master.specialties.length > 0
                                                                ? master.specialties[0]
                                                                : 'Stylist'}
                                                        </MerakiText>
                                                    </View>
                                                    {isSelected && (
                                                        <MaterialIcons name="check-circle" size={18} color="white" style={styles.checkIcon} />
                                                    )}
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </ScrollView>
                                )}

                                <MerakiText variant="body" style={[styles.formLabel, { marginTop: spacing.sm }]}>
                                    Or enter custom Master ID (UUID):
                                </MerakiText>
                                <TextInput
                                    style={styles.textInput}
                                    placeholder="Enter UUID..."
                                    placeholderTextColor={colors.textMuted}
                                    value={customMasterId}
                                    onChangeText={(val) => {
                                        setCustomMasterId(val);
                                        if (val) {
                                            setSelectedMasterId(''); // Clear selected list item when typing custom ID
                                        }
                                    }}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                />

                                <TouchableOpacity style={styles.simulateButton} onPress={simulateScan}>
                                    <Text style={styles.simulateButtonText}>Simulate NFC Tap</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </ScrollView>
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
    },
    simulatorContent: {
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.xxl,
    },
    simulatorNoticeCard: {
        padding: spacing.md,
        marginTop: spacing.sm,
        marginBottom: spacing.lg,
        borderLeftWidth: 3,
        borderLeftColor: colors.warning,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    scanningContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.xl * 2,
    },
    simulatorForm: {
        width: '100%',
    },
    formLabel: {
        fontWeight: '600',
        color: colors.text,
        marginBottom: spacing.xs,
    },
    emptyContainer: {
        padding: spacing.md,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.02)',
        borderRadius: borderRadius.md,
        marginBottom: spacing.sm,
    },
    mastersScrollView: {
        marginHorizontal: -spacing.lg,
        marginBottom: spacing.md,
    },
    mastersScrollContent: {
        paddingHorizontal: spacing.lg,
        gap: 12,
    },
    masterCard: {
        width: 140,
        padding: spacing.md,
        backgroundColor: colors.surface,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        justifyContent: 'space-between',
        flexDirection: 'row',
        alignItems: 'center',
    },
    selectedMasterCard: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    masterInfo: {
        flex: 1,
        marginRight: 4,
    },
    masterName: {
        fontWeight: '600',
        fontSize: 14,
    },
    selectedMasterText: {
        color: 'white',
    },
    checkIcon: {
        marginLeft: 4,
    },
    textInput: {
        width: '100%',
        height: 48,
        borderRadius: borderRadius.md,
        borderWidth: 1,
        borderColor: colors.border,
        paddingHorizontal: spacing.md,
        fontSize: 14,
        color: colors.text,
        backgroundColor: colors.surface,
        marginBottom: spacing.xl,
    },
    simulateButton: {
        backgroundColor: colors.primary,
        height: 52,
        borderRadius: 26,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 3,
        shadowColor: colors.primary,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
    },
    simulateButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '700',
    }
});
