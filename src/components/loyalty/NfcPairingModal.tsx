import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    ActivityIndicator,
    TouchableOpacity,
    Platform,
} from 'react-native';
import NfcManager, { NfcTech, Ndef } from 'react-native-nfc-manager';
import { colors, spacing, borderRadius } from '../../theme';
import { Button } from '../ui';

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

            // Check if NfcManager is available (won't be in Expo Go)
            if (!NfcManager || typeof NfcManager.isSupported !== 'function') {
                setErrorMessage(
                    'NFC is not available. This feature requires a development build (not Expo Go). ' +
                    'Run "npx expo run:android" or create an EAS build to use NFC.'
                );
                setState('error');
                return;
            }

            // Check if NFC is supported
            let isSupported = false;
            try {
                isSupported = await NfcManager.isSupported();
            } catch (e) {
                // isSupported threw - likely Expo Go
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

            // Check if NFC is enabled
            const isEnabled = await NfcManager.isEnabled();
            if (!isEnabled) {
                setErrorMessage('Please enable NFC in your device settings');
                setState('error');
                return;
            }

            // Start NFC session
            await NfcManager.start();
            await NfcManager.requestTechnology(NfcTech.Ndef);

            setState('writing');

            // Create the deep link URL
            const deepLinkUrl = `meraki://loyalty/stamp?master_id=${masterId}`;

            // Create NDEF message with URL record
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

            // Check for common error types
            let message = error?.message || 'Failed to write to NFC tag';

            if (message.includes('null') || message.includes('undefined')) {
                message = 'NFC module not available. Please use a development build instead of Expo Go.';
            }

            setErrorMessage(message);
            setState('error');
        } finally {
            // Clean up NFC session safely
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
                    <View style={styles.content}>
                        <Text style={styles.icon}>📱</Text>
                        <Text style={styles.title}>Pair NFC Tag</Text>
                        <Text style={styles.description}>
                            Write your loyalty stamp link to an NFC sticker.
                            Clients can tap their phone on the sticker to collect stamps instantly!
                        </Text>
                        <View style={styles.instructions}>
                            <Text style={styles.instructionTitle}>Requirements:</Text>
                            <Text style={styles.instructionItem}>• NTAG213, NTAG215, or NTAG216 tag</Text>
                            <Text style={styles.instructionItem}>• Tag must be blank or rewritable</Text>
                        </View>
                        <Button
                            title="Start Pairing"
                            onPress={startNfcPairing}
                            style={styles.button}
                        />
                        <Button
                            title="Cancel"
                            variant="ghost"
                            onPress={handleClose}
                            style={styles.cancelButton}
                        />
                    </View>
                );

            case 'scanning':
            case 'writing':
                return (
                    <View style={styles.content}>
                        <View style={styles.scanningAnimation}>
                            <Text style={styles.icon}>📡</Text>
                            <ActivityIndicator size="large" color={colors.primary} style={styles.spinner} />
                        </View>
                        <Text style={styles.title}>
                            {state === 'scanning' ? 'Ready to Scan' : 'Writing...'}
                        </Text>
                        <Text style={styles.description}>
                            Hold your phone near the NFC sticker to pair
                        </Text>
                        <Button
                            title="Cancel"
                            variant="outline"
                            onPress={handleClose}
                            style={styles.cancelButton}
                        />
                    </View>
                );

            case 'success':
                return (
                    <View style={styles.content}>
                        <Text style={styles.successIcon}>✅</Text>
                        <Text style={styles.successTitle}>Tag Paired!</Text>
                        <Text style={styles.description}>
                            Your NFC sticker is now ready. Clients can tap their phones on it to collect stamps automatically.
                        </Text>
                        <View style={styles.tipBox}>
                            <Text style={styles.tipTitle}>💡 Pro Tip</Text>
                            <Text style={styles.tipText}>
                                Place the sticker at your checkout counter or service station where clients can easily tap.
                            </Text>
                        </View>
                        <Button
                            title="Done"
                            onPress={handleClose}
                            style={styles.button}
                        />
                    </View>
                );

            case 'error':
                return (
                    <View style={styles.content}>
                        <Text style={styles.errorIcon}>❌</Text>
                        <Text style={styles.errorTitle}>Pairing Failed</Text>
                        <Text style={styles.errorDescription}>{errorMessage}</Text>
                        <Button
                            title="Try Again"
                            onPress={() => setState('ready')}
                            style={styles.button}
                        />
                        <Button
                            title="Cancel"
                            variant="ghost"
                            onPress={handleClose}
                            style={styles.cancelButton}
                        />
                    </View>
                );
        }
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={handleClose}
        >
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                        <Text style={styles.closeButtonText}>✕</Text>
                    </TouchableOpacity>
                </View>
                {renderContent()}
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        padding: spacing.md,
    },
    closeButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeButtonText: {
        fontSize: 20,
        color: colors.textSecondary,
    },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: spacing.xl,
    },
    icon: {
        fontSize: 64,
        marginBottom: spacing.lg,
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: colors.text,
        marginBottom: spacing.md,
        textAlign: 'center',
    },
    description: {
        fontSize: 16,
        color: colors.textSecondary,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: spacing.xl,
    },
    instructions: {
        backgroundColor: colors.surface,
        padding: spacing.lg,
        borderRadius: borderRadius.lg,
        width: '100%',
        marginBottom: spacing.xl,
    },
    instructionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text,
        marginBottom: spacing.sm,
    },
    instructionItem: {
        fontSize: 14,
        color: colors.textSecondary,
        marginBottom: spacing.xs,
    },
    button: {
        width: '100%',
        marginBottom: spacing.md,
    },
    cancelButton: {
        width: '100%',
    },
    scanningAnimation: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: `${colors.primary}20`,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.lg,
    },
    spinner: {
        position: 'absolute',
    },
    successIcon: {
        fontSize: 72,
        marginBottom: spacing.lg,
    },
    successTitle: {
        fontSize: 28,
        fontWeight: '700',
        color: colors.success,
        marginBottom: spacing.md,
    },
    tipBox: {
        backgroundColor: `${colors.primary}15`,
        padding: spacing.lg,
        borderRadius: borderRadius.lg,
        width: '100%',
        marginBottom: spacing.xl,
        borderLeftWidth: 4,
        borderLeftColor: colors.primary,
    },
    tipTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.primary,
        marginBottom: spacing.xs,
    },
    tipText: {
        fontSize: 14,
        color: colors.textSecondary,
        lineHeight: 20,
    },
    errorIcon: {
        fontSize: 72,
        marginBottom: spacing.lg,
    },
    errorTitle: {
        fontSize: 28,
        fontWeight: '700',
        color: colors.error,
        marginBottom: spacing.md,
    },
    errorDescription: {
        fontSize: 16,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: spacing.xl,
    },
});

export default NfcPairingModal;
