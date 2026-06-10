import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MarketingPayload {
    title: string;
    body: string;
    data?: Record<string, any>;
    // Optional filters
    role_filter?: "client" | "master" | "owner";
}

Deno.serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Verify the caller is an admin/owner
        const authHeader = req.headers.get("Authorization");
        if (authHeader && authHeader.startsWith("Bearer ")) {
            const token = authHeader.replace("Bearer ", "");
            // Skip auth check if using service role key
            if (token !== supabaseServiceKey) {
                const { data: { user }, error: authError } = await supabase.auth.getUser(token);
                if (authError || !user) {
                    return new Response(
                        JSON.stringify({ error: "Unauthorized" }),
                        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                    );
                }

                // Check if user is owner/admin
                const { data: profile } = await supabase
                    .from("profiles")
                    .select("role")
                    .eq("id", user.id)
                    .single();

                if (profile?.role !== "owner" && profile?.role !== "admin") {
                    return new Response(
                        JSON.stringify({ error: "Only owners can send marketing notifications" }),
                        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                    );
                }
            }
        }

        const payload: MarketingPayload = await req.json();

        if (!payload.title || !payload.body) {
            return new Response(
                JSON.stringify({ error: "title and body are required" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Build query to get users with push tokens and promotions enabled
        let query = supabase
            .from("profiles")
            .select("id, push_token, full_name, notification_preferences, role")
            .not("push_token", "is", null);

        // Apply role filter if specified
        if (payload.role_filter) {
            query = query.eq("role", payload.role_filter);
        }

        const { data: users, error: usersError } = await query;

        if (usersError) {
            throw usersError;
        }

        if (!users || users.length === 0) {
            return new Response(
                JSON.stringify({ message: "No users with push tokens found" }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Filter users who have promotions enabled
        const eligibleUsers = users.filter(user => {
            const prefs = user.notification_preferences;
            // Default to true if no preferences set
            return !prefs || prefs.promotions !== false;
        });

        if (eligibleUsers.length === 0) {
            return new Response(
                JSON.stringify({ message: "No users have promotional notifications enabled" }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Build notifications array
        const notifications = eligibleUsers.map(user => ({
            to: user.push_token,
            sound: "default",
            title: payload.title,
            body: payload.body,
            data: {
                type: "marketing",
                ...(payload.data || {}),
            },
            priority: "default",
            _contentAvailable: true,
        }));

        // Send in batches of 100 (Expo limit)
        const batchSize = 100;
        const results = [];

        for (let i = 0; i < notifications.length; i += batchSize) {
            const batch = notifications.slice(i, i + batchSize);

            const response = await fetch("https://exp.host/--/api/v2/push/send", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                body: JSON.stringify(batch),
            });

            const result = await response.json();
            results.push(result);
        }

        // Log the marketing notification for analytics
        await supabase.from("scheduled_notifications").insert({
            user_id: eligibleUsers[0].id, // Use first user as placeholder
            type: "marketing",
            title: payload.title,
            body: payload.body,
            data: {
                ...payload.data,
                recipients_count: eligibleUsers.length,
                role_filter: payload.role_filter || "all",
            },
            scheduled_for: new Date().toISOString(),
            sent_at: new Date().toISOString(),
        });

        return new Response(
            JSON.stringify({
                success: true,
                message: `Marketing notification sent to ${eligibleUsers.length} users`,
                total_users: users.length,
                eligible_users: eligibleUsers.length,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error("Error:", error);
        return new Response(
            JSON.stringify({ error: (error as Error).message }),
            {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        );
    }
});
