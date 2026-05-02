import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    Alert,
    TextInput,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { format, addMinutes } from 'date-fns';
import { useConfirmPayment, useConfirmSetupIntent, CardField } from '../../utils/stripe';
import { supabase } from '../../lib/supabase';
import { safeSupabaseFetch } from '../../lib/supabaseApi';
import { useAuth } from '../../contexts/AuthContext';
import { Button, Card, ScreenBackground, ConfirmModal, AlertModal } from '../../components/ui';
import { colors, spacing } from '../../theme';
import { Service, Profile, Tables } from '../../types/database';
import {
    createPaymentIntent,
    listPaymentMethods,
    eurosToCents,
    formatCardBrand,
    PaymentMethod,
} from '../../services/stripeService';
import { getTimezoneAbbreviation } from '../../utils/timezone';
import { useHideTabBar } from '../../hooks/useHideTabBar';

type BookingStackParamList = {
    BookingMain: undefined;
    ServiceDetail: { serviceId: string };
    SelectDateTime: { serviceId: string; masterId: string };
    BookingConfirm: { serviceId: string; masterId: string; dateTime: string; pilatesSessionId?: string };
};

type BookingConfirmScreenProps = {
    navigation: NativeStackNavigationProp<BookingStackParamList, 'BookingConfirm'>;
    route: RouteProp<BookingStackParamList, 'BookingConfirm'>;
};

type PilatesSettings = Tables<'pilates_settings'>;
type PilatesHost = Tables<'pilates_hosts'>;
type PilatesBooking = Pick<Tables<'pilates_session_bookings'>, 'id' | 'status'>;
type PilatesSession = Tables<'pilates_class_sessions'> & {
    host: PilatesHost | null;
    pilates_session_bookings: PilatesBooking[] | null;
};

export function BookingConfirmScreen({ navigation, route }: BookingConfirmScreenProps) {
    useHideTabBar();
    const { serviceId, masterId, dateTime, pilatesSessionId } = route.params;
    const { user, profile } = useAuth();
    const { confirmPayment } = useConfirmPayment();
    const { confirmSetupIntent } = useConfirmSetupIntent();

    const [service, setService] = useState<Service | null>(null);
    const [master, setMaster] = useState<Profile | null>(null);
    const [masterSettings, setMasterSettings] = useState<any | null>(null);
    const [pilatesSettings, setPilatesSettings] = useState<PilatesSettings | null>(null);
    const [pilatesSession, setPilatesSession] = useState<PilatesSession | null>(null);
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    // Credit state
    const [availableCredits, setAvailableCredits] = useState<any[]>([]);
    const [appliedCredit, setAppliedCredit] = useState<any | null>(null);

    // Payment state
    const [savedCards, setSavedCards] = useState<PaymentMethod[]>([]);
    const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
    const [showNewCard, setShowNewCard] = useState(false);
    const [newCardComplete, setNewCardComplete] = useState(false);

    const [loadingCards, setLoadingCards] = useState(true);

    // Terms of Service state (specialist)
    const [acceptedTOS, setAcceptedTOS] = useState(false);
    const [showTOSModal, setShowTOSModal] = useState(false);

    // App Terms of Service state
    const [acceptedAppTOS, setAcceptedAppTOS] = useState(false);
    const [showAppTOSModal, setShowAppTOSModal] = useState(false);

    // Modal state
    const [modalConfig, setModalConfig] = useState<{
        visible: boolean;
        title: string;
        message: string;
        type: 'success' | 'error' | 'warning' | 'info';
        onConfirm?: () => void;
    }>({
        visible: false,
        title: '',
        message: '',
        type: 'info',
    });

    const startTime = new Date(dateTime);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const servicePromise = supabase.from('services').select('*').eq('id', serviceId).single();
            const masterPromise = supabase.from('profiles').select('*').eq('id', masterId).single();
            const masterSettingsPromise = supabase.from('master_settings').select('*').eq('master_id', masterId).single();

            const [serviceRes, masterRes, masterSettingsRes] = await Promise.all([
                safeSupabaseFetch(servicePromise as any, { timeout: 5000 }),
                safeSupabaseFetch(masterPromise as any, { timeout: 5000 }),
                safeSupabaseFetch(masterSettingsPromise as any, { timeout: 5000 }).catch(() => ({ data: null }))
            ]);

            setService(serviceRes.data as Service);
            setMaster(masterRes.data as Profile);
            if (masterSettingsRes?.data) {
                setMasterSettings(masterSettingsRes.data);
            }

            if ((serviceRes.data as Service)?.category === 'Pilates') {
                const [{ data: pilatesData }, { data: sessionData }] = await Promise.all([
                    supabase
                        .from('pilates_settings')
                        .select('*')
                        .eq('service_id', serviceId)
                        .maybeSingle(),
                    pilatesSessionId
                        ? supabase
                            .from('pilates_class_sessions')
                            .select('*, host:pilates_hosts(*), pilates_session_bookings(id, status)')
                            .eq('id', pilatesSessionId)
                            .maybeSingle()
                        : Promise.resolve({ data: null }),
                ]);

                setPilatesSettings(pilatesData || null);
                setPilatesSession((sessionData as unknown as PilatesSession) || null);
            }

            // Fetch available credits for the user
            if (user) {
                const creditsPromise = (supabase as any)
                    .from('user_credits')
                    .select('*, reward:loyalty_rewards(name)')
                    .eq('user_id', user.id)
                    .eq('is_used', false)
                    .order('created_at', { ascending: false });

                const { data: credits } = await safeSupabaseFetch(creditsPromise, { timeout: 5000 });
                setAvailableCredits((credits as any[]) || []);
            }

            // Fetch saved payment methods
            if (profile?.stripe_customer_id) {
                try {
                    const cards = await listPaymentMethods(profile.stripe_customer_id);
                    setSavedCards(cards);

                    // Get default card from database
                    const { data: dbMethods } = await (supabase as any)
                        .from('payment_methods')
                        .select('stripe_payment_method_id, is_default')
                        .eq('user_id', user?.id)
                        .eq('is_default', true);

                    if (dbMethods?.[0]) {
                        setSelectedCardId(dbMethods[0].stripe_payment_method_id);
                    } else if (cards.length > 0) {
                        setSelectedCardId(cards[0].id);
                    } else {
                        setShowNewCard(true);
                    }
                } catch (error) {
                    console.error('Error fetching cards:', error);
                    setShowNewCard(true);
                }
            } else {
                setShowNewCard(true);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
            setLoadingCards(false);
        }
    };

    const calculateFinalPrice = () => {
        if (!service) return 0;
        let price = service.base_price;
        if (appliedCredit) {
            price = Math.max(0, price - Number(appliedCredit.amount));
        }
        return price;
    };

    const getDiscountAmount = () => {
        if (!appliedCredit || !service) return 0;
        return Math.min(Number(appliedCredit.amount), service.base_price);
    };

    const calculatePayment = () => {
        const total = calculateFinalPrice();
        return {
            amountToPay: total, // Full upfront payment
            remaining: 0,
        };
    };

    const pilatesBookedCount = pilatesSession?.pilates_session_bookings?.filter(item => item.status === 'booked').length || 0;
    const pilatesSpotsLeft = pilatesSession ? Math.max(0, pilatesSession.capacity - pilatesBookedCount) : pilatesSettings?.default_capacity || 0;
    const displayHostName = service?.category === 'Pilates'
        ? pilatesSession?.host?.display_name || master?.full_name
        : master?.full_name;
    const displayDuration = pilatesSession
        ? Math.round((new Date(pilatesSession.ends_at).getTime() - new Date(pilatesSession.starts_at).getTime()) / 60000)
        : service?.duration_minutes;

    const handleConfirmBooking = async () => {
        if (!user || !service) return;

        const finalPrice = calculateFinalPrice();

        // Validate payment method selection
        if (!showNewCard && !selectedCardId) {
            setModalConfig({
                visible: true,
                title: 'Payment Required',
                message: 'Please select a payment method to continue.',
                type: 'warning',
                onConfirm: () => setModalConfig(prev => ({ ...prev, visible: false })),
            });
            return;
        }

        if (showNewCard && !newCardComplete) {
            setModalConfig({
                visible: true,
                title: 'Card Required',
                message: 'Please enter your card details to continue.',
                type: 'warning',
                onConfirm: () => setModalConfig(prev => ({ ...prev, visible: false })),
            });
            return;
        }

        // Validate App Terms of Service (always required)
        if (!acceptedAppTOS) {
            setModalConfig({
                visible: true,
                title: 'Terms of Service',
                message: 'Please accept the Merakí Terms of Service to continue.',
                type: 'warning',
                onConfirm: () => setModalConfig(prev => ({ ...prev, visible: false })),
            });
            return;
        }

        // Validate specialist Terms of Service (only if specialist has set them)
        if (masterSettings?.terms_and_conditions && !acceptedTOS) {
            setModalConfig({
                visible: true,
                title: 'Specialist Terms',
                message: 'Please accept the specialist\'s terms of service to continue.',
                type: 'warning',
                onConfirm: () => setModalConfig(prev => ({ ...prev, visible: false })),
            });
            return;
        }

        setSubmitting(true);
        try {
            const { amountToPay } = calculatePayment();
            const amountInCents = eurosToCents(amountToPay);

            if (service.category !== 'Pilates') {
                const { data: existingAppts, error: checkError } = await (supabase as any)
                    .from('appointments')
                    .select('id')
                    .eq('master_id', masterId)
                    .eq('start_time', startTime.toISOString())
                    .in('status', ['pending', 'confirmed', 'completed']);

                if (checkError) throw new Error('Could not verify availability.');
                if (existingAppts && existingAppts.length > 0) {
                    throw new Error('This time slot is no longer available. Please choose another time.');
                }
            }

            // STEP 1: Create SetupIntent to save card
            console.log('Debug - user:', user);
            console.log('Debug - user.id:', user?.id);
            console.log('Debug - profile:', profile);

            // Ensure session is fresh before calling Edge Function
            const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
            if (sessionError || !sessionData.session) {
                throw new Error('Session expired. Please log in again.');
            }
            console.log('Debug - Session refreshed, token exists:', !!sessionData.session.access_token);

            const requestBody = {
                user_id: user?.id,
                user_email: profile?.email,
                customer_id: profile?.stripe_customer_id,
                payment_method_id: showNewCard ? undefined : selectedCardId,
            };
            console.log('Debug - Sending setup-intent request with body:', requestBody);

            const { data: setupIntentData, error: setupError } = await supabase.functions.invoke('setup-intent', {
                body: requestBody,
            });

            console.log('Debug - setup-intent response:', setupIntentData, setupError);

            if (setupError) throw setupError;

            // STEP 2: Confirm SetupIntent if using a new card
            let savedPaymentMethodId = selectedCardId;
            if (showNewCard && setupIntentData.client_secret) {
                const setupResult = await confirmSetupIntent(setupIntentData.client_secret, {
                    paymentMethodType: 'Card',
                });

                if (setupResult.error) {
                    throw new Error(setupResult.error.message);
                }

                savedPaymentMethodId = setupResult.setupIntent?.paymentMethodId || setupIntentData.payment_method_id;
            }

            // STEP 3: Create PaymentIntent for FULL service price
            let paymentIntentId: string | undefined;

            if (amountInCents > 0) {
                console.log('Debug - Creating PaymentIntent for amount:', amountInCents, 'masterId:', masterId);
                const { clientSecret, paymentIntentId: pId } = await createPaymentIntent({
                    amount: amountInCents,
                    customerId: profile?.stripe_customer_id || setupIntentData.customer_id,
                    paymentMethodId: savedPaymentMethodId || undefined,
                    masterId: masterId,
                    description: `${service.name} with ${master?.full_name}`,
                    captureMethod: 'automatic',
                });
                paymentIntentId = pId;
                console.log('Debug - PaymentIntent created:', paymentIntentId);

                // Confirm the payment
                let paymentResult;
                if (showNewCard) {
                    paymentResult = await confirmPayment(clientSecret, {
                        paymentMethodType: 'Card',
                        paymentMethodData: {
                            paymentMethodId: savedPaymentMethodId!,
                        },
                    });
                } else {
                    paymentResult = await confirmPayment(clientSecret, {
                        paymentMethodType: 'Card',
                        paymentMethodData: {
                            paymentMethodId: selectedCardId!,
                        },
                    });
                }

                if (paymentResult.error) {
                    throw new Error(paymentResult.error.message);
                }
                console.log('Debug - Payment confirmed successfully');
            }

            // STEP 4: Create appointment using the new confirmation flow
            const { data: appointmentId, error: bookError } = service.category === 'Pilates' && pilatesSessionId
                ? await supabase.rpc('book_pilates_session', {
                    p_session_id: pilatesSessionId,
                    p_stripe_setup_intent_id: setupIntentData.setup_intent_id,
                    p_stripe_payment_intent_id: (paymentIntentId || null) as any,
                    p_notes: notes || undefined,
                    p_deposit_amount: amountToPay,
                    p_deposit_payment_intent_id: (paymentIntentId || null) as any,
                    p_credit_id: appliedCredit?.id || null,
                })
                : await supabase.rpc(
                    'book_appointment_with_confirmation',
                    {
                        p_master_id: masterId,
                        p_service_id: serviceId,
                        p_start_time: startTime.toISOString(),
                        p_stripe_setup_intent_id: setupIntentData.setup_intent_id,
                        p_stripe_payment_intent_id: (paymentIntentId || null) as any,
                        p_notes: notes || undefined,
                        p_deposit_amount: amountToPay,
                        p_deposit_payment_intent_id: (paymentIntentId || null) as any,
                        p_credit_id: appliedCredit?.id || null
                    }
                );

            if (bookError) throw bookError;

            // Record the payment in the payments table for Order History
            if (amountInCents > 0) {
                await (supabase as any)
                    .from('payments')
                    .insert({
                        user_id: user.id,
                        appointment_id: appointmentId,
                        stripe_payment_intent_id: paymentIntentId,
                        amount: amountInCents,
                        currency: 'eur',
                        status: 'succeeded',
                        payment_type: 'booking',
                        description: `Booking: ${service?.name || 'Service'} with ${master?.full_name || 'Specialist'}`,
                    });
            }

            // Automatically create a conversation with the master if it doesn't exist
            try {
                const { error: convError } = await (supabase as any)
                    .from('conversations')
                    .insert({
                        client_id: user.id,
                        master_id: masterId,
                    })
                    .select()
                    .single();

                if (convError && convError.code !== '23505') {
                    console.warn('Error creating conversation:', convError);
                }
            } catch (err) {
                console.warn('Failed to auto-create conversation', err);
            }

            // Send push notification to Master about new booking (pending confirmation)
            if (master?.push_token) {
                try {
                    await fetch('https://exp.host/--/api/v2/push/send', {
                        method: 'POST',
                        headers: {
                            'Accept': 'application/json',
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            to: master.push_token,
                            sound: 'default',
                            title: 'New Booking Request 📅',
                            body: `${profile?.full_name || 'A client'} requested ${service.name} on ${format(startTime, 'MMM d')} at ${format(startTime, 'HH:mm')}. Awaiting client confirmation.`,
                            data: { appointmentId: appointmentId },
                        }),
                    });
                } catch (e) {
                    console.error('Failed to send booking notification:', e);
                }
            }

            const discountMsg = appliedCredit ? `\n\n💰 Discount of €${getDiscountAmount().toFixed(2)} applied!` : '';

            setIsSuccess(true);

            setModalConfig({
                visible: true,
                title: 'Request Sent! 📅',
                message: `Your appointment request with ${master?.full_name} has been received!${discountMsg}\n\n📧 You'll receive a confirmation request soon.\n\n💳 Card securely saved for booking.`,
                type: 'success',
                onConfirm: () => {
                    setModalConfig(prev => ({ ...prev, visible: false }));
                    (navigation as any).navigate('Home');
                },
            });

        } catch (error: any) {
            setModalConfig({
                visible: true,
                title: 'Booking Failed',
                message: error.message || 'Something went wrong',
                type: 'error',
                onConfirm: () => setModalConfig(prev => ({ ...prev, visible: false })),
            });
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <ScreenBackground>
                <SafeAreaView style={styles.container}>
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color={colors.text} />
                    </View>
                </SafeAreaView>
            </ScreenBackground>
        );
    }

    return (
        <ScreenBackground>
            <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
                <ScrollView style={styles.scrollView}>
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                            <MaterialIcons name="arrow-back" size={22} color="rgba(0, 0, 0, 0.55)" />
                        </TouchableOpacity>
                        <Text style={styles.title}>Confirm Booking</Text>
                        <Text style={styles.subtitle}>Review your appointment details</Text>
                    </View>

                    {/* Booking Details Card */}
                    <Card style={styles.detailsCard} variant="glass">
                        {/* Service */}
                        <View style={styles.detailRow}>
                            <Text style={styles.detailIcon}>💅</Text>
                            <View style={styles.detailInfo}>
                                <Text style={styles.detailLabel}>Service</Text>
                                <Text style={styles.detailValue}>{service?.name}</Text>
                            </View>
                        </View>

                        {/* Master */}
                        <View style={styles.detailRow}>
                            <Text style={styles.detailIcon}>👤</Text>
                            <View style={styles.detailInfo}>
                                <Text style={styles.detailLabel}>{service?.category === 'Pilates' ? 'Host' : 'Specialist'}</Text>
                                <Text style={styles.detailValue}>{displayHostName}</Text>
                            </View>
                        </View>

                        {/* Date */}
                        <View style={styles.detailRow}>
                            <MaterialIcons name="event" size={16} color={colors.textSecondary} />
                            <View style={styles.detailInfo}>
                                <Text style={styles.detailLabel}>Date</Text>
                                <Text style={styles.detailValue}>
                                    {format(startTime, 'EEEE, MMMM d, yyyy')}
                                </Text>
                            </View>
                        </View>

                        {/* Time */}
                        <View style={styles.detailRow}>
                            <MaterialIcons name="schedule" size={16} color={colors.textSecondary} />
                            <View style={styles.detailInfo}>
                                <Text style={styles.detailLabel}>Time</Text>
                                <View style={styles.timeWithTimezone}>
                                    <Text style={styles.detailValue}>{format(startTime, 'HH:mm')}</Text>
                                    {master?.timezone && (
                                        <Text style={styles.timezoneTag}>
                                            {getTimezoneAbbreviation(master.timezone)}
                                        </Text>
                                    )}
                                </View>
                            </View>
                        </View>

                        {/* Duration */}
                        <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
                            <MaterialIcons name="timer" size={16} color={colors.textSecondary} />
                            <View style={styles.detailInfo}>
                                <Text style={styles.detailLabel}>Duration</Text>
                                <Text style={styles.detailValue}>{displayDuration} minutes</Text>
                            </View>
                        </View>
                    </Card>

                    {service?.category === 'Pilates' && pilatesSettings && (
                        <Card style={styles.pilatesSection} variant="glass">
                            <Text style={styles.sectionLabel}>🧘 Pilates Session</Text>
                            <View style={styles.pilatesRow}>
                                <MaterialIcons name="fitness-center" size={16} color={colors.textSecondary} />
                                <Text style={styles.pilatesText}>{pilatesSession?.level || pilatesSettings.default_level || 'All levels'}</Text>
                            </View>
                            <View style={styles.pilatesRow}>
                                <MaterialIcons name="groups" size={16} color={colors.textSecondary} />
                                <Text style={styles.pilatesText}>{pilatesSpotsLeft} spot{pilatesSpotsLeft === 1 ? '' : 's'} left · {pilatesSession?.capacity || pilatesSettings.default_capacity || 6} total</Text>
                            </View>
                            <View style={styles.pilatesRow}>
                                <MaterialIcons name="inventory-2" size={16} color={colors.textSecondary} />
                                <Text style={styles.pilatesText}>
                                    {pilatesSettings.equipment_provided ? 'Equipment provided' : 'Bring your own equipment'}
                                </Text>
                            </View>
                            {pilatesSettings.require_health_declaration && (
                                <View style={styles.pilatesRow}>
                                    <MaterialIcons name="health-and-safety" size={16} color={colors.textSecondary} />
                                    <Text style={styles.pilatesText}>Health declaration required</Text>
                                </View>
                            )}
                        </Card>
                    )}

                    {/* Notes */}
                    <View style={styles.notesSection}>
                        <Text style={styles.notesLabel}>Add Notes (optional)</Text>
                        <TextInput
                            style={styles.notesInput}
                            placeholder="Any special requests or information..."
                            placeholderTextColor={colors.textMuted}
                            value={notes}
                            onChangeText={setNotes}
                            multiline
                            numberOfLines={3}
                        />
                    </View>

                    {/* App Terms of Service — always required */}
                    <View style={styles.tosSection}>
                        <TouchableOpacity
                            style={[styles.tosCheckboxContainer, acceptedAppTOS && styles.tosCheckboxContainerActive]}
                            onPress={() => setAcceptedAppTOS(!acceptedAppTOS)}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.tosCheckbox, acceptedAppTOS && styles.tosCheckboxActive]}>
                                {acceptedAppTOS && <MaterialIcons name="check" size={16} color="#fff" />}
                            </View>
                            <View style={styles.tosTextContainer}>
                                <Text style={styles.tosText}>I agree to the Merakí{' '}</Text>
                                <TouchableOpacity onPress={() => setShowAppTOSModal(true)}>
                                    <Text style={styles.tosLink}>Terms of Service</Text>
                                </TouchableOpacity>
                                <Text style={styles.tosText}>{' '}& cancellation policy</Text>
                            </View>
                        </TouchableOpacity>
                    </View>

                    {/* Specialist Terms of Service — only if specialist has set them */}
                    {masterSettings?.terms_and_conditions && (
                        <View style={styles.tosSection}>
                            <TouchableOpacity
                                style={[styles.tosCheckboxContainer, acceptedTOS && styles.tosCheckboxContainerActive]}
                                onPress={() => setAcceptedTOS(!acceptedTOS)}
                                activeOpacity={0.7}
                            >
                                <View style={[styles.tosCheckbox, acceptedTOS && styles.tosCheckboxActive]}>
                                    {acceptedTOS && <MaterialIcons name="check" size={16} color="#fff" />}
                                </View>
                                <View style={styles.tosTextContainer}>
                                    <Text style={styles.tosText}>I agree to the specialist's{' '}</Text>
                                    <TouchableOpacity onPress={() => setShowTOSModal(true)}>
                                        <Text style={styles.tosLink}>Terms of Service</Text>
                                    </TouchableOpacity>
                                </View>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Available Credits */}
                    {availableCredits.length > 0 && (
                        <View style={styles.creditsSection}>
                            <Text style={styles.sectionLabel}>🎁 Available Credits</Text>
                            {availableCredits.map((credit) => {
                                const isApplied = appliedCredit?.id === credit.id;
                                return (
                                    <TouchableOpacity
                                        key={credit.id}
                                        style={[
                                            styles.creditCard,
                                            isApplied && styles.creditCardApplied
                                        ]}
                                        onPress={() => setAppliedCredit(isApplied ? null : credit)}
                                    >
                                        <View style={styles.creditInfo}>
                                            <Text style={styles.creditAmount}>€{Number(credit.amount).toFixed(2)} off</Text>
                                            <Text style={styles.creditDesc}>{credit.description || credit.reward?.name}</Text>
                                        </View>
                                        <View style={[styles.creditCheck, isApplied && styles.creditCheckActive]}>
                                            <Text style={styles.creditCheckText}>{isApplied ? "✓" : ""}</Text>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    )}

                    {/* Payment Method Selection */}
                    <View style={styles.paymentSection}>
                        <Text style={styles.sectionLabel}>💳 Payment Method</Text>

                        {loadingCards ? (
                            <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                            <>
                                {/* Saved Cards */}
                                {savedCards.map((card) => (
                                    <TouchableOpacity
                                        key={card.id}
                                        style={[
                                            styles.paymentOption,
                                            selectedCardId === card.id && !showNewCard && styles.paymentOptionSelected
                                        ]}
                                        onPress={() => {
                                            setSelectedCardId(card.id);
                                            setShowNewCard(false);
                                        }}
                                    >
                                        <View style={styles.paymentOptionInfo}>
                                            <Text style={styles.paymentOptionIcon}>💳</Text>
                                            <View>
                                                <Text style={styles.paymentOptionTitle}>
                                                    {formatCardBrand(card.brand)} •••• {card.last4}
                                                </Text>
                                                <Text style={styles.paymentOptionSubtitle}>
                                                    Expires {card.expMonth}/{card.expYear}
                                                </Text>
                                            </View>
                                        </View>
                                        <View style={[
                                            styles.radioOuter,
                                            selectedCardId === card.id && !showNewCard && styles.radioOuterSelected
                                        ]}>
                                            {selectedCardId === card.id && !showNewCard && (
                                                <View style={styles.radioInner} />
                                            )}
                                        </View>
                                    </TouchableOpacity>
                                ))}

                                {/* Add New Card Option */}
                                <TouchableOpacity
                                    style={[
                                        styles.paymentOption,
                                        showNewCard && styles.paymentOptionSelected
                                    ]}
                                    onPress={() => setShowNewCard(true)}
                                >
                                    <View style={styles.paymentOptionInfo}>
                                        <Text style={styles.paymentOptionIcon}>➕</Text>
                                        <Text style={styles.paymentOptionTitle}>Use a new card</Text>
                                    </View>
                                    <View style={[styles.radioOuter, showNewCard && styles.radioOuterSelected]}>
                                        {showNewCard && <View style={styles.radioInner} />}
                                    </View>
                                </TouchableOpacity>

                                {/* New Card Input */}
                                {showNewCard && (
                                    <View style={styles.newCardContainer}>
                                        <CardField
                                            postalCodeEnabled={false}
                                            placeholders={{
                                                number: '4242 4242 4242 4242',
                                            }}
                                            cardStyle={{
                                                backgroundColor: colors.surface,
                                                textColor: colors.text,
                                                placeholderColor: colors.textMuted,
                                                borderWidth: 1,
                                                borderColor: colors.border,
                                                borderRadius: 12,
                                            }}
                                            style={styles.cardField}
                                            onCardChange={(cardDetails: any) => {
                                                setNewCardComplete(cardDetails.complete);
                                            }}
                                        />
                                    </View>
                                )}
                            </>
                        )}

                        {/* Payment Info */}
                        <View style={styles.paymentInfo}>
                            <MaterialIcons name="info-outline" size={16} color={colors.textMuted} />
                            <Text style={styles.paymentInfoText}>
                                {'You will be charged the full service amount at booking.'}
                            </Text>
                        </View>
                    </View>

                    {/* Price Summary */}
                    <Card style={styles.priceSection} variant="glass">
                        <View style={styles.priceRow}>
                            <Text style={styles.priceLabel}>{service?.name}</Text>
                            <Text style={styles.priceValue}>€{service?.base_price}</Text>
                        </View>
                        {appliedCredit && (
                            <View style={styles.priceRow}>
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}><MaterialIcons name="auto-awesome" size={14} color={colors.primary} /><Text style={styles.discountLabel}>Credit Applied</Text></View>
                                <Text style={styles.discountValue}>-€{getDiscountAmount().toFixed(2)}</Text>
                            </View>
                        )}
                        <View style={styles.priceDivider} />
                        <View style={styles.priceRow}>
                            <Text style={styles.totalLabel}>Total to Pay</Text>
                            <Text style={styles.totalValue}>€{calculateFinalPrice().toFixed(2)}</Text>
                        </View>
                    </Card>
                </ScrollView>

                {/* Bottom Button */}
                <View style={styles.bottomBar}>
                    <Button
                        title={submitting || isSuccess ? 'Processing...' : `Pay €${calculateFinalPrice().toFixed(2)} & Confirm`}
                        onPress={handleConfirmBooking}
                        loading={submitting || isSuccess}
                        disabled={submitting || isSuccess}
                        fullWidth
                    />
                </View>

                <AlertModal
                    visible={modalConfig.visible}
                    onClose={() => {
                        if (modalConfig.onConfirm) {
                            modalConfig.onConfirm();
                        } else {
                            setModalConfig(prev => ({ ...prev, visible: false }));
                        }
                    }}
                    title={modalConfig.title}
                    message={modalConfig.message}
                    buttonText={modalConfig.type === 'success' ? 'Done' : 'OK'}
                    type={modalConfig.type}
                />

                {/* Specialist Terms of Service Modal */}
                <AlertModal
                    visible={showTOSModal}
                    onClose={() => setShowTOSModal(false)}
                    title="Specialist Terms of Service"
                    message={masterSettings?.terms_and_conditions || ''}
                    buttonText="Close"
                    type="info"
                />

                {/* App Terms of Service Modal */}
                <AlertModal
                    visible={showAppTOSModal}
                    onClose={() => setShowAppTOSModal(false)}
                    title="Merakí Terms of Service"
                    message={`1. Acceptance of Terms\nBy using the Merakí app, you agree to be bound by these Terms of Service.\n\n2. Services\nMerakí connects clients with professional beauty specialists for appointments, product purchases, and educational content.\n\n3. User Accounts\nYou are responsible for keeping your account credentials secure. Notify us immediately of any unauthorized use.\n\n4. Booking & Cancellations\nCancellations made more than 24 hours before an appointment receive a full refund. Cancellations within 24 hours are subject to a 50% cancellation fee. No-shows will be charged 100% of the service amount.\n\n5. Payments\nAll payments are processed securely via Stripe. Prices are shown in Euros and include applicable taxes unless stated otherwise.\n\n6. Refunds\nRefunds are processed automatically where applicable. Allow 1–10 business days for funds to appear in your account depending on your bank.\n\n7. Intellectual Property\nAll content in the Merakí app is the property of Merakí and protected by applicable laws.\n\n8. Limitation of Liability\nMerakí is not liable for indirect, incidental, or consequential damages arising from your use of our services.\n\n9. Changes to Terms\nWe may update these terms at any time. Continued use constitutes acceptance of the updated terms.\n\n10. Contact\nFor questions: legal@meraki.com`}
                    buttonText="I Understand"
                    type="info"
                />
            </SafeAreaView>
        </ScreenBackground >
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scrollView: {
        flex: 1,
    },
    header: {
        padding: spacing.lg,
    },
    backButton: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.03)',
        borderWidth: 1, borderColor: 'rgba(0, 0, 0, 0.06)',
        alignItems: 'center', justifyContent: 'center',
    },
    title: {
        fontSize: 28,
        fontWeight: '600',
        color: colors.text,
        marginBottom: spacing.xs,
    },
    subtitle: {
        fontSize: 14,
        color: colors.textSecondary,
    },
    detailsCard: {
        margin: spacing.lg,
        padding: spacing.lg,
    },
    detailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    detailIcon: {
        fontSize: 24,
        marginRight: spacing.md,
    },
    detailInfo: {
        flex: 1,
    },
    detailLabel: {
        fontSize: 12,
        color: colors.textMuted,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
        marginBottom: spacing.xs,
    },
    detailValue: {
        fontSize: 16,
        fontWeight: '500',
        color: colors.text,
    },
    notesSection: {
        paddingHorizontal: spacing.lg,
        marginBottom: spacing.lg,
    },
    notesLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: colors.text,
        marginBottom: spacing.sm,
    },
    notesInput: {
        backgroundColor: 'rgba(0, 0, 0, 0.04)',
        borderRadius: 12,
        padding: spacing.md,
        color: colors.text,
        fontSize: 14,
        minHeight: 80,
        textAlignVertical: 'top',
        borderWidth: 1,
        borderColor: colors.border,
    },
    tosSection: {
        paddingHorizontal: spacing.lg,
        marginBottom: spacing.lg,
    },
    tosCheckboxContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.04)',
        padding: spacing.md,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
    },
    tosCheckboxContainerActive: {
        borderColor: colors.primary,
        backgroundColor: 'rgba(200, 160, 77, 0.08)',
    },
    tosCheckbox: {
        width: 24,
        height: 24,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: colors.border,
        marginRight: spacing.md,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tosCheckboxActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    tosTextContainer: {
        flex: 1,
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
    },
    tosText: {
        fontSize: 14,
        color: colors.text,
    },
    tosLink: {
        fontSize: 14,
        color: colors.primary,
        fontWeight: '600',
        textDecorationLine: 'underline',
    },
    sectionLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: colors.text,
        marginBottom: spacing.sm,
    },
    pilatesSection: {
        marginHorizontal: spacing.lg,
        marginBottom: spacing.lg,
        padding: spacing.lg,
        gap: spacing.sm,
    },
    pilatesRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    pilatesText: {
        fontSize: 14,
        color: colors.textSecondary,
        flex: 1,
    },
    creditsSection: {
        paddingHorizontal: spacing.lg,
        marginBottom: spacing.lg,
    },
    creditCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(0, 0, 0, 0.04)',
        borderRadius: 12,
        padding: spacing.md,
        marginBottom: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border,
    },
    creditCardApplied: {
        borderColor: '#22C55E',
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
    },
    creditInfo: {
        flex: 1,
    },
    creditAmount: {
        fontSize: 16,
        fontWeight: '600',
        color: colors.text,
    },
    creditDesc: {
        fontSize: 12,
        color: colors.textSecondary,
        marginTop: 2,
    },
    creditCheck: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    creditCheckActive: {
        backgroundColor: '#22C55E',
        borderColor: '#22C55E',
    },
    creditCheckText: {
        color: '#1A1A1A',
        fontSize: 14,
        fontWeight: '600',
    },
    paymentSection: {
        paddingHorizontal: spacing.lg,
        marginBottom: spacing.lg,
    },
    paymentOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'rgba(0, 0, 0, 0.04)',
        borderRadius: 12,
        padding: spacing.md,
        marginBottom: spacing.sm,
        borderWidth: 1,
        borderColor: colors.border,
    },
    paymentOptionSelected: {
        borderColor: colors.primary,
        backgroundColor: 'rgba(200, 160, 77, 0.1)',
    },
    paymentOptionInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    paymentOptionIcon: {
        fontSize: 20,
        marginRight: spacing.md,
    },
    paymentOptionTitle: {
        fontSize: 14,
        fontWeight: '500',
        color: colors.text,
    },
    paymentOptionSubtitle: {
        fontSize: 12,
        color: colors.textSecondary,
        marginTop: 2,
    },
    radioOuter: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    radioOuterSelected: {
        borderColor: colors.primary,
    },
    radioInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: colors.primary,
    },
    newCardContainer: {
        marginBottom: spacing.md,
    },
    cardField: {
        width: '100%',
        height: 50,
    },
    paymentInfo: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: 'rgba(200, 160, 77, 0.1)',
        padding: spacing.md,
        borderRadius: 12,
        marginTop: spacing.sm,
    },
    paymentInfoIcon: {
        fontSize: 14,
        marginRight: spacing.sm,
        marginTop: 2,
    },
    paymentInfoText: {
        flex: 1,
        fontSize: 12,
        color: colors.textSecondary,
        lineHeight: 18,
    },
    priceSection: {
        margin: spacing.lg,
        padding: spacing.lg,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: colors.border,
    },
    priceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    priceLabel: {
        fontSize: 14,
        color: colors.textSecondary,
    },
    priceValue: {
        fontSize: 14,
        color: colors.text,
    },
    priceDivider: {
        height: 1,
        backgroundColor: colors.border,
        marginVertical: spacing.md,
    },
    totalLabel: {
        fontSize: 18,
        fontWeight: '600',
        color: colors.text,
    },
    totalValue: {
        fontSize: 24,
        fontWeight: '700',
        color: colors.text,
    },
    discountLabel: {
        fontSize: 14,
        color: '#22C55E',
        marginTop: spacing.sm,
    },
    discountValue: {
        fontSize: 14,
        color: '#22C55E',
        fontWeight: '600',
        marginTop: spacing.sm,
    },
    timeWithTimezone: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
    },
    timezoneTag: {
        fontSize: 10,
        color: colors.primary,
        backgroundColor: 'rgba(200, 160, 77, 0.1)',
        paddingHorizontal: spacing.xs,
        paddingVertical: 2,
        borderRadius: 4,
        overflow: 'hidden',
    },
    bottomBar: {
        padding: spacing.lg,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        backgroundColor: 'transparent',
    },
});

export default BookingConfirmScreen;
