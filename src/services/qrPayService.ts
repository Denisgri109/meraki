import { supabase } from '../lib/supabase';
import type { Tables, Database } from '../types/database';

export type QrPayCode = Tables<'qr_pay_codes'>;

type QrPayCodeUpdate = Database['public']['Tables']['qr_pay_codes']['Update'];

export interface QrPayCodeInput {
    providerName: string;
    qrImageUrl?: string | null;
    qrPayload?: string | null;
    displayOrder?: number;
    isActive?: boolean;
    createdBy?: string;
}

const validateSource = (imageUrl?: string | null, payload?: string | null) => {
    const hasImage = !!imageUrl?.trim();
    const hasPayload = !!payload?.trim();
    if (hasImage === hasPayload) {
        throw new Error('Provide exactly one QR source: an image OR a payload.');
    }
};

export const listQrPayCodes = async (ownerView: boolean): Promise<QrPayCode[]> => {
    let query = supabase
        .from('qr_pay_codes')
        .select('*')
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: false });

    if (!ownerView) query = query.eq('is_active', true);

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as QrPayCode[];
};

export const createQrPayCode = async (input: QrPayCodeInput): Promise<QrPayCode> => {
    validateSource(input.qrImageUrl, input.qrPayload);
    if (!input.providerName.trim()) throw new Error('Provider name is required.');

    const { data, error } = await supabase
        .from('qr_pay_codes')
        .insert({
            provider_name: input.providerName.trim(),
            qr_image_url: input.qrImageUrl?.trim() || null,
            qr_payload: input.qrPayload?.trim() || null,
            display_order: input.displayOrder ?? 0,
            is_active: input.isActive ?? true,
            created_by: input.createdBy ?? null,
        })
        .select()
        .single();
    if (error) throw error;
    return data;
};

export const updateQrPayCode = async (id: string, patch: Partial<QrPayCodeInput>): Promise<QrPayCode> => {
    const { data: existing, error: fetchError } = await supabase
        .from('qr_pay_codes')
        .select('*')
        .eq('id', id)
        .single();
    if (fetchError) throw fetchError;

    const nextImageUrl =
        patch.qrImageUrl !== undefined ? patch.qrImageUrl?.trim() || null : existing.qr_image_url;
    const nextPayload =
        patch.qrPayload !== undefined ? patch.qrPayload?.trim() || null : existing.qr_payload;
    validateSource(nextImageUrl, nextPayload);

    const update: QrPayCodeUpdate = {};
    if (patch.providerName !== undefined) update.provider_name = patch.providerName.trim();
    if (patch.qrImageUrl !== undefined) update.qr_image_url = nextImageUrl;
    if (patch.qrPayload !== undefined) update.qr_payload = nextPayload;
    if (patch.displayOrder !== undefined) update.display_order = patch.displayOrder;
    if (patch.isActive !== undefined) update.is_active = patch.isActive;

    const { data, error } = await supabase
        .from('qr_pay_codes')
        .update(update)
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    return data;
};

export const deleteQrPayCode = async (id: string): Promise<void> => {
    const { error } = await supabase.from('qr_pay_codes').delete().eq('id', id);
    if (error) throw error;
};

export const setQrPayAccess = async (profileId: string, enabled: boolean): Promise<void> => {
    const { error } = await supabase
        .from('profiles')
        .update({ can_view_qr_pay: enabled })
        .eq('id', profileId);
    if (error) throw error;
};
