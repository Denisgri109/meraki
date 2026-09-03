import { supabase } from '../lib/supabase';

// ─── PARKED FEATURE ─────────────────────────────────────────────────────────────
// The `aftercare_campaigns` table was dropped by migration
// 20260613180736_remove_aftercare_campaigns, and MasterMenuScreen removed the menu
// entry on 2026-08-30, so nothing in the app reaches this service or
// AftercareCampaignsScreen any more. Both were kept on purpose, "for whenever the
// feature comes back with a table behind it".
//
// The row shape therefore cannot come from the generated database types — it is
// declared here instead, and the client is cast at the query boundary. Delete this
// file, the screen and their tests if the feature is not coming back; restore the
// table and swap these back to `Tables<'aftercare_campaigns'>` if it is.
export interface AftercareCampaign {
    id: string;
    master_id: string;
    name: string;
    message: string;
    campaign_type: string;
    is_recurring: boolean | null;
    send_date: string | null;
    days_after_appointment: number | null;
    service_category: string | null;
    start_date: string | null;
    end_date: string | null;
    last_broadcast_at: string | null;
    is_active: boolean | null;
    created_at: string | null;
    updated_at: string | null;
}

type CampaignUpdate = Partial<Omit<AftercareCampaign, 'id' | 'master_id'>>;

/**
 * The table is absent from the schema, so the generated client types every column as
 * `never`. Queries go through this deliberately untyped handle; `AftercareCampaign` above is
 * the contract the callers rely on, and the casts back to it are made explicit at each
 * return site.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const campaigns = (): any => (supabase as any).from('aftercare_campaigns');

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
    const { data, error } = await campaigns()
        .select('*')
        .eq('master_id', masterId)
        .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as AftercareCampaign[];
};

export const createCampaign = async (masterId: string, input: CampaignInput): Promise<AftercareCampaign> => {
    validateCampaign(input);
    const { data, error } = await campaigns()
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

    const { data, error } = await campaigns()
        .update(patch)
        .eq('id', id)
        .select()
        .single();
    if (error) throw error;
    return data;
};

export const deleteCampaign = async (id: string): Promise<void> => {
    const { error } = await campaigns().delete().eq('id', id);
    if (error) throw error;
};
