import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Campaign {
    id: string;
    master_id: string;
    name: string;
    message: string;
    campaign_type: 'aftercare' | 'promotion' | 'vacation' | 'announcement';
    is_recurring: boolean;
    days_after_appointment: number | null;
    service_category: string | null;
    start_date: string | null;
    end_date: string | null;
}

interface Appointment {
    id: string;
    client_id: string;
    master_id: string;
    end_time: string;
    service: { name: string; category: string | null } | null;
    client: { push_token: string | null; full_name: string | null } | null;
}

// Default aftercare messages (fallback if no custom campaign)
const DEFAULT_AFTERCARE_MESSAGES: Record<string, { title: string; body: string }> = {
    Lashes: {
        title: "💫 Lash Care Reminder",
        body: "Keep your lashes beautiful! Avoid water for 24h, no oil-based products near eyes, and brush gently with a spoolie daily.",
    },
    Nails: {
        title: "💅 Nail Care Tips",
        body: "Keep your nails looking fresh! Wear gloves for cleaning, moisturize cuticles daily, and avoid using nails as tools.",
    },
    Brows: {
        title: "✨ Brow Aftercare",
        body: "Protect your beautiful brows! Avoid touching, keep dry for 24h, no makeup on brows for 48h, and apply aftercare serum.",
    },
    default: {
        title: "💆 Aftercare Reminder",
        body: "Thank you for your recent visit! Follow your aftercare instructions to maintain your beautiful results.",
    },
};

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const results = {
            aftercare_sent: 0,
            campaigns_processed: 0,
            errors: [] as string[],
        };

        // ============================================
        // 1. Process Custom Aftercare Campaigns
        // ============================================

        // Get all active aftercare campaigns
        const { data: aftercareCampaigns, error: campaignError } = await supabase
            .from("aftercare_campaigns")
            .select("*")
            .eq("campaign_type", "aftercare")
            .eq("is_active", true);

        if (campaignError) {
            console.error("Error fetching campaigns:", campaignError);
            results.errors.push(`Campaign fetch error: ${campaignError.message}`);
        }

        // Process each aftercare campaign
        for (const campaign of (aftercareCampaigns || []) as Campaign[]) {
            const daysAfter = campaign.days_after_appointment || 1;

            // Calculate time window for this campaign
            const targetDate = new Date();
            targetDate.setDate(targetDate.getDate() - daysAfter);

            const windowStart = new Date(targetDate);
            windowStart.setHours(windowStart.getHours() - 1);

            const windowEnd = new Date(targetDate);
            windowEnd.setHours(windowEnd.getHours() + 1);

            // Find completed appointments in the time window for this master
            let appointmentQuery = supabase
                .from("appointments")
                .select(`
                    id,
                    client_id,
                    master_id,
                    end_time,
                    service:service_id (name, category),
                    client:client_id (push_token, full_name)
                `)
                .eq("status", "completed")
                .eq("master_id", campaign.master_id)
                .gte("end_time", windowStart.toISOString())
                .lte("end_time", windowEnd.toISOString());

            const { data: appointments, error: aptError } = await appointmentQuery;

            if (aptError) {
                results.errors.push(`Appointment query error for campaign ${campaign.id}: ${aptError.message}`);
                continue;
            }

            for (const apt of (appointments || []) as unknown as Appointment[]) {
                const pushToken = apt.client?.push_token;
                if (!pushToken) continue;

                // Check if notification already sent for this campaign/appointment
                const { data: alreadySent } = await supabase
                    .from("campaign_notifications_sent")
                    .select("id")
                    .eq("campaign_id", campaign.id)
                    .eq("appointment_id", apt.id)
                    .single();

                if (alreadySent) continue;

                // Personalize message
                const clientName = apt.client?.full_name || "there";
                const personalizedMessage = campaign.message.replace(/\{name\}/gi, clientName);

                // Send push notification
                const notification = {
                    to: pushToken,
                    sound: "default",
                    title: `💆 ${campaign.name}`,
                    body: personalizedMessage,
                    data: {
                        type: "aftercare",
                        campaign_id: campaign.id,
                        appointment_id: apt.id
                    },
                    priority: "default" as const,
                    _contentAvailable: true,
                };

                try {
                    const response = await fetch("https://exp.host/--/api/v2/push/send", {
                        method: "POST",
                        headers: { "Content-Type": "application/json", Accept: "application/json" },
                        body: JSON.stringify(notification),
                    });

                    if (response.ok) {
                        // Record that we sent this notification
                        await supabase.from("campaign_notifications_sent").insert({
                            campaign_id: campaign.id,
                            client_id: apt.client_id,
                            appointment_id: apt.id,
                        });
                        results.aftercare_sent++;
                    }
                } catch (pushError) {
                    results.errors.push(`Push error: ${(pushError as Error).message}`);
                }
            }

            results.campaigns_processed++;
        }

        // ============================================
        // 2. Fallback: Process appointments without custom campaigns
        // ============================================

        // Find completed appointments from 24 hours ago that don't have custom campaigns
        const twentyFourHoursAgo = new Date();
        twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

        const twentyFiveHoursAgo = new Date();
        twentyFiveHoursAgo.setHours(twentyFiveHoursAgo.getHours() - 25);

        // Get master IDs that have custom aftercare campaigns
        const mastersWithCampaigns = new Set(
            (aftercareCampaigns || []).map((c: Campaign) => c.master_id)
        );

        const { data: appointmentsWithoutCampaign } = await supabase
            .from("appointments")
            .select(`
                id,
                client_id,
                master_id,
                service:service_id (name, category),
                client:client_id (push_token, full_name)
            `)
            .eq("status", "completed")
            .eq("aftercare_sent", false)
            .gte("end_time", twentyFiveHoursAgo.toISOString())
            .lte("end_time", twentyFourHoursAgo.toISOString());

        const fallbackNotifications = [];
        const updatedIds: string[] = [];

        for (const apt of (appointmentsWithoutCampaign || []) as unknown as Appointment[]) {
            // Skip if this master has custom campaigns (already processed above)
            if (mastersWithCampaigns.has(apt.master_id)) continue;

            const pushToken = apt.client?.push_token;
            if (!pushToken) continue;

            // Get category-specific default aftercare message
            const category = apt.service?.category || "default";
            const message = DEFAULT_AFTERCARE_MESSAGES[category] || DEFAULT_AFTERCARE_MESSAGES.default;

            fallbackNotifications.push({
                to: pushToken,
                sound: "default",
                title: message.title,
                body: message.body,
                data: { type: "aftercare", appointmentId: apt.id },
                priority: "default" as const,
                _contentAvailable: true,
            });

            updatedIds.push(apt.id);
        }

        // Send fallback notifications
        if (fallbackNotifications.length > 0) {
            const response = await fetch("https://exp.host/--/api/v2/push/send", {
                method: "POST",
                headers: { "Content-Type": "application/json", Accept: "application/json" },
                body: JSON.stringify(fallbackNotifications),
            });

            if (response.ok) {
                // Mark appointments as aftercare sent
                await supabase
                    .from("appointments")
                    .update({ aftercare_sent: true })
                    .in("id", updatedIds);

                results.aftercare_sent += fallbackNotifications.length;
            }
        }

        return new Response(
            JSON.stringify({
                success: true,
                message: `Processed ${results.campaigns_processed} campaigns, sent ${results.aftercare_sent} aftercare reminders`,
                ...results,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error("Error:", error);
        return new Response(
            JSON.stringify({ error: (error as Error).message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
