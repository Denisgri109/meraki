import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
// Set SITE_URL secret to your deployed web app URL (e.g. https://meraki.vercel.app).
// Falls back to localhost for local testing.
const SITE_URL = Deno.env.get("SITE_URL") || "http://localhost:4001";
// Default to Resend test sender (works without domain verification).
// Set FROM_EMAIL secret to your verified domain sender for production.
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "Merakí <noreply@pingrab.xyz>";

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function buildInviteHtml(fullName: string, email: string, siteUrl: string): string {
  const registerUrl = `${siteUrl}/register?email=${encodeURIComponent(email)}&role=master&invited=true`;
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background-color:#1a1a2e;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#1a1a2e;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:linear-gradient(135deg,#2d2d44 0%,#1a1a2e 100%);border-radius:24px;overflow:hidden;box-shadow:0 20px 60px rgba(139,92,246,0.3);">
  <tr>
    <td style="padding:50px 40px 30px;text-align:center;background:linear-gradient(135deg,rgba(139,92,246,0.2) 0%,transparent 100%);">
      <h1 style="margin:0;font-size:48px;font-weight:300;color:#FDF6F6;letter-spacing:8px;">Merakí</h1>
      <p style="margin:15px 0 0;font-size:14px;color:#8B5CF6;text-transform:uppercase;letter-spacing:3px;">Beauty &amp; Wellness</p>
    </td>
  </tr>
  <tr>
    <td style="padding:40px;">
      <h2 style="margin:0 0 20px;font-size:28px;font-weight:600;color:#FDF6F6;text-align:center;">You're Invited!</h2>
      <p style="margin:0 0 20px;font-size:16px;color:#a0a0b0;text-align:center;line-height:1.6;">
        Hi <strong style="color:#FDF6F6;">${fullName}</strong>,
      </p>
      <p style="margin:0 0 30px;font-size:16px;color:#a0a0b0;text-align:center;line-height:1.6;">
        You've been invited to join <strong style="color:#8B5CF6;">Merakí</strong> as a beauty professional.
        Manage your bookings, services, portfolio, and clients — all in one place.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#3d3d5c 0%,#2d2d44 100%);border-radius:16px;margin-bottom:30px;">
        <tr>
          <td style="padding:30px;text-align:center;">
            <p style="margin:0 0 15px;font-size:14px;color:#8B5CF6;text-transform:uppercase;letter-spacing:2px;">What You'll Get</p>
            <p style="margin:0;font-size:14px;color:#a0a0b0;line-height:1.8;text-align:left;">
              ✓ Your own professional profile &amp; portfolio<br>
              ✓ Online booking system with calendar management<br>
              ✓ Client management &amp; chat<br>
              ✓ Wholesale pricing on all products<br>
              ✓ Access to the Merakí Academy
            </p>
          </td>
        </tr>
      </table>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td align="center" style="padding:10px 0 30px;">
            <a href="${registerUrl}" style="display:inline-block;background:linear-gradient(135deg,#8B5CF6,#6D28D9);color:#ffffff;text-decoration:none;padding:16px 48px;border-radius:50px;font-size:16px;font-weight:600;letter-spacing:1px;">
              Get Started
            </a>
          </td>
        </tr>
      </table>
      <p style="margin:0;font-size:13px;color:#6b6b80;text-align:center;">
        If you didn't expect this invitation, you can safely ignore this email.
      </p>
    </td>
  </tr>
  <tr>
    <td style="padding:30px 40px;background:rgba(0,0,0,0.2);text-align:center;">
      <p style="margin:0;font-size:11px;color:#4a4a5a;">© 2026 Merakí. All rights reserved.</p>
    </td>
  </tr>
</table>
</td></tr></table>
</body></html>`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // --- Auth: verify caller is owner ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: authErr,
    } = await userClient.auth.getUser();
    if (authErr || !user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (profile?.role !== "owner")
      return json({ error: "Only owners can invite masters" }, 403);

    // --- Parse body ---
    const body = await req.json();
    const email = body.email?.trim()?.toLowerCase();
    const fullName = body.full_name?.trim();
    if (!email || !fullName)
      return json({ error: "Email and name are required" }, 400);

    // --- Check duplicate application ---
    const { data: existing } = await admin
      .from("master_applications")
      .select("id, status")
      .eq("email", email)
      .maybeSingle();
    if (existing)
      return json(
        {
          error: `An application for this email already exists (status: ${existing.status})`,
        },
        409
      );

    // --- Insert application ---
    const { error: insertErr } = await admin
      .from("master_applications")
      .insert({
        full_name: fullName,
        email,
        status: "invited",
        country_code: "FR",
        currency_code: "EUR",
        timezone: "Europe/Paris",
      });
    if (insertErr) throw new Error(insertErr.message);

    // --- Send invitation email ---
    let emailSent = false;
    let emailNote: string | undefined;

    if (RESEND_API_KEY) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: [email],
          subject: `${fullName}, you're invited to join Merakí!`,
          html: buildInviteHtml(fullName, email, SITE_URL),
        }),
      });
      emailSent = res.ok;
      if (!res.ok) {
        emailNote = `Resend error: ${await res.text()}`;
        console.error("[invite-master] Resend error:", emailNote);
      }
    } else {
      emailNote = "RESEND_API_KEY not configured";
      console.warn("[invite-master]", emailNote);
    }

    return json({
      success: true,
      email_sent: emailSent,
      ...(emailNote && !emailSent ? { note: emailNote } : {}),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[invite-master] error:", msg);
    return json({ error: msg }, 500);
  }
});
