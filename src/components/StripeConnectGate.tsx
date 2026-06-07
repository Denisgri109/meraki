import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { Button, MerakiText } from './ui';
import { colors, spacing } from '../theme';
import { useStripeConnectGate } from '../hooks';

/**
 * StripeConnectGate — A full-screen blocking modal that prevents masters
 * from using the app until they complete Stripe Connect onboarding.
 * 
 * Cannot be dismissed. The only way past it is to complete Stripe onboarding.
 */
export function StripeConnectGate() {
    const {
        shouldShow,
        hasPendingAccount,
        loading,
        checkingStatus,
        error,
        handleStartOnboarding,
        handleCheckStatus,
    } = useStripeConnectGate();

    if (!shouldShow) return null;

    return (
        <Modal
            visible={true}
            animationType="fade"
            transparent={true}
            statusBarTranslucent={true}
        >
            <View style={styles.overlay}>
                <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />

                <View style={styles.container}>
                    {/* Decorative gradient top bar */}
                    <LinearGradient
                        colors={['#C8A04D', '#E8C86D', '#C8A04D']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.topBar}
                    />

                    {/* Icon */}
                    <View style={styles.iconContainer}>
                        <LinearGradient
                            colors={['rgba(200, 160, 77, 0.3)', 'rgba(200, 160, 77, 0.1)']}
                            style={styles.iconGradient}
                        >
                            <MaterialCommunityIcons
                                name="bank-transfer"
                                size={48}
                                color={colors.primary}
                            />
                        </LinearGradient>
                    </View>

                    {/* Title */}
                    <MerakiText variant="h1" style={styles.title}>
                        Set Up Your Payouts
                    </MerakiText>

                    {/* Description */}
                    <Text style={styles.description}>
                        To start using Merakí and managing your business, you need to connect
                        your bank account. This ensures you receive payments directly from your clients.
                    </Text>

                    {/* Benefits list */}
                    <View style={styles.benefitsContainer}>
                        <View style={styles.benefitRow}>
                            <MaterialCommunityIcons name="check-circle" size={20} color="#10B981" />
                            <Text style={styles.benefitText}>Receive payments directly to your bank</Text>
                        </View>
                        <View style={styles.benefitRow}>
                            <MaterialCommunityIcons name="check-circle" size={20} color="#10B981" />
                            <Text style={styles.benefitText}>100% of your earnings — no platform fees</Text>
                        </View>
                        <View style={styles.benefitRow}>
                            <MaterialCommunityIcons name="check-circle" size={20} color="#10B981" />
                            <Text style={styles.benefitText}>Secure setup powered by Stripe</Text>
                        </View>
                        <View style={styles.benefitRow}>
                            <MaterialCommunityIcons name="check-circle" size={20} color="#10B981" />
                            <Text style={styles.benefitText}>Takes just a few minutes</Text>
                        </View>
                    </View>

                    {/* Error message */}
                    {error && (
                        <View style={styles.errorContainer}>
                            <MaterialCommunityIcons name="alert-circle" size={16} color="#EF4444" />
                            <Text style={styles.errorText}>{error}</Text>
                        </View>
                    )}

                    {/* Action buttons */}
                    <View style={styles.actions}>
                        <Button
                            title={loading ? 'Opening Stripe...' : (hasPendingAccount ? 'Continue Setup' : 'Set Up Payouts')}
                            onPress={handleStartOnboarding}
                            loading={loading}
                            fullWidth
                        />

                        {hasPendingAccount && (
                            <Button
                                title={checkingStatus ? 'Checking...' : 'I\'ve Completed Setup'}
                                onPress={handleCheckStatus}
                                loading={checkingStatus}
                                fullWidth
                                variant="outline"
                            />
                        )}
                    </View>

                    {/* Footer note */}
                    <View style={styles.footer}>
                        <MaterialCommunityIcons name="shield-check" size={14} color={colors.textMuted} />
                        <Text style={styles.footerText}>
                            Your banking information is securely handled by Stripe and never stored by Merakí.
                        </Text>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: spacing.lg,
    },
    container: {
        width: width - 48,
        maxWidth: 400,
        backgroundColor: colors.surface,
        borderRadius: 24,
        padding: spacing.xl,
        borderWidth: 1,
        borderColor: 'rgba(200, 160, 77, 0.2)',
        overflow: 'hidden',
    },
    topBar: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 3,
    },
    iconContainer: {
        alignItems: 'center',
        marginBottom: spacing.lg,
    },
    iconGradient: {
        width: 88,
        height: 88,
        borderRadius: 44,
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        textAlign: 'center',
        marginBottom: spacing.sm,
    },
    description: {
        fontSize: 14,
        lineHeight: 22,
        color: colors.textSecondary,
        textAlign: 'center',
        marginBottom: spacing.lg,
    },
    benefitsContainer: {
        backgroundColor: 'rgba(0, 0, 0, 0.02)',
        borderRadius: 16,
        padding: spacing.md,
        marginBottom: spacing.lg,
        borderWidth: 1,
        borderColor: 'rgba(0, 0, 0, 0.05)',
    },
    benefitRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingVertical: 6,
    },
    benefitText: {
        fontSize: 14,
        color: colors.text,
        flex: 1,
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs,
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        borderRadius: 12,
        padding: spacing.sm,
        marginBottom: spacing.md,
    },
    errorText: {
        fontSize: 13,
        color: '#EF4444',
        flex: 1,
    },
    actions: {
        gap: spacing.sm,
        marginBottom: spacing.md,
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    footerText: {
        fontSize: 11,
        color: colors.textMuted,
        flex: 1,
    },
});

export default StripeConnectGate;
