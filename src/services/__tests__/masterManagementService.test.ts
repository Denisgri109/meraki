/**
 * Master Management Service Tests
 * Tests all CRUD operations for managing masters
 */

// Mock supabase
const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockOrder = jest.fn();
const mockInsert = jest.fn();
const mockUpdate = jest.fn();
const mockSingle = jest.fn();

const createChainMock = () => {
    const chain: any = {};
    chain.select = jest.fn().mockReturnValue(chain);
    chain.eq = jest.fn().mockReturnValue(chain);
    chain.order = jest.fn().mockReturnValue(chain);
    chain.insert = jest.fn().mockReturnValue(chain);
    chain.update = jest.fn().mockReturnValue(chain);
    chain.single = jest.fn().mockReturnValue(chain);
    // Final resolution
    chain.then = undefined; // Will be set per-test
    return chain;
};

let mockChain: any;
let mockFromFn: jest.Mock;
let mockGetSession: jest.Mock;
let mockInvoke: jest.Mock;

jest.mock('../../lib/supabase', () => ({
    supabase: {
        from: (...args: any[]) => mockFromFn(...args),
        auth: { getSession: (...args: any[]) => mockGetSession(...args) },
        functions: { invoke: (...args: any[]) => mockInvoke(...args) },
    },
}));

jest.mock('../../lib/supabaseApi', () => ({
    safeSupabaseFetch: jest.fn((promise: any) => promise),
}));

import {
    fetchActiveMasters,
    fetchPendingMasters,
    fetchMasterApplications,
    inviteMaster,
    updateMasterProfile,
    deactivateMaster,
    reactivateMaster,
    fetchMasterCounts,
} from '../masterManagementService';

beforeEach(() => {
    jest.clearAllMocks();
    mockChain = createChainMock();
    mockFromFn = jest.fn().mockReturnValue(mockChain);
    mockGetSession = jest.fn().mockResolvedValue({ data: { session: { access_token: 'tok-1' } }, error: null });
    mockInvoke = jest.fn().mockResolvedValue({ data: { success: true, email_sent: true }, error: null });
});

// ═══════════════════════════════════════════════════════════════════════════
// fetchActiveMasters
// ═══════════════════════════════════════════════════════════════════════════
describe('fetchActiveMasters', () => {
    it('queries profiles table with role=master', async () => {
        const masters = [{ id: '1', full_name: 'Jane', role: 'master' }];
        mockChain.order.mockResolvedValue({ data: masters, error: null });

        const result = await fetchActiveMasters();
        expect(mockFromFn).toHaveBeenCalledWith('profiles');
        expect(result.data).toEqual(masters);
        expect(result.error).toBeNull();
    });

    it('returns error when query fails', async () => {
        const err = new Error('DB error');
        mockChain.order.mockResolvedValue({ data: null, error: err });

        const result = await fetchActiveMasters();
        expect(result.data).toBeNull();
        expect(result.error).toBe(err);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// fetchPendingMasters
// ═══════════════════════════════════════════════════════════════════════════
describe('fetchPendingMasters', () => {
    it('queries pending_masters table', async () => {
        const pending = [{ id: '1', full_name: 'John', master_status: 'invited' }];
        mockChain.order.mockResolvedValue({ data: pending, error: null });

        const result = await fetchPendingMasters();
        expect(mockFromFn).toHaveBeenCalledWith('pending_masters');
        expect(result.data).toEqual(pending);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// inviteMaster
// ═══════════════════════════════════════════════════════════════════════════
describe('inviteMaster', () => {
    it('calls the invite-master edge function with the owner session token', async () => {
        mockChain.single.mockResolvedValue({ data: { id: '1' }, error: null });

        const result = await inviteMaster(
            { full_name: 'Jane Smith', email: 'jane@test.com', phone: '123', bio: 'bio' },
            'owner-123'
        );

        expect(mockInvoke).toHaveBeenCalledWith('invite-master', {
            body: { email: 'jane@test.com', full_name: 'Jane Smith' },
            headers: { Authorization: 'Bearer tok-1' },
        });
        expect(result.emailSent).toBe(true);
        expect(result.error).toBeNull();
    });

    it('still writes pending_masters for the mobile pending list (best effort)', async () => {
        const newMaster = { id: '1', full_name: 'Jane Smith', email: 'jane@test.com', master_status: 'invited' };
        mockChain.single.mockResolvedValue({ data: newMaster, error: null });

        const result = await inviteMaster(
            { full_name: 'Jane Smith', email: 'jane@test.com' },
            'owner-123'
        );

        expect(mockFromFn).toHaveBeenCalledWith('pending_masters');
        expect(mockChain.insert).toHaveBeenCalledWith(expect.objectContaining({
            full_name: 'Jane Smith',
            email: 'jane@test.com',
            master_status: 'invited',
            created_by: 'owner-123',
        }));
        expect(result.data).toEqual(newMaster);
    });

    it('returns error without touching pending_masters when the edge function fails', async () => {
        mockInvoke.mockResolvedValue({ data: null, error: new Error('Function unreachable') });

        const result = await inviteMaster(
            { full_name: 'Jane', email: 'jane@test.com' },
            'owner-123'
        );

        expect(result.error?.message).toBe('Function unreachable');
        expect(result.emailSent).toBe(false);
        expect(mockFromFn).not.toHaveBeenCalledWith('pending_masters');
    });

    it('surfaces edge function body errors (e.g. duplicate application)', async () => {
        mockInvoke.mockResolvedValue({
            data: { error: 'An application for this email already exists (status: invited)' },
            error: null,
        });

        const result = await inviteMaster(
            { full_name: 'Jane', email: 'jane@test.com' },
            'owner-123'
        );

        expect(result.error?.message).toContain('already exists');
        expect(result.emailSent).toBe(false);
    });

    it('reports emailSent=false when Resend is not configured but the invite succeeded', async () => {
        mockInvoke.mockResolvedValue({
            data: { success: true, email_sent: false, note: 'RESEND_API_KEY not configured' },
            error: null,
        });
        mockChain.single.mockResolvedValue({ data: { id: '1' }, error: null });

        const result = await inviteMaster(
            { full_name: 'Jane', email: 'jane@test.com' },
            'owner-123'
        );

        expect(result.error).toBeNull();
        expect(result.emailSent).toBe(false);
    });

    it('fails fast when the session is expired', async () => {
        mockGetSession.mockResolvedValue({ data: { session: null }, error: null });

        const result = await inviteMaster(
            { full_name: 'Jane', email: 'jane@test.com' },
            'owner-123'
        );

        expect(result.error?.message).toContain('Session expired');
        expect(mockInvoke).not.toHaveBeenCalled();
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// updateMasterProfile
// ═══════════════════════════════════════════════════════════════════════════
describe('updateMasterProfile', () => {
    it('updates profile successfully', async () => {
        mockChain.eq.mockResolvedValue({ error: null });

        const result = await updateMasterProfile('master-1', { is_verified: true });
        expect(mockFromFn).toHaveBeenCalledWith('profiles');
        expect(result.success).toBe(true);
        expect(result.error).toBeNull();
    });

    it('returns error on update failure', async () => {
        const err = new Error('Update failed');
        mockChain.eq.mockResolvedValue({ error: err });

        const result = await updateMasterProfile('master-1', { bio: 'New bio' });
        expect(result.success).toBe(false);
        expect(result.error).toBe(err);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// deactivateMaster
// ═══════════════════════════════════════════════════════════════════════════
describe('deactivateMaster', () => {
    it('deactivates a master successfully', async () => {
        mockChain.eq.mockResolvedValue({ error: null });

        const result = await deactivateMaster('master-1');
        expect(result.success).toBe(true);
    });

    it('returns error on failure', async () => {
        mockChain.eq.mockResolvedValue({ error: new Error('Failed') });

        const result = await deactivateMaster('master-1');
        expect(result.success).toBe(false);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// reactivateMaster
// ═══════════════════════════════════════════════════════════════════════════
describe('reactivateMaster', () => {
    it('reactivates a master successfully', async () => {
        mockChain.eq.mockResolvedValue({ error: null });

        const result = await reactivateMaster('master-1');
        expect(result.success).toBe(true);
    });

    it('returns error on failure', async () => {
        mockChain.eq.mockResolvedValue({ error: new Error('Failed') });

        const result = await reactivateMaster('master-1');
        expect(result.success).toBe(false);
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// fetchMasterCounts
// ═══════════════════════════════════════════════════════════════════════════
describe('fetchMasterApplications', () => {
    it('queries master_applications filtered by status, newest first', async () => {
        mockChain.order.mockResolvedValue({
            data: [{ id: 'app-1', full_name: 'Ada', status: 'pending' }],
            error: null,
        });

        const result = await fetchMasterApplications();

        expect(mockFromFn).toHaveBeenCalledWith('master_applications');
        expect(mockChain.eq).toHaveBeenCalledWith('status', 'pending');
        expect(mockChain.order).toHaveBeenCalledWith('created_at', { ascending: false });
        expect(result.data).toHaveLength(1);
        expect(result.error).toBeNull();
    });

    it('supports reviewing other statuses', async () => {
        mockChain.order.mockResolvedValue({ data: [], error: null });
        await fetchMasterApplications('approved');
        expect(mockChain.eq).toHaveBeenCalledWith('status', 'approved');
    });

    it('surfaces query errors', async () => {
        mockChain.order.mockResolvedValue({ data: null, error: new Error('denied') });
        const result = await fetchMasterApplications();
        expect(result.data).toBeNull();
        expect(result.error).toBeTruthy();
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// fetchMasterCounts
// ═══════════════════════════════════════════════════════════════════════════
describe('fetchMasterCounts', () => {
    it('returns counts for active masters, applications and pending invitations', async () => {
        // mockFromFn will be called twice — one for profiles, one for pending_masters
        // We need to handle sequential calls
        let callCount = 0;
        const profileChain = createChainMock();
        const pendingChain = createChainMock();

        const applicationChain = createChainMock();

        mockFromFn.mockImplementation((table: string) => {
            if (table === 'profiles') return profileChain;
            if (table === 'pending_masters') return pendingChain;
            if (table === 'master_applications') return applicationChain;
            return createChainMock();
        });

        // Resolve both Promise.all calls
        // Note: the mock for `eq` needs to return another chained object if called repeatedly,
        // or a promise. Since the first `eq` calls `.eq()` again, we need to handle that.
        // But for mock flexibility, we can just make `.eq` return a mock chain that resolves.
        profileChain.eq = jest.fn().mockImplementation(() => {
            const chain = createChainMock();
            chain.eq = jest.fn().mockResolvedValue({ count: 5, error: null });
            return chain;
        });
        pendingChain.eq.mockResolvedValue({ count: 3, error: null });
        applicationChain.eq.mockResolvedValue({ count: 2, error: null });

        const result = await fetchMasterCounts();
        expect(result.activeMasters).toBe(5);
        expect(result.pendingInvitations).toBe(3);
        expect(result.pendingApplications).toBe(2);
    });
});
