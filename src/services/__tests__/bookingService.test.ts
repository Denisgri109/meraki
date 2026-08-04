/**
 * bookingService.confirmBooking — Tier 2/4 coverage.
 *
 * THE critical untested orchestrator: slot-guard -> session-check ->
 * setup-intent -> optional card capture -> payment-intent -> booking RPC ->
 * payments row -> conversation insert (idempotent) -> push notification.
 *
 * Every branch is asserted: the exact RPC chosen, exact payload keys,
 * payment-row write only when amount>0, conversation errors swallowed
 * (except codes other than 23505), push only when push_token present.
 */
import { confirmBooking, ConfirmBookingParams } from '../bookingService';
import { supabase } from '../../lib/supabase';
import { createSetupIntent, createPaymentIntent, eurosToCents } from '../stripeService';
import {
    makeBuilder,
    mockUser,
    mockProfile,
    mockMaster,
    mockPilatesService,
    mockBeautyService,
} from '../../__mocks__/merakiData';

jest.mock('../../lib/supabase', () => ({
    supabase: {
        from: jest.fn(),
        rpc: jest.fn(),
        auth: { getSession: jest.fn() },
        functions: { invoke: jest.fn() },
    },
}));

jest.mock('../stripeService', () => ({
    createSetupIntent: jest.fn(),
    createPaymentIntent: jest.fn(),
    eurosToCents: jest.fn((e: number) => Math.round(e * 100)),
}));

const supabaseMock = supabase as unknown as {
    from: jest.Mock;
    rpc: jest.Mock;
    auth: { getSession: jest.Mock };
    functions: { invoke: jest.Mock };
};

const setupOk = {
    clientSecret: 'seti_secret_abc',
    setupIntentId: 'seti_abc',
    customerId: 'cus_abc',
};

const BASE: ConfirmBookingParams = {
    user: mockUser({ id: 'u-1' }),
    profile: mockProfile({ full_name: 'Demo Client', email: 'c@e.ie', stripe_customer_id: 'cus_abc' }),
    master: mockMaster({ id: 'm-1', full_name: 'Demo Master', push_token: 'ExponentPushToken[m]' }),
    service: mockBeautyService({ name: 'Gel Manicure' }),
    masterId: 'm-1',
    serviceId: 's-1',
    startTime: new Date('2026-09-01T10:00:00.000Z'),
    amountToPay: 35,
    showNewCard: false,
    selectedCardId: 'pm_saved_1',
    confirmSetupIntent: jest.fn(),
    confirmPayment: jest.fn(),
};

const freshSession = {
    data: { session: { access_token: 'tok', user: { id: 'u-1' } } },
    error: null,
};

beforeEach(() => {
    jest.resetAllMocks();
    supabaseMock.auth.getSession.mockResolvedValue(freshSession);
    (createSetupIntent as jest.Mock).mockResolvedValue(setupOk);
    (createPaymentIntent as jest.Mock).mockResolvedValue({
        clientSecret: 'pi_secret_1',
        paymentIntentId: 'pi_1',
    });
    (eurosToCents as jest.Mock).mockImplementation((e: number) => Math.round(e * 100));
    supabaseMock.rpc.mockResolvedValue({ data: 'appt-123', error: null });
});

// Guard the from() table dispatcher: appointments slot check -> empty,
// payments insert -> ok, conversations insert -> ok.
function mockTables(overrides: Record<string, ReturnType<typeof makeBuilder>> = {}) {
    const tableBuilders: Record<string, ReturnType<typeof makeBuilder>> = {
        appointments: makeBuilder({ data: [], error: null }),
        payments: makeBuilder({ data: { id: 'pay-1' }, error: null }),
        conversations: makeBuilder({ data: { id: 'conv-1' }, error: null }),
        ...overrides,
    };
    supabaseMock.from.mockImplementation((table: string) => {
        const b = tableBuilders[table];
        if (!b) throw new Error(`unexpected table ${table}`);
        return b;
    });
    return tableBuilders;
}

describe('confirmBooking — routing', () => {
    it('books a Pilates session via book_pilates_session RPC with pilatesSessionId', async () => {
        mockTables();
        (BASE.confirmPayment as jest.Mock).mockResolvedValue({ error: null });

        const id = await confirmBooking({
            ...BASE,
            service: mockPilatesService({ name: 'Reformer' }),
            pilatesSessionId: 'ps-9',
            amountToPay: 0,
        });

        expect(id).toBe('appt-123');
        expect(supabaseMock.rpc).toHaveBeenCalledTimes(1);
        const [fn, args] = supabaseMock.rpc.mock.calls[0];
        expect(fn).toBe('book_pilates_session');
        expect(args).toMatchObject({
            p_session_id: 'ps-9',
            p_stripe_setup_intent_id: 'seti_abc',
            p_stripe_payment_intent_id: null,
            p_deposit_amount: 0,
            p_credit_id: null,
        });
    });

    it('books non-Pilates via book_appointment_with_confirmation with ISO start_time', async () => {
        mockTables();
        (BASE.confirmPayment as jest.Mock).mockResolvedValue({ error: null });

        await confirmBooking(BASE);

        const [fn, args] = supabaseMock.rpc.mock.calls[0];
        expect(fn).toBe('book_appointment_with_confirmation');
        expect(args.p_master_id).toBe('m-1');
        expect(args.p_service_id).toBe('s-1');
        expect(args.p_start_time).toBe('2026-09-01T10:00:00.000Z');
        expect(args.p_stripe_payment_intent_id).toBe('pi_1');
    });

    it('passes appliedCredit.id as p_credit_id on the RPC payload', async () => {
        mockTables();
        (BASE.confirmPayment as jest.Mock).mockResolvedValue({ error: null });

        await confirmBooking({ ...BASE, appliedCredit: { id: 'credit-77' } });

        expect(supabaseMock.rpc.mock.calls[0][1].p_credit_id).toBe('credit-77');
    });
});

describe('confirmBooking — payments branch', () => {
    it('writes a payments row (amount in cents, eur, succeeded) when amount > 0', async () => {
        const t = mockTables();
        (BASE.confirmPayment as jest.Mock).mockResolvedValue({ error: null });

        await confirmBooking(BASE);

        expect(t.payments.insert).toHaveBeenCalledWith(
            expect.objectContaining({
                user_id: 'u-1',
                appointment_id: 'appt-123',
                stripe_payment_intent_id: 'pi_1',
                amount: 3500,
                currency: 'eur',
                status: 'succeeded',
                payment_type: 'booking',
            })
        );
    });

    it('skips payment intent, card confirm, and payments row when amount is 0', async () => {
        const t = mockTables();

        await confirmBooking({ ...BASE, amountToPay: 0 });

        expect(createPaymentIntent).not.toHaveBeenCalled();
        expect(BASE.confirmPayment).not.toHaveBeenCalled();
        expect(t.payments.insert).not.toHaveBeenCalled();
        expect(supabaseMock.rpc).toHaveBeenCalled();
    });

    it('confirms payment with the new card paymentMethodId when showNewCard', async () => {
        mockTables();
        (BASE.confirmSetupIntent as jest.Mock).mockResolvedValue({
            error: null,
            setupIntent: { paymentMethodId: 'pm_new_9' },
        });
        (BASE.confirmPayment as jest.Mock).mockResolvedValue({ error: null });

        await confirmBooking({ ...BASE, showNewCard: true, selectedCardId: null });

        expect(BASE.confirmPayment).toHaveBeenCalledWith('pi_secret_1', {
            paymentMethodType: 'Card',
            paymentMethodData: { paymentMethodId: 'pm_new_9' },
        });
    });

    it('propagates confirmPayment card errors and never books the RPC', async () => {
        mockTables();
        (BASE.confirmPayment as jest.Mock).mockResolvedValue({
            error: { message: 'Your card was declined.' },
        });

        await expect(confirmBooking(BASE)).rejects.toThrow('Your card was declined.');
        expect(supabaseMock.rpc).not.toHaveBeenCalled();
    });

    it('propagates setup-intent card errors', async () => {
        mockTables();
        (BASE.confirmSetupIntent as jest.Mock).mockResolvedValue({
            error: { message: 'Setup failed' },
        });

        await expect(
            confirmBooking({ ...BASE, showNewCard: true })
        ).rejects.toThrow('Setup failed');
        expect(supabaseMock.rpc).not.toHaveBeenCalled();
    });
});

describe('confirmBooking — availability & session guards (Tier 4 chaos)', () => {
    it('rejects double-booking: any active appointment in slot aborts before payment', async () => {
        mockTables({
            appointments: makeBuilder({ data: [{ id: 'appt-existing' }], error: null }),
        });

        await expect(confirmBooking(BASE)).rejects.toThrow(/no longer available/);
        expect(createSetupIntent).not.toHaveBeenCalled();
        expect(supabaseMock.rpc).not.toHaveBeenCalled();
    });

    it('propagates a 500 from the availability check', async () => {
        mockTables({
            appointments: makeBuilder({
                data: null,
                error: { code: '500', message: 'Internal Server Error' },
            }),
        });

        await expect(confirmBooking(BASE)).rejects.toThrow('Could not verify availability.');
    });

    it('skips the availability query entirely for Pilates services (capacity server-side)', async () => {
        const t = mockTables();
        (BASE.confirmPayment as jest.Mock).mockResolvedValue({ error: null });

        await confirmBooking({
            ...BASE,
            service: mockPilatesService(),
            pilatesSessionId: 'ps-1',
        });

        expect(t.appointments.select).not.toHaveBeenCalled();
    });

    it('fails closed when the session is missing (401-equivalent)', async () => {
        supabaseMock.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
        mockTables();

        await expect(confirmBooking(BASE)).rejects.toThrow(/Session expired/);
        expect(supabaseMock.rpc).not.toHaveBeenCalled();
    });

    it('fails closed when getSession itself errors', async () => {
        supabaseMock.auth.getSession.mockResolvedValue({
            data: { session: null },
            error: { message: 'JWT expired' },
        });
        mockTables();

        await expect(confirmBooking(BASE)).rejects.toThrow(/Session expired/);
    });

    it('propagates booking RPC failure (bookError)', async () => {
        mockTables();
        (BASE.confirmPayment as jest.Mock).mockResolvedValue({ error: null });
        supabaseMock.rpc.mockResolvedValue({
            data: null,
            error: { code: 'P0001', message: 'session_full' },
        });

        await expect(
            confirmBooking({ ...BASE, service: mockPilatesService(), pilatesSessionId: 'ps-1' })
        ).rejects.toMatchObject({ code: 'P0001' });
    });
});

describe('confirmBooking — side effects', () => {
    it('inserts a conversation row keyed to (client, master)', async () => {
        const t = mockTables();
        (BASE.confirmPayment as jest.Mock).mockResolvedValue({ error: null });

        await confirmBooking(BASE);

        expect(t.conversations.insert).toHaveBeenCalledWith({
            client_id: 'u-1',
            master_id: 'm-1',
        });
    });

    it('treats conversation 23505 unique-violation as benign (already exists)', async () => {
        mockTables({
            conversations: makeBuilder({
                data: null,
                error: { code: '23505', message: 'duplicate key' },
            }),
        });
        (BASE.confirmPayment as jest.Mock).mockResolvedValue({ error: null });

        const id = await confirmBooking(BASE);
        expect(id).toBe('appt-123');
        // booking succeeded even though conversation insert returned 23505
    });

    it('still succeeds when conversation insert throws an unexpected code (logs only)', async () => {
        mockTables({
            conversations: makeBuilder({
                data: null,
                error: { code: '42P01', message: 'undefined table' },
            }),
        });
        (BASE.confirmPayment as jest.Mock).mockResolvedValue({ error: null });

        await expect(confirmBooking(BASE)).resolves.toBe('appt-123');
    });

    it('invokes send-push-notification edge function when master has push_token', async () => {
        mockTables();
        (BASE.confirmPayment as jest.Mock).mockResolvedValue({ error: null });
        supabaseMock.functions.invoke.mockResolvedValue({ data: {}, error: null });

        await confirmBooking(BASE);

        expect(supabaseMock.functions.invoke).toHaveBeenCalledWith(
            'send-push-notification',
            expect.objectContaining({
                body: expect.objectContaining({
                    to: 'ExponentPushToken[m]',
                    title: expect.stringContaining('New Booking Confirmed'),
                    data: { appointmentId: 'appt-123' },
                }),
            })
        );
    });

    it('does not invoke push edge function when master.push_token is absent', async () => {
        mockTables();
        (BASE.confirmPayment as jest.Mock).mockResolvedValue({ error: null });

        await confirmBooking({ ...BASE, master: mockMaster({ push_token: null }) });

        expect(supabaseMock.functions.invoke).not.toHaveBeenCalled();
    });

    it('swallows push-notification failures without failing the booking', async () => {
        mockTables();
        (BASE.confirmPayment as jest.Mock).mockResolvedValue({ error: null });
        supabaseMock.functions.invoke.mockRejectedValue(new Error('fetch failed'));

        await expect(confirmBooking(BASE)).resolves.toBe('appt-123');
    });
});
