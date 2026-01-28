import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface MessagePayload {
    message_id?: string;
    record?: {
        id: string;
        conversation_id: string;
        sender_id: string;
        content: string | null;
        media_type: string | null;
    };
}

Deno.serve(async (req: Request) => {
    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const payload: MessagePayload = await req.json();

        // Support both direct call with message_id and webhook trigger with record
        let messageId = payload.message_id;
        let messageRecord = payload.record;

        if (!messageId && !messageRecord) {
            return new Response(
                JSON.stringify({ error: "message_id or record required" }),
                { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // If we have message_id but not record, fetch the message
        if (messageId && !messageRecord) {
            const { data: msg, error } = await supabase
                .from("messages")
                .select("id, conversation_id, sender_id, content, media_type")
                .eq("id", messageId)
                .single();

            if (error || !msg) {
                return new Response(
                    JSON.stringify({ error: "Message not found" }),
                    { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
            }
            messageRecord = msg;
        }

        // Get conversation to find the recipient
        const { data: conversation, error: convError } = await supabase
            .from("conversations")
            .select("client_id, master_id")
            .eq("id", messageRecord!.conversation_id)
            .single();

        if (convError || !conversation) {
            return new Response(
                JSON.stringify({ error: "Conversation not found" }),
                { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Determine recipient (the one who didn't send the message)
        const recipientId = messageRecord!.sender_id === conversation.client_id
            ? conversation.master_id
            : conversation.client_id;

        // Get recipient's push token and preferences
        const { data: recipient, error: recipientError } = await supabase
            .from("profiles")
            .select("push_token, full_name, notification_preferences")
            .eq("id", recipientId)
            .single();

        if (recipientError || !recipient) {
            return new Response(
                JSON.stringify({ message: "Recipient not found" }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Check if recipient has message notifications enabled
        const prefs = recipient.notification_preferences;
        if (prefs && prefs.messages === false) {
            return new Response(
                JSON.stringify({ message: "Recipient has message notifications disabled" }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        if (!recipient.push_token) {
            return new Response(
                JSON.stringify({ message: "Recipient has no push token" }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Get sender's name
        const { data: sender } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", messageRecord!.sender_id)
            .single();

        const senderName = sender?.full_name || "Someone";

        // Build notification body
        let body = messageRecord!.content || "";
        if (messageRecord!.media_type === "image") {
            body = "📷 Sent a photo";
        } else if (messageRecord!.media_type === "video") {
            body = "🎥 Sent a video";
        } else if (!body) {
            body = "Sent you a message";
        } else if (body.length > 100) {
            body = body.substring(0, 100) + "...";
        }

        // Send push notification
        const notification = {
            to: recipient.push_token,
            sound: "default",
            title: `💬 ${senderName}`,
            body: body,
            data: {
                type: "message",
                conversation_id: messageRecord!.conversation_id,
                message_id: messageRecord!.id,
            },
            channelId: "messages",
        };

        const response = await fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            body: JSON.stringify(notification),
        });

        const result = await response.json();
        console.log("Push notification result:", result);

        return new Response(
            JSON.stringify({
                success: true,
                message: `Notification sent to ${recipient.full_name || recipientId}`,
                result,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error("Error:", error);
        return new Response(
            JSON.stringify({ error: (error as Error).message }),
            {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        );
    }
});
