import {
    createPackage,
    updatePackage,
    listActivePackages,
    getActivePassSummary,
    finalizePassPurchase,
    redeemClassCredit,
    grantPassToUser,
} from '../classPassService';
import { supabase } from '../../lib/supabase';

jest.mock('../../lib/supabase', () => ({
    supabase: {
        from: jest.fn(),
        rpc: jest.fn(),
        functions: { invoke: jest.fn() },
    },
}));

describe('classPassService', () => {
    beforeEach(() => jest.clearAllMocks());

    describe('createPackage', () => {
        const valid = {
            ownerId: 'owner-1',
            name: '10-Class Pass',
            totalCredits: 10,
            priceCents: 15000,
        };

        it('rejects short names', async () => {
            await expect(createPackage({ ...valid, name: 'A' })).rejects.toThrow('at least 2 characters');
            expect(supabase.from).not.toHaveBeenCalled();
        });

        it('rejects non-positive credit counts', async () => {
            await expect(createPackage({ ...valid, totalCredits: 0 })).rejects.toThrow('positive whole number');
        });

        it('rejects negative prices', async () => {
            await expect(createPackage({ ...valid, priceCents: -1 })).rejects.toThrow('cents');
        });

        it('rejects invalid validity days', async () => {
            await expect(createPackage({ ...valid, validityDays: -5 })).rejects.toThrow('Validity days');
        });

        it('inserts a valid package and returns it', async () => {
            const single = jest.fn().mockResolvedValue({ data: { id: 'pkg-1', name: '10-Class Pass' }, error: null });
            const select = jest.fn().mockReturnValue({ single });
            const insert = jest.fn().mockReturnValue({ select });
            (supabase.from as jest.Mock).mockReturnValue({ insert });

            const result = await createPackage(valid);

            expect(insert).toHaveBeenCalledWith(expect.objectContaining({
                owner_id: 'owner-1',
                name: '10-Class Pass',
                total_credits: 10,
                price_cents: 15000,
                is_active: true,
                validity_days: null,
                sort_order: 0,
            }));
            expect(result.id).toBe('pkg-1');
        });
    });

    describe('updatePackage', () => {
        it('throws when patch is empty', async () => {
            await expect(updatePackage('pkg-1', {})).rejects.toThrow('No valid fields');
        });

        it('whitelists allowed fields', async () => {
            const single = jest.fn().mockResolvedValue({ data: { id: 'pkg-1' }, error: null });
            const select = jest.fn().mockReturnValue({ single });
            const eq = jest.fn().mockReturnValue({ select });
            const update = jest.fn().mockReturnValue({ eq });
            (supabase.from as jest.Mock).mockReturnValue({ update });

            await updatePackage('pkg-1', { is_active: false, price_cents: 5000 });

            expect(update).toHaveBeenCalledWith({ is_active: false, price_cents: 5000 });
            expect(eq).toHaveBeenCalledWith('id', 'pkg-1');
        });
    });

    describe('listActivePackages', () => {
        it('queries active packages only', async () => {
            const order2 = jest.fn().mockResolvedValue({ data: [], error: null });
            const order1 = jest.fn().mockReturnValue({ order: order2 });
            const eq = jest.fn().mockReturnValue({ order: order1 });
            const select = jest.fn().mockReturnValue({ eq });
            (supabase.from as jest.Mock).mockReturnValue({ select });

            await listActivePackages();

            expect(eq).toHaveBeenCalledWith('is_active', true);
        });
    });

    describe('RPC functions', () => {
        it('getActivePassSummary calls RPC with no user override', async () => {
            (supabase.rpc as jest.Mock).mockResolvedValue({ data: [{ user_pass_id: 'p1', remaining_credits: 3 }], error: null });
            const result = await getActivePassSummary();
            expect(supabase.rpc).toHaveBeenCalledWith('get_active_pass_summary', {});
            expect(result).toHaveLength(1);
        });

        it('redeemClassCredit passes session and pass ids', async () => {
            (supabase.rpc as jest.Mock).mockResolvedValue({ data: 'appointment-1', error: null });
            const id = await redeemClassCredit('sess-1', 'pass-1');
            expect(supabase.rpc).toHaveBeenCalledWith('redeem_class_credit', {
                p_session_id: 'sess-1',
                p_user_pass_id: 'pass-1',
            });
            expect(id).toBe('appointment-1');
        });

        it('grantPassToUser passes grantor and note', async () => {
            (supabase.rpc as jest.Mock).mockResolvedValue({ data: 'pass-9', error: null });
            const id = await grantPassToUser('user-1', 'pkg-1', 'owner-1', 'Comp pass');
            expect(supabase.rpc).toHaveBeenCalledWith('grant_user_pass', {
                p_user_id: 'user-1',
                p_package_id: 'pkg-1',
                p_granted_by: 'owner-1',
                p_note: 'Comp pass',
            });
            expect(id).toBe('pass-9');
        });

        it('finalizePassPurchase invokes the edge function', async () => {
            (supabase.functions.invoke as jest.Mock).mockResolvedValue({
                data: { pass_id: 'pass-1', already_granted: false, total_credits: 10 },
                error: null,
            });
            const result = await finalizePassPurchase('pkg-1', 'pi_123');
            expect(supabase.functions.invoke).toHaveBeenCalledWith('finalize-pass-purchase', {
                body: { package_id: 'pkg-1', payment_intent_id: 'pi_123' },
            });
            expect(result.pass_id).toBe('pass-1');
        });

        it('finalizePassPurchase throws on function error body', async () => {
            (supabase.functions.invoke as jest.Mock).mockResolvedValue({
                data: { error: 'Amount mismatch' },
                error: null,
            });
            await expect(finalizePassPurchase('pkg-1', 'pi_123')).rejects.toThrow('Amount mismatch');
        });
    });
});
