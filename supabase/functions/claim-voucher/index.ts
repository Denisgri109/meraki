import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// ============================================================================
// claim-voucher Edge Function
// Validates a voucher code, checks eligibility, links it to a user, and
// increments the usage counter. Called after signup with a promo code.
// ============================================================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface RequestBody {
    code: string;
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

    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        // 1. Verify the calling user via JWT
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

        // 2. Parse and validate body
        const body: RequestBody = await req.json();
        const { code, userId } = body;

        if (!code || !userId) {
            return new Response(
                JSON.stringify({ error: "Missing required fields: code, userId" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Ensure the calling user matches the userId param
        if (user.id !== userId) {
            return new Response(
                JSON.stringify({ error: "User ID mismatch" }),
                { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // 3. Use service role for DB writes (bypasses RLS)
        const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

        // 4. Look up voucher by code
        const { data: voucher, error: voucherError } = await supabaseAdmin
            .from("vouchers")
            .select("*")
            .eq("code", code.trim().toUpperCase())
            .single();

        if (voucherError || !voucher) {
            return new Response(
                JSON.stringify({ error: "Invalid voucher code" }),
                { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // 5. Check voucher is active and has remaining uses
        if (!voucher.is_active) {
            return new Response(
                JSON.stringify({ error: "This voucher is no longer active" }),
                { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        if (voucher.current_uses >= voucher.max_uses) {
            return new Response(
                JSON.stringify({ error: "This voucher has reached its usage limit" }),
                { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // 6. Check user hasn't already claimed this voucher
        const { data: existing } = await supabaseAdmin
            .from("user_vouchers")
            .select("id")
            .eq("user_id", userId)
            .eq("voucher_id", voucher.id)
            .maybeSingle();

        if (existing) {
            return new Response(
                JSON.stringify({ error: "You have already claimed this voucher" }),
                { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // 7. Insert user_voucher row (expires_at defaults to created_at + 7 days via DB default)
        const { data: userVoucher, error: insertError } = await supabaseAdmin
            .from("user_vouchers")
            .insert({
                user_id: userId,
                voucher_id: voucher.id,
            })
            .select()
            .single();

        if (insertError) {
            console.error("Failed to insert user_voucher:", insertError);
            return new Response(
                JSON.stringify({ error: "Failed to claim voucher", details: insertError.message }),
                { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // 8. Increment the voucher usage counter
        const { error: updateError } = await supabaseAdmin
            .from("vouchers")
            .update({ current_uses: voucher.current_uses + 1 })
            .eq("id", voucher.id);

        if (updateError) {
            console.error("Failed to increment voucher uses:", updateError);
            // Non-fatal — the user already has the voucher
        }

        console.log(`Voucher ${code} claimed by user ${userId}. Expires: ${userVoucher.expires_at}`);

        return new Response(
            JSON.stringify({
                success: true,
                voucher: {
                    code: voucher.code,
                    discount_value: voucher.discount_value,
                    discount_type: voucher.discount_type,
                },
                expires_at: userVoucher.expires_at,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error("Error in claim-voucher:", error);
        return new Response(
            JSON.stringify({ error: "Internal server error", details: String(error) }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
});
