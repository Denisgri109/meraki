import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

/**
 * Cancel & Refund Edge Function
 * 
 * Handles appointment cancellation with intelligent refund logic:
 * - Client cancels > 24hrs before → 100% refund (hold released)
 * - Client cancels < 24hrs before → 50% refund (late cancellation fee)
 * - Master cancels at any time    → 100% refund
 * 
 * Supports both uncaptured holds (cancel PI / partial capture) and
 * captured payments (full/partial refund with reverse_transfer).
 */

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CANCELLATION_WINDOW_HOURS = 24;
const LATE_CANCELLATION_REFUND_PERCENT = 50;

interface RequestBody {
    appointment_id: string;
    cancelled_by: "client" | "master";
    reason?: string;
}

interface StripeResult {
    action: "cancelled" | "partial_capture" | "full_refund" | "partial_refund" | "no_payment";
    refund_amount_cents: number;
    fee_amount_cents: number;
    original_amount_cents: number;
    refund_id?: string;
}

const corsHeaders = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST",
    "Access-Control-Allow-Headers": "authorization, content-type",
};

async function stripeRequest(endpoint: string, method: string = "GET", body?: Record<string, string>) {
    const options: RequestInit = {
        method,
        headers: {
            "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
            "Content-Type": "application/x-www-form-urlencoded",
        },
    };
    if (body) {
        options.body = new URLSearchParams(body);
    }
    const res = await fetch(`https://api.stripe.com/v1${endpoint}`, options);
    return res.json();
}

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const body: RequestBody = await req.json();
        const { appointment_id, cancelled_by, reason } = body;

        if (!appointment_id || !cancelled_by) {
            return new Response(
                JSON.stringify({ error: "Missing appointment_id or cancelled_by" }),
                { status: 400, headers: corsHeaders }
            );
        }

        // Use service role to fetch appointment (bypasses RLS)
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        // 1. Fetch appointment
        const { data: appointment, error: fetchError } = await supabase
            .from("appointments")
            .select("id, start_time, price, stripe_payment_intent_id, deposit_amount, payment_hold_amount, status, master_id, client_id")
            .eq("id", appointment_id)
            .single();

        if (fetchError || !appointment) {
            return new Response(
                JSON.stringify({ error: "Appointment not found" }),
                { status: 404, headers: corsHeaders }
            );
        }

        // Don't allow cancellation of already-cancelled appointments
        if (appointment.status.startsWith("cancelled")) {
            return new Response(
                JSON.stringify({ error: "Appointment is already cancelled" }),
                { status: 400, headers: corsHeaders }
            );
        }

        // 2. Calculate time until appointment
        const now = new Date();
        const appointmentTime = new Date(appointment.start_time);
        const hoursUntil = (appointmentTime.getTime() - now.getTime()) / (1000 * 60 * 60);
        const isLateCancellation = hoursUntil < CANCELLATION_WINDOW_HOURS;

        // 3. Determine refund percentage
        let refundPercentage: number;
        if (cancelled_by === "master") {
            // Master cancels → always 100%
            refundPercentage = 100;
        } else {
            // Client cancels
            refundPercentage = isLateCancellation ? LATE_CANCELLATION_REFUND_PERCENT : 100;
        }

        // 4. Handle Stripe payment
        let stripeResult: StripeResult;
        const paymentIntentId = appointment.stripe_payment_intent_id;

        if (!paymentIntentId) {
            // No payment attached — just cancel in DB
            stripeResult = {
                action: "no_payment",
                refund_amount_cents: 0,
                fee_amount_cents: 0,
                original_amount_cents: 0,
            };
        } else if (paymentIntentId.startsWith('pi_mock_') || paymentIntentId.startsWith('pi_simulated_') || paymentIntentId.startsWith('mock_pi_')) {
            // Intercept simulated/mock payment intent IDs
            console.log("Mock payment intent detected in cancel-and-refund:", paymentIntentId);
            const originalAmountCents = appointment.payment_hold_amount || appointment.price * 100;
            const refundAmountCents = Math.round(originalAmountCents * (refundPercentage / 100));
            const feeAmountCents = originalAmountCents - refundAmountCents;

            stripeResult = {
                action: refundPercentage === 100 ? "cancelled" : "partial_capture",
                refund_amount_cents: refundAmountCents,
                fee_amount_cents: feeAmountCents,
                original_amount_cents: originalAmountCents,
                refund_id: "re_mock_" + Math.random().toString(36).substr(2, 9),
            };
        } else {
            // Fetch the PaymentIntent from Stripe to check its status
            const pi = await stripeRequest(`/payment_intents/${paymentIntentId}`);

            if (pi.error) {
                console.error("Failed to fetch PI:", pi.error);
                return new Response(
                    JSON.stringify({ error: `Stripe error: ${pi.error.message}` }),
                    { status: 400, headers: corsHeaders }
                );
            }

            const originalAmountCents = pi.amount;
            const refundAmountCents = Math.round(originalAmountCents * (refundPercentage / 100));
            const feeAmountCents = originalAmountCents - refundAmountCents;

            if (pi.status === "requires_capture") {
                // Payment is still a HOLD (not captured yet)
                if (refundPercentage === 100) {
                    // Full refund → cancel the PI entirely (releases hold)
                    const cancelResult = await stripeRequest(
                        `/payment_intents/${paymentIntentId}/cancel`,
                        "POST"
                    );

                    if (cancelResult.error) {
                        return new Response(
                            JSON.stringify({ error: `Failed to cancel hold: ${cancelResult.error.message}` }),
                            { status: 400, headers: corsHeaders }
                        );
                    }

                    stripeResult = {
                        action: "cancelled",
                        refund_amount_cents: originalAmountCents,
                        fee_amount_cents: 0,
                        original_amount_cents: originalAmountCents,
                    };
                } else {
                    // Partial refund → capture only the fee portion, rest is released
                    const captureResult = await stripeRequest(
                        `/payment_intents/${paymentIntentId}/capture`,
                        "POST",
                        { amount_to_capture: feeAmountCents.toString() }
                    );

                    if (captureResult.error) {
                        return new Response(
                            JSON.stringify({ error: `Failed to capture partial: ${captureResult.error.message}` }),
                            { status: 400, headers: corsHeaders }
                        );
                    }

                    stripeResult = {
                        action: "partial_capture",
                        refund_amount_cents: refundAmountCents,
                        fee_amount_cents: feeAmountCents,
                        original_amount_cents: originalAmountCents,
                    };
                }
            } else if (pi.status === "succeeded") {
                // Payment was already captured → issue a refund
                const refundParams: Record<string, string> = {
                    payment_intent: paymentIntentId,
                    reverse_transfer: "true",      // Pull money back from Master's connected account
                    reason: "requested_by_customer",
                };

                if (refundPercentage < 100) {
                    refundParams.amount = refundAmountCents.toString();
                }

                let refundResult = await stripeRequest("/refunds", "POST", refundParams);

                // If it fails because there is no transfer (e.g. direct charge), retry without reverse_transfer
                if (refundResult.error && refundResult.error.message?.includes("does not have an associated transfer")) {
                    console.log("Retrying refund without reverse_transfer...");
                    delete refundParams.reverse_transfer;
                    refundResult = await stripeRequest("/refunds", "POST", refundParams);
                }

                if (refundResult.error) {
                    return new Response(
                        JSON.stringify({ error: `Refund failed: ${refundResult.error.message}` }),
                        { status: 400, headers: corsHeaders }
                    );
                }

                stripeResult = {
                    action: refundPercentage === 100 ? "full_refund" : "partial_refund",
                    refund_amount_cents: refundResult.amount,
                    fee_amount_cents: originalAmountCents - refundResult.amount,
                    original_amount_cents: originalAmountCents,
                    refund_id: refundResult.id,
                };
            } else if (pi.status === "canceled") {
                // Already cancelled — just update DB
                stripeResult = {
                    action: "no_payment",
                    refund_amount_cents: 0,
                    fee_amount_cents: 0,
                    original_amount_cents: 0,
                };
            } else {
                // Unexpected PI status (e.g., requires_payment_method, processing)
                // Try to cancel it
                const cancelResult = await stripeRequest(
                    `/payment_intents/${paymentIntentId}/cancel`,
                    "POST"
                );
                
                stripeResult = {
                    action: cancelResult.error ? "no_payment" : "cancelled",
                    refund_amount_cents: cancelResult.error ? 0 : pi.amount,
                    fee_amount_cents: 0,
                    original_amount_cents: pi.amount || 0,
                };
            }
        }

        // 5. Update appointment in database
        const newStatus = stripeResult.fee_amount_cents > 0 ? "cancelled_charge" : "cancelled_free";
        const cancellationReason = reason || (cancelled_by === "master"
            ? "Cancelled by specialist"
            : isLateCancellation
                ? "Late cancellation by client (within 24 hours)"
                : "Cancelled by client");

        const { error: updateError } = await supabase
            .from("appointments")
            .update({
                status: newStatus,
                cancellation_reason: cancellationReason,
                cancellation_fee_amount: stripeResult.fee_amount_cents,
                updated_at: new Date().toISOString(),
            } as any)
            .eq("id", appointment_id);

        if (updateError) {
            console.error("DB update error (full):", updateError);
            // Fallback: try updating just the critical status field
            const { error: fallbackError } = await supabase
                .from("appointments")
                .update({
                    status: newStatus,
                    cancellation_reason: cancellationReason,
                    updated_at: new Date().toISOString(),
                } as any)
                .eq("id", appointment_id);

            if (fallbackError) {
                console.error("DB fallback update also failed:", fallbackError);
            }
        }

        // 6. Return comprehensive result
        const isHoldRelease = stripeResult.action === "cancelled" || stripeResult.action === "partial_capture";

        return new Response(
            JSON.stringify({
                success: true,
                appointment_id,
                cancelled_by,
                is_late_cancellation: isLateCancellation && cancelled_by === "client",
                hours_until_appointment: Math.max(0, Math.round(hoursUntil * 10) / 10),
                refund_percentage: refundPercentage,
                original_amount_cents: stripeResult.original_amount_cents,
                refund_amount_cents: stripeResult.refund_amount_cents,
                fee_amount_cents: stripeResult.fee_amount_cents,
                stripe_action: stripeResult.action,
                refund_id: stripeResult.refund_id || null,
                // Help the frontend display the right message
                estimated_arrival: isHoldRelease
                    ? "Your hold has been released. Funds will appear in your account within 1-3 business days."
                    : "Your refund has been initiated. Funds will appear in your account within 5-10 business days.",
                status: newStatus,
            }),
            { headers: corsHeaders }
        );
    } catch (error) {
        console.error("cancel-and-refund error:", error);
        return new Response(
            JSON.stringify({ error: "Internal server error" }),
            { status: 500, headers: corsHeaders }
        );
    }
});
