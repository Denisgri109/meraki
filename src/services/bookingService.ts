import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import {
    createSetupIntent,
    createPaymentIntent,
    eurosToCents,
} from './stripeService';

export interface ConfirmBookingParams {
    user: any;
    profile: any;
    master: any;
    service: any;
    masterId: string;
    serviceId: string;
    startTime: Date;
    amountToPay: number;
    showNewCard: boolean;
    selectedCardId: string | null;
    notes?: string;
    pilatesSessionId?: string;
    appliedCredit?: any;
    confirmSetupIntent: (clientSecret: string, params: any) => Promise<any>;
    confirmPayment: (clientSecret: string, params: any) => Promise<any>;
}

export const confirmBooking = async ({
    user,
    profile,
    master,
    service,
    masterId,
    serviceId,
    startTime,
    amountToPay,
    showNewCard,
    selectedCardId,
    notes,
    pilatesSessionId,
    appliedCredit,
    confirmSetupIntent,
    confirmPayment,
}: ConfirmBookingParams): Promise<string> => {
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

    // Ensure session is fresh before calling Edge Function
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData.session) {
        throw new Error('Session expired. Please log in again.');
    }

    const setupIntentData = await createSetupIntent(
        user?.id || '',
        profile?.email || undefined,
        profile?.stripe_customer_id || undefined
    );

    let savedPaymentMethodId = selectedCardId;
    if (showNewCard && setupIntentData.clientSecret) {
        const setupResult = await confirmSetupIntent(setupIntentData.clientSecret, {
            paymentMethodType: 'Card',
        });

        if (setupResult.error) {
            throw new Error(setupResult.error.message);
        }

        savedPaymentMethodId = setupResult.setupIntent?.paymentMethodId;
    }

    let paymentIntentId: string | undefined;

    if (amountInCents > 0) {
        const { clientSecret, paymentIntentId: pId } = await createPaymentIntent({
            amount: amountInCents,
            customerId: profile?.stripe_customer_id || setupIntentData.customerId,
            paymentMethodId: savedPaymentMethodId || undefined,
            masterId: masterId,
            description: `${service.name} with ${master?.full_name}`,
            captureMethod: 'automatic',
        });
        paymentIntentId = pId;

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
    }

    const { data: appointmentId, error: bookError } = service.category === 'Pilates' && pilatesSessionId
        ? await supabase.rpc('book_pilates_session', {
            p_session_id: pilatesSessionId,
            p_stripe_setup_intent_id: setupIntentData.setupIntentId,
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
                p_stripe_setup_intent_id: setupIntentData.setupIntentId,
                p_stripe_payment_intent_id: (paymentIntentId || null) as any,
                p_notes: notes || undefined,
                p_deposit_amount: amountToPay,
                p_deposit_payment_intent_id: (paymentIntentId || null) as any,
                p_credit_id: appliedCredit?.id || null
            }
        );

    if (bookError) throw bookError;

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

    if (master?.push_token) {
        try {
            await supabase.functions.invoke('send-push-notification', { body: {
                    to: master.push_token,
                    sound: 'default',
                    title: 'New Booking Confirmed ✅',
                    body: `${profile?.full_name || 'A client'} booked ${service.name} on ${format(startTime, 'MMM d')} at ${format(startTime, 'HH:mm')}.`,
                    data: { appointmentId: appointmentId },
                } });
        } catch (e) {
            console.error('Failed to send booking notification:', e);
        }
    }

    return appointmentId;
};
