import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Delete Payment Method Edge Function
// Detaches a payment method from a customer

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;

interface RequestBody {
    payment_method_id: string;
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
        const { payment_method_id } = body;

        if (!payment_method_id) {
            return new Response(
                JSON.stringify({ error: "Missing payment_method_id" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        // Detach the payment method
        const response = await fetch(
            `https://api.stripe.com/v1/payment_methods/${payment_method_id}/detach`,
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
                    "Content-Type": "application/x-www-form-urlencoded",
                },
            }
        );

        const result = await response.json();

        if (result.error) {
            return new Response(
                JSON.stringify({ error: result.error.message }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        return new Response(
            JSON.stringify({ success: true }),
            {
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
            }
        );
    } catch (error) {
        console.error("Error deleting payment method:", error);
        return new Response(
            JSON.stringify({ error: "Failed to delete payment method" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
});
