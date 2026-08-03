import { createVoucher, redeemVoucher, toggleVoucherActive, deleteVoucher, listVouchers } from '../voucherService';
import { supabase } from '../../lib/supabase';

jest.mock('../../lib/supabase', () => ({
    supabase: {
        from: jest.fn(),
        rpc: jest.fn(),
    },
}));

describe('voucherService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('listVouchers', () => {
        it('returns vouchers ordered by created_at desc', async () => {
            const mockRows = [{ id: 'v1', code: 'SUMMER50' }];
            const order = jest.fn().mockResolvedValue({ data: mockRows, error: null });
            (supabase.from as jest.Mock).mockReturnValue({ select: jest.fn().mockReturnValue({ order }) });

            const result = await listVouchers();

            expect(supabase.from).toHaveBeenCalledWith('vouchers');
            expect(order).toHaveBeenCalledWith('created_at', { ascending: false });
            expect(result).toEqual(mockRows);
        });
    });

    describe('createVoucher', () => {
        const setupInsert = (insertResult: any) => {
            const single = jest.fn().mockResolvedValue(insertResult);
            const select = jest.fn().mockReturnValue({ single });
            const insert = jest.fn().mockReturnValue({ select });
            (supabase.from as jest.Mock).mockReturnValue({ insert });
            return insert;
        };

        it('rejects codes shorter than 3 characters', async () => {
            await expect(
                createVoucher({ code: 'AB', discountType: 'percentage', discountValue: 10, createdBy: 'u1' })
            ).rejects.toThrow('at least 3 characters');
        });

        it('rejects percentage above 100', async () => {
            await expect(
                createVoucher({ code: 'TOOHIGH', discountType: 'percentage', discountValue: 101, createdBy: 'u1' })
            ).rejects.toThrow('cannot exceed 100');
        });

        it('stores free types as discount_value 100', async () => {
            const insert = setupInsert({ data: { id: 'v1', code: 'FREETRIAL' }, error: null });

            await createVoucher({ code: 'freetrial', discountType: 'free_trial', discountValue: 0, createdBy: 'u1' });

            const payload = insert.mock.calls[0][0];
            expect(payload.code).toBe('FREETRIAL');
            expect(payload.discount_value).toBe(100);
            expect(payload.is_active).toBe(true);
            expect(payload.benefit_expires_days).toBe(7);
        });

        it('maps duplicate-code DB error to a friendly message', async () => {
            setupInsert({ data: null, error: { code: '23505', message: 'duplicate' } });

            await expect(
                createVoucher({ code: 'SUMMER50', discountType: 'percentage', discountValue: 50, createdBy: 'u1' })
            ).rejects.toThrow('already exists');
        });
    });

    describe('toggleVoucherActive', () => {
        it('updates is_active and returns updated row', async () => {
            const single = jest.fn().mockResolvedValue({ data: { id: 'v1', is_active: false }, error: null });
            const select = jest.fn().mockReturnValue({ single });
            const eq = jest.fn().mockReturnValue({ select });
            const update = jest.fn().mockReturnValue({ eq });
            (supabase.from as jest.Mock).mockReturnValue({ update });

            const result = await toggleVoucherActive('v1', false);

            expect(update).toHaveBeenCalledWith({ is_active: false });
            expect(eq).toHaveBeenCalledWith('id', 'v1');
            expect(result.is_active).toBe(false);
        });
    });

    describe('deleteVoucher', () => {
        it('deletes by id', async () => {
            const eq = jest.fn().mockResolvedValue({ error: null });
            (supabase.from as jest.Mock).mockReturnValue({ delete: jest.fn().mockReturnValue({ eq }) });

            await deleteVoucher('v1');

            expect(supabase.from).toHaveBeenCalledWith('vouchers');
            expect(eq).toHaveBeenCalledWith('id', 'v1');
        });
    });

    describe('redeemVoucher', () => {
        it('calls the redeem_voucher RPC with trimmed code and amount cents', async () => {
            (supabase.rpc as jest.Mock).mockResolvedValue({
                data: { success: true, discount_amount_cents: 2500, new_total_cents: 2500 },
                error: null,
            });

            const result = await redeemVoucher('  summer50 ', 'u1', 5000);

            expect(supabase.rpc).toHaveBeenCalledWith('redeem_voucher', {
                p_code: 'summer50',
                p_user_id: 'u1',
                p_amount_cents: 5000,
            });
            expect(result.success).toBe(true);
            expect(result.new_total_cents).toBe(2500);
        });

        it('rejects short codes before hitting the backend', async () => {
            await expect(redeemVoucher('AB', 'u1')).rejects.toThrow('required');
            expect(supabase.rpc).not.toHaveBeenCalled();
        });
    });
});
