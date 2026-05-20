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

        // Get stripe_customer_id from profile
        const { data: profile } = await supabase
            .from('profiles')
            .select('stripe_customer_id')
            .eq('id', user.id)
            .single();

        const customerId = profile?.stripe_customer_id;
        if (!customerId || customerId.startsWith('cus_mock_')) {
            return new Response(
                JSON.stringify({ paymentMethods: [] }),
                { headers: { "Content-Type": "application/json", ...corsHeaders } }
            );
        }

        // Get customer to find default payment method
        const customerRes = await fetch(
            `https://api.stripe.com/v1/customers/${customerId}`,
            { headers: { "Authorization": `Bearer ${STRIPE_SECRET_KEY}` } }
        );
        const customer = await customerRes.json();
        if (customer.error) {
            return new Response(
                JSON.stringify({ paymentMethods: [] }),
                { headers: { "Content-Type": "application/json", ...corsHeaders } }
            );
        }
        const defaultPmId = customer.invoice_settings?.default_payment_method || null;

        // List payment methods
        const response = await fetch(
            `https://api.stripe.com/v1/payment_methods?customer=${customerId}&type=card`,
            { headers: { "Authorization": `Bearer ${STRIPE_SECRET_KEY}` } }
        );
        const result = await response.json();
        if (result.error) {
            return new Response(
                JSON.stringify({ paymentMethods: [] }),
                { headers: { "Content-Type": "application/json", ...corsHeaders } }
            );
        }

        const paymentMethods = result.data.map((pm: any) => ({
            id: pm.id,
            brand: pm.card.brand,
            last4: pm.card.last4,
            expMonth: pm.card.exp_month,
            expYear: pm.card.exp_year,
            isDefault: pm.id === defaultPmId,
        }));

        return new Response(
            JSON.stringify({ paymentMethods }),
            { headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
    } catch (error) {
        console.error("Error listing payment methods:", error);
        return new Response(
            JSON.stringify({ error: "Failed to list payment methods" }),
            { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
    }
});
