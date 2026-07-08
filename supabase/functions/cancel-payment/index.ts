import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Cancel Payment Edge Function
// Cancels a payment hold, releasing funds back to customer

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;

interface RequestBody {
    payment_intent_id: string;
}

Deno.serve(async (req: Request) => {
    const origin = req.headers.get("origin") || "";
    const allowedOriginsStr = Deno.env.get("ALLOWED_ORIGINS") || "";
    const allowedOrigins = allowedOriginsStr.split(",").map(o => o.trim()).filter(Boolean);

    const corsHeaders: Record<string, string> = {
        "Access-Control-Allow-Origin": allowedOrigins.includes(origin) ? origin : "https://meraki.app",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, content-type",
    };

    // Handle CORS
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const body: RequestBody = await req.json();
        const { payment_intent_id } = body;

        if (!payment_intent_id) {
            return new Response(
                JSON.stringify({ error: "Missing payment_intent_id" }),
                {
                    status: 400,
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                }
            );
        }

        // Intercept simulated/mock payment intent IDs
        if (Deno.env.get("ENVIRONMENT") === "development" && (payment_intent_id.startsWith('pi_mock_') || payment_intent_id.startsWith('pi_simulated_') || payment_intent_id.startsWith('mock_pi_'))) {
            console.log("Mock payment intent detected in cancel-payment:", payment_intent_id);
            return new Response(
                JSON.stringify({ success: true, status: "canceled" }),
                {
                    headers: {
                        ...corsHeaders,
                        "Content-Type": "application/json",
                    },
                }
            );
        }

        // Cancel the payment intent
        const cancelUrl = `https://api.stripe.com/v1/payment_intents/${payment_intent_id}/cancel`;

        const stripeResponse = await fetch(cancelUrl, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
                "Content-Type": "application/x-www-form-urlencoded",
            },
        });

        const result = await stripeResponse.json();

        if (result.error) {
            return new Response(
                JSON.stringify({ error: result.error.message }),
                {
                    status: 400,
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                }
            );
        }

        return new Response(
            JSON.stringify({ success: true, status: result.status }),
            {
                headers: {
                    ...corsHeaders,
                    "Content-Type": "application/json",
                },
            }
        );
    } catch (error) {
        console.error("Error cancelling payment:", error);
        return new Response(
            JSON.stringify({ error: "Failed to cancel payment" }),
            {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            }
        );
    }
});
