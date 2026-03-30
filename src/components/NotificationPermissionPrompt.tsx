import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, spacing } from '../theme';

interface NotificationPermissionPromptProps {
    visible: boolean;
    onEnable: () => void;
    onSkip: () => void;
}

/**
 * A branded pre-permission prompt shown before the native iOS notification popup.
 * 
 * On iOS, if a user taps "Don't Allow" on the native popup, you can NEVER ask again.
 * This prompt explains the value of notifications first, so users are more likely to accept.
 * 
 * This component is only relevant on iOS — Android handles permissions differently.
 */
export function NotificationPermissionPrompt({ visible, onEnable, onSkip }: NotificationPermissionPromptProps) {
    // Only show on iOS
    if (Platform.OS !== 'ios') return null;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            statusBarTranslucent
        >
            <View style={styles.overlay}>
                <View style={styles.container}>
                    {/* Icon */}
                    <LinearGradient
                        colors={['rgba(200, 160, 77, 0.2)', 'rgba(200, 160, 77, 0.05)']}
                        style={styles.iconCircle}
                    >
                        <Text style={styles.icon}>🔔</Text>
                    </LinearGradient>

                    {/* Title */}
                    <Text style={styles.title}>Stay in the Loop</Text>

                    {/* Description */}
                    <Text style={styles.description}>
                        Enable notifications to get instant updates about:
                    </Text>

                    {/* Benefits List */}
                    <View style={styles.benefitsList}>
                        <View style={styles.benefitRow}>
                            <Text style={styles.benefitIcon}>📅</Text>
                            <Text style={styles.benefitText}>Appointment reminders & confirmations</Text>
                        </View>
                        <View style={styles.benefitRow}>
                            <Text style={styles.benefitIcon}>💬</Text>
                            <Text style={styles.benefitText}>New messages from your stylist</Text>
                        </View>
                        <View style={styles.benefitRow}>
                            <Text style={styles.benefitIcon}>🎁</Text>
                            <Text style={styles.benefitText}>Exclusive promotions & rewards</Text>
                        </View>
                        <View style={styles.benefitRow}>
                            <Text style={styles.benefitIcon}>✨</Text>
                            <Text style={styles.benefitText}>Aftercare tips for your treatments</Text>
                        </View>
                    </View>

                    {/* Enable Button */}
                    <TouchableOpacity style={styles.enableButton} onPress={onEnable} activeOpacity={0.8}>
                        <LinearGradient
                            colors={['#C8A04D', '#A67C3D']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.enableGradient}
                        >
                            <Text style={styles.enableText}>Enable Notifications</Text>
                        </LinearGradient>
                    </TouchableOpacity>

                    {/* Skip Button */}
                    <TouchableOpacity style={styles.skipButton} onPress={onSkip} activeOpacity={0.7}>
                        <Text style={styles.skipText}>Not Now</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.xl,
    },
    container: {
        backgroundColor: colors.surface,
        borderRadius: 24,
        padding: spacing.xl,
        width: '100%',
        maxWidth: 360,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.06)',
    },
    iconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: spacing.lg,
    },
    icon: {
        fontSize: 40,
    },
    title: {
        fontSize: 22,
        fontWeight: '700',
        color: colors.text,
        marginBottom: spacing.sm,
        textAlign: 'center',
    },
    description: {
        fontSize: 14,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: spacing.lg,
        lineHeight: 20,
    },
    benefitsList: {
        width: '100%',
        marginBottom: spacing.xl,
    },
    benefitRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: spacing.md,
    },
    benefitIcon: {
        fontSize: 20,
        marginRight: spacing.md,
        width: 28,
    },
    benefitText: {
        fontSize: 14,
        color: colors.text,
        flex: 1,
        lineHeight: 20,
    },
    enableButton: {
        width: '100%',
        borderRadius: 14,
        overflow: 'hidden',
        marginBottom: spacing.md,
    },
    enableGradient: {
        paddingVertical: 16,
        alignItems: 'center',
    },
    enableText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
    skipButton: {
        padding: spacing.sm,
    },
    skipText: {
        fontSize: 14,
        color: colors.textMuted,
    },
});

export default NotificationPermissionPrompt;
