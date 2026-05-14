// Stripe Payment Service
// Handles all Stripe-related operations for the Merakí app

import { supabase } from '../lib/supabase';

// ============================================
// TYPES
// ============================================

export interface PaymentMethod {
    id: string;
    brand: string;
    last4: string;
    expMonth: number;
    expYear: number;
    isDefault?: boolean;
}

export interface PaymentIntentResult {
    clientSecret: string;
    paymentIntentId: string;
}

export interface SetupIntentResult {
    clientSecret: string;
    setupIntentId: string;
    customerId: string;
}

interface CreatePaymentIntentParams {
    amount: number; // In cents
    currency?: string;
    customerId?: string;
    appointmentId?: string;
    orderId?: string;
    paymentMethodId?: string;
    masterId?: string; // ID of the master performing the service for destination routing
    description?: string;
    captureMethod?: 'manual' | 'automatic';
}

const SIMULATION_MODE = false; // Disabled - use real Stripe integration

// Helper to simulate delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ... existing code ...

// ============================================
// SETUP INTENT (For saving payment methods)
// ============================================

/**
 * Create a SetupIntent for securely saving a card
 */
export async function createSetupIntent(userId: string, userEmail?: string, customerId?: string): Promise<SetupIntentResult> {
    if (SIMULATION_MODE) {
        await delay(500);
        return {
            clientSecret: 'seti_mock_secret_' + Math.random().toString(36).substr(2, 9),
            setupIntentId: 'seti_mock_' + Math.random().toString(36).substr(2, 9),
            customerId: customerId || 'cus_mock_' + Math.random().toString(36).substr(2, 9),
        };
    }

    // Filter out mock customer IDs from simulation mode - don't send them to the real Stripe API
    const realCustomerId = customerId && !customerId.startsWith('cus_mock_') ? customerId : undefined;

    const { data, error } = await supabase.functions.invoke('setup-intent', {
        body: {
            user_id: userId,
            user_email: userEmail,
            customer_id: realCustomerId,
        },
    });

    if (error) throw error;
    return data;
}

// ============================================
// PAYMENT METHODS
// ============================================

/**
 * List saved payment methods for a customer
 */
export async function listPaymentMethods(customerId: string | null | undefined): Promise<PaymentMethod[]> {
    // Return empty array if no customer ID (new user without Stripe setup)
    if (!customerId) {
        return [];
    }

    if (SIMULATION_MODE) {
        // Return a mock card if in simulation mode
        await delay(500);
        return [{
            id: 'pm_mock_visa',
            brand: 'visa',
            last4: '4242',
            expMonth: 12,
            expYear: 2025,
            isDefault: true,
        }];
    }

    const { data, error } = await supabase.functions.invoke('list-payment-methods', {
        body: {
            customer_id: customerId,
        },
    });

    if (error) throw error;
    return data.paymentMethods || [];
}

/**
 * Delete a saved payment method
 */
export async function deletePaymentMethod(paymentMethodId: string): Promise<boolean> {
    if (SIMULATION_MODE) return true;

    const { data, error } = await supabase.functions.invoke('delete-payment-method', {
        body: {
            payment_method_id: paymentMethodId,
        },
    });

    if (error) throw error;
    return data.success;
}

// ============================================
// PAYMENT INTENTS
// ============================================

/**
 * Create a PaymentIntent for charging a customer
 * Use captureMethod: 'manual' for pre-authorization (holds)
 * Use captureMethod: 'automatic' for immediate charge
 */
export async function createPaymentIntent(params: CreatePaymentIntentParams): Promise<PaymentIntentResult> {
    if (SIMULATION_MODE) {
        await delay(1000);
        return {
            clientSecret: 'pi_mock_secret_' + Math.random().toString(36).substr(2, 9),
            paymentIntentId: 'pi_mock_' + Math.random().toString(36).substr(2, 9),
        };
    }

    const { data, error } = await supabase.functions.invoke('create-payment-intent', {
        body: {
            amount: params.amount,
            currency: params.currency || 'eur',
            customer_id: params.customerId,
            appointment_id: params.appointmentId,
            order_id: params.orderId,
            payment_method_id: params.paymentMethodId,
            master_id: params.masterId,
            description: params.description || 'Merakí Payment',
            capture_method: params.captureMethod || 'automatic',
        },
    });

    if (error) throw error;
    return data;
}

/**
 * Capture a previously held payment (after service completion)
 */
export async function capturePayment(paymentIntentId: string, amount?: number): Promise<boolean> {
    const { data, error } = await supabase.functions.invoke('capture-payment', {
        body: {
            payment_intent_id: paymentIntentId,
            amount_to_capture: amount,
        },
    });

    if (error) throw error;
    return data.success;
}

/**
 * Cancel a payment hold (release funds back to customer)
 */
export async function cancelPaymentIntent(paymentIntentId: string): Promise<boolean> {
    const { data, error } = await supabase.functions.invoke('cancel-payment', {
        body: {
            payment_intent_id: paymentIntentId,
        },
    });

    if (error) throw error;
    return data.success;
}

// ============================================
// NO-SHOW HANDLING
// ============================================

/**
 * Handle no-show: capture the pre-auth as a no-show fee
 * @param appointmentId - The appointment ID
 * @param paymentIntentId - The payment intent ID to capture
 * @param feePercentage - Percentage of the hold to capture (default: 100%)
 */
export async function handleNoShow(
    appointmentId: string,
    paymentIntentId: string,
    feePercentage: number = 100
): Promise<{ success: boolean; amountCaptured: number }> {
    const { data, error } = await supabase.functions.invoke('handle-no-show', {
        body: {
            appointment_id: appointmentId,
            payment_intent_id: paymentIntentId,
            no_show_fee_percentage: feePercentage,
        },
    });

    if (error) throw error;
    return {
        success: data.success,
        amountCaptured: data.amount_captured,
    };
}

// ============================================
// REFUNDS
// ============================================

/**
 * Process a refund for a payment
 * @param paymentIntentId - The payment intent to refund
 * @param amount - Optional: amount to refund in cents (partial refund)
 * @param reason - Optional: reason for the refund
 */
export async function processRefund(
    paymentIntentId: string,
    amount?: number,
    reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer'
): Promise<{ success: boolean; refundId: string; amount: number }> {
    const { data, error } = await supabase.functions.invoke('process-refund', {
        body: {
            payment_intent_id: paymentIntentId,
            amount,
            reason,
        },
    });

    if (error) throw error;
    return {
        success: data.success,
        refundId: data.refund_id,
        amount: data.amount,
    };
}

// ============================================
// HELPERS
// ============================================

/**
 * Calculate amount in cents from euros
 */
export function eurosToCents(euros: number): number {
    return Math.round(euros * 100);
}

/**
 * Calculate euros from cents
 */
export function centsToEuros(cents: number): number {
    return cents / 100;
}

/**
 * Get the pre-auth amount for a service (configurable percentage)
 * Default: 100% of service price for full protection
 */
export function calculatePreAuthAmount(servicePrice: number, percentage: number = 100): number {
    const holdAmount = Math.round(servicePrice * 100 * (percentage / 100));
    return Math.max(50, holdAmount); // Minimum €0.50 for Stripe
}

/**
 * Format card brand for display
 */
export function formatCardBrand(brand: string): string {
    const brands: Record<string, string> = {
        visa: 'Visa',
        mastercard: 'Mastercard',
        amex: 'American Express',
        discover: 'Discover',
        diners: 'Diners Club',
        jcb: 'JCB',
        unionpay: 'UnionPay',
    };
    return brands[brand.toLowerCase()] || brand;
}

// ============================================
// CANCEL & REFUND (Unified)
// ============================================

export interface CancelAndRefundResult {
    success: boolean;
    appointment_id: string;
    cancelled_by: 'client' | 'master';
    is_late_cancellation: boolean;
    hours_until_appointment: number;
    refund_percentage: number;
    original_amount_cents: number;
    refund_amount_cents: number;
    fee_amount_cents: number;
    stripe_action: 'cancelled' | 'partial_capture' | 'full_refund' | 'partial_refund' | 'no_payment';
    refund_id: string | null;
    estimated_arrival: string;
    status: string;
}

/**
 * Cancel an appointment and process the appropriate refund.
 * Backend handles all time calculations and Stripe logic securely.
 *
 * - Client cancels > 24hrs → 100% refund
 * - Client cancels < 24hrs → 50% refund (late cancellation fee)
 * - Master cancels → always 100% refund
 */
export async function cancelAndRefund(
    appointmentId: string,
    cancelledBy: 'client' | 'master',
    reason?: string,
): Promise<CancelAndRefundResult> {
    const { data, error } = await supabase.functions.invoke('cancel-and-refund', {
        body: {
            appointment_id: appointmentId,
            cancelled_by: cancelledBy,
            reason,
        },
    });

    if (error) {
        console.error("Edge function error object:", error);
        
        // Supabase `FunctionsHttpError` contains the raw Response in `context`
        // We can extract the real JSON error body to show to the user.
        if (error.context && typeof error.context.json === 'function') {
            try {
                // We need to clone it because the body might already be read, or just read it natively
                const errData = await error.context.json();
                if (errData && errData.error) {
                    throw new Error(errData.error);
                }
            } catch (jsonErr) {
                console.error("Failed to parse edge function error JSON", jsonErr);
            }
        }
        
        throw error;
    }

    if (data?.error) throw new Error(data.error);
    return data as CancelAndRefundResult;
}

export default {
    // Setup Intent
    createSetupIntent,
    // Payment Methods
    listPaymentMethods,
    deletePaymentMethod,
    // Payment Intents
    createPaymentIntent,
    capturePayment,
    cancelPaymentIntent,
    // No-Show
    handleNoShow,
    // Refunds
    processRefund,
    cancelAndRefund,
    // Helpers
    eurosToCents,
    centsToEuros,
    calculatePreAuthAmount,
    formatCardBrand,
};
