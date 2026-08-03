import { supabase } from '../lib/supabase';
import type { ClassPackage, UserPass, CreditLedger, Database } from '../types/database';

export type { ClassPackage, UserPass, CreditLedger };

export type PassWithPackage = UserPass & { class_packages: ClassPackage | null };

export interface PassSummaryRow {
    user_pass_id: string;
    package_id: string;
    name: string;
    remaining_credits: number;
    initial_credits: number;
    expires_at: string | null;
}

export interface CreatePackageParams {
    ownerId: string;
    name: string;
    description?: string;
    totalCredits: number;
    priceCents: number;
    validityDays?: number | null;
    sortOrder?: number;
}

export interface UpdatePackagePatch {
    name?: string;
    description?: string | null;
    total_credits?: number;
    price_cents?: number;
    validity_days?: number | null;
    is_active?: boolean;
    sort_order?: number;
}

export const listActivePackages = async (): Promise<ClassPackage[]> => {
    const { data, error } = await supabase
        .from('class_packages')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as ClassPackage[];
};

export const listAllPackages = async (): Promise<ClassPackage[]> => {
    const { data, error } = await supabase
        .from('class_packages')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as ClassPackage[];
};

export const createPackage = async (params: CreatePackageParams): Promise<ClassPackage> => {
    if (!params.name || params.name.trim().length < 2) {
        throw new Error('Package name must be at least 2 characters.');
    }
    if (!Number.isInteger(params.totalCredits) || params.totalCredits <= 0) {
        throw new Error('Total credits must be a positive whole number.');
    }
    if (!Number.isInteger(params.priceCents) || params.priceCents < 0) {
        throw new Error('Price must be a non-negative whole number of cents.');
    }
    if (params.validityDays != null && (!Number.isInteger(params.validityDays) || params.validityDays <= 0)) {
        throw new Error('Validity days must be a positive whole number or omitted for no expiry.');
    }

    const { data, error } = await supabase
        .from('class_packages')
        .insert({
            owner_id: params.ownerId,
            name: params.name.trim(),
            description: params.description?.trim() || null,
            total_credits: params.totalCredits,
            price_cents: params.priceCents,
            validity_days: params.validityDays ?? null,
            sort_order: params.sortOrder ?? 0,
            is_active: true,
        })
        .select()
        .single();
    if (error) throw error;
    return data as ClassPackage;
};

export const updatePackage = async (id: string, patch: UpdatePackagePatch): Promise<ClassPackage> => {
    const update: Database['public']['Tables']['class_packages']['Update'] = {};
    if (typeof patch.name === 'string') update.name = patch.name.trim();
    if (patch.description !== undefined) update.description = patch.description?.trim() || null;
    if (Number.isInteger(patch.total_credits) && patch.total_credits! > 0) update.total_credits = patch.total_credits;
    if (Number.isInteger(patch.price_cents) && patch.price_cents! >= 0) update.price_cents = patch.price_cents;
    if (patch.validity_days === null || (Number.isInteger(patch.validity_days) && patch.validity_days! > 0)) {
        update.validity_days = patch.validity_days ?? null;
    }
    if (typeof patch.is_active === 'boolean') update.is_active = patch.is_active;
    if (Number.isInteger(patch.sort_order)) update.sort_order = patch.sort_order;

    if (Object.keys(update).length === 0) throw new Error('No valid fields to update.');

    const { data, error } = await supabase
        .from('class_packages')
        .update(update)
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    return data as ClassPackage;
};

export const getMyPasses = async (userId: string): Promise<PassWithPackage[]> => {
    const { data, error } = await supabase
        .from('user_passes')
        .select('*, class_packages(*)')
        .eq('user_id', userId)
        .order('purchased_at', { ascending: false });
    if (error) throw error;
    return (data || []) as unknown as PassWithPackage[];
};

export const getMyLedger = async (userId: string, limit = 50): Promise<CreditLedger[]> => {
    const { data, error } = await supabase
        .from('credit_ledger')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);
    if (error) throw error;
    return (data || []) as CreditLedger[];
};

export const getActivePassSummary = async (): Promise<PassSummaryRow[]> => {
    const { data, error } = await supabase.rpc('get_active_pass_summary', {});
    if (error) throw error;
    return (data || []) as PassSummaryRow[];
};

export const finalizePassPurchase = async (
    packageId: string,
    paymentIntentId: string
): Promise<{ pass_id?: string; already_granted?: boolean; total_credits?: number }> => {
    const { data, error } = await supabase.functions.invoke('finalize-pass-purchase', {
        body: { package_id: packageId, payment_intent_id: paymentIntentId },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
};

export const redeemClassCredit = async (sessionId: string, userPassId: string): Promise<string> => {
    const { data, error } = await supabase.rpc('redeem_class_credit', {
        p_session_id: sessionId,
        p_user_pass_id: userPassId,
    });
    if (error) throw error;
    return data as string;
};

export const grantPassToUser = async (
    targetUserId: string,
    packageId: string,
    grantedBy: string,
    note?: string
): Promise<string> => {
    const { data, error} = await supabase.rpc('grant_user_pass', {
        p_user_id: targetUserId,
        p_package_id: packageId,
        p_granted_by: grantedBy,
        p_note: note ?? null,
    });
    if (error) throw error;
    return data as string;
};
