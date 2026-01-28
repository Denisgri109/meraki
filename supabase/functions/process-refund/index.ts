import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Process Refund Edge Function
// Issues a refund for a payment

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;

interface RequestBody {
    payment_intent_id: string;
    amount?: number; // Optional: partial refund amount in cents. If not provided, full refund.
    reason?: string; // Optional: reason for the refund
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
        const { payment_intent_id, amount, reason } = body;

        if (!payment_intent_id) {
            return new Response(
                JSON.stringify({ error: "Missing payment_intent_id" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        // Create refund parameters
        const refundParams: Record<string, string> = {
            payment_intent: payment_intent_id,
        };

        if (amount) {
            refundParams.amount = amount.toString();
        }

        if (reason) {
            // Stripe only accepts: duplicate, fraudulent, requested_by_customer
            const validReasons = ["duplicate", "fraudulent", "requested_by_customer"];
            if (validReasons.includes(reason)) {
                refundParams.reason = reason;
            }
        }

        // Create the refund
        const response = await fetch("https://api.stripe.com/v1/refunds", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams(refundParams),
        });

        const result = await response.json();

        if (result.error) {
            return new Response(
                JSON.stringify({ error: result.error.message }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        return new Response(
            JSON.stringify({
                success: true,
                refund_id: result.id,
                status: result.status,
                amount: result.amount,
            }),
            {
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
            }
        );
    } catch (error) {
        console.error("Error processing refund:", error);
        return new Response(
            JSON.stringify({ error: "Failed to process refund" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
});
