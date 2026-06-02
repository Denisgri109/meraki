import { useState, useEffect, useCallback } from 'react';
import { AppState, AppStateStatus, Linking } from 'react-native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useModal } from '../contexts/ModalContext';

export function useStripeConnectGate() {
    const { profile, refreshProfile } = useAuth();
    const { showAlert } = useModal();
    const [loading, setLoading] = useState(false);
    const [checkingStatus, setCheckingStatus] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Only show for masters who haven't completed Connect
    const isConnected = profile?.stripe_connect_status === 'active';
    const isMaster = profile?.role === 'master';
    const shouldShow = isMaster && !isConnected;
    const hasPendingAccount = profile?.stripe_connect_id && profile?.stripe_connect_status === 'pending';

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
                let errorMsg = 'An unknown error occurred';

                // Supabase FunctionsHttpError hides the actual response body
                if (fnError.name === 'FunctionsHttpError' && fnError.context) {
                    try {
                        const contextData = await fnError.context.json();
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
        } catch (err: unknown) {
            const error = err instanceof Error ? err : new Error(String(err));
            const message = error.message || 'Failed to start onboarding. Please try again.';
            showAlert('Onboarding Error', message, 'error');
            setError(message);
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
        } catch (err: unknown) {
            const error = err instanceof Error ? err : new Error(String(err));
            const message = error.message || 'Failed to check status. Please try again.';
            showAlert('Status Check Error', message, 'error');
            setError(message);
        } finally {
            setCheckingStatus(false);
        }
    }, [refreshProfile, showAlert]);

    return {
        shouldShow,
        hasPendingAccount,
        loading,
        checkingStatus,
        error,
        handleStartOnboarding,
        handleCheckStatus,
    };
}
