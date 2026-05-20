import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@12.0.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2023-10-16",
  httpClient: Stripe.createFetchHttpClient(),
});

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

    // Get appointments past their confirmation deadline
    const { data: appointments, error: fetchError } = await supabaseClient.rpc(
      "get_appointments_for_auto_cancel"
    );

    if (fetchError) {
      throw fetchError;
    }

    if (!appointments || appointments.length === 0) {
      return new Response(
        JSON.stringify({ message: "No appointments to auto-cancel" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    const results = [];

    for (const appt of appointments) {
      try {
        // Cancel the Stripe PaymentIntent to release the hold
        if (appt.stripe_payment_intent_id) {
          try {
            await stripe.paymentIntents.cancel(appt.stripe_payment_intent_id);
          } catch (stripeError) {
            console.error(
              `Stripe cancel error for appointment ${appt.appointment_id}:`,
              stripeError
            );
            // Continue even if Stripe cancel fails - we'll update the DB anyway
          }
        }

        // Auto-cancel the appointment
        const { data: cancelResult, error: cancelError } = await supabaseClient.rpc(
          "auto_cancel_appointment",
          { p_appointment_id: appt.appointment_id }
        );

        if (cancelError) {
          throw cancelError;
        }

        // Notify client via email
        await sendAutoCancelEmail(supabaseClient, appt);

        // Notify master via email
        await sendMasterAutoCancelNotification(supabaseClient, appt);

        // Log notifications
        await supabaseClient.from("notification_logs").insert([
          {
            user_id: appt.client_id,
            appointment_id: appt.appointment_id,
            notification_type: "auto_cancel",
            channel: "email",
            status: "sent",
            sent_at: new Date().toISOString(),
          },
          {
            user_id: appt.master_id,
            appointment_id: appt.appointment_id,
            notification_type: "auto_cancel",
            channel: "email",
            status: "sent",
            sent_at: new Date().toISOString(),
          },
        ]);

        results.push({
          appointment_id: appt.appointment_id,
          status: "cancelled",
          message: "Auto-cancelled due to no response",
        });
      } catch (error) {
        console.error(`Error auto-cancelling appointment ${appt.appointment_id}:`, error);
        results.push({
          appointment_id: appt.appointment_id,
          status: "error",
          error: error.message,
        });
      }
    }

    return new Response(
      JSON.stringify({
        message: `Auto-cancelled ${results.filter((r) => r.status === "cancelled").length} appointments`,
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

async function sendAutoCancelEmail(supabaseClient: any, appt: any) {
  const startDate = new Date(appt.start_time);

  const emailContent = {
    to: appt.client_email,
    subject: "Your Appointment Has Been Cancelled",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc3545;">Appointment Cancelled</h2>
        
        <p>Hello,</p>
        
        <p>Your appointment has been automatically cancelled because the confirmation deadline has passed.</p>
        
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
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
        
        <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; color: #856404;">
            <strong>Your payment hold has been released.</strong>
          </p>
          <p style="margin: 10px 0 0 0; color: #856404; font-size: 14px;">
            No charges have been made to your card.
          </p>
        </div>
        
        <p>You can book a new appointment anytime through the Meraki app.</p>
        
        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
        <p style="font-size: 12px; color: #999; text-align: center;">
          This is an automated message from Meraki App.
        </p>
      </div>
    `,
  };

  try {
    await supabaseClient.functions.invoke("send-email", {
      body: emailContent,
    });
  } catch (error) {
    console.error("Failed to send auto-cancel email:", error);
  }
}

async function sendMasterAutoCancelNotification(supabaseClient: any, appt: any) {
  const startDate = new Date(appt.start_time);

  const emailContent = {
    to: appt.master_email,
    subject: "Appointment Auto-Cancelled - Slot Now Available",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #ffc107;">Appointment Auto-Cancelled</h2>
        
        <p>An appointment has been automatically cancelled due to client not responding to confirmation request:</p>
        
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
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
        
        <div style="background: #d4edda; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; color: #155724;">
            <strong>✓ This time slot is now available for new bookings.</strong>
          </p>
        </div>
        
        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
        <p style="font-size: 12px; color: #999; text-align: center;">
          This is an automated message from Meraki App.
        </p>
      </div>
    `,
  };

  try {
    await supabaseClient.functions.invoke("send-email", {
      body: emailContent,
    });
  } catch (error) {
    console.error("Failed to send master auto-cancel notification:", error);
  }
}
