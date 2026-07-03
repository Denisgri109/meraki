import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const baseCorsHeaders = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getCorsHeaders(req: Request) {
    const origin = req.headers.get("Origin");
    const allowedOriginsEnv = Deno.env.get("ALLOWED_ORIGINS");
    const allowedOrigins = allowedOriginsEnv ? allowedOriginsEnv.split(",").map(o => o.trim()) : ["https://meraki.app"];

    let allowedOrigin = allowedOrigins[0]; // Stick to configured list fallback

    if (origin) {
        // Always allow localhost for development if needed, or stick strictly to the list
        // In this security fix, we stick to the configured list.
        if (allowedOrigins.includes(origin)) {
            allowedOrigin = origin;
        }
    }

    return {
        ...baseCorsHeaders,
        "Access-Control-Allow-Origin": allowedOrigin,
    };
}

const shippingCosts: Record<string, number> = {
    GB: 4.99,
    IE: 5.99,
    NL: 5.99,
    BE: 5.99,
    LU: 5.99,
    DE: 6.49,
    FR: 6.99,
    AT: 6.99,
    MC: 7.49,
    LI: 7.49,
    AD: 7.99,
    SM: 7.99,
    VA: 7.99,
    ES: 7.49,
    PT: 7.99,
    IT: 7.49,
    GR: 8.99,
    MT: 9.99,
    CY: 9.99,
    DK: 7.49,
    SE: 8.49,
    NO: 9.99,
    FI: 11.99,
    IS: 14.99,
    PL: 5.99,
    CZ: 5.99,
    SK: 5.99,
    HU: 6.49,
    SI: 6.49,
    HR: 6.99,
    EE: 6.99,
    LV: 6.99,
    LT: 6.49,
    RO: 6.99,
    BG: 7.49,
    CH: 11.99,
    AL: 12.99,
    BA: 12.99,
    RS: 11.99,
    ME: 12.99,
    MK: 12.99,
    MD: 13.99,
    UA: 14.99,
};

type RequestItem = {
    product_id: string;
    quantity: number;
};

type RequestBody = {
    items: RequestItem[];
    payment_intent_id: string;
    currency?: string;
    shipping: {
        name: string;
        phone: string;
        address: string;
        city: string;
        postal_code: string;
        country: string;
        notes?: string;
    };
};

function jsonResponse(body: unknown, status = 200, req?: Request) {
    // If req is not passed, fallback to a safe default. In practice we will pass it.
    const headers = req ? getCorsHeaders(req) : { ...baseCorsHeaders, "Access-Control-Allow-Origin": "https://meraki.app" };
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            ...headers,
            "Content-Type": "application/json",
        },
    });
}

function validateBody(body: RequestBody) {
    if (!Array.isArray(body.items) || body.items.length === 0) return "Cart is empty";
    if (!body.payment_intent_id) return "Missing payment intent id";
    if (!body.shipping?.name?.trim()) return "Missing shipping name";
    if (!body.shipping?.phone?.trim()) return "Missing shipping phone";
    if (!body.shipping?.address?.trim()) return "Missing shipping address";
    if (!body.shipping?.city?.trim()) return "Missing shipping city";
    if (!body.shipping?.postal_code?.trim()) return "Missing shipping postal code";
    if (!body.shipping?.country?.trim()) return "Missing shipping country";

    const country = body.shipping.country.toUpperCase();
    if (!(country in shippingCosts)) return "Unsupported shipping country";

    for (const item of body.items) {
        if (!item.product_id || !Number.isInteger(item.quantity) || item.quantity <= 0) {
            return "Invalid cart item";
        }
    }

    return null;
}

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: getCorsHeaders(req) });
    }

    if (req.method !== "POST") {
        return jsonResponse({ error: "Method not allowed" }, 405, req);
    }

    try {
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
            return jsonResponse({ error: "Missing Authorization header" }, 401, req);
        }

        const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            global: { headers: { Authorization: authHeader } },
        });

        const { data: userData, error: authError } = await authClient.auth.getUser();
        if (authError || !userData.user) {
            return jsonResponse({ error: "Unauthorized", details: authError?.message }, 401, req);
        }

        const body = (await req.json()) as RequestBody;
        const validationError = validateBody(body);
        if (validationError) {
            return jsonResponse({ error: validationError }, 400, req);
        }

        let paymentIntent;
        if (Deno.env.get("ENVIRONMENT") === "development" && (body.payment_intent_id.startsWith('pi_simulated_') || body.payment_intent_id.startsWith('pi_mock_') || body.payment_intent_id.startsWith('mock_pi_'))) {
            console.log("Mock payment intent detected in finalize-shop-order:", body.payment_intent_id);
            
            // Calculate total price to match database expectations exactly
            const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
                auth: { autoRefreshToken: false, persistSession: false },
            });
            
            const productIds = body.items.map(item => item.product_id);
            const { data: products } = await serviceClient.from('products').select('id, retail_price, wholesale_price').in('id', productIds);
            const { data: profile } = await serviceClient.from('profiles').select('role').eq('id', userData.user.id).single();
            
            let subtotal = 0;
            for (const item of body.items) {
                const prod = products?.find(p => p.id === item.product_id);
                if (prod) {
                    const price = (profile?.role === 'master' || profile?.role === 'owner') ? prod.wholesale_price : prod.retail_price;
                    subtotal += price * item.quantity;
                }
            }
            
            const country = body.shipping.country.toUpperCase();
            const shippingCost = shippingCosts[country] || 0;
            const totalCents = Math.round((subtotal + shippingCost) * 100);

            paymentIntent = {
                id: body.payment_intent_id,
                status: "succeeded",
                amount_received: totalCents,
                amount: totalCents,
                currency: body.currency || "eur",
                metadata: {
                    user_id: userData.user.id
                }
            };
        } else {
            const stripeResponse = await fetch(`https://api.stripe.com/v1/payment_intents/${body.payment_intent_id}`, {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
                },
            });

            paymentIntent = await stripeResponse.json();
            if (!stripeResponse.ok || paymentIntent.error) {
                return jsonResponse({ error: paymentIntent.error?.message || "Could not verify payment" }, 400, req);
            }
        }

        if (paymentIntent.status !== "succeeded") {
            return jsonResponse({ error: "Payment has not succeeded" }, 400, req);
        }

        if (paymentIntent.metadata?.user_id !== userData.user.id) {
            return jsonResponse({ error: "Payment does not belong to this user" }, 403, req);
        }

        if (paymentIntent.metadata?.appointment_id) {
            return jsonResponse({ error: "Payment intent is not a shop payment" }, 400, req);
        }

        const requestedCurrency = (body.currency || paymentIntent.currency || "").toLowerCase();
        if (paymentIntent.currency !== requestedCurrency) {
            return jsonResponse({ error: "Payment currency mismatch" }, 400, req);
        }

        const country = body.shipping.country.toUpperCase();
        const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        });

        const { data, error } = await serviceClient.rpc("finalize_shop_order", {
            p_user_id: userData.user.id,
            p_items: body.items.map((item) => ({
                product_id: item.product_id,
                quantity: item.quantity,
            })),
            p_shipping: {
                name: body.shipping.name.trim(),
                phone: body.shipping.phone.trim(),
                address: body.shipping.address.trim(),
                city: body.shipping.city.trim(),
                postal_code: body.shipping.postal_code.trim(),
                country,
                cost: shippingCosts[country],
                notes: body.shipping.notes?.trim() || null,
            },
            p_payment: {
                stripe_payment_intent_id: paymentIntent.id,
                amount_cents: paymentIntent.amount_received || paymentIntent.amount,
                currency: paymentIntent.currency,
            },
        });

        if (error) {
            return jsonResponse({ error: error.message }, 400, req);
        }

        return jsonResponse(data, 200, req);
    } catch (error) {
        return jsonResponse({ error: "Failed to finalize order", details: String(error) }, 500, req);
    }
});
