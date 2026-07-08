import { confirmBooking } from '../bookingService';
import { supabase } from '../../lib/supabase';
import * as stripeService from '../stripeService';

// Mock dependencies
jest.mock('../../lib/supabase', () => {
    const mockSupabase = {
        auth: {
            getSession: jest.fn().mockResolvedValue({
                data: { session: { user: { id: 'user123' } } },
                error: null,
            }),
        },
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        in: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: {}, error: null }),
        rpc: jest.fn().mockResolvedValue({ data: 'appointment123', error: null }),
        functions: {
            invoke: jest.fn(),
        },
    };
    return { supabase: mockSupabase };
});

jest.mock('../stripeService', () => ({
    createSetupIntent: jest.fn().mockResolvedValue({
        clientSecret: 'secret_123',
        setupIntentId: 'si_123',
        customerId: 'cus_123',
    }),
    createPaymentIntent: jest.fn().mockResolvedValue({
        clientSecret: 'pi_secret_123',
        paymentIntentId: 'pi_123',
    }),
    eurosToCents: jest.fn((euros) => euros * 100),
}));

describe('bookingService', () => {
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(() => {
        jest.clearAllMocks();
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        // Setup mock default returns for supabase builder
        (supabase as any).from.mockImplementation((table: string) => {
            if (table === 'appointments') {
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    in: jest.fn().mockResolvedValue({ data: [], error: null }),
                };
            }
            if (table === 'payments') {
                return {
                    insert: jest.fn().mockResolvedValue({ data: {}, error: null }),
                };
            }
            if (table === 'conversations') {
                return {
                    insert: jest.fn().mockReturnThis(),
                    select: jest.fn().mockReturnThis(),
                    single: jest.fn().mockResolvedValue({ data: {}, error: null }),
                };
            }
            return {
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                in: jest.fn().mockResolvedValue({ data: [], error: null }),
                insert: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({ data: {}, error: null }),
            };
        });
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    const defaultParams = {
        user: { id: 'user123' },
        profile: { email: 'test@test.com', stripe_customer_id: 'cus_123' },
        master: { id: 'master123', push_token: 'push_token_123' },
        service: { id: 'service123', name: 'Haircut', category: 'Hair' },
        masterId: 'master123',
        serviceId: 'service123',
        startTime: new Date('2023-10-10T10:00:00Z'),
        amountToPay: 0, // start with 0 to simplify payment logic for basic tests
        showNewCard: false,
        selectedCardId: null,
        confirmSetupIntent: jest.fn().mockResolvedValue({ setupIntent: { paymentMethodId: 'pm_123' } }),
        confirmPayment: jest.fn().mockResolvedValue({}),
    };

    it('should successfully book and return appointmentId', async () => {
        (supabase.functions.invoke as jest.Mock).mockResolvedValue({ data: {}, error: null });

        const appointmentId = await confirmBooking(defaultParams as any);

        expect(appointmentId).toBe('appointment123');
        expect(supabase.functions.invoke).toHaveBeenCalled();
        expect(consoleErrorSpy).not.toHaveBeenCalled();
    });

    it('should catch and log error if sending push notification fails', async () => {
        const mockError = new Error('Network error');
        (supabase.functions.invoke as jest.Mock).mockRejectedValue(mockError);

        const appointmentId = await confirmBooking(defaultParams as any);

        // It should still return the appointmentId despite the push notification error
        expect(appointmentId).toBe('appointment123');

        expect(supabase.functions.invoke).toHaveBeenCalled();
        expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to send booking notification:', mockError);
    });
});
