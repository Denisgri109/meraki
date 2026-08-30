import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Create Payment Intent Edge Function
// Creates a Stripe PaymentIntent for pre-authorization

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface RequestBody {
    amount: number;
    currency: string;
    /**
     * Ignored. The Stripe customer is always resolved from the caller's own
     * profile — accepting it from the client let a caller create a
     * PaymentIntent against somebody else's saved cards. Kept in the type for
     * backward compatibility with clients that still send it.
     */
    customer_id?: string;
    payment_method_id?: string;
    appointment_id: string;
    master_id?: string;
    description?: string;
    capture_method?: "manual" | "automatic";
}

Deno.serve(async (req: Request) => {
    // Handle CORS
    if (req.method === "OPTIONS") {
        return new Response("ok", {
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
            payment_method_id,
            appointment_id,
            master_id,
            description = "Merakí Beauty Service",
            capture_method = "manual",
        } = body;

        if (!Number.isInteger(amount) || amount <= 0) {
            return new Response(
                JSON.stringify({ error: "Amount must be a positive whole number of cents" }),
                { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
            );
        }

        // 1b. Resolve the Stripe customer from the CALLER'S OWN profile.
        // `customer_id` in the request body is ignored: trusting it allowed a
        // caller to create a PaymentIntent against another user's saved cards.
        const { data: callerProfile } = await supabase
            .from("profiles")
            .select("stripe_customer_id")
            .eq("id", user.id)
            .maybeSingle();

        let stripeCustomerId: string | undefined = callerProfile?.stripe_customer_id ?? undefined;

        // Safety check for mock IDs here too
        if (stripeCustomerId && stripeCustomerId.startsWith('cus_mock_')) {
            console.warn("Mock customer ID on profile:", stripeCustomerId);
            stripeCustomerId = undefined;
        }

        if (customer_id && stripeCustomerId && customer_id !== stripeCustomerId) {
            console.warn(`Ignoring client-supplied customer_id ${customer_id} for user ${user.id}`);
        }

        // 1c. A saved card may only be used if it is attached to the caller's
        // own Stripe customer.
        if (payment_method_id) {
            if (!stripeCustomerId) {
                return new Response(
                    JSON.stringify({ error: "No Stripe customer on file for this account" }),
                    { status: 403, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
                );
            }

            const pmRes = await fetch(
                `https://api.stripe.com/v1/payment_methods/${payment_method_id}`,
                { headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` } },
            );
            const pm = await pmRes.json();

            if (!pmRes.ok || pm.error || pm.customer !== stripeCustomerId) {
                return new Response(
                    JSON.stringify({ error: "Payment method does not belong to this account" }),
                    { status: 403, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
                );
            }
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
                { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
            );
        }

        // 3. Record the PaymentIntent we just issued. Postgres cannot call
        // Stripe, so this ledger is the only thing the booking RPCs can trust
        // when a client hands them a payment reference: it proves the id is
        // real, belongs to this user, and is for this amount.
        try {
            const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
                auth: { autoRefreshToken: false, persistSession: false },
            });
            const { error: ledgerError } = await serviceClient
                .from("payment_intent_ledger")
                .insert({
                    stripe_payment_intent_id: paymentIntent.id,
                    user_id: user.id,
                    amount_cents: amount,
                    currency: currency,
                    purpose: appointment_id ? "booking" : (description || "payment"),
                });
            if (ledgerError) {
                console.error("Failed to record payment intent in ledger:", ledgerError);
            }
        } catch (ledgerErr) {
            console.error("Ledger write threw:", ledgerErr);
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
