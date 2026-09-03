import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: string;
  badge?: number;
  channelId?: string;
}

/**
 * Android draws a notification on the channel it names. The app creates three channels in
 * registerForPushNotificationsAsync — default, appointments and messages — but nothing was
 * ever sending a channelId, so every push landed on "default" and the other two were dead.
 */
function channelFor(type: unknown): string {
  switch (type) {
    case "appointment_reminder":
    case "confirmation_request":
      return "appointments";
    case "message":
      return "messages";
    default:
      return "default";
  }
}

/**
 * verify_jwt alone is not enough here: the anon key that ships inside the app bundle is
 * itself a valid project JWT, so anyone holding it could relay an arbitrary title and body
 * to any Expo token they knew. Every legitimate caller is a signed-in screen, so require a
 * real user behind the token.
 */
async function callerIsSignedIn(req: Request): Promise<boolean> {
  const authorization = req.headers.get("Authorization");
  if (!authorization) return false;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authorization } } },
  );

  const { data, error } = await supabase.auth.getUser();
  return !error && !!data.user;
}

Deno.serve(async (req: Request) => {
  try {
    if (!(await callerIsSignedIn(req))) {
      return new Response(
        JSON.stringify({ success: false, error: "Sign-in required" }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }

    const { token, title, body, data } = await req.json();

    if (!token || !title || !body) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: token, title, body" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    if (typeof token !== "string" || !token.startsWith("ExponentPushToken")) {
      return new Response(
        JSON.stringify({ success: false, error: "Not a valid Expo push token" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const message: PushMessage = {
      to: token,
      title,
      body,
      data: data ?? {},
      sound: "default",
      channelId: channelFor((data ?? {}).type),
    };

    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify([message]),
    });

    const result = await response.json();

    // Expo answers 200 with a per-message ticket even when it refuses to deliver — an
    // unregistered device comes back as {status: "error", details: {error:
    // "DeviceNotRegistered"}}. Reporting success:true regardless meant callers could never
    // tell a delivered push from a dropped one.
    const ticket = Array.isArray(result?.data) ? result.data[0] : result?.data;
    const accepted = response.ok && ticket?.status === "ok";

    return new Response(
      JSON.stringify({
        success: accepted,
        error: accepted ? undefined : ticket?.message ?? result?.errors ?? "Push was rejected",
        details: ticket?.details,
        result,
      }),
      {
        status: accepted ? 200 : 502,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
