import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: string;
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

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization) return json({ success: false, error: "Sign-in required" }, 401);

    // verify_jwt alone is not enough: the anon key shipped in the app bundle is itself a
    // valid project JWT. Resolve the caller so only a real signed-in user gets through.
    const caller = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authorization } } },
    );

    const { data: userData, error: userError } = await caller.auth.getUser();
    if (userError || !userData.user) {
      return json({ success: false, error: "Sign-in required" }, 401);
    }

    const { userId, title, body, data } = await req.json();

    if (!title || !body) {
      return json({ error: "Missing required fields: title, body" }, 400);
    }
    // Recipients are named by id only. Accepting a caller-supplied push token was what let
    // anyone who could read profiles.push_token relay an arbitrary message to that device.
    if (!userId || typeof userId !== "string") {
      return json({ error: "Missing required field: userId" }, 400);
    }

    // Authorise the same way the profiles policy does: studio staff, or someone the caller
    // actually shares a conversation or an appointment with.
    const [{ data: staff }, { data: viaChat }, { data: viaBooking }] = await Promise.all([
      caller.rpc("is_staff"),
      caller.rpc("shares_conversation_with", { p_other: userId }),
      caller.rpc("shares_appointment_with", { p_other: userId }),
    ]);

    if (!staff && !viaChat && !viaBooking) {
      return json({ success: false, error: "Not allowed to notify this user" }, 403);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: recipient, error: lookupError } = await admin
      .from("profiles")
      .select("push_token")
      .eq("id", userId)
      .single();

    if (lookupError) {
      return json({ success: false, error: "Recipient not found" }, 404);
    }

    const pushToken = recipient?.push_token ?? null;

    // A recipient who never enabled notifications is not an error — the caller should carry
    // on with whatever it was doing.
    if (!pushToken || !pushToken.startsWith("ExponentPushToken")) {
      return json({ success: false, skipped: true, reason: "No push token registered" }, 200);
    }

    const message: PushMessage = {
      to: pushToken,
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

    // Drop a token Expo says is dead so it is not retried forever.
    if (!accepted && ticket?.details?.error === "DeviceNotRegistered") {
      await admin
        .from("profiles")
        .update({ push_token: null, push_token_updated_at: null })
        .eq("id", userId);
    }

    return json(
      {
        success: accepted,
        error: accepted ? undefined : ticket?.message ?? result?.errors ?? "Push was rejected",
        details: ticket?.details,
        result,
      },
      accepted ? 200 : 502,
    );
  } catch (error) {
    return json({ success: false, error: (error as Error).message }, 500);
  }
});
