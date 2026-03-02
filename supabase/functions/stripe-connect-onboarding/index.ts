import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// Stripe Connect Onboarding Edge Function
// Creates a Connect Express account for a master and returns the onboarding link

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
};

// Map common country names to ISO 3166-1 alpha-2 codes (Stripe requirement)
const countryNameToCode: Record<string, string> = {
    "ireland": "IE", "united kingdom": "GB", "uk": "GB", "england": "GB",
    "united states": "US", "usa": "US", "us": "US",
    "france": "FR", "germany": "DE", "spain": "ES", "italy": "IT",
    "portugal": "PT", "netherlands": "NL", "belgium": "BE", "austria": "AT",
    "switzerland": "CH", "sweden": "SE", "norway": "NO", "denmark": "DK",
    "finland": "FI", "poland": "PL", "czech republic": "CZ", "czechia": "CZ",
    "romania": "RO", "hungary": "HU", "croatia": "HR", "greece": "GR",
    "bulgaria": "BG", "slovakia": "SK", "slovenia": "SI", "lithuania": "LT",
    "latvia": "LV", "estonia": "EE", "luxembourg": "LU", "malta": "MT",
    "cyprus": "CY", "canada": "CA", "australia": "AU", "new zealand": "NZ",
    "japan": "JP", "south korea": "KR", "singapore": "SG", "hong kong": "HK",
    "brazil": "BR", "mexico": "MX", "india": "IN", "united arab emirates": "AE",
    "uae": "AE", "nigeria": "NG", "south africa": "ZA", "egypt": "EG",
    "thailand": "TH", "malaysia": "MY", "indonesia": "ID", "philippines": "PH",
};

function getCountryCode(country: string): string | undefined {
    if (!country) return undefined;
    if (country.length === 2 && /^[A-Z]{2}$/.test(country.toUpperCase())) {
        return country.toUpperCase();
    }
    return countryNameToCode[country.toLowerCase()];
}

Deno.serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        // 0. Check Stripe key is configured
        if (!STRIPE_SECRET_KEY) {
            console.error("STRIPE_SECRET_KEY is not set!");
            return new Response(
                JSON.stringify({ error: "Stripe is not configured. Please set STRIPE_SECRET_KEY." }),
                { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
            );
        }
        console.log("STRIPE_SECRET_KEY exists, length:", STRIPE_SECRET_KEY.length, "starts with:", STRIPE_SECRET_KEY.substring(0, 7));

        // 1. Verify JWT
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
            return new Response(
                JSON.stringify({ error: "Missing Authorization header" }),
                { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
            );
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            global: { headers: { Authorization: authHeader } },
        });

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            console.error("Auth error:", authError);
            return new Response(
                JSON.stringify({ error: "Unauthorized" }),
                { status: 401, headers: { "Content-Type": "application/json", ...corsHeaders } }
            );
        }
        console.log("Authenticated user:", user.id, user.email);

        // 2. Get profile to check if already has a connect account
        const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("stripe_connect_id, stripe_connect_status, email, full_name, country")
            .eq("id", user.id)
            .single();

        if (profileError) {
            console.error("Profile fetch error:", profileError);
            return new Response(
                JSON.stringify({ error: "Could not fetch profile" }),
                { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
            );
        }

        console.log("Profile:", JSON.stringify(profile));

        let connectAccountId = profile?.stripe_connect_id;

        // 3. Create Connect Express account if doesn't exist
        if (!connectAccountId) {
            const countryCode = profile?.country ? getCountryCode(profile.country) : undefined;
            console.log("Country from profile:", profile?.country, "-> ISO code:", countryCode);

            // Use minimal params - Stripe collects the rest during onboarding
            // We provide a default business_profile.url to bypass Stripe's website requirement
            const params: Record<string, string> = {
                type: "express",
                "capabilities[card_payments][requested]": "true",
                "capabilities[transfers][requested]": "true",
                "business_profile[url]": "https://meraki-app.example.com",
                "metadata[user_id]": user.id,
                "metadata[platform]": "meraki",
            };

            // Only add optional fields if they exist
            if (user.email) params.email = user.email;
            if (countryCode) params.country = countryCode;

            const createParams = new URLSearchParams(params);
            console.log("Creating Stripe account with params:", JSON.stringify(params));

            const accountRes = await fetch("https://api.stripe.com/v1/accounts", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                body: createParams.toString(),
            });

            const accountText = await accountRes.text();
            console.log("Stripe API response status:", accountRes.status);
            console.log("Stripe API response body:", accountText);

            let account;
            try {
                account = JSON.parse(accountText);
            } catch {
                console.error("Failed to parse Stripe response:", accountText);
                return new Response(
                    JSON.stringify({ error: "Invalid response from Stripe", details: accountText.substring(0, 200) }),
                    { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
                );
            }

            if (account.error) {
                console.error("Stripe error:", JSON.stringify(account.error));
                return new Response(
                    JSON.stringify({
                        error: account.error.message,
                        type: account.error.type,
                        code: account.error.code,
                        param: account.error.param,
                    }),
                    { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
                );
            }

            connectAccountId = account.id;
            console.log("Created Stripe Connect account:", connectAccountId);

            // Save to profile using service role client
            const serviceClient = createClient(
                SUPABASE_URL,
                Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
            );

            const { error: updateError } = await serviceClient
                .from("profiles")
                .update({
                    stripe_connect_id: connectAccountId,
                    stripe_connect_status: "pending",
                })
                .eq("id", user.id);

            if (updateError) {
                console.error("Profile update error:", updateError);
            } else {
                console.log("Updated profile with connect account ID");
            }
        } else {
            console.log("Using existing connect account:", connectAccountId);
        }

        // 4. Create Account Link for onboarding
        // For testing/development, Stripe requires valid HTTP(S) URLs
        // We use the Expo auth proxy which redirects back to the Expo Go app
        // Format: https://auth.expo.io/@your-expo-username/your-app-slug
        const returnUrl = "https://auth.expo.io/@denis_gripx/meraki";
        const refreshUrl = "https://auth.expo.io/@denis_gripx/meraki";

        const linkParams = new URLSearchParams({
            account: connectAccountId!,
            refresh_url: refreshUrl,
            return_url: returnUrl,
            type: "account_onboarding",
        });

        console.log("Creating account link for:", connectAccountId);

        const linkRes = await fetch("https://api.stripe.com/v1/account_links", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: linkParams.toString(),
        });

        const linkText = await linkRes.text();
        console.log("Account link response status:", linkRes.status);
        console.log("Account link response body:", linkText);

        let link;
        try {
            link = JSON.parse(linkText);
        } catch {
            return new Response(
                JSON.stringify({ error: "Invalid response from Stripe", details: linkText.substring(0, 200) }),
                { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
            );
        }

        if (link.error) {
            console.error("Account link error:", JSON.stringify(link.error));
            return new Response(
                JSON.stringify({ error: link.error.message }),
                { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
            );
        }

        console.log("Successfully created onboarding URL");
        return new Response(
            JSON.stringify({
                url: link.url,
                account_id: connectAccountId,
            }),
            { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
    } catch (error) {
        console.error("Unhandled error in stripe-connect-onboarding:", String(error));
        return new Response(
            JSON.stringify({ error: "Internal server error", details: String(error) }),
            { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
    }
});
