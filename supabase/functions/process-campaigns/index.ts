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
    start_date: string | null;
    end_date: string | null;
    last_broadcast_at: string | null;
}

interface MasterClient {
    client_id: string;
    push_token: string;
    full_name: string;
}

const CAMPAIGN_ICONS: Record<string, string> = {
    promotion: "🎉",
    vacation: "🏖️",
    announcement: "📢",
};

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const today = new Date().toISOString().split('T')[0];
        const results = {
            campaigns_processed: 0,
            notifications_sent: 0,
            errors: [] as string[],
        };

        // ============================================
        // 1. Get Active Promotion/Vacation/Announcement Campaigns
        // ============================================

        const { data: campaigns, error: campaignError } = await supabase
            .from("aftercare_campaigns")
            .select("*")
            .eq("is_active", true)
            .in("campaign_type", ["promotion", "vacation", "announcement"])
            .lte("start_date", today)
            .or(`end_date.gte.${today},end_date.is.null`);

        if (campaignError) {
            console.error("Error fetching campaigns:", campaignError);
            return new Response(
                JSON.stringify({ error: campaignError.message }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        if (!campaigns || campaigns.length === 0) {
            return new Response(
                JSON.stringify({ message: "No active campaigns to process" }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // ============================================
        // 2. Process Each Campaign
        // ============================================

        for (const campaign of campaigns as Campaign[]) {
            // Skip if already broadcast today (for daily scheduled runs)
            if (campaign.last_broadcast_at) {
                const lastBroadcast = new Date(campaign.last_broadcast_at).toISOString().split('T')[0];
                if (lastBroadcast === today) {
                    continue; // Already broadcast today
                }
            }

            // Get all clients who have booked with this master
            const { data: clients, error: clientError } = await supabase
                .rpc("get_master_clients", { p_master_id: campaign.master_id });

            if (clientError) {
                results.errors.push(`Error getting clients for master ${campaign.master_id}: ${clientError.message}`);
                continue;
            }

            if (!clients || clients.length === 0) {
                continue; // No clients to notify
            }

            const notifications = [];
            const notificationRecords = [];

            for (const client of clients as MasterClient[]) {
                if (!client.push_token) continue;

                // Check if already sent to this client for this campaign
                const { data: alreadySent } = await supabase
                    .from("campaign_notifications_sent")
                    .select("id")
                    .eq("campaign_id", campaign.id)
                    .eq("client_id", client.client_id)
                    .single();

                if (alreadySent) continue;

                // Personalize message
                const clientName = client.full_name || "there";
                const personalizedMessage = campaign.message.replace(/\{name\}/gi, clientName);
                const icon = CAMPAIGN_ICONS[campaign.campaign_type] || "📢";

                notifications.push({
                    to: client.push_token,
                    sound: "default",
                    title: `${icon} ${campaign.name}`,
                    body: personalizedMessage,
                    data: {
                        type: "marketing",
                        campaign_type: campaign.campaign_type,
                        campaign_id: campaign.id,
                    },
                });

                notificationRecords.push({
                    campaign_id: campaign.id,
                    client_id: client.client_id,
                });
            }

            // Send notifications in batches of 100
            const batchSize = 100;
            for (let i = 0; i < notifications.length; i += batchSize) {
                const batch = notifications.slice(i, i + batchSize);
                const batchRecords = notificationRecords.slice(i, i + batchSize);

                try {
                    const response = await fetch("https://exp.host/--/api/v2/push/send", {
                        method: "POST",
                        headers: { "Content-Type": "application/json", Accept: "application/json" },
                        body: JSON.stringify(batch),
                    });

                    if (response.ok) {
                        // Record sent notifications
                        await supabase.from("campaign_notifications_sent").insert(batchRecords);
                        results.notifications_sent += batch.length;
                    }
                } catch (pushError) {
                    results.errors.push(`Push error: ${(pushError as Error).message}`);
                }
            }

            // Update last_broadcast_at
            await supabase
                .from("aftercare_campaigns")
                .update({ last_broadcast_at: new Date().toISOString() })
                .eq("id", campaign.id);

            results.campaigns_processed++;
        }

        return new Response(
            JSON.stringify({
                success: true,
                message: `Processed ${results.campaigns_processed} campaigns, sent ${results.notifications_sent} notifications`,
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
