/**
 * Master Management Service
 * Provides all CRUD operations for the owner to manage beauty masters
 * on the Merakí platform — invitations, applications, profiles, deactivation.
 */
import { supabase } from '../lib/supabase';
import { safeSupabaseFetch } from '../lib/supabaseApi';
import type { Tables } from '../types/database';

// ─── Types ───────────────────────────────────────────────────────────────────

export type MasterProfile = {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    avatar_url: string | null;
    bio: string | null;
    city: string | null;
    country: string | null;
    role: string;
    is_master: boolean | null;
    master_status: string | null;
    is_verified: boolean | null;
    specialties: string[] | null;
    years_of_experience: number | null;
    created_at: string | null;
};

export type PendingMaster = {
    id: string;
    full_name: string;
    email: string;
    phone: string | null;
    bio: string | null;
    master_status: string | null;
    created_by: string | null;
    created_at: string | null;
};

export type MasterApplication = Tables<'master_applications'>;

export type InviteMasterPayload = {
    full_name: string;
    email: string;
    phone?: string;
    bio?: string;
};

// ─── Fetch Lists ─────────────────────────────────────────────────────────────

/**
 * Fetch all active/verified masters (profiles with role=master or is_master=true)
 */
export async function fetchActiveMasters(): Promise<{ data: MasterProfile[] | null; error: Error | unknown }> {
    const { data, error } = await safeSupabaseFetch(
        supabase
            .from('profiles')
            .select('id, full_name, email, phone, avatar_url, bio, city, country, role, is_master, master_status, is_verified, specialties, years_of_experience, created_at')
            .eq('role', 'master')
            .order('full_name') as any
    );
    return { data: data as MasterProfile[] | null, error };
}

/**
 * Fetch all pending masters (invited but not yet registered)
 */
export async function fetchPendingMasters(): Promise<{ data: PendingMaster[] | null; error: Error | null }> {
    const { data, error } = await safeSupabaseFetch(
        supabase
            .from('pending_masters')
            .select('*')
            .order('created_at', { ascending: false }) as any
    );
    return { data: data as PendingMaster[] | null, error };
}

// ─── Invite / Create ─────────────────────────────────────────────────────────

/**
 * Invite a new master. Calls the invite-master Edge Function which writes the
 * master_applications record and emails the invite link via Resend
 * (same path as the web app). Also keeps a pending_masters record so the
 * mobile pending list stays populated; that insert is best-effort.
 */
export async function inviteMaster(
    payload: InviteMasterPayload,
    ownerId: string
): Promise<{ data: PendingMaster | null; emailSent: boolean; error: Error | null }> {
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !sessionData.session) {
        return { data: null, emailSent: false, error: new Error('Session expired. Please log in again.') };
    }

    const { data: fnData, error: fnError } = await supabase.functions.invoke('invite-master', {
        body: { email: payload.email, full_name: payload.full_name },
        headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
    });

    if (fnError) {
        return { data: null, emailSent: false, error: fnError instanceof Error ? fnError : new Error(String(fnError)) };
    }
    if (fnData?.error) {
        return { data: null, emailSent: false, error: new Error(fnData.error) };
    }

    const emailSent = fnData?.email_sent === true;

    let pending: PendingMaster | null = null;
    const { data: pendingData } = await supabase
        .from('pending_masters')
        .insert({
            full_name: payload.full_name,
            email: payload.email,
            phone: payload.phone || null,
            bio: payload.bio || null,
            master_status: 'invited',
            created_by: ownerId,
        })
        .select()
        .single();
    pending = pendingData as PendingMaster | null;

    return { data: pending, emailSent, error: null };
}

export async function approveApplication(
    applicationId: string,
    reviewerId: string
): Promise<{ success: boolean; error: any }> {
    const { data: application, error: fetchError } = await supabase
        .from('master_applications')
        .select('profile_id, specialties, bio, service_radius_km')
        .eq('id', applicationId)
        .single();

    if (fetchError) return { success: false, error: fetchError };

    const reviewedAt = new Date().toISOString();
    const { error: applicationError } = await supabase
        .from('master_applications')
        .update({
            status: 'approved',
            reviewed_by: reviewerId,
            reviewed_at: reviewedAt,
            updated_at: reviewedAt,
        })
        .eq('id', applicationId);

    if (applicationError) return { success: false, error: applicationError };

    if (application?.profile_id) {
        const { error: profileError } = await supabase
            .from('profiles')
            .update({
                role: 'master',
                is_master: true,
                is_verified: true,
                master_status: 'active',
                specialties: application.specialties,
                bio: application.bio,
                service_radius_km: application.service_radius_km,
                updated_at: reviewedAt,
            })
            .eq('id', application.profile_id);

        if (profileError) return { success: false, error: profileError };
    }

    return { success: true, error: null };
}

export async function rejectApplication(
    applicationId: string,
    reviewerId: string,
    reason: string
): Promise<{ success: boolean; error: any }> {
    const reviewedAt = new Date().toISOString();
    const { error } = await supabase
        .from('master_applications')
        .update({
            status: 'rejected',
            rejection_reason: reason,
            reviewed_by: reviewerId,
            reviewed_at: reviewedAt,
            updated_at: reviewedAt,
        })
        .eq('id', applicationId);

    return { success: !error, error };
}

// ─── Edit / Deactivate ──────────────────────────────────────────────────────

/**
 * Update a master's profile (verification, etc.)
 */
export async function updateMasterProfile(
    masterId: string,
    updates: Partial<{
        is_verified: boolean;
        master_status: string;
        specialties: string[];
        bio: string;
    }>
): Promise<{ success: boolean; error: any }> {
    const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', masterId);

    return { success: !error, error };
}

/**
 * Deactivate a master (set role back, disable master flag)
 */
export async function deactivateMaster(
    masterId: string
): Promise<{ success: boolean; error: any }> {
    const { error } = await supabase
        .from('profiles')
        .update({
            master_status: 'deactivated',
            is_master: false,
        })
        .eq('id', masterId);

    return { success: !error, error };
}

/**
 * Reactivate a deactivated master
 */
export async function reactivateMaster(
    masterId: string
): Promise<{ success: boolean; error: any }> {
    const { error } = await supabase
        .from('profiles')
        .update({
            master_status: 'active',
            is_master: true,
        })
        .eq('id', masterId);

    return { success: !error, error };
}

/**
 * Get counts for the master management dashboard
 */
export async function fetchMasterCounts(): Promise<{
    activeMasters: number;
    pendingInvitations: number;
}> {
    const [activeRes, invRes] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'master').eq('master_status', 'active'),
        supabase.from('pending_masters').select('*', { count: 'exact', head: true }).eq('master_status', 'invited'),
    ]);

    return {
        activeMasters: activeRes.count || 0,
        pendingInvitations: invRes.count || 0,
    };
}
