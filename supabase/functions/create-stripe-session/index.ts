import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// ============================================================================
// create-stripe-session Edge Function
// Creates a Stripe Checkout Session for an on-site QR product purchase.
// Automatically checks for an active user voucher and applies the discount.
// ============================================================================

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL = Deno.env.get("APP_URL") || "https://meraki.app";

interface RequestBody {
    productId: string;
    productName: string;
    priceInCents: number;
    currency?: string;
    userId: string;
}

Deno.serve(async (req: Request) => {
    const origin = req.headers.get("origin") || "";
    const allowedOriginsStr = Deno.env.get("ALLOWED_ORIGINS") || "";
    const allowedOrigins = allowedOriginsStr.split(",").map(o => o.trim()).filter(Boolean);

    const corsHeaders: Record<string, string> = {
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Origin": allowedOrigins.includes(origin) ? origin : "https://meraki.app",
    };

    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        // 1. Verify the calling user
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
            return new Response(
                JSON.stringify({ error: "Missing Authorization header" }),
                { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            global: { headers: { Authorization: authHeader } },
        });

        const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
        if (authError || !user) {
            return new Response(
                JSON.stringify({ error: "Unauthorized", details: authError?.message }),
                { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // 2. Parse body
        const body: RequestBody = await req.json();
        const {
            productId,
            productName,
            priceInCents,
            currency = "eur",
            userId,
        } = body;

        if (!productId || !priceInCents || !userId) {
            return new Response(
                JSON.stringify({ error: "Missing required fields: productId, priceInCents, userId" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        if (user.id !== userId) {
            return new Response(
                JSON.stringify({ error: "User ID mismatch" }),
                { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // 3. Use service role for DB operations
        const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        // 4. Check for an active, unused voucher for this user
        const { data: activeVoucher } = await supabaseAdmin
            .from("user_vouchers")
            .select(`
                id,
                voucher_id,
                expires_at,
                vouchers (
                    id,
                    code,
                    discount_value,
                    discount_type
                )
            `)
            .eq("user_id", userId)
            .eq("is_used", false)
            .gt("expires_at", new Date().toISOString())
            .order("created_at", { ascending: true })
            .limit(1)
            .maybeSingle();

        // 5. Calculate the final price after any voucher discount
        let finalPriceInCents = priceInCents;
        let discountApplied = 0;
        let voucherId: string | null = null;
        let stripeCouponId: string | null = null;

        if (activeVoucher?.vouchers) {
            const v = activeVoucher.vouchers as any;
            voucherId = v.id;

            if (v.discount_type === "percentage") {
                discountApplied = Math.round(priceInCents * (v.discount_value / 100));
            } else {
                // Fixed discount in euros → convert to cents
                discountApplied = Math.round(v.discount_value * 100);
            }

            // Ensure discount doesn't exceed total price
            discountApplied = Math.min(discountApplied, priceInCents);
            finalPriceInCents = priceInCents - discountApplied;

            // Minimum charge of 50 cents (Stripe minimum)
            if (finalPriceInCents < 50) {
                finalPriceInCents = 50;
                discountApplied = priceInCents - 50;
            }

            // Create a one-time Stripe coupon for this session
            const couponParams = new URLSearchParams({
                duration: "once",
                name: `Voucher ${v.code}`,
            });

            if (v.discount_type === "percentage") {
                couponParams.set("percent_off", v.discount_value.toString());
            } else {
                couponParams.set("amount_off", discountApplied.toString());
                couponParams.set("currency", currency);
            }

            const couponResponse = await fetch("https://api.stripe.com/v1/coupons", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: couponParams,
            });

            const coupon = await couponResponse.json();
            if (!coupon.error) {
                stripeCouponId = coupon.id;
                console.log(`Created Stripe coupon ${coupon.id} for voucher ${v.code}`);
            } else {
                console.error("Failed to create Stripe coupon:", coupon.error);
                // Proceed without the coupon — log but don't block the sale
            }
        }

        // 6. Build Stripe Checkout Session params
        const sessionParams = new URLSearchParams({
            "mode": "payment",
            "line_items[0][price_data][currency]": currency,
            "line_items[0][price_data][product_data][name]": productName || `Product ${productId}`,
            "line_items[0][price_data][unit_amount]": priceInCents.toString(),
            "line_items[0][quantity]": "1",
            "success_url": `${APP_URL}/dashboard/qr-payments?success=true&session_id={CHECKOUT_SESSION_ID}`,
            "cancel_url": `${APP_URL}/dashboard/qr-payments?cancelled=true`,
            "metadata[user_id]": userId,
            "metadata[product_id]": productId,
            "metadata[product_name]": productName || "",
        });

        if (voucherId) {
            sessionParams.set("metadata[voucher_id]", voucherId);
            sessionParams.set("metadata[user_voucher_id]", activeVoucher!.id);
        }

        // Apply the Stripe coupon discount
        if (stripeCouponId) {
            sessionParams.set("discounts[0][coupon]", stripeCouponId);
        }

        // Add customer email for receipt
        if (user.email) {
            sessionParams.set("customer_email", user.email);
        }

        // 7. Create Stripe Checkout Session
        const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: sessionParams,
        });

        const session = await stripeResponse.json();

        if (session.error) {
            console.error("Stripe session creation error:", session.error);
            return new Response(
                JSON.stringify({ error: session.error.message }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // 8. Insert a pending transaction row
        const { error: txError } = await supabaseAdmin
            .from("transactions")
            .insert({
                user_id: userId,
                stripe_session_id: session.id,
                amount: priceInCents / 100,
                currency,
                status: "pending",
                product_name: productName,
                product_id: productId,
                discount_applied: discountApplied / 100,
                voucher_id: voucherId,
                metadata: {
                    stripe_checkout_url: session.url,
                    voucher_code: activeVoucher?.vouchers
                        ? (activeVoucher.vouchers as any).code
                        : null,
                },
            });

        if (txError) {
            console.error("Failed to insert transaction:", txError);
            // Non-fatal — session was created, don't block the user
        }

        console.log(`Checkout session ${session.id} created for user ${userId}. Discount: €${discountApplied / 100}`);

        return new Response(
            JSON.stringify({
                url: session.url,
                sessionId: session.id,
                discountApplied: discountApplied / 100,
                voucherCode: activeVoucher?.vouchers
                    ? (activeVoucher.vouchers as any).code
                    : null,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error("Error in create-stripe-session:", error);
        return new Response(
            JSON.stringify({ error: "Internal server error", details: String(error) }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
