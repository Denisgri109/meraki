import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// List Payment Methods Edge Function
// Retrieves saved payment methods for a Stripe customer

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;

interface RequestBody {
    customer_id: string;
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
        const { customer_id } = body;

        if (!customer_id) {
            return new Response(
                JSON.stringify({ error: "Missing customer_id" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        // List payment methods for the customer
        const response = await fetch(
            `https://api.stripe.com/v1/payment_methods?customer=${customer_id}&type=card`,
            {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
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

        // Format the payment methods
        const paymentMethods = result.data.map((pm: any) => ({
            id: pm.id,
            brand: pm.card.brand,
            last4: pm.card.last4,
            expMonth: pm.card.exp_month,
            expYear: pm.card.exp_year,
        }));

        return new Response(
            JSON.stringify({ paymentMethods }),
            {
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
            }
        );
    } catch (error) {
        console.error("Error listing payment methods:", error);
        return new Response(
            JSON.stringify({ error: "Failed to list payment methods" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
});
