import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Handle No-Show Edge Function
// Captures the pre-authorized payment when a client doesn't show up

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;

interface RequestBody {
    appointment_id: string;
    payment_intent_id: string;
    no_show_fee_percentage?: number; // Optional: defaults to 100% (full capture)
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
        const { appointment_id, payment_intent_id, no_show_fee_percentage = 100 } = body;

        if (!appointment_id || !payment_intent_id) {
            return new Response(
                JSON.stringify({ error: "Missing appointment_id or payment_intent_id" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        // Intercept simulated/mock payment intent IDs
        if (Deno.env.get("ENVIRONMENT") === "development" && (payment_intent_id.startsWith('pi_mock_') || payment_intent_id.startsWith('pi_simulated_') || payment_intent_id.startsWith('mock_pi_'))) {
            console.log("Mock payment intent detected in handle-no-show:", payment_intent_id);
            return new Response(
                JSON.stringify({
                    success: true,
                    status: "succeeded",
                    amount_captured: 1500, // mock captured amount
                    appointment_id: appointment_id,
                }),
                {
                    headers: {
                        "Content-Type": "application/json",
                        "Access-Control-Allow-Origin": "*",
                    },
                }
            );
        }

        // First, retrieve the payment intent to get the amount
        const getResponse = await fetch(
            `https://api.stripe.com/v1/payment_intents/${payment_intent_id}`,
            {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
                },
            }
        );

        const paymentIntent = await getResponse.json();

        if (paymentIntent.error) {
            return new Response(
                JSON.stringify({ error: paymentIntent.error.message }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        // Check if already captured
        if (paymentIntent.status === "succeeded") {
            return new Response(
                JSON.stringify({ error: "Payment already captured" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        // Calculate the no-show fee amount
        const feePercentage = Math.min(100, Math.max(0, no_show_fee_percentage));
        const amountToCapture = Math.round(paymentIntent.amount * (feePercentage / 100));

        // Capture the payment (full or partial based on fee percentage)
        const captureParams: Record<string, string> = {};
        if (feePercentage < 100) {
            captureParams.amount_to_capture = amountToCapture.toString();
        }

        const captureResponse = await fetch(
            `https://api.stripe.com/v1/payment_intents/${payment_intent_id}/capture`,
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams(captureParams),
            }
        );

        const result = await captureResponse.json();

        if (result.error) {
            return new Response(
                JSON.stringify({ error: result.error.message }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        return new Response(
            JSON.stringify({
                success: true,
                status: result.status,
                amount_captured: result.amount_received,
                appointment_id: appointment_id,
            }),
            {
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
            }
        );
    } catch (error) {
        console.error("Error handling no-show:", error);
        return new Response(
            JSON.stringify({ error: "Failed to process no-show charge" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
});
