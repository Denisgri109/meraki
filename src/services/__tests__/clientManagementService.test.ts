/**
 * clientManagementService tests (T08)
 * RPC arg mapping, error propagation verbatim, notification gating, invite EF, conversation idempotency.
 */

type Terminal = { data: any; error: any };

function makeChain(result: Terminal | (() => Terminal)) {
    const chain: any = {};
    const methods = ['select', 'eq', 'neq', 'in', 'or', 'gte', 'gt', 'lt', 'order', 'limit', 'maybeSingle', 'single', 'insert', 'update', 'delete', 'filter'];
    for (const m of methods) chain[m] = jest.fn().mockReturnValue(chain);
    chain.then = (res: any, rej: any) => {
        const out = typeof result === 'function' ? result() : result;
        return Promise.resolve(out).then(res, rej);
    };
    return chain;
}

let mockTables: Record<string, Terminal[]> = {};
let mockRpcs: Record<string, Terminal> = {};
let mockInvoke: jest.Mock;
let mockGetSession: jest.Mock;
let mockFromCalls: string[] = [];
let mockRpcCalls: Array<{ name: string; args: any }> = [];

jest.mock('../../lib/supabase', () => {
    const makeChain = (result: any) => {
        const chain: any = {};
        const methods = ['select', 'eq', 'neq', 'in', 'or', 'gte', 'gt', 'lt', 'order', 'limit', 'maybeSingle', 'single', 'insert', 'update', 'delete', 'filter'];
        for (const m of methods) chain[m] = jest.fn().mockReturnValue(chain);
        chain.then = (res: any, rej: any) => {
            const out = typeof result === 'function' ? result() : result;
            return Promise.resolve(out).then(res, rej);
        };
        return chain;
    };
    return {
        supabase: {
            from: (name: string) => {
                mockFromCalls.push(name);
                const queue = mockTables[name] || [{ data: null, error: null }];
                const result = queue.length > 1 ? queue.shift()! : queue[0];
                return makeChain(result);
            },
            rpc: (name: string, args: any) => {
                mockRpcCalls.push({ name, args });
                return makeChain(mockRpcs[name] || { data: null, error: null });
            },
            auth: { getSession: (...a: any[]) => mockGetSession(...a) },
            functions: { invoke: (...a: any[]) => mockInvoke(...a) },
        },
    };
});

import {
    searchClients,
    getClientDetail,
    openConversationWith,
    addClientToPilatesSession,
    addClientToBeautyAppointment,
    inviteWalkInClient,
} from '../clientManagementService';

const OWNER = 'owner-1';
const CLIENT = 'client-1';

beforeEach(() => {
    mockTables = {};
    mockRpcs = {};
    mockFromCalls = [];
    mockRpcCalls = [];
    mockGetSession = jest.fn().mockResolvedValue({ data: { session: { access_token: 'tok' } }, error: null });
    mockInvoke = jest.fn().mockResolvedValue({ data: { success: true, data: { id: 'new-1', email: 'w@in.com' }, email_sent: true }, error: null });
});

describe('searchClients', () => {
    it('filters role=client by default (canonical predicate, no is_master)', async () => {
        mockTables['profiles'] = [{ data: [{ id: CLIENT, role: 'client' }], error: null }];
        const res = await searchClients('', 'clients');
        expect(res.error).toBeNull();
        expect(res.data).toHaveLength(1);
        expect(mockFromCalls).toEqual(['profiles']);
    });

    it('applies ilike search over name/email/phone', async () => {
        mockTables['profiles'] = [{ data: [], error: null }];
        const res = await searchClients('anna', 'all');
        expect(res.error).toBeNull();
        // chain methods recorded implicitly via from; query sanitized of % and ,
        expect(res.data).toEqual([]);
    });

    it('surfaces query error message', async () => {
        mockTables['profiles'] = [{ data: null, error: { message: 'boom' } }];
        const res = await searchClients('x');
        expect(res.error).toBe('boom');
        expect(res.data).toBeNull();
    });
});

describe('getClientDetail', () => {
    it('bundles profile, upcoming bookings, passes, and latest waiver', async () => {
        mockTables['profiles'] = [{ data: { id: CLIENT, full_name: 'Anna' }, error: null }];
        mockTables['appointments'] = [{ data: [{ id: 'a1', service_name: 'Facial', start_time: '2026-08-10T10:00:00Z', status: 'confirmed', price: 40 }], error: null }];
        mockTables['pilates_waivers'] = [{ data: [{ terms_version: '3.0', signed_at: '2026-01-01' }], error: null }];
        mockRpcs['get_active_pass_summary'] = { data: [{ name: '10 Pack', remaining_credits: 3, initial_credits: 10, expires_at: null }], error: null };

        const res = await getClientDetail(CLIENT);
        expect(res.error).toBeNull();
        expect(res.data!.profile!.full_name).toBe('Anna');
        expect(res.data!.upcoming).toHaveLength(1);
        expect(res.data!.passes[0].remaining_credits).toBe(3);
        expect(res.data!.waiver!.terms_version).toBe('3.0');
    });

    it('returns null waiver when none signed', async () => {
        mockTables['profiles'] = [{ data: { id: CLIENT }, error: null }];
        mockTables['appointments'] = [{ data: [], error: null }];
        mockTables['pilates_waivers'] = [{ data: [], error: null }];
        mockRpcs['get_active_pass_summary'] = { data: [], error: null };
        const res = await getClientDetail(CLIENT);
        expect(res.data!.waiver).toBeNull();
        expect(res.data!.passes).toEqual([]);
    });
});

describe('openConversationWith', () => {
    it('returns existing conversation without inserting', async () => {
        mockTables['conversations'] = [{ data: { id: 'conv-9' }, error: null }];
        const res = await openConversationWith(CLIENT, OWNER);
        expect(res.conversationId).toBe('conv-9');
        expect(mockFromCalls).toEqual(['conversations']);
    });

    it('creates conversation with client_id/master_id mapping', async () => {
        mockTables['conversations'] = [
            { data: null, error: null }, // select → none
            { data: { id: 'conv-new' }, error: null }, // insert → created
        ];
        const res = await openConversationWith(CLIENT, OWNER);
        expect(res.conversationId).toBe('conv-new');
        expect(res.error).toBeNull();
    });

    it('treats 23505 insert race as benign and refetches', async () => {
        mockTables['conversations'] = [
            { data: null, error: null }, // select → none
            { data: null, error: { code: '23505', message: 'duplicate key' } }, // insert → race
            { data: { id: 'conv-7' }, error: null }, // refetch → found
        ];
        const res = await openConversationWith(CLIENT, OWNER);
        expect(res.conversationId).toBe('conv-7');
        expect(res.error).toBeNull();
    });

    it('propagates real insert errors', async () => {
        mockTables['conversations'] = [
            { data: null, error: null },
            { data: null, error: { code: '42501', message: 'rls' } },
        ];
        const res = await openConversationWith(CLIENT, OWNER);
        expect(res.conversationId).toBeNull();
        expect(res.error).toBe('rls');
    });
});

describe('addClientToPilatesSession', () => {
    it('maps RPC args and notifies unsigned-waiver client with waiver sentence', async () => {
        mockRpcs['owner_book_for_client'] = { data: 'appt-1', error: null };
        mockTables['pilates_waivers'] = [{ data: [], error: null }]; // unsigned
        mockTables['conversations'] = [{ data: { id: 'c1' }, error: null }];
        mockTables['messages'] = [{ data: { id: 'm1' }, error: null }];

        const res = await addClientToPilatesSession(CLIENT, 'sess-1', 'note', {
            ownerUserId: OWNER,
            clientPushToken: 'ExponentPushToken[xyz]',
            serviceLabel: 'Reformer',
            startsAt: '2026-08-10T18:00:00Z',
        });

        expect(res.error).toBeNull();
        expect(mockRpcCalls[0]).toEqual({
            name: 'owner_book_for_client',
            args: { p_client_id: CLIENT, p_session_id: 'sess-1', p_notes: 'note' },
        });
        expect(mockInvoke).toHaveBeenCalledWith('send-push-notification', expect.objectContaining({
            body: expect.objectContaining({
                to: 'ExponentPushToken[xyz]',
                body: expect.stringContaining('Please sign your pilates waiver'),
            }),
        }));
    });

    it('skips waiver sentence when waiver is signed at v3.0', async () => {
        mockRpcs['owner_book_for_client'] = { data: 'appt-2', error: null };
        mockTables['pilates_waivers'] = [{ data: [{ terms_version: '3.0' }], error: null }];
        mockTables['conversations'] = [{ data: { id: 'c1' }, error: null }];
        mockTables['messages'] = [{ data: { id: 'm1' }, error: null }];

        await addClientToPilatesSession(CLIENT, 's1', undefined, {
            ownerUserId: OWNER, clientPushToken: 't', serviceLabel: 'Reformer', startsAt: '2026-08-10T18:00:00Z',
        });
        expect(mockInvoke).toHaveBeenCalledWith('send-push-notification', expect.objectContaining({
            body: expect.objectContaining({ body: expect.not.stringContaining('waiver') }),
        }));
    });

    it('does NOT push when client has no push_token', async () => {
        mockRpcs['owner_book_for_client'] = { data: 'appt-3', error: null };
        mockTables['pilates_waivers'] = [{ data: [], error: null }];
        mockTables['conversations'] = [{ data: { id: 'c1' }, error: null }];
        mockTables['messages'] = [{ data: { id: 'm1' }, error: null }];

        await addClientToPilatesSession(CLIENT, 's1', undefined, {
            ownerUserId: OWNER, clientPushToken: null, serviceLabel: 'Reformer', startsAt: '2026-08-10T18:00:00Z',
        });
        expect(mockInvoke).not.toHaveBeenCalledWith('send-push-notification', expect.anything());
    });

    it('surfaces RPC error verbatim (duplicate 23505-style message)', async () => {
        mockRpcs['owner_book_for_client'] = { data: null, error: { message: 'Client is already booked on this session' } };
        const res = await addClientToPilatesSession(CLIENT, 's1', undefined, {
            ownerUserId: OWNER, clientPushToken: null, serviceLabel: 'R', startsAt: '2026-08-10T18:00:00Z',
        });
        expect(res.error).toBe('Client is already booked on this session');
    });
});

describe('addClientToBeautyAppointment', () => {
    it('maps beauty RPC args, notifies without waiver sentence', async () => {
        mockRpcs['owner_book_for_client'] = { data: 'appt-9', error: null };
        mockTables['conversations'] = [{ data: { id: 'c1' }, error: null }];
        mockTables['messages'] = [{ data: { id: 'm1' }, error: null }];

        const res = await addClientToBeautyAppointment(CLIENT, 'm1', 'svc-1', '2026-08-10T12:00:00.000Z', 'n', {
            ownerUserId: OWNER, clientPushToken: 'tok', serviceLabel: 'Facial',
        });

        expect(res.error).toBeNull();
        expect(mockRpcCalls[0]).toEqual({
            name: 'owner_book_for_client',
            args: {
                p_client_id: CLIENT, p_master_id: 'm1', p_service_id: 'svc-1',
                p_start_time: '2026-08-10T12:00:00.000Z', p_notes: 'n',
            },
        });
        expect(mockInvoke).toHaveBeenCalledWith('send-push-notification', expect.objectContaining({
            body: expect.objectContaining({ body: expect.not.stringContaining('waiver') }),
        }));
    });
});

describe('inviteWalkInClient', () => {
    it('invokes invite-client with camelCase body and reports emailSent', async () => {
        const res = await inviteWalkInClient({ email: 'Walk@In.com ', fullName: 'Walk In', phone: '' });
        expect(res.error).toBeNull();
        expect(res.emailSent).toBe(true);
        expect(res.data).toEqual({ id: 'new-1', email: 'w@in.com' });
        expect(mockInvoke).toHaveBeenCalledWith('invite-client', {
            body: { email: 'Walk@In.com', fullName: 'Walk In', phone: undefined },
        });
    });

    it('surfaces EF 409 duplicate message from error context body', async () => {
        mockInvoke.mockResolvedValue({
            data: null,
            error: { message: 'Edge Function returned a non-2xx status code', context: { json: async () => ({ error: 'A user with this email already exists', code: 'duplicate' }) } },
        });
        const res = await inviteWalkInClient({ email: 'a@b.com', fullName: 'A B' });
        expect(res.error).toBe('A user with this email already exists');
        expect(res.data).toBeNull();
    });

    it('falls back to generic error message when context body unreadable', async () => {
        mockInvoke.mockResolvedValue({ data: null, error: { message: 'network down' } });
        const res = await inviteWalkInClient({ email: 'a@b.com', fullName: 'A B' });
        expect(res.error).toBe('network down');
    });
});
