import { supabase } from '../lib/supabase';
import type { Tables } from '../types/database';

export type Voucher = Tables<'vouchers'>;
export type DiscountType = 'free_month' | 'percentage' | 'free_trial' | 'fixed_amount';

export interface CreateVoucherParams {
    code: string;
    discountType: DiscountType;
    /** Percentage (50 = 50%) or cents for fixed_amount. Ignored for free types (stored as 100). */
    discountValue: number;
    maxUses?: number;
    description?: string;
    createdBy: string;
}

export interface RedeemVoucherResult {
    success: boolean;
    message: string;
    voucher_id?: string;
    code?: string;
    discount_type?: string;
    discount_value?: number;
    discount_amount_cents?: number;
    new_total_cents?: number;
    benefit_expires_at?: string | null;
}

const VALID_DISCOUNT_TYPES: DiscountType[] = ['free_month', 'percentage', 'free_trial', 'fixed_amount'];

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export const listVouchers = async (): Promise<Voucher[]> => {
    const { data, error } = await supabase
        .from('vouchers')
        .select('*')
        .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as Voucher[];
};

export const createVoucher = async (params: CreateVoucherParams): Promise<Voucher> => {
    const code = params.code.trim().toUpperCase();
    if (code.length < 3) throw new Error('Voucher code must be at least 3 characters.');
    if (!VALID_DISCOUNT_TYPES.includes(params.discountType)) throw new Error('Invalid discount type.');
    if (typeof params.discountValue !== 'number' || params.discountValue < 0) {
        throw new Error('Discount value must be a non-negative number.');
    }
    if (params.discountType === 'percentage' && params.discountValue > 100) {
        throw new Error('Percentage discount cannot exceed 100%.');
    }

    const storedValue =
        params.discountType === 'free_month' || params.discountType === 'free_trial'
            ? 100
            : Math.round(params.discountValue);

    const { data, error } = await supabase
        .from('vouchers')
        .insert({
            code,
            discount_type: params.discountType,
            discount_value: storedValue,
            max_uses: params.maxUses ?? 1,
            is_active: true,
            created_by: params.createdBy,
            expires_at: new Date(Date.now() + SEVEN_DAYS_MS).toISOString(),
            benefit_expires_days: 7,
            description: params.description?.trim() || null,
        })
        .select()
        .single();

    if (error) {
        if (error.code === '23505') {
            throw new Error('A voucher with this code already exists.');
        }
        throw error;
    }
    return data as Voucher;
};

export const toggleVoucherActive = async (id: string, isActive: boolean): Promise<Voucher> => {
    const { data, error } = await supabase
        .from('vouchers')
        .update({ is_active: isActive })
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    return data as Voucher;
};

export const deleteVoucher = async (id: string): Promise<void> => {
    const { error } = await supabase.from('vouchers').delete().eq('id', id);
    if (error) throw error;
};

export const redeemVoucher = async (
    code: string,
    userId: string,
    amountCents?: number
): Promise<RedeemVoucherResult> => {
    const trimmed = code.trim();
    if (trimmed.length < 3) throw new Error('Voucher code is required.');

    const { data, error } = await supabase.rpc('redeem_voucher', {
        p_code: trimmed,
        p_user_id: userId,
        p_amount_cents: amountCents ?? null,
    });
    if (error) throw error;
    return data as unknown as RedeemVoucherResult;
};
