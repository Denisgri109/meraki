import { supabase } from '../lib/supabase';
import type { Database, Tables } from '../types/database';

export type AftercareCampaign = Tables<'aftercare_campaigns'>;

type CampaignUpdate = Database['public']['Tables']['aftercare_campaigns']['Update'];
export type CampaignType = 'aftercare' | 'promotion' | 'vacation' | 'announcement';

export interface CampaignInput {
    name: string;
    message: string;
    campaignType: CampaignType;
    isRecurring: boolean;
    daysAfterAppointment?: number | null;
    sendDate?: string | null;
    serviceCategory?: string | null;
    startDate?: string | null;
    endDate?: string | null;
    isActive?: boolean;
}

const validateCampaign = (input: CampaignInput) => {
    if (!input.name.trim()) throw new Error('Campaign name is required.');
    if (!input.message.trim()) throw new Error('Message content is required.');
    if (input.isRecurring && (!input.daysAfterAppointment || input.daysAfterAppointment <= 0)) {
        throw new Error('Recurring campaigns need "days after appointment" (e.g. 2).');
    }
};

export const listCampaigns = async (masterId: string): Promise<AftercareCampaign[]> => {
    const { data, error } = await supabase
        .from('aftercare_campaigns')
        .select('*')
        .eq('master_id', masterId)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as AftercareCampaign[];
};

export const createCampaign = async (masterId: string, input: CampaignInput): Promise<AftercareCampaign> => {
    validateCampaign(input);
    const { data, error } = await supabase
        .from('aftercare_campaigns')
        .insert({
            master_id: masterId,
            name: input.name.trim(),
            message: input.message.trim(),
            campaign_type: input.campaignType,
            is_recurring: input.isRecurring,
            days_after_appointment: input.isRecurring ? input.daysAfterAppointment ?? null : null,
            send_date: input.isRecurring ? null : input.sendDate ?? null,
            service_category: input.serviceCategory?.trim() || null,
            start_date: input.startDate ?? null,
            end_date: input.endDate ?? null,
            is_active: input.isActive ?? true,
        })
        .select()
        .single();
    if (error) throw error;
    return data;
};

export const updateCampaign = async (id: string, input: Partial<CampaignInput>): Promise<AftercareCampaign> => {
    const patch: CampaignUpdate = {};
    if (input.name !== undefined) patch.name = input.name.trim();
    if (input.message !== undefined) patch.message = input.message.trim();
    if (input.campaignType !== undefined) patch.campaign_type = input.campaignType;
    if (input.isRecurring !== undefined) patch.is_recurring = input.isRecurring;
    if (input.daysAfterAppointment !== undefined) patch.days_after_appointment = input.daysAfterAppointment;
    if (input.sendDate !== undefined) patch.send_date = input.sendDate;
    if (input.serviceCategory !== undefined) patch.service_category = input.serviceCategory?.trim() || null;
    if (input.startDate !== undefined) patch.start_date = input.startDate;
    if (input.endDate !== undefined) patch.end_date = input.endDate;
    if (input.isActive !== undefined) patch.is_active = input.isActive;

    if (Object.keys(patch).length === 0) throw new Error('No valid fields to update.');

    const { data, error } = await supabase
        .from('aftercare_campaigns')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    return data;
};

export const deleteCampaign = async (id: string): Promise<void> => {
    const { error } = await supabase.from('aftercare_campaigns').delete().eq('id', id);
    if (error) throw error;
};
