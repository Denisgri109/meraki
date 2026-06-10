import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@12.0.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Get appointments needing confirmation reminders
    const { data: appointments, error: fetchError } = await supabaseClient.rpc(
      "get_appointments_needing_confirmation_reminder"
    );

    if (fetchError) {
      throw fetchError;
    }

    if (!appointments || appointments.length === 0) {
      return new Response(
        JSON.stringify({ message: "No appointments need confirmation reminders" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    const results = [];

    for (const appt of appointments) {
      try {
        // Send push notification
        if (appt.client_push_token) {
          await sendPushNotification(
            supabaseClient,
            appt.client_push_token,
            appt
          );
        }

        // Send email notification
        await sendEmailNotification(supabaseClient, appt);

        // Update appointment to mark reminder as sent
        await supabaseClient
          .from("appointments")
          .update({ confirmation_reminder_sent_at: new Date().toISOString() })
          .eq("id", appt.appointment_id);

        // Log notification
        await supabaseClient.from("notification_logs").insert([
          {
            user_id: appt.client_id,
            appointment_id: appt.appointment_id,
            notification_type: "confirmation_request",
            channel: appt.client_push_token ? "push" : "email",
            status: "sent",
            sent_at: new Date().toISOString(),
          },
        ]);

        results.push({
          appointment_id: appt.appointment_id,
          status: "success",
          client_notified: true,
        });
      } catch (error) {
        console.error(`Error processing appointment ${appt.appointment_id}:`, error);
        results.push({
          appointment_id: appt.appointment_id,
          status: "error",
          error: error.message,
        });
      }
    }

    return new Response(
      JSON.stringify({
        message: `Processed ${appointments.length} appointments`,
        results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

async function sendPushNotification(supabaseClient: any, pushToken: string, appt: any) {
  const message = {
    to: pushToken,
    sound: "default",
    title: "Confirm Your Appointment",
    body: `Your appointment with ${appt.master_full_name} is on ${new Date(
      appt.start_time
    ).toLocaleDateString()} at ${new Date(
      appt.start_time
    ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}. Please confirm.`,
    data: {
      type: "appointment_confirmation",
      appointment_id: appt.appointment_id,
      master_name: appt.master_full_name,
      start_time: appt.start_time,
      confirmation_deadline: appt.confirmation_deadline,
      screen: "AppointmentConfirmation",
    },
    priority: "high",
    _contentAvailable: true,
  };

  // Send via Expo Push API
  const response = await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "Accept-encoding": "gzip, deflate",
    },
    body: JSON.stringify(message),
  });

  if (!response.ok) {
    throw new Error(`Push notification failed: ${await response.text()}`);
  }

  return response.json();
}

async function sendEmailNotification(supabaseClient: any, appt: any) {
  // Get master settings to include T&C in email
  const { data: masterSettings } = await supabaseClient
    .from("master_settings")
    .select("terms_and_conditions, no_show_charge_percent")
    .eq("master_id", appt.master_id)
    .single();

  const noShowPercent = masterSettings?.no_show_charge_percent || 100;
  const termsAndConditions = masterSettings?.terms_and_conditions || "";

  // Prepare email content
  const startDate = new Date(appt.start_time);
  const deadlineDate = new Date(appt.confirmation_deadline);

  const emailContent = {
    to: appt.client_email,
    subject: `Action Required: Confirm Your Appointment with ${appt.master_full_name}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Confirm Your Appointment</h2>
        
        <p>Hello,</p>
        
        <p>You have an upcoming appointment that requires your confirmation:</p>
        
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Master:</strong> ${appt.master_full_name}</p>
          <p><strong>Service:</strong> ${appt.service_name}</p>
          <p><strong>Date:</strong> ${startDate.toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
          })}</p>
          <p><strong>Time:</strong> ${startDate.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          })}</p>
        </div>
        
        <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ffc107;">
          <p style="margin: 0; color: #856404;">
            <strong>⚠️ Please confirm by:</strong> ${deadlineDate.toLocaleString("en-US")}
          </p>
          <p style="margin: 10px 0 0 0; color: #856404; font-size: 14px;">
            If you don't confirm in time, your appointment will be automatically cancelled.
          </p>
        </div>
        
        <div style="background: #f8d7da; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc3545;">
          <p style="margin: 0; color: #721c24;">
            <strong>Important No-Show Policy:</strong>
          </p>
          <p style="margin: 10px 0 0 0; color: #721c24; font-size: 14px;">
            By confirming this appointment, you agree that if you don't show up or arrive significantly late, 
            you may be charged ${noShowPercent}% of the service price as a no-show fee.
          </p>
        </div>
        
        ${
          termsAndConditions
            ? `
        <div style="margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 8px;">
          <h4 style="margin-top: 0;">Terms & Conditions</h4>
          <p style="font-size: 14px; color: #666;">${termsAndConditions}</p>
        </div>
        `
            : ""
        }
        
        <div style="text-align: center; margin: 30px 0;">
          <p style="margin-bottom: 15px; font-weight: bold;">Tap the link below to confirm or cancel:</p>
          <p style="font-size: 14px; color: #666;">
            Please open the Meraki app and respond to the confirmation notification.
          </p>
        </div>
        
        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
        <p style="font-size: 12px; color: #999; text-align: center;">
          This is an automated message from Meraki App. Please do not reply to this email.
        </p>
      </div>
    `,
  };

  // Call email-sending edge function
  const { data, error } = await supabaseClient.functions.invoke("send-email", {
    body: emailContent,
  });

  if (error) {
    throw new Error(`Email notification failed: ${error.message}`);
  }

  return data;
}
