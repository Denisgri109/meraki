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
    appointment_id: string;
    description?: string;
    capture_method?: "manual" | "automatic";
}

Deno.serve(async (req: Request) => {
    // Handle CORS
    if (req.method === "OPTIONS") {
        return new Response("ok", {
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST",
                "Access-Control-Allow-Headers": "authorization, content-type",
            },
        });
    }

    try {
        console.log("Create payment intent received request");

        // 1. Manually verify the JWT
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response(
                JSON.stringify({ error: "Missing Authorization header" }),
                { status: 401, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
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
                { status: 401, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
            );
        }

        console.log("User verified:", user.id);

        const body: RequestBody = await req.json();
        const {
            amount,
            currency = "eur",
            customer_id,
            appointment_id,
            description = "Merakí Beauty Service",
            capture_method = "manual",
        } = body;

        if (!amount) {
            return new Response(
                JSON.stringify({ error: "Missing required field: amount" }),
                { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
            );
        }

        let stripeCustomerId = customer_id;
        // Safety check for mock IDs here too
        if (stripeCustomerId && stripeCustomerId.startsWith('cus_mock_')) {
            console.warn("Mock customer ID detected in payment intent:", stripeCustomerId);
            // We can't easily create a customer here without email/metadata, 
            // but hopefully setup-intent already fixed it. 
            // If we proceed with mock ID, it WILL fail.
            // Better to strip it and let it fail with "missing customer" or attached to guest if logic allowed,
            // but for now let's just null it so it doesn't cause a 400 from Stripe for invalid ID.
            stripeCustomerId = undefined;
        }

        // Create PaymentIntent with Stripe API
        const stripeResponse = await fetch("https://api.stripe.com/v1/payment_intents", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                amount: amount.toString(),
                currency: currency,
                capture_method: capture_method,
                description: description,
                ...(appointment_id && { "metadata[appointment_id]": appointment_id }),
                ...(stripeCustomerId && { customer: stripeCustomerId }),
                "metadata[user_id]": user.id
            }),
        });

        const paymentIntent = await stripeResponse.json();

        if (paymentIntent.error) {
            console.error("Stripe payment intent creation error:", paymentIntent.error);
            return new Response(
                JSON.stringify({ error: paymentIntent.error.message }),
                { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
            );
        }

        return new Response(
            JSON.stringify({
                clientSecret: paymentIntent.client_secret,
                paymentIntentId: paymentIntent.id,
            }),
            {
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
            }
        );
    } catch (error) {
        console.error("Error creating payment intent:", error);
        return new Response(
            JSON.stringify({ error: "Failed to create payment intent", details: String(error) }),
            { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
        );
    }
});
