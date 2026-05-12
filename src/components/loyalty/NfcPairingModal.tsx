import React, { useState } from 'react';
import {
    View,
    StyleSheet,
    Modal,
    ActivityIndicator,
    TouchableOpacity,
    Platform,
} from 'react-native';
import NfcManager, { NfcTech, Ndef } from 'react-native-nfc-manager';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, borderRadius } from '../../theme';
import { Button, Card, ScreenBackground, MerakiText } from '../ui';

interface NfcPairingModalProps {
    visible: boolean;
    onClose: () => void;
    masterId: string;
}

type PairingState = 'ready' | 'scanning' | 'writing' | 'success' | 'error';

export function NfcPairingModal({ visible, onClose, masterId }: NfcPairingModalProps) {
    const [state, setState] = useState<PairingState>('ready');
    const [errorMessage, setErrorMessage] = useState<string>('');

    const startNfcPairing = async () => {
        try {
            setState('scanning');

            if (!NfcManager || typeof NfcManager.isSupported !== 'function') {
                setErrorMessage(
                    'NFC is not available. This feature requires a development build (not Expo Go). ' +
                    'Run "npx expo run:android" or create an EAS build to use NFC.'
                );
                setState('error');
                return;
            }

            let isSupported = false;
            try {
                isSupported = await NfcManager.isSupported();
            } catch (e) {
                setErrorMessage(
                    'NFC module not linked. This feature requires a development build. ' +
                    'Run "npx expo run:android" to test NFC pairing.'
                );
                setState('error');
                return;
            }

            if (!isSupported) {
                setErrorMessage('NFC is not supported on this device');
                setState('error');
                return;
            }

            const isEnabled = await NfcManager.isEnabled();
            if (!isEnabled) {
                setErrorMessage('Please enable NFC in your device settings');
                setState('error');
                return;
            }

            await NfcManager.start();
            await NfcManager.requestTechnology(NfcTech.Ndef);

            setState('writing');

            const deepLinkUrl = `meraki://loyalty/stamp?master_id=${masterId}`;

            const bytes = Ndef.encodeMessage([
                Ndef.uriRecord(deepLinkUrl),
            ]);

            if (bytes) {
                await NfcManager.ndefHandler.writeNdefMessage(bytes);
                setState('success');
            } else {
                throw new Error('Failed to encode NFC message');
            }

        } catch (error: any) {
            console.error('NFC Pairing Error:', error);

            let message = error?.message || 'Failed to write to NFC tag';

            if (message.includes('null') || message.includes('undefined')) {
                message = 'NFC module not available. Please use a development build instead of Expo Go.';
            }

            setErrorMessage(message);
            setState('error');
        } finally {
            try {
                await NfcManager.cancelTechnologyRequest();
            } catch (e) {
                // Ignore cleanup errors
            }
        }
    };

    const handleClose = () => {
        setState('ready');
        setErrorMessage('');
        onClose();
    };

    const renderContent = () => {
        switch (state) {
            case 'ready':
                return (
                    <>
                        <Card style={styles.mainCard}>
                            <View style={styles.iconCircle}>
                                <MaterialCommunityIcons name="cellphone-nfc" size={48} color={colors.accent} />
                            </View>
                            <MerakiText variant="h2" style={styles.cardTitle}>Pair NFC Tag</MerakiText>
                            <MerakiText variant="body" color={colors.textSecondary} style={styles.cardDescription}>
                                Write your loyalty stamp link to an NFC sticker.
                                Clients can tap their phone on the sticker to collect stamps instantly!
                            </MerakiText>
                        </Card>

                        <Card variant="glass" style={styles.requirementsCard}>
                            <View style={styles.sectionHeader}>
                                <MaterialCommunityIcons name="information-outline" size={18} color={colors.accent} />
                                <MerakiText variant="body" color={colors.text} style={{ fontWeight: '600' }}>Requirements</MerakiText>
                            </View>
                            <MerakiText variant="caption" color={colors.textSecondary} style={styles.requirementItem}>
                                •  NTAG213, NTAG215, or NTAG216 tag
                            </MerakiText>
                            <MerakiText variant="caption" color={colors.textSecondary} style={styles.requirementItem}>
                                •  Tag must be blank or rewritable
                            </MerakiText>
                        </Card>

                        <View style={styles.buttonContainer}>
                            <Button
                                title="Start Pairing"
                                onPress={startNfcPairing}
                                fullWidth
                            />
                        </View>
                    </>
                );

            case 'scanning':
            case 'writing':
                return (
                    <Card style={styles.mainCard}>
                        <View style={styles.scanningCircle}>
                            <MaterialCommunityIcons name="antenna" size={48} color={colors.accent} />
                            <ActivityIndicator size="large" color={colors.primary} style={styles.spinner} />
                        </View>
                        <MerakiText variant="h2" style={styles.cardTitle}>
                            {state === 'scanning' ? 'Ready to Scan' : 'Writing...'}
                        </MerakiText>
                        <MerakiText variant="body" color={colors.textSecondary} style={styles.cardDescription}>
                            Hold your phone near the NFC sticker to pair
                        </MerakiText>
                        <Button
                            title="Cancel"
                            variant="outline"
                            onPress={handleClose}
                            fullWidth
                            style={{ marginTop: spacing.md }}
                        />
                    </Card>
                );

            case 'success':
                return (
                    <>
                        <Card style={styles.mainCard}>
                            <View style={[styles.iconCircle, styles.successCircle]}>
                                <MaterialCommunityIcons name="check-circle" size={48} color={colors.success} />
                            </View>
                            <MerakiText variant="h2" color={colors.success} style={styles.cardTitle}>Tag Paired!</MerakiText>
                            <MerakiText variant="body" color={colors.textSecondary} style={styles.cardDescription}>
                                Your NFC sticker is now ready. Clients can tap their phones on it to collect stamps automatically.
                            </MerakiText>
                        </Card>

                        <Card variant="glass" style={styles.tipCard}>
                            <View style={styles.sectionHeader}>
                                <MaterialCommunityIcons name="lightbulb-on-outline" size={18} color={colors.accent} />
                                <MerakiText variant="body" color={colors.accent} style={{ fontWeight: '600' }}>Pro Tip</MerakiText>
                            </View>
                            <MerakiText variant="caption" color={colors.textSecondary} style={{ lineHeight: 20 }}>
                                Place the sticker at your checkout counter or service station where clients can easily tap.
                            </MerakiText>
                        </Card>

                        <View style={styles.buttonContainer}>
                            <Button
                                title="Done"
                                onPress={handleClose}
                                fullWidth
                            />
                        </View>
                    </>
                );

            case 'error':
                return (
                    <>
                        <Card style={styles.mainCard}>
                            <View style={[styles.iconCircle, styles.errorCircle]}>
                                <MaterialCommunityIcons name="close-circle" size={48} color={colors.error} />
                            </View>
                            <MerakiText variant="h2" color={colors.error} style={styles.cardTitle}>Pairing Failed</MerakiText>
                            <MerakiText variant="body" color={colors.textSecondary} style={styles.cardDescription}>
                                {errorMessage}
                            </MerakiText>
                        </Card>

                        <View style={styles.buttonContainer}>
                            <Button
                                title="Try Again"
                                onPress={() => setState('ready')}
                                fullWidth
                                style={{ marginBottom: spacing.sm }}
                            />
                            <Button
                                title="Cancel"
                                variant="ghost"
                                onPress={handleClose}
                                fullWidth
                            />
                        </View>
                    </>
                );
        }
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="fullScreen"
            onRequestClose={handleClose}
        >
            <ScreenBackground>
                <SafeAreaView style={styles.container} edges={['top']}>
                    {/* Standardized header with back button */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={handleClose} style={styles.backButton}>
                            <MaterialCommunityIcons name="arrow-left" size={24} color={colors.text} />
                        </TouchableOpacity>
                        <View>
                            <MerakiText variant="h1">Pair NFC Tag</MerakiText>
                            <MerakiText variant="caption" color={colors.textSecondary}>
                                Write your stamp link to a tag
                            </MerakiText>
                        </View>
                    </View>

                    {/* Content */}
                    <View style={styles.content}>
                        {renderContent()}
                    </View>
                </SafeAreaView>
            </ScreenBackground>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        paddingHorizontal: spacing.lg,
        paddingTop: spacing.lg,
        paddingBottom: spacing.md,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(0, 0, 0, 0.04)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.08)',
        marginBottom: spacing.sm,
    },
    content: {
        flex: 1,
        paddingHorizontal: spacing.lg,
        justifyContent: 'center',
    },
    mainCard: {
        padding: spacing.xl,
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    iconCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: 'rgba(200, 160, 77, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.lg,
        borderWidth: 1,
        borderColor: 'rgba(200, 160, 77, 0.2)',
    },
    successCircle: {
        backgroundColor: 'rgba(52, 199, 89, 0.1)',
        borderColor: 'rgba(52, 199, 89, 0.2)',
    },
    errorCircle: {
        backgroundColor: 'rgba(255, 69, 58, 0.1)',
        borderColor: 'rgba(255, 69, 58, 0.2)',
    },
    scanningCircle: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: 'rgba(200, 160, 77, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.lg,
        borderWidth: 1,
        borderColor: 'rgba(200, 160, 77, 0.2)',
    },
    spinner: {
        position: 'absolute',
    },
    cardTitle: {
        marginBottom: spacing.sm,
        textAlign: 'center',
    },
    cardDescription: {
        textAlign: 'center',
        lineHeight: 24,
    },
    requirementsCard: {
        padding: spacing.lg,
        marginBottom: spacing.md,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: spacing.sm,
    },
    requirementItem: {
        marginBottom: spacing.xs,
        paddingLeft: spacing.xs,
    },
    tipCard: {
        padding: spacing.lg,
        marginBottom: spacing.md,
        borderLeftWidth: 3,
        borderLeftColor: colors.accent,
    },
    buttonContainer: {
        paddingVertical: spacing.md,
    },
});

export default NfcPairingModal;
