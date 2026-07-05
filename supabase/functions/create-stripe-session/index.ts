import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// ============================================================================
// create-stripe-session Edge Function
// Creates a Stripe Checkout Session for an on-site QR product purchase.
// Automatically checks for an active user voucher and applies the discount.
//
// ⚠️  SECURITY: The charge amount is ALWAYS taken from the server-side
// PRODUCT_CATALOG below (the single source of truth). The client-supplied
// priceInCents / productName are NEVER trusted for the actual charge — they
// are ignored entirely. A tampered QR URL cannot change what the customer is
// charged. Only productId is trusted, and it must resolve to a known product.
// ============================================================================

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL = Deno.env.get("APP_URL") || "https://meraki.app";

/**
 * Server-side product catalog — the single source of truth for prices.
 * The owner edits prices HERE (and in the matching client catalog) to change
 * what a product costs. Clients can never override these values.
 *
 * To add/remove products: update this map AND the matching client catalog at
 * meraki-WEB/src/lib/qr-catalog.ts so the QR generator stays in sync.
 */
interface CatalogProduct {
    name: string;
    /** Price in euros (excluding discount). Server converts to cents. */
    priceEur: number;
    description?: string;
}

const PRODUCT_CATALOG: Record<string, CatalogProduct> = {
    "socks-16":  { name: "Merakí Cozy Socks",        priceEur: 16.00, description: "Soft, organic cotton salon socks" },
    "tshirt-25": { name: "Merakí Premium Tee",       priceEur: 25.00, description: "Relaxed fit, ultra-soft daily wear" },
    "cap-20":    { name: "Signature Dad Cap",        priceEur: 20.00, description: "Embroidered logo, adjustable strap" },
    "towel-12":  { name: "Microfiber Salon Towel",   priceEur: 12.50, description: "Quick-dry, absorbent hair towel" },
    "tote-10":   { name: "Canvas Tote Bag",          priceEur: 10.00, description: "Eco-friendly, spacious everyday carry" },
    "combo-45":  { name: "Ultimate Care Combo",      priceEur: 45.00, description: "Socks + Tee + Tote bag premium bundle" },
};

interface RequestBody {
    productId: string;
    /** @deprecated Ignored. The charge amount comes from the server catalog. Kept for backward-compat with older clients. */
    productName?: string;
    /** @deprecated Ignored. The charge amount comes from the server catalog. Kept for backward-compat with older clients. */
    priceInCents?: number;
    currency?: string;
    userId: string;
    /** 'embedded' = Stripe Embedded Checkout (web), 'hosted' = redirect to Stripe hosted page (mobile). Defaults to 'hosted'. */
    uiMode?: 'hosted' | 'embedded';
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
            // NOTE: productName / priceInCents from the client are deliberately
            // ignored — the server catalog is the only source of truth for the
            // charge. They remain in the type for backward compatibility with
            // older mobile clients but have no effect on what is charged.
            currency = "eur",
            userId,
            uiMode = "hosted",
        } = body;

        if (!productId || !userId) {
            return new Response(
                JSON.stringify({ error: "Missing required fields: productId, userId" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        if (user.id !== userId) {
            return new Response(
                JSON.stringify({ error: "User ID mismatch" }),
                { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // 2b. Resolve the product from the SERVER-SIDE catalog (source of truth).
        // An unknown productId is rejected outright — no fallback to a client
        // price. This closes the price-tampering vector completely.
        const catalogProduct = PRODUCT_CATALOG[productId];
        if (!catalogProduct) {
            return new Response(
                JSON.stringify({
                    error: `Unknown product: ${productId}. This product is not in the on-site catalog.`,
                }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Authoritative price (cents), computed server-side. Never trust client input.
        const priceInCents = Math.round(catalogProduct.priceEur * 100);
        const productName = catalogProduct.name;

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
            "metadata[user_id]": userId,
            "metadata[product_id]": productId,
            "metadata[product_name]": productName || "",
        });

        // ui_mode: 'embedded' → Stripe Embedded Checkout (web, no redirect).
        // ui_mode: 'hosted'   → Stripe hosted Checkout page (mobile redirect).
        if (uiMode === "embedded") {
            sessionParams.set("ui_mode", "embedded");
            // Embedded mode requires return_url (used by redirect-based PMs like iDEAL).
            // success_url / cancel_url are NOT allowed in embedded mode.
            sessionParams.set("return_url", `${APP_URL}/dashboard/checkout`);
        } else {
            sessionParams.set(
                "success_url",
                `${APP_URL}/dashboard/qr-payments?success=true&session_id={CHECKOUT_SESSION_ID}`,
            );
            sessionParams.set("cancel_url", `${APP_URL}/dashboard/qr-payments?cancelled=true`);
        }

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

        console.log(`Checkout session ${session.id} created for user ${userId}. Discount: €${discountApplied / 100} (ui_mode: ${uiMode})`);

        return new Response(
            JSON.stringify({
                url: session.url ?? null,
                sessionId: session.id,
                clientSecret: session.client_secret ?? null,
                uiMode,
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
