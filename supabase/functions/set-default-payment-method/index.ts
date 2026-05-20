import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        // Verify JWT
        const authHeader = req.headers.get('Authorization');
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

        const body = await req.json();
        const { payment_method_id } = body;

        if (!payment_method_id) {
            return new Response(
                JSON.stringify({ error: "Missing payment_method_id" }),
                { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
            );
        }

        // Get stripe_customer_id from profile
        const { data: profile } = await supabase
            .from('profiles')
            .select('stripe_customer_id')
            .eq('id', user.id)
            .single();

        const customerId = profile?.stripe_customer_id;
        if (!customerId) {
            return new Response(
                JSON.stringify({ error: "No Stripe customer found" }),
                { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
            );
        }

        // Verify the payment method belongs to this customer
        const pmRes = await fetch(
            `https://api.stripe.com/v1/payment_methods/${payment_method_id}`,
            { headers: { "Authorization": `Bearer ${STRIPE_SECRET_KEY}` } }
        );
        const pm = await pmRes.json();
        if (pm.error || pm.customer !== customerId) {
            return new Response(
                JSON.stringify({ error: "Payment method not found or not owned by you" }),
                { status: 403, headers: { "Content-Type": "application/json", ...corsHeaders } }
            );
        }

        // Update customer default payment method
        const updateRes = await fetch(
            `https://api.stripe.com/v1/customers/${customerId}`,
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams({
                    "invoice_settings[default_payment_method]": payment_method_id,
                }),
            }
        );
        const updateResult = await updateRes.json();
        if (updateResult.error) {
            return new Response(
                JSON.stringify({ error: updateResult.error.message }),
                { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
            );
        }

        return new Response(
            JSON.stringify({ success: true }),
            { headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
    } catch (error) {
        console.error("Error setting default payment method:", error);
        return new Response(
            JSON.stringify({ error: "Failed to set default payment method" }),
            { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
    }
});
