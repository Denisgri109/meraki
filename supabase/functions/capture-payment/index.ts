import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Capture Payment Edge Function
// Captures a previously held payment after service completion

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;

interface RequestBody {
    payment_intent_id: string;
    amount_to_capture?: number;
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
        const { payment_intent_id, amount_to_capture } = body;

        if (!payment_intent_id) {
            return new Response(
                JSON.stringify({ error: "Missing payment_intent_id" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        // Capture the payment
        const captureUrl = `https://api.stripe.com/v1/payment_intents/${payment_intent_id}/capture`;

        const stripeResponse = await fetch(captureUrl, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                ...(amount_to_capture && { amount_to_capture: amount_to_capture.toString() }),
            }),
        });

        const result = await stripeResponse.json();

        if (result.error) {
            return new Response(
                JSON.stringify({ error: result.error.message }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        return new Response(
            JSON.stringify({ success: true, status: result.status }),
            {
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
            }
        );
    } catch (error) {
        console.error("Error capturing payment:", error);
        return new Response(
            JSON.stringify({ error: "Failed to capture payment" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
});
