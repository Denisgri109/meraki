import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Setup Intent Edge Function
// Creates a Stripe SetupIntent for securely saving a card

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

interface RequestBody {
    customer_id?: string;
    // user_id is now extracted from the JWT for security, but we keep it in interface for compatibility
    user_id?: string;
    user_email?: string;
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
        console.log("Setup intent received request");

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
        const { customer_id, user_email } = body;
        const user_id = user.id; // Use trusted ID from token

        let stripeCustomerId = customer_id;

        // Check if the customer ID is a mock ID from simulation mode - treat as if no customer exists
        if (stripeCustomerId && stripeCustomerId.startsWith('cus_mock_')) {
            console.log('Detected mock customer ID, will create a real Stripe customer:', stripeCustomerId);
            stripeCustomerId = undefined;
        }

        // Create a Stripe customer if one doesn't exist
        if (!stripeCustomerId) {
            console.log("Creating new Stripe customer for user:", user_id);
            const customerResponse = await fetch("https://api.stripe.com/v1/customers", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams({
                    "metadata[user_id]": user_id,
                    ...(user_email && { email: user_email }),
                }),
            });

            const customer = await customerResponse.json();
            if (customer.error) {
                console.error("Stripe customer creation error:", customer.error);
                return new Response(
                    JSON.stringify({ error: customer.error.message }),
                    { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
                );
            }
            stripeCustomerId = customer.id;

            // Optionally update profile with new customer ID
            // We don't block on this, but it's good practice to sync back
            await supabase.from('profiles').update({ stripe_customer_id: stripeCustomerId }).eq('id', user_id);
        }

        // Create SetupIntent
        const setupIntentResponse = await fetch("https://api.stripe.com/v1/setup_intents", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                customer: stripeCustomerId!,
                "payment_method_types[]": "card",
                usage: "off_session",
            }),
        });

        const setupIntent = await setupIntentResponse.json();

        if (setupIntent.error) {
            console.error("Stripe setup intent creation error:", setupIntent.error);
            return new Response(
                JSON.stringify({ error: setupIntent.error.message }),
                { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
            );
        }

        return new Response(
            JSON.stringify({
                clientSecret: setupIntent.client_secret,
                setupIntentId: setupIntent.id,
                customerId: stripeCustomerId,
            }),
            {
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
            }
        );
    } catch (error) {
        console.error("Error creating setup intent:", error);
        return new Response(
            JSON.stringify({ error: "Failed to create setup intent", details: String(error) }),
            { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
        );
    }
});
