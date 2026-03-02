import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Stripe Connect Dashboard Edge Function
// Creates a login link for the master's Stripe Express dashboard

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
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

        // 2. Get connect ID from profile
        const { data: profile } = await supabase
            .from("profiles")
            .select("stripe_connect_id, stripe_connect_status")
            .eq("id", user.id)
            .single();

        if (!profile?.stripe_connect_id || profile.stripe_connect_status !== "active") {
            return new Response(
                JSON.stringify({ error: "Stripe Connect account not active" }),
                { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
            );
        }

        // 3. Create Express dashboard login link
        const loginLinkRes = await fetch(
            `https://api.stripe.com/v1/accounts/${profile.stripe_connect_id}/login_links`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            }
        );

        const loginLink = await loginLinkRes.json();
        if (loginLink.error) {
            console.error("Login link creation error:", loginLink.error);
            return new Response(
                JSON.stringify({ error: loginLink.error.message }),
                { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
            );
        }

        return new Response(
            JSON.stringify({ url: loginLink.url }),
            { headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
    } catch (error) {
        console.error("Error in stripe-connect-dashboard:", error);
        return new Response(
            JSON.stringify({ error: "Internal server error", details: String(error) }),
            { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
    }
});
