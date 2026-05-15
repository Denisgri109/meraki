import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const REQUIRED_PHRASE = "DELETE MY ACCOUNT";

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
}

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: CORS_HEADERS });
    }

    if (req.method !== "POST") {
        return jsonResponse({ error: "Method not allowed" }, 405);
    }

    try {
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
            return jsonResponse({ error: "Missing Authorization header" }, 401);
        }

        // Identify the calling user using their JWT
        const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            global: { headers: { Authorization: authHeader } },
        });
        const { data: { user }, error: authError } = await userClient.auth.getUser();
        if (authError || !user) {
            return jsonResponse({ error: "Unauthorized", details: authError?.message }, 401);
        }
        if (!user.email) {
            return jsonResponse({ error: "Account has no email on file" }, 400);
        }

        // Parse body
        let body: { otp?: string; phrase?: string };
        try {
            body = await req.json();
        } catch {
            return jsonResponse({ error: "Invalid JSON body" }, 400);
        }
        const otp = (body.otp || "").trim();
        const phrase = (body.phrase || "").trim();

        // Validate confirmation phrase (case-sensitive — user must type it exactly)
        if (phrase !== REQUIRED_PHRASE) {
            return jsonResponse(
                { error: `Confirmation phrase mismatch. Type exactly: ${REQUIRED_PHRASE}` },
                400
            );
        }

        // Validate OTP shape
        if (!/^\d{6}$/.test(otp)) {
            return jsonResponse({ error: "OTP must be a 6-digit code" }, 400);
        }

        // Verify the email OTP — this confirms the requester controls the email
        const verifyClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        const { data: verifyData, error: verifyError } = await verifyClient.auth.verifyOtp({
            email: user.email,
            token: otp,
            type: "email",
        });
        if (verifyError || !verifyData.user) {
            return jsonResponse(
                { error: "Invalid or expired verification code", details: verifyError?.message },
                401
            );
        }
        if (verifyData.user.id !== user.id) {
            return jsonResponse({ error: "OTP does not match calling user" }, 403);
        }

        // Delete via service-role admin client (hard delete: shouldSoftDelete=false)
        const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
            auth: { persistSession: false, autoRefreshToken: false },
        });

        // Best-effort: clear obvious profile fields first to prevent dangling references
        // The auth.users delete will cascade through FKs that reference auth.users(id).
        await adminClient.from("profiles").update({ push_token: null }).eq("id", user.id);

        const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id, false);
        if (deleteError) {
            console.error("Admin deleteUser error:", deleteError);
            return jsonResponse(
                { error: "Failed to delete account", details: deleteError.message },
                500
            );
        }

        return jsonResponse({ success: true });
    } catch (error) {
        console.error("delete-account error:", error);
        return jsonResponse(
            { error: "Internal server error", details: String(error) },
            500
        );
    }
});
