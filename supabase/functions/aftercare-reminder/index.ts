import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Appointment {
    id: string;
    client_id: string;
    service: { name: string; category: string | null };
    client: { push_token: string | null; full_name: string | null };
}

// Aftercare messages based on service category
const AFTERCARE_MESSAGES: Record<string, { title: string; body: string }> = {
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
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Find completed appointments from 24 hours ago that haven't received aftercare
        const twentyFourHoursAgo = new Date();
        twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

        const twentyFiveHoursAgo = new Date();
        twentyFiveHoursAgo.setHours(twentyFiveHoursAgo.getHours() - 25);

        const { data: appointments, error } = await supabase
            .from("appointments")
            .select(`
        id,
        client_id,
        service:service_id (name, category),
        client:client_id (push_token, full_name)
      `)
            .eq("status", "completed")
            .eq("aftercare_sent", false)
            .gte("end_time", twentyFiveHoursAgo.toISOString())
            .lte("end_time", twentyFourHoursAgo.toISOString());

        if (error) throw error;

        if (!appointments || appointments.length === 0) {
            return new Response(
                JSON.stringify({ message: "No appointments need aftercare reminders" }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const notifications = [];
        const updatedIds: string[] = [];

        for (const apt of appointments as unknown as Appointment[]) {
            const pushToken = apt.client?.push_token;
            if (!pushToken) continue;

            // Get category-specific aftercare message
            const category = apt.service?.category || "default";
            const message = AFTERCARE_MESSAGES[category] || AFTERCARE_MESSAGES.default;

            notifications.push({
                to: pushToken,
                sound: "default",
                title: message.title,
                body: message.body,
                data: { type: "aftercare", appointmentId: apt.id },
            });

            updatedIds.push(apt.id);
        }

        // Send push notifications
        if (notifications.length > 0) {
            const response = await fetch("https://exp.host/--/api/v2/push/send", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                body: JSON.stringify(notifications),
            });

            const result = await response.json();
            console.log("Push notification result:", result);

            // Mark appointments as aftercare sent
            const { error: updateError } = await supabase
                .from("appointments")
                .update({ aftercare_sent: true })
                .in("id", updatedIds);

            if (updateError) {
                console.error("Error updating aftercare_sent:", updateError);
            }
        }

        return new Response(
            JSON.stringify({
                message: `Sent ${notifications.length} aftercare reminders`,
                appointmentIds: updatedIds,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error("Error:", error);
        return new Response(
            JSON.stringify({ error: (error as Error).message }),
            {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            }
        );
    }
});
