import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// T02 — invite-client (owner creates walk-in clients; emailed a set-password link).
// Mirrored from invite-master but: verify_jwt=true at deployment, role='client',
// duplicates checked on profiles.email, and auth user created directly
// (profiles row is auto-created by the handle_new_user trigger on auth.users;
//  step-0 decision recorded in .omo/evidence/t02-discovery.txt).

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SITE_URL = Deno.env.get("SITE_URL") || "http://localhost:4001";
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "Merak\u00ed <noreply@pingrab.xyz>";

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function buildInviteHtml(fullName: string, actionLink: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;background-color:#1a1a2e;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#1a1a2e;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:linear-gradient(135deg,#2d2d44 0%,#1a1a2e 100%);border-radius:24px;overflow:hidden;box-shadow:0 20px 60px rgba(139,92,246,0.3);">
  <tr>
    <td style="padding:50px 40px 30px;text-align:center;background:linear-gradient(135deg,rgba(139,92,246,0.2) 0%,transparent 100%);">
      <h1 style="margin:0;font-size:48px;font-weight:300;color:#FDF6F6;letter-spacing:8px;">Merak\u00ed</h1>
      <p style="margin:15px 0 0;font-size:14px;color:#8B5CF6;text-transform:uppercase;letter-spacing:3px;">Beauty &amp; Wellness</p>
    </td>
  </tr>
  <tr>
    <td style="padding:40px;">
      <h2 style="margin:0 0 20px;font-size:28px;font-weight:600;color:#FDF6F6;text-align:center;">Welcome to Merak\u00ed!</h2>
      <p style="margin:0 0 20px;font-size:16px;color:#a0a0b0;text-align:center;line-height:1.6;">
        Hi <strong style="color:#FDF6F6;">${fullName}</strong>,
      </p>
      <p style="margin:0 0 30px;font-size:16px;color:#a0a0b0;text-align:center;line-height:1.6;">
        An account has been created for you at <strong style="color:#8B5CF6;">Merak\u00ed</strong>.
        Tap below to set your password and start booking your appointments.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td align="center" style="padding:10px 0 30px;">
            <a href="${actionLink}" style="display:inline-block;background:linear-gradient(135deg,#8B5CF6,#6D28D9);color:#ffffff;text-decoration:none;padding:16px 48px;border-radius:50px;font-size:16px;font-weight:600;letter-spacing:1px;">
              Set Your Password
            </a>
          </td>
        </tr>
      </table>
      <p style="margin:0;font-size:13px;color:#6b6b80;text-align:center;">
        If you didn't expect this email, you can safely ignore it.
      </p>
    </td>
  </tr>
  <tr>
    <td style="padding:30px 40px;background:rgba(0,0,0,0.2);text-align:center;">
      <p style="margin:0;font-size:11px;color:#4a4a5a;">\u00a9 2026 Merak\u00ed. All rights reserved.</p>
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
      return json({ error: "Only owners can create clients" }, 403);

    const body = await req.json();
    const email = body.email?.trim()?.toLowerCase();
    const fullName = body.fullName?.trim();
    const phone = body.phone?.trim() || null;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return json({ error: "A valid email is required" }, 400);
    if (!fullName || fullName.length < 2)
      return json({ error: "Full name (min 2 characters) is required" }, 400);

    // Case-insensitive duplicate check (auth also enforces unique email).
    const { data: existing } = await admin
      .from("profiles")
      .select("id")
      .ilike("email", email)
      .maybeSingle();
    if (existing)
      return json(
        { error: "A user with this email already exists", code: "duplicate" },
        409
      );

    // Random temp password; the emailed recovery link lets the client set their own.
    const tempPassword = crypto.randomUUID() + "!Aq3";
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: fullName, role: "client", invited_by: user.id },
    });
    if (createErr) {
      if (/already|exists|duplicate/i.test(createErr.message))
        return json(
          { error: "A user with this email already exists", code: "duplicate" },
          409
        );
      throw new Error(createErr.message);
    }
    const newUserId = created.user.id;

    // handle_new_user trigger creates the profiles row; add phone if provided.
    if (phone) {
      const { error: phoneErr } = await admin
        .from("profiles")
        .update({ phone })
        .eq("id", newUserId);
      if (phoneErr)
        console.warn("[invite-client] phone update failed:", phoneErr.message);
    }

    const { data: linkData, error: linkErr } =
      await admin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: { redirectTo: `${SITE_URL}/reset-password` },
      });
    if (linkErr) throw new Error(linkErr.message);
    const actionLink = linkData?.properties?.action_link;

    let emailSent = false;
    let emailNote: string | undefined;

    if (RESEND_API_KEY && actionLink) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: [email],
          subject: `${fullName}, welcome to Merak\u00ed!`,
          html: buildInviteHtml(fullName, actionLink),
        }),
      });
      emailSent = res.ok;
      if (!res.ok) {
        emailNote = `Resend error: ${await res.text()}`;
        console.error("[invite-client] Resend error:", emailNote);
      }
    } else {
      emailNote = RESEND_API_KEY
        ? "No recovery action_link generated"
        : "RESEND_API_KEY not configured";
      console.warn("[invite-client]", emailNote);
    }

    return json({
      success: true,
      data: { id: newUserId, email },
      email_sent: emailSent,
      ...(emailNote && !emailSent ? { note: emailNote } : {}),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[invite-client] error:", msg);
    return json({ error: msg }, 500);
  }
});
