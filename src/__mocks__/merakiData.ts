/**
 * Shared Meraki test fixtures & Supabase mock helpers.
 *
 * DRY MOCKS — every new test suite imports from here instead of re-defining
 * chainable builders and data factories. Matches the shape used by
 * src/services/__tests__/qrPayService.test.ts and extends it with:
 *   - a Realtime-channel mock factory for supabase.channel() chains
 *   - deterministic domain factories (user, profile, service, pass, voucher…)
 *
 * Usage:
 *   import { makeBuilder, mockUser, mockMaster, mockPilatesService } from '../../__mocks__/merakiData';
 */

// ---------------------------------------------------------------------------
// Chainable PostgREST builder mock
// ---------------------------------------------------------------------------

export interface MockResult {
    data?: any;
    error?: any;
    count?: number | null;
}

/**
 * Returns a thenable chain. Terminal calls:
 *   .single() / .maybeSingle()                -> promise
 *   .upsert(sel?)/.insert(sel?)/.update(sel?) -> builder (await builder)
 * The builder itself is also a promise resolving to `result`, so
 * `await supabase.from('t').select('*').eq(...)` resolves correctly.
 */
export function makeBuilder(result: MockResult) {
    const promise = Promise.resolve({ count: null, ...result });
    const builder: any = promise;
    builder.select = jest.fn(() => builder);
    builder.insert = jest.fn(() => builder);
    builder.update = jest.fn(() => builder);
    builder.upsert = jest.fn(() => builder);
    builder.delete = jest.fn(() => builder);
    builder.eq = jest.fn(() => builder);
    builder.neq = jest.fn(() => builder);
    builder.in = jest.fn(() => builder);
    builder.is = jest.fn(() => builder);
    builder.gte = jest.fn(() => builder);
    builder.lte = jest.fn(() => builder);
    builder.lt = jest.fn(() => builder);
    builder.gt = jest.fn(() => builder);
    builder.or = jest.fn(() => builder);
    builder.order = jest.fn(() => builder);
    builder.limit = jest.fn(() => builder);
    builder.range = jest.fn(() => builder);
    builder.contains = jest.fn(() => builder);
    builder.ilike = jest.fn(() => builder);
    builder.filter = jest.fn(() => builder);
    builder.single = jest.fn(() => promise);
    builder.maybeSingle = jest.fn(() => promise);
    return builder;
}

/**
 * Full supabase client mock shape. Assign per-test via:
 *   (supabase.from as jest.Mock).mockReturnValue(builder)
 * For functions.invoke/auth channels wire these explicitly.
 */
export function createSupabaseMock() {
    return {
        from: jest.fn(),
        rpc: jest.fn(),
        auth: {
            getSession: jest.fn(),
            getUser: jest.fn(),
            signInWithPassword: jest.fn(),
            signUp: jest.fn(),
            signOut: jest.fn(),
            onAuthStateChange: jest.fn(() => ({
                data: { subscription: { unsubscribe: jest.fn() } },
            })),
        },
        functions: {
            invoke: jest.fn(),
        },
        channel: jest.fn(),
        removeChannel: jest.fn(async () => 'ok'),
        storage: {
            from: jest.fn(() => ({
                upload: jest.fn(),
                getPublicUrl: jest.fn(() => ({ data: { publicUrl: '' } })),
            })),
        },
    };
}

// ---------------------------------------------------------------------------
// Realtime channel mock (chain: supabase.channel(name).on(...).subscribe(cb))
// ---------------------------------------------------------------------------

export interface MockChannel {
    on: jest.Mock;
    subscribe: jest.Mock;
    /** test hook: capture the payload handler passed to .on(...) */
    __lastChangeHandler: (payload: { new: any; old: any }) => void;
    __triggerSubscribe: (status: string) => void;
}

export function makeMockChannel(autoSubscribeStatus = 'SUBSCRIBED'): MockChannel {
    const channel: any = {};
    channel.__lastChangeHandler = undefined as any;
    channel.__triggerSubscribe = undefined as any;
    channel.on = jest.fn((_event: string, _filter: any, handler: any) => {
        channel.__lastChangeHandler = handler;
        return channel;
    });
    channel.subscribe = jest.fn((statusCb?: (status: string) => void) => {
        channel.__triggerSubscribe = (status: string) => statusCb?.(status);
        if (statusCb) statusCb(autoSubscribeStatus);
        return channel;
    });
    return channel as MockChannel;
}

// ---------------------------------------------------------------------------
// Domain factories
// ---------------------------------------------------------------------------

let seq = 0;
const uid = (prefix: string) => `${prefix}-000${++seq}-test-fixture`;

export const mockUser = (overrides: Partial<any> = {}) => ({
    id: uid('user'),
    email: 'client@example.ie',
    aud: 'authenticated',
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
});

export const mockProfile = (overrides: Partial<any> = {}) => ({
    id: uid('profile'),
    full_name: 'Demo Client',
    email: 'client@example.ie',
    role: 'client' as 'client' | 'master' | 'owner',
    stripe_customer_id: 'cus_test_123',
    is_authorized_instructor: false,
    can_view_qr_pay: false,
    marketing_opt_in: false,
    ...overrides,
});

export const mockMaster = (overrides: Partial<any> = {}) => ({
    id: uid('master'),
    full_name: 'Demo Master',
    role: 'master',
    push_token: 'ExponentPushToken[master]',
    latitude: 53.3498,
    longitude: -6.2603,
    country: 'Ireland',
    ...overrides,
});

export const mockBeautyService = (overrides: Partial<any> = {}) => ({
    id: uid('service'),
    name: 'Gel Manicure',
    category: 'Nails',
    price: 35,
    duration_minutes: 60,
    ...overrides,
});

export const mockPilatesService = (overrides: Partial<any> = {}) => ({
    id: uid('service'),
    name: 'Reformer Pilates',
    category: 'Pilates',
    price: 25,
    duration_minutes: 50,
    ...overrides,
});

export const mockCartItem = (overrides: Partial<any> = {}) => ({
    id: uid('prod'),
    name: 'Gua Sha Stone',
    price: 24.99,
    quantity: 1,
    image_url: null,
    stock_count: 10,
    ...overrides,
});

export const mockVoucher = (overrides: Partial<any> = {}) => ({
    id: uid('voucher'),
    code: 'SUMMER25',
    discount_type: 'percentage',
    discount_value: 25,
    is_active: true,
    expires_at: '2999-01-01T00:00:00.000Z',
    benefit_expires_days: 7,
    ...overrides,
});

export const mockUserPass = (overrides: Partial<any> = {}) => ({
    id: uid('pass'),
    user_id: uid('user'),
    package_id: uid('package'),
    credits_remaining: 5,
    credits_total: 8,
    is_active: true,
    expires_at: '2999-01-01T00:00:00.000Z',
    ...overrides,
});

export const mockCreditLedgerEntry = (overrides: Partial<any> = {}) => ({
    id: uid('ledger'),
    user_pass_id: uid('pass'),
    delta_credits: -1,
    reason: 'booking_redeem',
    created_at: '2026-08-01T12:00:00.000Z',
    ...overrides,
});

export const mockQrPayCode = (overrides: Partial<any> = {}) => ({
    id: uid('qr'),
    provider_name: 'Revolut',
    qr_image_url: 'https://cdn.example.ie/qr/revolut.png',
    qr_payload: null,
    is_active: true,
    display_order: 0,
    created_by: uid('owner'),
    ...overrides,
});

export const mockTransaction = (overrides: Partial<any> = {}) => ({
    id: uid('txn'),
    user_id: uid('user'),
    stripe_session_id: 'cs_test_123',
    amount: 2500,
    currency: 'eur',
    status: 'completed' as 'pending' | 'completed' | 'failed',
    product_name: 'Gua Sha Stone',
    product_id: null,
    discount_applied: 0,
    created_at: '2026-08-03T12:00:00.000Z',
    updated_at: '2026-08-03T12:00:01.000Z',
    ...overrides,
});

export const mockPilatesWaiverData = () => ({
    injuriesJointProblems: '',
    pilatesExperience: 'Beginner',
    hasIllnesses: false,
    illnessDetails: '',
    pregnancyStatus: 'not_applicable' as 'yes' | 'no' | 'not_applicable',
    medicationDetails: '',
    exerciseHistory: 'Regular gym',
    practitionerRecommended: false,
    goalsExpectations: 'Core strength',
    hasBoneCondition: false,
    agreedTermsOfUse: true,
    agreedLiabilityWaiver: true,
    emergencyContactName: 'Jane Doe',
    emergencyContactRelationship: 'Sister',
    emergencyContactPhone: '+353871234567',
});

export const mockAppointment = (overrides: Partial<any> = {}) => ({
    id: uid('appt'),
    client_id: uid('user'),
    master_id: uid('master'),
    service_id: uid('service'),
    start_time: '2026-09-01T10:00:00.000Z',
    status: 'confirmed' as 'pending' | 'confirmed' | 'completed' | 'cancelled',
    price: 3500,
    ...overrides,
});
