import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Create Payment Intent Edge Function
// Creates a Stripe PaymentIntent for pre-authorization

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

interface RequestBody {
    amount: number;
    currency: string;
    customer_id?: string;
    payment_method_id?: string;
    appointment_id: string;
    master_id?: string;
    description?: string;
    capture_method?: "manual" | "automatic";
}

Deno.serve(async (req: Request) => {
    const origin = req.headers.get("origin") || "";
    const allowedOriginsStr = Deno.env.get("ALLOWED_ORIGINS") || "";
    const allowedOrigins = allowedOriginsStr.split(",").map(o => o.trim()).filter(Boolean);

    const corsHeaders: Record<string, string> = {
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Origin": allowedOrigins.includes(origin) ? origin : "https://meraki.app",
    };

    // Handle CORS
    if (req.method === "OPTIONS") {
        return new Response("ok", {
            headers: corsHeaders,
        });
    }

    try {
        console.log("Create payment intent received request");

        // 1. Manually verify the JWT
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response(
                JSON.stringify({ error: "Missing Authorization header" }),
                { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            global: { headers: { Authorization: authHeader } },
        });

        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            console.error("Auth error:", authError);
            return new Response(
                JSON.stringify({ error: "Unauthorized", details: authError?.message }),
                { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        console.log("User verified:", user.id);

        const body: RequestBody = await req.json();
        const {
            amount,
            currency = "eur",
            customer_id,
            payment_method_id,
            appointment_id,
            master_id,
            description = "Merakí Beauty Service",
            capture_method = "manual",
        } = body;

        if (!amount) {
            return new Response(
                JSON.stringify({ error: "Missing required field: amount" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        let stripeCustomerId = customer_id;
        // Safety check for mock IDs here too
        if (stripeCustomerId && stripeCustomerId.startsWith('cus_mock_')) {
            console.warn("Mock customer ID detected in payment intent:", stripeCustomerId);
            stripeCustomerId = undefined;
        }

        // 2. Check if the master has a Stripe Connect account for destination charges
        let masterConnectId: string | null = null;
        if (master_id) {
            const { data: masterProfile } = await supabase
                .from("profiles")
                .select("stripe_connect_id, stripe_connect_status")
                .eq("id", master_id)
                .single();

            if (masterProfile?.stripe_connect_id && masterProfile?.stripe_connect_status === "active") {
                masterConnectId = masterProfile.stripe_connect_id;
                console.log("Master has active Connect account:", masterConnectId);
            }
        }

        // Build PaymentIntent params
        const params: Record<string, string> = {
            amount: amount.toString(),
            currency: currency,
            capture_method: capture_method,
            description: description,
            "metadata[user_id]": user.id,
        };

        if (appointment_id) params["metadata[appointment_id]"] = appointment_id;
        if (stripeCustomerId) params.customer = stripeCustomerId;
        if (payment_method_id) params.payment_method = payment_method_id;

        // If master has Connect account → destination charge (100% to master, zero platform fee)
        if (masterConnectId) {
            params["transfer_data[destination]"] = masterConnectId;
            // No application_fee_amount → 100% goes to the master
            console.log("Creating destination charge for master Connect:", masterConnectId);
        }

        // Create PaymentIntent with Stripe API
        const stripeResponse = await fetch("https://api.stripe.com/v1/payment_intents", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams(params),
        });

        const paymentIntent = await stripeResponse.json();

        if (paymentIntent.error) {
            console.error("Stripe payment intent creation error:", paymentIntent.error);
            return new Response(
                JSON.stringify({ error: paymentIntent.error.message }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        return new Response(
            JSON.stringify({
                clientSecret: paymentIntent.client_secret,
                paymentIntentId: paymentIntent.id,
            }),
            {
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        );
    } catch (error) {
        console.error("Error creating payment intent:", error);
        return new Response(
            JSON.stringify({ error: "Failed to create payment intent", details: String(error) }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
