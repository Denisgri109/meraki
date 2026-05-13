import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

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
        console.log("Create portal session received request");

        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response(
                JSON.stringify({ error: "Missing Authorization header" }),
                { status: 401, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
            );
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            global: { headers: { Authorization: authHeader } },
        });

        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return new Response(
                JSON.stringify({ error: "Unauthorized", details: authError?.message }),
                { status: 401, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
            );
        }

        let body;
        try { body = await req.json(); } catch { body = {}; }
        const return_url = body.return_url || "http://localhost:4001/dashboard/settings";

        // Fetch customer profile
        const { data: profile } = await supabase
            .from("profiles")
            .select("stripe_customer_id, email, full_name")
            .eq("id", user.id)
            .single();

        let stripeCustomerId = profile?.stripe_customer_id;

        if (!stripeCustomerId) {
            // Create a Stripe customer on the fly
            const customerParams = new URLSearchParams({
                email: profile?.email || user.email || '',
                name: profile?.full_name || '',
                "metadata[user_id]": user.id
            });
            const customerRes = await fetch("https://api.stripe.com/v1/customers", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: customerParams,
            });
            const newCustomer = await customerRes.json();
            if (newCustomer.error) throw new Error(newCustomer.error.message);
            
            stripeCustomerId = newCustomer.id;
            
            // Save it in DB
            await supabase.from('profiles').update({ stripe_customer_id: stripeCustomerId }).eq('id', user.id);
        }

        // Create Billing Portal Session
        const portalParams = new URLSearchParams({
            customer: stripeCustomerId,
            return_url: return_url
        });

        const portalRes = await fetch("https://api.stripe.com/v1/billing_portal/sessions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: portalParams,
        });

        const session = await portalRes.json();

        if (session.error) {
            return new Response(
                JSON.stringify({ error: session.error.message }),
                { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
            );
        }

        return new Response(
            JSON.stringify({ url: session.url }),
            { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
        );

    } catch (error) {
        console.error("Error creating portal session:", error);
        return new Response(
            JSON.stringify({ error: "Failed to create portal session", details: String(error) }),
            { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
        );
    }
});
