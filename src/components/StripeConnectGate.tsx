import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    ActivityIndicator,
    Linking,
    Dimensions,
    AppState,
    AppStateStatus,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Button, MerakiText } from './ui';
import { colors, spacing } from '../theme';

/**
 * StripeConnectGate — A full-screen blocking modal that prevents masters
 * from using the app until they complete Stripe Connect onboarding.
 * 
 * Cannot be dismissed. The only way past it is to complete Stripe onboarding.
 */
export function StripeConnectGate() {
    const { profile, refreshProfile } = useAuth();
    const [loading, setLoading] = useState(false);
    const [checkingStatus, setCheckingStatus] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Only show for masters who haven't completed Connect
    const isConnected = profile?.stripe_connect_status === 'active';
    const isMaster = profile?.role === 'master';
    const shouldShow = isMaster && !isConnected;

    // Auto-check status when app comes back to foreground (after Stripe onboarding)
    useEffect(() => {
        if (!shouldShow) return;

        const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
            if (state === 'active' && shouldShow) {
                handleCheckStatus();
            }
        });

        return () => subscription.remove();
    }, [shouldShow]);

    const handleStartOnboarding = async () => {
        setLoading(true);
        setError(null);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Not authenticated');

            const { data, error: fnError } = await supabase.functions.invoke(
                'stripe-connect-onboarding',
                {
                    headers: { Authorization: `Bearer ${session.access_token}` },
                }
            );

            if (fnError) {
                console.error('Function error details:', fnError);
                let errorMsg = 'An unknown error occurred';

                // Supabase FunctionsHttpError hides the actual response body
                if (fnError.name === 'FunctionsHttpError' && fnError.context) {
                    try {
                        const contextData = await fnError.context.json();
                        console.error('Extracted context:', contextData);
                        errorMsg = contextData.error || JSON.stringify(contextData);
                        if (contextData.param) {
                            errorMsg += ` (Param: ${contextData.param})`;
                        }
                    } catch (e) {
                        errorMsg = fnError.message;
                    }
                } else {
                    errorMsg = fnError.message || String(fnError);
                }

                throw new Error(errorMsg);
            }
            if (data?.error) throw new Error(data.error);

            if (data?.url) {
                await Linking.openURL(data.url);
            }
        } catch (err: any) {
            console.error('Onboarding error:', err);
            setError(err.message || 'Failed to start onboarding. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleCheckStatus = useCallback(async () => {
        setCheckingStatus(true);
        setError(null);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Not authenticated');

            const { data, error: fnError } = await supabase.functions.invoke(
                'stripe-connect-status',
                {
                    headers: { Authorization: `Bearer ${session.access_token}` },
                }
            );

            if (fnError) throw fnError;
            if (data?.error) throw new Error(data.error);

            // Refresh the profile to pick up the updated stripe_connect_status
            await refreshProfile();
        } catch (err: any) {
            console.error('Status check error:', err);
            setError(err.message || 'Failed to check status. Please try again.');
        } finally {
            setCheckingStatus(false);
        }
    }, [refreshProfile]);

    if (!shouldShow) return null;

    const hasPendingAccount = profile?.stripe_connect_id && profile?.stripe_connect_status === 'pending';

    return (
        <Modal
            visible={true}
            animationType="fade"
            transparent={true}
            statusBarTranslucent={true}
        >
            <View style={styles.overlay}>
                <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />

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
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderRadius: 16,
        padding: spacing.md,
        marginBottom: spacing.lg,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.06)',
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
