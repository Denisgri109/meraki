import React, { useEffect, useState } from 'react';
import { Linking } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useModal } from '../contexts/ModalContext';
import { StampSuccessModal } from './loyalty';

interface DeepLinkHandlerProps {
    children: React.ReactNode;
}

export function DeepLinkHandler({ children }: DeepLinkHandlerProps) {
    const navigation = useNavigation();
    const { user, profile } = useAuth();
    const { showModal, hideModal } = useModal();
    const [stampResult, setStampResult] = useState<{
        visible: boolean;
        cardName: string;
        masterName: string;
        stampsCollected: number;
        stampsRequired: number;
        rewardAvailable: boolean;
    }>({
        visible: false,
        cardName: '',
        masterName: '',
        stampsCollected: 0,
        stampsRequired: 0,
        rewardAvailable: false,
    });

    useEffect(() => {
        // Handle deep link when app is opened from a link
        const handleDeepLink = async (event: { url: string }) => {
            await processDeepLink(event.url);
        };

        // Get initial URL if app was opened via deep link
        const getInitialURL = async () => {
            const initialUrl = await Linking.getInitialURL();
            if (initialUrl) {
                await processDeepLink(initialUrl);
            }
        };

        // Add listener for deep links
        const subscription = Linking.addEventListener('url', handleDeepLink);

        // Check for initial URL
        getInitialURL();

        return () => {
            subscription.remove();
        };
    }, [user]);

    const processDeepLink = async (url: string) => {
        try {
            // Parse the URL to validate origin
            const u = new URL(url);
            const isMerakiProtocol = u.protocol === 'meraki:';
            const isMerakiWeb = u.protocol === 'https:' && u.hostname === 'meraki.app';

            if (!isMerakiProtocol && !isMerakiWeb) {
                console.warn('Ignoring deep link from unknown origin:', url);
                return;
            }

            // ── Auth callback (email change confirm, etc.) ──────────────
            // Format: meraki://auth-callback?code=...
            //     or: meraki://auth-callback?token_hash=...&type=email_change
            const isAuthCallback = (isMerakiProtocol && u.host === 'auth-callback') || (isMerakiWeb && u.pathname.includes('auth-callback'));
            if (isAuthCallback) {
                const code = u.searchParams.get('code');
                const tokenHash = u.searchParams.get('token_hash');
                const type = u.searchParams.get('type');

                if (code) {
                    const { error } = await supabase.auth.exchangeCodeForSession(code);
                    if (error) {
                        showModal({
                            title: 'Confirmation failed',
                            message: error.message || 'Could not confirm. Try again or request a new link.',
                            confirmText: 'OK',
                            hideCancel: true,
                            type: 'error',
                            onConfirm: hideModal,
                        });
                    } else {
                        showModal({
                            title: 'Confirmed',
                            message: 'Your email change link has been confirmed. Both old and new email links must be opened to finish the change.',
                            confirmText: 'OK',
                            hideCancel: true,
                            type: 'success',
                            onConfirm: hideModal,
                        });
                    }
                    return;
                }

                if (tokenHash && type) {
                    const { error } = await supabase.auth.verifyOtp({
                        type: type as import('@supabase/supabase-js').EmailOtpType,
                        token_hash: tokenHash,
                    });
                    if (error) {
                        showModal({
                            title: 'Confirmation failed',
                            message: error.message || 'Could not confirm. Try again or request a new link.',
                            confirmText: 'OK',
                            hideCancel: true,
                            type: 'error',
                            onConfirm: hideModal,
                        });
                    } else {
                        showModal({
                            title: 'Confirmed',
                            message: 'Email confirmation processed successfully.',
                            confirmText: 'OK',
                            hideCancel: true,
                            type: 'success',
                            onConfirm: hideModal,
                        });
                    }
                    return;
                }

                console.warn('auth-callback deep link missing code/token_hash');
                return;
            }

            // ── Loyalty stamp scan ──────────────────────────────────────
            // Expected format: meraki://loyalty/stamp?master_id=<master_id>
            const isLoyaltyStamp = (isMerakiProtocol && u.host === 'loyalty' && u.pathname.includes('stamp')) || (isMerakiWeb && u.pathname.includes('loyalty/stamp'));
            if (!isLoyaltyStamp) {
                return; // Not a stamp deep link
            }

            // Extract master_id from URL
            const masterId = u.searchParams.get('master_id');

            if (!masterId) {
                console.error('No master_id in deep link');
                return;
            }

            // Must be logged in as a client
            if (!user) {
                showModal({
                    title: 'Login Required',
                    message: 'Please log in to collect stamps.',
                    confirmText: 'OK',
                    hideCancel: true,
                    type: 'warning',
                    onConfirm: hideModal,
                });
                return;
            }

            // Don't allow masters/owners to collect stamps from themselves
            if (masterId === user.id) {
                showModal({
                    title: 'Cannot Collect',
                    message: 'You cannot collect stamps from yourself.',
                    confirmText: 'OK',
                    hideCancel: true,
                    type: 'error',
                    onConfirm: hideModal,
                });
                return;
            }

            // Call the stamp RPC
            const { data: result, error } = await (supabase as any).rpc('process_stamp_scan', {
                p_master_id: masterId,
                p_client_id: user.id,
            });

            if (error) {
                console.error('Stamp scan error:', error);
                showModal({
                    title: 'Error',
                    message: error.message || 'Failed to collect stamp',
                    confirmText: 'OK',
                    hideCancel: true,
                    type: 'error',
                    onConfirm: hideModal,
                });
                return;
            }

            if (result.success) {
                // Show success modal with animation
                setStampResult({
                    visible: true,
                    cardName: result.card_name,
                    masterName: result.master_name,
                    stampsCollected: result.stamps_collected,
                    stampsRequired: result.stamps_required,
                    rewardAvailable: result.reward_available,
                });
            } else {
                showModal({
                    title: 'Cannot Collect Stamp',
                    message: result.message || 'Unable to process stamp',
                    confirmText: 'OK',
                    hideCancel: true,
                    type: 'warning',
                    onConfirm: hideModal,
                });
            }
        } catch (error: any) {
            console.error('Deep link processing error:', error);
            showModal({
                title: 'Error',
                message: 'Something went wrong while processing the stamp.',
                confirmText: 'OK',
                hideCancel: true,
                type: 'error',
                onConfirm: hideModal,
            });
        }
    };

    const handleSuccessClose = () => {
        setStampResult((prev) => ({ ...prev, visible: false }));
        if (stampResult.rewardAvailable) {
            // Navigate to stamp cards if reward available
            navigation.navigate('StampCards' as never);
        }
    };

    return (
        <>
            {children}
            <StampSuccessModal
                visible={stampResult.visible}
                onClose={handleSuccessClose}
                cardName={stampResult.cardName}
                masterName={stampResult.masterName}
                stampsCollected={stampResult.stampsCollected}
                stampsRequired={stampResult.stampsRequired}
                rewardAvailable={stampResult.rewardAvailable}
            />
        </>
    );
}

export default DeepLinkHandler;
