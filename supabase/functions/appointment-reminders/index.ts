import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Appointment {
    id: string;
    start_time: string;
    client_id: string;
    master_id: string;
    service: { name: string } | null;
    client: { push_token: string | null; full_name: string | null; notification_preferences: any } | null;
    master: { full_name: string | null } | null;
}

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const now = new Date();
        const notifications: any[] = [];
        const sentIds: string[] = [];

        // 24-HOUR reminders
        const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const twentyThreeHoursFromNow = new Date(now.getTime() + 23 * 60 * 60 * 1000);

        const { data: appointments24h } = await supabase
            .from("appointments")
            .select(`id, start_time, client_id, master_id, service:service_id (name), client:client_id (push_token, full_name, notification_preferences), master:master_id (full_name)`)
            .eq("status", "confirmed")
            .gte("start_time", twentyThreeHoursFromNow.toISOString())
            .lte("start_time", twentyFourHoursFromNow.toISOString());

        // 1-HOUR reminders (Expanded window for testing)
        const oneHourFromNow = new Date(now.getTime() + 90 * 60 * 1000); // Expanded up to 90 mins for testing
        const thirtyMinsFromNow = new Date(now.getTime() + 10 * 60 * 1000);

        const { data: appointments1h } = await supabase
            .from("appointments")
            .select(`id, start_time, client_id, master_id, service:service_id (name), client:client_id (push_token, full_name, notification_preferences), master:master_id (full_name)`)
            .eq("status", "confirmed")
            .gte("start_time", thirtyMinsFromNow.toISOString())
            .lte("start_time", oneHourFromNow.toISOString());

        // Process 24h
        for (const apt of (appointments24h || []) as unknown as Appointment[]) {
            const { data: existing } = await supabase
                .from("scheduled_notifications")
                .select("id, sent_at")
                .eq("appointment_id", apt.id)
                .eq("type", "appointment_reminder")
                .like("data->>'reminder_type'", "24h")
                .single();

            if (existing?.sent_at) continue;

            const pushToken = apt.client?.push_token;
            if (!pushToken) continue;

            notifications.push({
                to: pushToken,
                sound: "default",
                title: "📅 Appointment Tomorrow",
                body: `Don't forget! ${apt.service?.name} with ${apt.master?.full_name} tomorrow`,
                data: { type: "appointment_reminder", appointment_id: apt.id },
                channelId: "appointments",
                priority: "high",
            });
            sentIds.push(`24h-${apt.id}`);
        }

        // Process 1h
        for (const apt of (appointments1h || []) as unknown as Appointment[]) {
            const pushToken = apt.client?.push_token;
            if (!pushToken) continue;

            notifications.push({
                to: pushToken,
                sound: "default",
                title: "⏰ Appointment in 1 Hour (Test)",
                body: `Debug: Notification sent at ${new Date().toISOString()}`,
                data: { type: "appointment_reminder", appointment_id: apt.id },
                channelId: "appointments",
                priority: "high",
            });

            sentIds.push(`1h-${apt.id}`);
        }

        let ticketResults = null;

        if (notifications.length > 0) {
            const response = await fetch("https://exp.host/--/api/v2/push/send", {
                method: "POST",
                headers: { "Content-Type": "application/json", Accept: "application/json" },
                body: JSON.stringify(notifications),
            });

            ticketResults = await response.json();
            console.log("Push notification result:", ticketResults);
        }

        return new Response(
            JSON.stringify({
                success: true,
                message: `Sent ${notifications.length} reminders`,
                reminders: sentIds,
                debug_tickets: ticketResults
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
