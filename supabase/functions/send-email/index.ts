import { serve } from "https://deno.land/std@0.177.0/http/server.ts";


// Define allowed origins for CORS
const allowedOrigins = [
  "https://meraki.app",
  "https://www.meraki.app",
  "http://localhost:3000",
  "http://localhost:8081",
  "exp://localhost:8081" // Expo development
];

// Get trusted origins from environment or use defaults
const getTrustedOrigins = () => {
  const envOrigins = Deno.env.get("ALLOWED_ORIGINS");
  if (envOrigins) {
    return envOrigins.split(",").map(o => o.trim());
  }
  return allowedOrigins;
};

// Function to generate CORS headers based on the request origin
const getCorsHeaders = (req: Request) => {
  const origin = req.headers.get("Origin") || "";
  const trustedOrigins = getTrustedOrigins();

  // Check if the origin is in the trusted list, otherwise fallback to the first trusted origin
  // (In production, you might want to return no CORS headers or a strict default if origin is unknown)
  const isTrusted = trustedOrigins.includes(origin);
  const allowOrigin = isTrusted ? origin : trustedOrigins[0];

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
};

// Using Resend for email delivery (recommended for Supabase)
// You can also use SendGrid, Postmark, AWS SES, etc.
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "noreply@meraki.app";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }

  try {
    const { to, subject, html, text } = await req.json();

    if (!to || !subject || (!html && !text)) {
      return new Response(
        JSON.stringify({
          error: "Missing required fields: to, subject, and html or text",
        }),
        {
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // If no Resend API key is configured, log the email for development
    if (!RESEND_API_KEY) {
      console.log("📧 Email would be sent (no RESEND_API_KEY configured):");
      console.log({
        to,
        from: FROM_EMAIL,
        subject,
        htmlLength: html?.length || 0,
        textLength: text?.length || 0,
      });

      // In development, return success without actually sending
      if (Deno.env.get("ENVIRONMENT") === "development") {
        return new Response(
          JSON.stringify({
            success: true,
            message: "Email logged (development mode - no API key configured)",
            to,
            subject,
          }),
          {
            headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
            status: 200,
          }
        );
      }

      return new Response(
        JSON.stringify({
          error: "Email service not configured. Please set RESEND_API_KEY environment variable.",
        }),
        {
          headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
          status: 500,
        }
      );
    }

    // Send email via Resend
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        text,
      }),
    });

    if (!res.ok) {
      const error = await res.text();
      throw new Error(`Resend API error: ${error}`);
    }

    const data = await res.json();

    return new Response(
      JSON.stringify({
        success: true,
        messageId: data.id,
        to,
        subject,
      }),
      {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Email sending error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
