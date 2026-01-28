import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Create Payment Intent Edge Function
// Creates a Stripe PaymentIntent for pre-authorization

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;

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
        const body: RequestBody = await req.json();
        const {
            amount,
            currency = "eur",
            customer_id,
            appointment_id,
            description = "Merakí Beauty Service",
            capture_method = "manual",
        } = body;

        if (!amount || !appointment_id) {
            return new Response(
                JSON.stringify({ error: "Missing required fields: amount, appointment_id" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
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
                "metadata[appointment_id]": appointment_id,
                ...(customer_id && { customer: customer_id }),
            }),
        });

        const paymentIntent = await stripeResponse.json();

        if (paymentIntent.error) {
            return new Response(
                JSON.stringify({ error: paymentIntent.error.message }),
                { status: 400, headers: { "Content-Type": "application/json" } }
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
            JSON.stringify({ error: "Failed to create payment intent" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
});
