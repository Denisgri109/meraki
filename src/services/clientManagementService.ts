// T08 — clientManagementService: owner client directory, walk-in invite,
// owner-initiated pay-at-venue bookings (via owner_book_for_client RPC), and
// client notification (conversation message mirroring bookingService pattern,
// plus send-push-notification, addressed by client id).

import { supabase } from '../lib/supabase';

export type DirectoryRoleFilter = 'all' | 'clients' | 'masters';

export interface DirectoryProfile {
    id: string;
    full_name: string | null;
    email: string | null;
    phone: string | null;
    avatar_url: string | null;
    role: string;
    created_at: string | null;
}

export interface ClientDetailBundle {
    profile: DirectoryProfile | null;
    upcoming: Array<{
        id: string;
        service_name: string | null;
        service_category: string | null;
        start_time: string;
        status: string;
        price: number | null;
    }>;
    passes: Array<{
        name: string;
        remaining_credits: number;
        initial_credits: number;
        expires_at: string | null;
    }>;
    waiver: { terms_version: string; signed_at: string | null } | null;
}

export const CURRENT_WAIVER_TERMS_VERSION = '3.0';

// Canonical predicate (web parity): filter on `role` column only, never is_master.
export async function searchClients(
    query: string,
    roleFilter: DirectoryRoleFilter = 'clients',
): Promise<{ data: DirectoryProfile[] | null; error: string | null }> {
    try {
        let q = supabase
            .from('profiles')
            .select('id, full_name, email, phone, avatar_url, role, created_at')
            .in('role', ['client', 'master'])
            .order('full_name', { ascending: true })
            .limit(200);
        if (roleFilter === 'clients') q = q.eq('role', 'client');
        if (roleFilter === 'masters') q = q.eq('role', 'master');
        const trimmed = query.trim();
        if (trimmed) {
            const like = `%${trimmed.replace(/[%,]/g, '')}%`;
            q = q.or(`full_name.ilike.${like},email.ilike.${like},phone.ilike.${like}`);
        }
        const { data, error } = await q;
        if (error) return { data: null, error: error.message };
        return { data: (data as DirectoryProfile[]) || [], error: null };
    } catch (e: any) {
        return { data: null, error: e?.message || 'Failed to load clients' };
    }
}

export async function getClientDetail(clientId: string): Promise<{ data: ClientDetailBundle | null; error: string | null }> {
    try {
        const [p, appts, passRows, waivers] = await Promise.all([
            supabase.from('profiles')
                .select('id, full_name, email, phone, avatar_url, role, created_at')
                .eq('id', clientId)
                .maybeSingle(),
            supabase.from('appointments')
                .select('id, service_name, service_category, start_time, status, price')
                .eq('client_id', clientId)
                .gte('start_time', new Date().toISOString())
                .in('status', ['confirmed', 'pending'])
                .order('start_time', { ascending: true })
                .limit(10),
            supabase.rpc('get_active_pass_summary', { p_user_id: clientId } as any),
            supabase.from('pilates_waivers')
                .select('terms_version, signed_at')
                .eq('user_id', clientId)
                .order('signed_at', { ascending: false })
                .limit(1),
        ]);
        if (p.error) return { data: null, error: p.error.message };
        return {
            data: {
                profile: (p.data as DirectoryProfile | null) || null,
                upcoming: (appts.data as ClientDetailBundle['upcoming']) || [],
                passes: (passRows.data as ClientDetailBundle['passes']) || [],
                waiver: waivers.data && waivers.data.length > 0 ? (waivers.data[0] as any) : null,
            },
            error: null,
        };
    } catch (e: any) {
        return { data: null, error: e?.message || 'Failed to load client' };
    }
}

// Conversation find-or-create between owner (master_id side) and a client.
// Mirrors ChatListScreen.startOrOpenConversation field mapping.
export async function openConversationWith(
    clientId: string,
    ownerUserId: string,
): Promise<{ conversationId: string | null; error: string | null }> {
    try {
        const { data: existing } = await (supabase as any)
            .from('conversations')
            .select('id')
            .eq('client_id', clientId)
            .eq('master_id', ownerUserId)
            .maybeSingle();
        if (existing?.id) return { conversationId: existing.id, error: null };

        const { data: created, error } = await (supabase as any)
            .from('conversations')
            .insert({ client_id: clientId, master_id: ownerUserId })
            .select('id')
            .single();
        if (error) {
            // 23505 = unique (client_id, master_id) race — treat as benign, refetch
            if (error.code === '23505') {
                const { data: retry } = await (supabase as any)
                    .from('conversations')
                    .select('id')
                    .eq('client_id', clientId)
                    .eq('master_id', ownerUserId)
                    .maybeSingle();
                if (retry?.id) return { conversationId: retry.id, error: null };
            }
            return { conversationId: null, error: error.message };
        }
        return { conversationId: created.id, error: null };
    } catch (e: any) {
        return { conversationId: null, error: e?.message || 'Failed to open conversation' };
    }
}

function buildBookingNotice(args: {
    serviceLabel: string;
    when: Date;
    needsWaiver: boolean;
}): string {
    const day = args.when.toLocaleDateString('en-IE', { weekday: 'short', day: 'numeric', month: 'short' });
    const time = args.when.toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' });
    const waiver = args.needsWaiver ? ' Please sign your pilates waiver in the app before class.' : '';
    return `You've been booked for ${args.serviceLabel} on ${day} at ${time}. Pay at the venue.${waiver}`;
}

async function hasSignedCurrentWaiver(clientId: string): Promise<boolean> {
    const { data } = await supabase
        .from('pilates_waivers')
        .select('terms_version')
        .eq('user_id', clientId)
        .order('signed_at', { ascending: false })
        .limit(1);
    return !!data && data.length > 0 && (data[0] as any).terms_version === CURRENT_WAIVER_TERMS_VERSION;
}

// Post-RPC notification chain: conversation message + push (mirrors bookingService.ts:162-189).
async function notifyClientOfBooking(args: {
    clientId: string;
    ownerUserId: string;
    serviceLabel: string;
    when: Date;
    isPilates: boolean;
    appointmentId: string;
}): Promise<void> {
    const needsWaiver = args.isPilates ? !(await hasSignedCurrentWaiver(args.clientId)) : false;
    const body = buildBookingNotice({ serviceLabel: args.serviceLabel, when: args.when, needsWaiver });

    const { conversationId } = await openConversationWith(args.clientId, args.ownerUserId);
    if (conversationId) {
        const { error } = await (supabase as any).from('messages').insert({
            conversation_id: conversationId,
            sender_id: args.ownerUserId,
            content: body,
        });
        if (error) console.warn('Owner booking message insert failed:', error.message);
    }

    // Addressed by recipient id: the edge function resolves the push token with the service
    // role and reports {skipped: true} when the client has notifications off, so the caller
    // no longer needs to fetch and pass a token around.
    try {
        await supabase.functions.invoke('send-push-notification', {
            body: {
                userId: args.clientId,
                title: 'New booking from Merakí',
                body,
                data: { type: 'appointment_reminder', appointmentId: args.appointmentId },
            },
        });
    } catch (e) {
        console.warn('Owner booking push failed (non-fatal):', e);
    }
}

export async function addClientToPilatesSession(
    clientId: string,
    sessionId: string,
    notes: string | undefined,
    ctx: { ownerUserId: string; serviceLabel: string; startsAt: string },
): Promise<{ error: string | null }> {
    try {
        const { data: appointmentId, error } = await supabase.rpc('owner_book_for_client', {
            p_client_id: clientId,
            p_session_id: sessionId,
            p_notes: notes || null,
        });
        if (error) return { error: error.message };
        await notifyClientOfBooking({
            clientId,
            ownerUserId: ctx.ownerUserId,
            serviceLabel: ctx.serviceLabel,
            when: new Date(ctx.startsAt),
            isPilates: true,
            appointmentId: appointmentId as string,
        });
        return { error: null };
    } catch (e: any) {
        return { error: e?.message || 'Failed to add client to session' };
    }
}

export async function addClientToBeautyAppointment(
    clientId: string,
    masterId: string,
    serviceId: string,
    startTimeIso: string,
    notes: string | undefined,
    ctx: { ownerUserId: string; serviceLabel: string },
): Promise<{ error: string | null }> {
    try {
        const { data: appointmentId, error } = await supabase.rpc('owner_book_for_client', {
            p_client_id: clientId,
            p_master_id: masterId,
            p_service_id: serviceId,
            p_start_time: startTimeIso,
            p_notes: notes || null,
        });
        if (error) return { error: error.message };
        await notifyClientOfBooking({
            clientId,
            ownerUserId: ctx.ownerUserId,
            serviceLabel: ctx.serviceLabel,
            when: new Date(startTimeIso),
            isPilates: false,
            appointmentId: appointmentId as string,
        });
        return { error: null };
    } catch (e: any) {
        return { error: e?.message || 'Failed to create appointment' };
    }
}

// Walk-in client invite (mirrors masterManagementService.inviteMaster invocation pattern).
export async function inviteWalkInClient(input: {
    email: string;
    fullName: string;
    phone?: string;
}): Promise<{ data: { id: string; email: string } | null; emailSent: boolean; error: string | null }> {
    try {
        await supabase.auth.getSession();
        const { data, error } = await supabase.functions.invoke('invite-client', {
            body: {
                email: input.email.trim(),
                fullName: input.fullName.trim(),
                phone: input.phone?.trim() || undefined,
            },
        });
        if (error) {
            // Edge-function JSON error bodies (409 duplicate etc.) arrive via error.context
            try {
                const ctx = await (error as any).context?.json?.();
                if (ctx?.error) return { data: null, emailSent: false, error: ctx.error };
            } catch { /* fall through to generic message */ }
            return { data: null, emailSent: false, error: error.message };
        }
        return {
            data: data?.data ? { id: data.data.id, email: data.data.email } : null,
            emailSent: !!data?.email_sent,
            error: null,
        };
    } catch (e: any) {
        return { data: null, emailSent: false, error: e?.message || 'Failed to invite client' };
    }
}
