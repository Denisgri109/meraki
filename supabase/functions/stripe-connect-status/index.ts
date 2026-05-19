import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Stripe Connect Status Edge Function
// Checks a master's Connect account status and updates the profile

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const corsHeaders = {
    "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") || "https://meraki-app.example.com",
    "Access-Control-Allow-Methods": "POST",
    "Access-Control-Allow-Headers": "authorization, content-type",
};

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        // 1. Verify JWT
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
            return new Response(
                JSON.stringify({ error: "Missing Authorization header" }),
                { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
            );
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            global: { headers: { Authorization: authHeader } },
        });

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return new Response(
                JSON.stringify({ error: "Unauthorized" }),
                { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
            );
        }

        // 2. Get profile
        const { data: profile } = await supabase
            .from("profiles")
            .select("stripe_connect_id, stripe_connect_status")
            .eq("id", user.id)
            .single();

        if (!profile?.stripe_connect_id) {
            return new Response(
                JSON.stringify({
                    status: "not_connected",
                    charges_enabled: false,
                    payouts_enabled: false,
                    details_submitted: false,
                }),
                { headers: { "Content-Type": "application/json", ...corsHeaders } }
            );
        }

        // 3. Retrieve the Connect account from Stripe
        const accountRes = await fetch(
            `https://api.stripe.com/v1/accounts/${profile.stripe_connect_id}`,
            {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
                },
            }
        );

        const account = await accountRes.json();
        if (account.error) {
            console.error("Stripe account retrieval error:", account.error);
            return new Response(
                JSON.stringify({ error: account.error.message }),
                { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
            );
        }

        // 4. Determine status
        const isActive = account.charges_enabled && account.payouts_enabled;
        const newStatus = isActive ? "active" : "pending";

        // 5. Update profile if status changed
        if (profile.stripe_connect_status !== newStatus) {
            const serviceClient = createClient(
                SUPABASE_URL,
                Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
            );

            await serviceClient
                .from("profiles")
                .update({ stripe_connect_status: newStatus })
                .eq("id", user.id);
        }

        return new Response(
            JSON.stringify({
                status: newStatus,
                charges_enabled: account.charges_enabled,
                payouts_enabled: account.payouts_enabled,
                details_submitted: account.details_submitted,
            }),
            { headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
    } catch (error) {
        console.error("Error in stripe-connect-status:", error);
        return new Response(
            JSON.stringify({ error: "Internal server error", details: String(error) }),
            { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
    }
});
