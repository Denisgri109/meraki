import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Enhanced Handle No-Show Edge Function
// This version checks if client confirmed attendance before charging the no-show fee

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
const PROJECT_URL = Deno.env.get("PROJECT_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY");

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

        // Fetch appointment details including confirmation status
        const appointmentQuery = await fetch(
            `${PROJECT_URL}/rest/v1/appointments?id=eq.${appointment_id}&select=*,profiles:client_id(full_name,email)`,
            {
                headers: {
                    "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
                    "apikey": SERVICE_ROLE_KEY,
                },
            }
        );

        const appointments = await appointmentQuery.json();
        
        if (!appointments || appointments.length === 0) {
            return new Response(
                JSON.stringify({ error: "Appointment not found" }),
                { status: 404, headers: { "Content-Type": "application/json" } }
            );
        }

        const appointment = appointments[0];

        // ENHANCED NO-SHOW LOGIC:
        // Only charge if client confirmed attendance but didn't show up
        if (appointment.client_confirmed !== true) {
            // Client never confirmed - we shouldn't charge the full no-show fee
            // Cancel the payment intent instead
            const cancelResponse = await fetch(
                `https://api.stripe.com/v1/payment_intents/${payment_intent_id}/cancel`,
                {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
                        "Content-Type": "application/x-www-form-urlencoded",
                    },
                }
            );

            const cancelResult = await cancelResponse.json();

            if (cancelResult.error) {
                return new Response(
                    JSON.stringify({ error: cancelResult.error.message }),
                    { status: 400, headers: { "Content-Type": "application/json" } }
                );
            }

            // Update appointment status to cancelled (not no-show, since they never confirmed)
            await fetch(
                `${PROJECT_URL}/rest/v1/appointments?id=eq.${appointment_id}`,
                {
                    method: "PATCH",
                    headers: {
                        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
                        "apikey": SERVICE_ROLE_KEY,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        status: 'cancelled',
                        updated_at: new Date().toISOString(),
                    }),
                }
            );

            return new Response(
                JSON.stringify({
                    success: true,
                    message: "Client did not confirm attendance - payment cancelled, no fee charged",
                    appointment_id: appointment_id,
                    action: "payment_cancelled",
                    reason: "client_never_confirmed",
                }),
                {
                    headers: {
                        "Content-Type": "application/json",
                        "Access-Control-Allow-Origin": "*",
                    },
                }
            );
        }

        // Client confirmed but didn't show up - charge the no-show fee
        // Retrieve the payment intent to get the amount
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

        // Update appointment status to no_show and record the capture
        await fetch(
            `${PROJECT_URL}/rest/v1/appointments?id=eq.${appointment_id}`,
            {
                method: "PATCH",
                headers: {
                    "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
                    "apikey": SERVICE_ROLE_KEY,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    status: 'no_show',
                    updated_at: new Date().toISOString(),
                }),
            }
        );

        // Create payment record
        await fetch(
            `${PROJECT_URL}/rest/v1/payments`,
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
                    "apikey": SERVICE_ROLE_KEY,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    appointment_id: appointment_id,
                    client_id: appointment.client_id,
                    amount: amountToCapture / 100, // Convert from cents
                    currency: paymentIntent.currency,
                    stripe_payment_intent_id: payment_intent_id,
                    status: 'captured',
                    type: 'no_show_fee',
                    created_at: new Date().toISOString(),
                }),
            }
        );

        // Send no-show fee charged email
        if (appointment.profiles?.email) {
            // TODO: Send email notification about no-show fee
        }

        return new Response(
            JSON.stringify({
                success: true,
                status: result.status,
                amount_captured: result.amount_received,
                appointment_id: appointment_id,
                action: "no_show_fee_charged",
                reason: "client_confirmed_but_no_show",
                fee_percentage: feePercentage,
            }),
            {
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
            }
        );
    } catch (error: any) {
        console.error("Error handling no-show:", error);
        return new Response(
            JSON.stringify({ error: error.message || "Failed to process no-show charge" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
});
