/**
 * Stripe Service Tests
 * Tests all payment functions — pure helpers run directly, 
 * async functions mock Supabase edge function invocations
 */

// Mock the supabase module before import
const mockInvoke = jest.fn();
jest.mock('../../lib/supabase', () => ({
    __esModule: true,
    get supabase() {
        return {
            functions: {
                invoke: mockInvoke,
            },
        };
    }
}));

import {
    eurosToCents,
    centsToEuros,
    calculatePreAuthAmount,
    formatCardBrand,
    createSetupIntent,
    listPaymentMethods,
    deletePaymentMethod,
    createPaymentIntent,
    capturePayment,
    cancelPaymentIntent,
    handleNoShow,
    processRefund,
    cancelAndRefund,
} from '../stripeService';

beforeEach(() => {
    mockInvoke.mockReset();
});

// ═══════════════════════════════════════════════════════════════════════════
// eurosToCents (Pure Helper)
// ═══════════════════════════════════════════════════════════════════════════
describe('eurosToCents', () => {
    it('converts 10 euros to 1000 cents', () => {
        expect(eurosToCents(10)).toBe(1000);
    });

    it('converts 0 euros to 0 cents', () => {
        expect(eurosToCents(0)).toBe(0);
    });

    it('converts 1.50 euros to 150 cents', () => {
        expect(eurosToCents(1.50)).toBe(150);
    });

    it('converts 0.01 euros to 1 cent', () => {
        expect(eurosToCents(0.01)).toBe(1);
    });

    it('rounds floating point correctly (19.99 → 1999)', () => {
        expect(eurosToCents(19.99)).toBe(1999);
    });

    it('handles tricky floating point: 0.1 + 0.2 → 30', () => {
        expect(eurosToCents(0.1 + 0.2)).toBe(30);
    });

    it('handles negative euros (-10 → -1000)', () => {
        expect(eurosToCents(-10)).toBe(-1000);
    });

    it('handles negative fractional euros (-1.50 → -150)', () => {
        expect(eurosToCents(-1.50)).toBe(-150);
    });

    it('handles extremely small fractional numbers rounding down (0.001 → 0)', () => {
        expect(eurosToCents(0.001)).toBe(0);
    });

    it('handles extremely small fractional numbers rounding up (0.005 → 1)', () => {
        expect(eurosToCents(0.005)).toBe(1);
    });

    it('handles NaN input by returning NaN', () => {
        expect(eurosToCents(NaN)).toBeNaN();
    });

    it('handles precision edge cases like 1.13 and 2.55', () => {
        expect(eurosToCents(1.13)).toBe(113);
        expect(eurosToCents(2.55)).toBe(255);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// centsToEuros (Pure Helper)
// ═══════════════════════════════════════════════════════════════════════════
describe('centsToEuros', () => {
    it('converts 1000 cents to 10 euros', () => {
        expect(centsToEuros(1000)).toBe(10);
    });

    it('converts 0 cents to 0 euros', () => {
        expect(centsToEuros(0)).toBe(0);
    });

    it('converts 150 cents to 1.50 euros', () => {
        expect(centsToEuros(150)).toBe(1.5);
    });

    it('converts 1 cent to 0.01 euros', () => {
        expect(centsToEuros(1)).toBe(0.01);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// calculatePreAuthAmount (Pure Helper)
// ═══════════════════════════════════════════════════════════════════════════
describe('calculatePreAuthAmount', () => {
    it('calculates 100% pre-auth for €50 service', () => {
        expect(calculatePreAuthAmount(50)).toBe(5000);
    });

    it('calculates 50% pre-auth for €50 service', () => {
        expect(calculatePreAuthAmount(50, 50)).toBe(2500);
    });

    it('calculates 25% pre-auth for €100 service', () => {
        expect(calculatePreAuthAmount(100, 25)).toBe(2500);
    });

    it('enforces minimum of 50 cents (€0.50)', () => {
        expect(calculatePreAuthAmount(0.01, 1)).toBe(50);
    });

    it('handles 0 service price with minimum enforcement', () => {
        expect(calculatePreAuthAmount(0)).toBe(50);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// formatCardBrand (Pure Helper)
// ═══════════════════════════════════════════════════════════════════════════
describe('formatCardBrand', () => {
    it('formats visa to Visa', () => {
        expect(formatCardBrand('visa')).toBe('Visa');
    });

    it('formats mastercard to Mastercard', () => {
        expect(formatCardBrand('mastercard')).toBe('Mastercard');
    });

    it('formats amex to American Express', () => {
        expect(formatCardBrand('amex')).toBe('American Express');
    });

    it('formats discover to Discover', () => {
        expect(formatCardBrand('discover')).toBe('Discover');
    });

    it('formats VISA (uppercase) to Visa', () => {
        expect(formatCardBrand('VISA')).toBe('Visa');
    });

    it('returns unknown brand as-is', () => {
        expect(formatCardBrand('unknown_brand')).toBe('unknown_brand');
    });

    it('formats diners to Diners Club', () => {
        expect(formatCardBrand('diners')).toBe('Diners Club');
    });

    it('formats jcb to JCB', () => {
        expect(formatCardBrand('jcb')).toBe('JCB');
    });

    it('formats unionpay to UnionPay', () => {
        expect(formatCardBrand('unionpay')).toBe('UnionPay');
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// createSetupIntent (Async — Mocked)
// ═══════════════════════════════════════════════════════════════════════════
describe('createSetupIntent', () => {
    it('calls setup-intent edge function with correct body', async () => {
        const mockResult = {
            clientSecret: 'seti_secret_123',
            setupIntentId: 'seti_123',
            customerId: 'cus_123',
        };
        mockInvoke.mockResolvedValue({ data: mockResult, error: null });

        const result = await createSetupIntent('user-123', 'test@test.com', 'cus_123');
        expect(mockInvoke).toHaveBeenCalledWith('setup-intent', {
            body: {
                user_id: 'user-123',
                user_email: 'test@test.com',
                customer_id: 'cus_123',
            },
        });
        expect(result).toEqual(mockResult);
    });

    it('throws error when edge function fails', async () => {
        mockInvoke.mockResolvedValue({ data: null, error: new Error('Edge function error') });
        await expect(createSetupIntent('user-123')).rejects.toThrow('Edge function error');
    });

    it('filters out mock customer IDs', async () => {
        mockInvoke.mockResolvedValue({
            data: { clientSecret: 'test', setupIntentId: 'test', customerId: 'cus_real' },
            error: null,
        });
        await createSetupIntent('user-123', undefined, 'cus_mock_12345');
        expect(mockInvoke).toHaveBeenCalledWith('setup-intent', {
            body: {
                user_id: 'user-123',
                user_email: undefined,
                customer_id: undefined, // mock IDs are filtered out
            },
        });
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// listPaymentMethods (Async — Mocked)
// ═══════════════════════════════════════════════════════════════════════════
describe('listPaymentMethods', () => {
    it('returns empty array for null customerId', async () => {
        const result = await listPaymentMethods(null);
        expect(result).toEqual([]);
        expect(mockInvoke).not.toHaveBeenCalled();
    });

    it('returns empty array for undefined customerId', async () => {
        const result = await listPaymentMethods(undefined);
        expect(result).toEqual([]);
    });

    it('returns payment methods from edge function', async () => {
        const mockCards = [
            { id: 'pm_1', brand: 'visa', last4: '4242', expMonth: 12, expYear: 2025 },
        ];
        mockInvoke.mockResolvedValue({ data: { paymentMethods: mockCards }, error: null });

        const result = await listPaymentMethods('cus_123');
        expect(result).toEqual(mockCards);
    });

    it('returns empty array if no paymentMethods in response', async () => {
        mockInvoke.mockResolvedValue({ data: {}, error: null });
        const result = await listPaymentMethods('cus_123');
        expect(result).toEqual([]);
    });

    it('throws on error', async () => {
        mockInvoke.mockResolvedValue({ data: null, error: new Error('Failed') });
        await expect(listPaymentMethods('cus_123')).rejects.toThrow('Failed');
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// deletePaymentMethod (Async — Mocked)
// ═══════════════════════════════════════════════════════════════════════════
describe('deletePaymentMethod', () => {
    it('returns true on success', async () => {
        mockInvoke.mockResolvedValue({ data: { success: true }, error: null });
        const result = await deletePaymentMethod('pm_123');
        expect(result).toBe(true);
    });

    it('calls edge function with correct payment_method_id', async () => {
        mockInvoke.mockResolvedValue({ data: { success: true }, error: null });
        await deletePaymentMethod('pm_test_456');
        expect(mockInvoke).toHaveBeenCalledWith('delete-payment-method', {
            body: { payment_method_id: 'pm_test_456' },
        });
    });

    it('throws on error', async () => {
        mockInvoke.mockResolvedValue({ data: null, error: new Error('Failed') });
        await expect(deletePaymentMethod('pm_123')).rejects.toThrow();
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// createPaymentIntent (Async — Mocked)
// ═══════════════════════════════════════════════════════════════════════════
describe('createPaymentIntent', () => {
    it('creates payment intent with all params', async () => {
        const mockResult = { clientSecret: 'pi_secret', paymentIntentId: 'pi_123' };
        mockInvoke.mockResolvedValue({ data: mockResult, error: null });

        const result = await createPaymentIntent({
            amount: 5000,
            currency: 'eur',
            customerId: 'cus_123',
            appointmentId: 'apt_456',
            paymentMethodId: 'pm_789',
            masterId: 'master_1',
            captureMethod: 'manual',
        });

        expect(result).toEqual(mockResult);
        expect(mockInvoke).toHaveBeenCalledWith('create-payment-intent', {
            body: expect.objectContaining({
                amount: 5000,
                currency: 'eur',
                capture_method: 'manual',
            }),
        });
    });

    it('defaults currency to eur and capture to automatic', async () => {
        mockInvoke.mockResolvedValue({ data: { clientSecret: 'x', paymentIntentId: 'y' }, error: null });
        await createPaymentIntent({ amount: 1000 });

        expect(mockInvoke).toHaveBeenCalledWith('create-payment-intent', {
            body: expect.objectContaining({
                currency: 'eur',
                capture_method: 'automatic',
            }),
        });
    });

    it('throws on error', async () => {
        mockInvoke.mockResolvedValue({ data: null, error: new Error('Failed') });
        await expect(createPaymentIntent({ amount: 500 })).rejects.toThrow();
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// capturePayment (Async — Mocked)
// ═══════════════════════════════════════════════════════════════════════════
describe('capturePayment', () => {
    it('returns true on success', async () => {
        mockInvoke.mockResolvedValue({ data: { success: true }, error: null });
        const result = await capturePayment('pi_123');
        expect(result).toBe(true);
    });

    it('passes optional amount', async () => {
        mockInvoke.mockResolvedValue({ data: { success: true }, error: null });
        await capturePayment('pi_123', 2500);
        expect(mockInvoke).toHaveBeenCalledWith('capture-payment', {
            body: { payment_intent_id: 'pi_123', amount_to_capture: 2500 },
        });
    });

    it('throws on error', async () => {
        mockInvoke.mockResolvedValue({ data: null, error: new Error('Capture failed') });
        await expect(capturePayment('pi_123')).rejects.toThrow();
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// cancelPaymentIntent (Async — Mocked)
// ═══════════════════════════════════════════════════════════════════════════
describe('cancelPaymentIntent', () => {
    it('returns true on success', async () => {
        mockInvoke.mockResolvedValue({ data: { success: true }, error: null });
        const result = await cancelPaymentIntent('pi_123');
        expect(result).toBe(true);
    });

    it('throws on error', async () => {
        mockInvoke.mockResolvedValue({ data: null, error: new Error('Cancel failed') });
        await expect(cancelPaymentIntent('pi_123')).rejects.toThrow();
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// handleNoShow (Async — Mocked)
// ═══════════════════════════════════════════════════════════════════════════
describe('handleNoShow', () => {
    it('returns success with amountCaptured', async () => {
        mockInvoke.mockResolvedValue({
            data: { success: true, amount_captured: 5000 },
            error: null,
        });
        const result = await handleNoShow('apt_123', 'pi_456');
        expect(result).toEqual({ success: true, amountCaptured: 5000 });
    });

    it('sends default 100% fee percentage', async () => {
        mockInvoke.mockResolvedValue({ data: { success: true, amount_captured: 5000 }, error: null });
        await handleNoShow('apt_123', 'pi_456');
        expect(mockInvoke).toHaveBeenCalledWith('handle-no-show', {
            body: {
                appointment_id: 'apt_123',
                payment_intent_id: 'pi_456',
                no_show_fee_percentage: 100,
            },
        });
    });

    it('sends custom fee percentage', async () => {
        mockInvoke.mockResolvedValue({ data: { success: true, amount_captured: 2500 }, error: null });
        await handleNoShow('apt_123', 'pi_456', 50);
        expect(mockInvoke).toHaveBeenCalledWith('handle-no-show', {
            body: expect.objectContaining({
                no_show_fee_percentage: 50,
            }),
        });
    });

    it('throws on error', async () => {
        mockInvoke.mockResolvedValue({ data: null, error: new Error('No-show failed') });
        await expect(handleNoShow('apt_123', 'pi_456')).rejects.toThrow();
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// processRefund (Async — Mocked)
// ═══════════════════════════════════════════════════════════════════════════
describe('processRefund', () => {
    it('returns success with refund details', async () => {
        mockInvoke.mockResolvedValue({
            data: { success: true, refund_id: 're_123', amount: 5000 },
            error: null,
        });
        const result = await processRefund('pi_123');
        expect(result).toEqual({ success: true, refundId: 're_123', amount: 5000 });
    });

    it('sends partial refund amount', async () => {
        mockInvoke.mockResolvedValue({
            data: { success: true, refund_id: 're_123', amount: 2500 },
            error: null,
        });
        await processRefund('pi_123', 2500, 'requested_by_customer');
        expect(mockInvoke).toHaveBeenCalledWith('process-refund', {
            body: {
                payment_intent_id: 'pi_123',
                amount: 2500,
                reason: 'requested_by_customer',
            },
        });
    });

    it('throws on error', async () => {
        mockInvoke.mockResolvedValue({ data: null, error: new Error('Refund failed') });
        await expect(processRefund('pi_123')).rejects.toThrow();
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// cancelAndRefund (Async — Mocked)
// ═══════════════════════════════════════════════════════════════════════════
describe('cancelAndRefund', () => {
    it('returns full result on client cancellation', async () => {
        const mockResult = {
            success: true,
            appointment_id: 'apt_123',
            cancelled_by: 'client',
            is_late_cancellation: false,
            hours_until_appointment: 48,
            refund_percentage: 100,
            original_amount_cents: 5000,
            refund_amount_cents: 5000,
            fee_amount_cents: 0,
            stripe_action: 'full_refund',
            refund_id: 're_123',
            estimated_arrival: '5-10 business days',
            status: 'refunded',
        };
        mockInvoke.mockResolvedValue({ data: mockResult, error: null });

        const result = await cancelAndRefund('apt_123', 'client', 'Changed plans');
        expect(result.success).toBe(true);
        expect(result.refund_percentage).toBe(100);
    });

    it('calls cancel-and-refund edge function', async () => {
        mockInvoke.mockResolvedValue({
            data: { success: true, appointment_id: 'apt_123' },
            error: null,
        });
        await cancelAndRefund('apt_123', 'master', 'Unavailable');
        expect(mockInvoke).toHaveBeenCalledWith('cancel-and-refund', {
            body: {
                appointment_id: 'apt_123',
                cancelled_by: 'master',
                reason: 'Unavailable',
            },
        });
    });

    it('throws on edge function error', async () => {
        mockInvoke.mockResolvedValue({ data: null, error: new Error('Cancel failed') });
        await expect(cancelAndRefund('apt_123', 'client')).rejects.toThrow();
    });

    it('throws on data.error', async () => {
        mockInvoke.mockResolvedValue({
            data: { error: 'Appointment not found' },
            error: null,
        });
        await expect(cancelAndRefund('apt_123', 'client')).rejects.toThrow('Appointment not found');
    });
});
