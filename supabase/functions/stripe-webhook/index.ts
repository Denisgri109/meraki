import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// ============================================================================
// stripe-webhook Edge Function
// Receives Stripe webhook events, verifies the signature, and on
// checkout.session.completed: marks the transaction as 'completed' and
// marks the associated user voucher as 'used'.
//
// The transaction update triggers Supabase Realtime, which the mobile
// app subscribes to for instant payment confirmation.
// ============================================================================

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/**
 * Verify Stripe webhook signature using the Web Crypto API (Deno-compatible).
 * This replaces the Node.js stripe SDK's constructEvent.
 */
async function verifyStripeSignature(
    payload: string,
    sigHeader: string,
    secret: string
): Promise<boolean> {
    const pairs = sigHeader.split(",").reduce((acc, part) => {
        const [key, value] = part.split("=");
        acc[key.trim()] = value.trim();
        return acc;
    }, {} as Record<string, string>);

    const timestamp = pairs["t"];
    const signature = pairs["v1"];

    if (!timestamp || !signature) {
        return false;
    }

    // Reject timestamps older than 5 minutes
    const tolerance = 300; // seconds
    const currentTime = Math.floor(Date.now() / 1000);
    if (currentTime - parseInt(timestamp) > tolerance) {
        console.warn("Stripe webhook timestamp too old");
        return false;
    }

    const signedPayload = `${timestamp}.${payload}`;

    // HMAC-SHA256 using Web Crypto API
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    );

    const signatureBytes = await crypto.subtle.sign(
        "HMAC",
        key,
        encoder.encode(signedPayload)
    );

    const expectedSignature = Array.from(new Uint8Array(signatureBytes))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");

    // Constant-time comparison
    if (expectedSignature.length !== signature.length) return false;
    let mismatch = 0;
    for (let i = 0; i < expectedSignature.length; i++) {
        mismatch |= expectedSignature.charCodeAt(i) ^ signature.charCodeAt(i);
    }

    return mismatch === 0;
}

Deno.serve(async (req: Request) => {
    // Webhooks are server-to-server; minimal CORS needed
    const corsHeaders: Record<string, string> = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "content-type, stripe-signature",
    };

    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        // 1. Read raw body and verify signature
        const rawBody = await req.text();
        const sigHeader = req.headers.get("stripe-signature");

        if (!sigHeader) {
            console.error("Missing stripe-signature header");
            return new Response(
                JSON.stringify({ error: "Missing stripe-signature header" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const isValid = await verifyStripeSignature(rawBody, sigHeader, STRIPE_WEBHOOK_SECRET);
        if (!isValid) {
            console.error("Invalid Stripe signature");
            return new Response(
                JSON.stringify({ error: "Invalid signature" }),
                { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // 2. Parse the event
        const event = JSON.parse(rawBody);
        console.log(`Stripe webhook received: ${event.type} (${event.id})`);

        // 3. Handle checkout.session.completed
        if (event.type === "checkout.session.completed") {
            const session = event.data.object;
            const sessionId = session.id;
            const userId = session.metadata?.user_id;
            const userVoucherId = session.metadata?.user_voucher_id;
            const productName = session.metadata?.product_name;

            console.log(`Checkout completed: session=${sessionId}, user=${userId}, product=${productName}`);

            const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

            // 3a. Update transaction status to 'completed'
            const { error: txError } = await supabaseAdmin
                .from("transactions")
                .update({ status: "completed" })
                .eq("stripe_session_id", sessionId);

            if (txError) {
                console.error("Failed to update transaction:", txError);
            } else {
                console.log(`Transaction ${sessionId} marked as completed`);
            }

            // 3b. Mark the user voucher as used (if one was applied)
            if (userVoucherId) {
                const { error: voucherError } = await supabaseAdmin
                    .from("user_vouchers")
                    .update({ is_used: true })
                    .eq("id", userVoucherId);

                if (voucherError) {
                    console.error("Failed to mark voucher as used:", voucherError);
                } else {
                    console.log(`User voucher ${userVoucherId} marked as used`);
                }
            }
        }

        // Acknowledge receipt — Stripe retries on non-2xx
        return new Response(
            JSON.stringify({ received: true }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error("Error in stripe-webhook:", error);
        return new Response(
            JSON.stringify({ error: "Webhook processing failed", details: String(error) }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
