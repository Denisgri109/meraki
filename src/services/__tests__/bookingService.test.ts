import { confirmBooking, ConfirmBookingParams } from '../bookingService';
import { supabase } from '../../lib/supabase';
import {
    createSetupIntent,
    createPaymentIntent,
} from '../stripeService';

// Mock dependencies
jest.mock('../../lib/supabase', () => ({
    supabase: {
        auth: {
            getSession: jest.fn(),
        },
        from: jest.fn(),
        rpc: jest.fn(),
        functions: {
            invoke: jest.fn(),
        },
    },
}));

jest.mock('../stripeService', () => ({
    createSetupIntent: jest.fn(),
    createPaymentIntent: jest.fn(),
    eurosToCents: jest.fn((euros: number) => euros * 100),
}));

describe('bookingService', () => {
    let mockParams: ConfirmBookingParams;
    let mockSupabaseFrom: any;

    beforeEach(() => {
        jest.clearAllMocks();

        // Setup base mock responses
        (supabase.auth.getSession as jest.Mock).mockResolvedValue({
            data: { session: { user: { id: 'user-1' } } },
            error: null,
        });

        (createSetupIntent as jest.Mock).mockResolvedValue({
            setupIntentId: 'si_123',
            clientSecret: 'si_secret_123',
            customerId: 'cus_123'
        });

        (createPaymentIntent as jest.Mock).mockResolvedValue({
            paymentIntentId: 'pi_123',
            clientSecret: 'pi_secret_123',
        });

        // Helper to chain Supabase from().select().eq().eq().in()
        mockSupabaseFrom = {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            in: jest.fn().mockResolvedValue({ data: [], error: null }),
            insert: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({ data: { id: 'conv-1' }, error: null }),
        };
        (supabase.from as jest.Mock).mockReturnValue(mockSupabaseFrom);

        (supabase.rpc as jest.Mock).mockResolvedValue({
            data: 'appt_123',
            error: null,
        });

        // Initialize params with happy path default
        mockParams = {
            user: { id: 'user-1' },
            profile: { email: 'test@test.com', stripe_customer_id: 'cus_123', full_name: 'Test User' },
            master: { full_name: 'Master Yoda', push_token: 'token123' },
            service: { name: 'Massage', category: 'Therapy' },
            masterId: 'master-1',
            serviceId: 'service-1',
            startTime: new Date('2024-01-01T10:00:00.000Z'),
            amountToPay: 0,
            showNewCard: false,
            selectedCardId: 'pm_123',
            notes: 'Test note',
            confirmSetupIntent: jest.fn().mockResolvedValue({ setupIntent: { paymentMethodId: 'pm_123' }, error: null }),
            confirmPayment: jest.fn().mockResolvedValue({ paymentIntent: { id: 'pi_123' }, error: null }),
        };
    });

    it('successfully books a regular service with an existing card (amount 0)', async () => {
        const appointmentId = await confirmBooking(mockParams);

        expect(appointmentId).toBe('appt_123');
        // Regular service calls appointments check
        expect(supabase.from).toHaveBeenCalledWith('appointments');
        expect(mockSupabaseFrom.select).toHaveBeenCalledWith('id');
        // Doesn't call createPaymentIntent since amount is 0
        expect(createPaymentIntent).not.toHaveBeenCalled();
        // Calls RPC
        expect(supabase.rpc).toHaveBeenCalledWith('book_appointment_with_confirmation', expect.any(Object));
        // Check successful conversation creation (optional but good to verify it tried)
        expect(supabase.from).toHaveBeenCalledWith('conversations');
    });

    it('successfully books a Pilates service requiring payment with a new card', async () => {
        mockParams.service = { name: 'Pilates Class', category: 'Pilates' };
        mockParams.pilatesSessionId = 'pilates-123';
        mockParams.amountToPay = 50; // 5000 cents
        mockParams.showNewCard = true;

        const appointmentId = await confirmBooking(mockParams);

        expect(appointmentId).toBe('appt_123');

        // Pilates skips availability check (expect 0 calls but could be 1 because of other tables)
        // Check that appointments table wasn't queried
        expect(supabase.from).not.toHaveBeenCalledWith('appointments');

        // Because showNewCard is true and setupIntent has secret, it calls confirmSetupIntent
        expect(mockParams.confirmSetupIntent).toHaveBeenCalledWith('si_secret_123', { paymentMethodType: 'Card' });

        // Because amount > 0, it calls payment intents
        expect(createPaymentIntent).toHaveBeenCalledWith(expect.objectContaining({
            amount: 5000,
        }));
        expect(mockParams.confirmPayment).toHaveBeenCalledWith('pi_secret_123', expect.objectContaining({
            paymentMethodType: 'Card',
        }));

        // Calls Pilates RPC
        expect(supabase.rpc).toHaveBeenCalledWith('book_pilates_session', expect.any(Object));

        // Inserts payment record
        expect(supabase.from).toHaveBeenCalledWith('payments');
        expect(mockSupabaseFrom.insert).toHaveBeenCalledWith(expect.objectContaining({
            amount: 5000,
            appointment_id: 'appt_123'
        }));
    });

    it('fails when time slot is no longer available (regular service)', async () => {
        // Mock existing appointments
        mockSupabaseFrom.in.mockResolvedValueOnce({ data: [{ id: 'existing-1' }], error: null });

        await expect(confirmBooking(mockParams)).rejects.toThrow('This time slot is no longer available. Please choose another time.');
    });

    it('fails when the session is expired', async () => {
        (supabase.auth.getSession as jest.Mock).mockResolvedValueOnce({
            data: { session: null },
            error: new Error('Expired'),
        });

        await expect(confirmBooking(mockParams)).rejects.toThrow('Session expired. Please log in again.');
    });

    it('fails when confirmSetupIntent fails', async () => {
        mockParams.showNewCard = true;
        (mockParams.confirmSetupIntent as jest.Mock).mockResolvedValueOnce({
            error: { message: 'Setup Intent Failed' }
        });

        await expect(confirmBooking(mockParams)).rejects.toThrow('Setup Intent Failed');
    });

    it('fails when confirmPayment fails', async () => {
        mockParams.amountToPay = 50;
        (mockParams.confirmPayment as jest.Mock).mockResolvedValueOnce({
            error: { message: 'Payment Failed' }
        });

        await expect(confirmBooking(mockParams)).rejects.toThrow('Payment Failed');
    });

    it('fails when the booking RPC fails', async () => {
        (supabase.rpc as jest.Mock).mockResolvedValueOnce({
            data: null,
            error: new Error('RPC Failed'),
        });

        await expect(confirmBooking(mockParams)).rejects.toThrow('RPC Failed');
    });

    it('succeeds even if conversation creation or push notification fails', async () => {
        // Make conversation insert fail
        mockSupabaseFrom.single.mockResolvedValueOnce({
            data: null,
            error: { code: 'some-error', message: 'Failed to create conv' }
        });

        // Make push notification fail
        (supabase.functions.invoke as jest.Mock).mockRejectedValueOnce(new Error('Push failed'));

        // Should not throw, should return the appointment ID
        const appointmentId = await confirmBooking(mockParams);
        expect(appointmentId).toBe('appt_123');
    });
});
