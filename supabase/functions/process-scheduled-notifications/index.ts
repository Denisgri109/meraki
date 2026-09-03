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

interface ExpoTicket {
  status?: string;
  message?: string;
  details?: { error?: string };
}

/** The app registers default, appointments and messages channels; use the right one. */
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

async function sendExpoPush(messages: PushMessage[]): Promise<ExpoTicket[]> {
  if (messages.length === 0) return [];

  const response = await fetch(EXPO_PUSH_URL, {
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Accept-Encoding": "gzip, deflate",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(messages),
  });

  if (!response.ok) {
    // A transport-level failure says nothing about individual messages. Treat every one as
    // unsent so the next run retries it rather than dropping it on the floor.
    throw new Error(`Expo push endpoint returned ${response.status}`);
  }

  const body = await response.json();
  return Array.isArray(body?.data) ? body.data : [];
}

Deno.serve(async () => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: pending, error: fetchError } = await supabase
      .from("scheduled_notifications")
      .select(`
        id,
        user_id,
        type,
        title,
        body,
        data,
        profiles!scheduled_notifications_user_id_fkey (push_token)
      `)
      .lte("scheduled_for", new Date().toISOString())
      .is("sent_at", null)
      .limit(100);

    if (fetchError) {
      throw new Error(`Failed to fetch notifications: ${fetchError.message}`);
    }

    if (!pending || pending.length === 0) {
      return new Response(
        JSON.stringify({ message: "No pending notifications", processed: 0 }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    const messages: PushMessage[] = [];
    const rowForMessage: { id: string; userId: string; token: string }[] = [];
    // Nothing to deliver to — settle these so they are not reconsidered every minute.
    const noRecipient: string[] = [];

    for (const notification of pending) {
      const pushToken = (notification.profiles as { push_token?: string } | null)?.push_token;

      if (pushToken && pushToken.startsWith("ExponentPushToken")) {
        messages.push({
          to: pushToken,
          title: notification.title,
          body: notification.body,
          data: notification.data ?? {},
          sound: "default",
          channelId: channelFor(notification.type),
        });
        rowForMessage.push({
          id: notification.id,
          userId: notification.user_id,
          token: pushToken,
        });
      } else {
        noRecipient.push(notification.id);
      }
    }

    // Previously every row was stamped sent_at regardless of what Expo said, so a rejected
    // push was silently lost and never retried. Only settle what Expo actually accepted.
    const delivered: string[] = [];
    const retryLater: string[] = [];
    const staleTokens = new Set<string>();
    let transportError: string | null = null;

    try {
      const tickets = await sendExpoPush(messages);

      rowForMessage.forEach((row, index) => {
        const ticket = tickets[index];

        if (ticket?.status === "ok") {
          delivered.push(row.id);
          return;
        }

        // The device uninstalled the app or the token was replaced. Retrying will never
        // succeed, so drop the dead token and stop reconsidering the row.
        if (ticket?.details?.error === "DeviceNotRegistered") {
          delivered.push(row.id);
          staleTokens.add(row.userId);
          return;
        }

        retryLater.push(row.id);
      });
    } catch (error) {
      transportError = (error as Error).message;
      retryLater.push(...rowForMessage.map((row) => row.id));
    }

    const settled = [...delivered, ...noRecipient];
    if (settled.length > 0) {
      const { error: updateError } = await supabase
        .from("scheduled_notifications")
        .update({ sent_at: new Date().toISOString() })
        .in("id", settled);

      if (updateError) {
        console.error("Error marking notifications as sent:", updateError.message);
      }
    }

    if (staleTokens.size > 0) {
      const { error: tokenError } = await supabase
        .from("profiles")
        .update({ push_token: null, push_token_updated_at: null })
        .in("id", [...staleTokens]);

      if (tokenError) {
        console.error("Error clearing dead push tokens:", tokenError.message);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        considered: pending.length,
        delivered: delivered.length,
        noRecipient: noRecipient.length,
        retryLater: retryLater.length,
        clearedTokens: staleTokens.size,
        transportError,
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error processing notifications:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
