import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Setup Intent Edge Function
// Creates a Stripe SetupIntent for securely saving a card

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;

interface RequestBody {
    customer_id?: string;
    user_id: string;
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
        const body: RequestBody = await req.json();
        const { customer_id, user_id, user_email } = body;

        if (!user_id) {
            return new Response(
                JSON.stringify({ error: "Missing user_id" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        let stripeCustomerId = customer_id;

        // Create a Stripe customer if one doesn't exist
        if (!stripeCustomerId) {
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
                return new Response(
                    JSON.stringify({ error: customer.error.message }),
                    { status: 400, headers: { "Content-Type": "application/json" } }
                );
            }
            stripeCustomerId = customer.id;
        }

        // Create SetupIntent
        const setupIntentResponse = await fetch("https://api.stripe.com/v1/setup_intents", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                customer: stripeCustomerId,
                "payment_method_types[]": "card",
                usage: "off_session",
            }),
        });

        const setupIntent = await setupIntentResponse.json();

        if (setupIntent.error) {
            return new Response(
                JSON.stringify({ error: setupIntent.error.message }),
                { status: 400, headers: { "Content-Type": "application/json" } }
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
            JSON.stringify({ error: "Failed to create setup intent" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
});
