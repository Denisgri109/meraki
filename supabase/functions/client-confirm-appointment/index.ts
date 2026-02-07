import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { appointment_id, response } = await req.json();

    if (!appointment_id || !response) {
      return new Response(
        JSON.stringify({ error: "appointment_id and response are required" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    // Process the confirmation
    const { data, error } = await supabaseClient.rpc("client_confirm_appointment", {
      p_appointment_id: appointment_id,
      p_response: response,
    });

    if (error) {
      throw error;
    }

    // Get appointment details for notifications
    const { data: appointment } = await supabaseClient
      .from("appointments")
      .select(`
        *,
        master:master_id (full_name, email, push_token),
        client:client_id (full_name, email),
        service:service_id (name)
      `)
      .eq("id", appointment_id)
      .single();

    if (appointment) {
      // Send notification to master
      if (response === "yes") {
        await notifyMasterConfirmed(supabaseClient, appointment);
        await sendClientConfirmationEmail(supabaseClient, appointment, true);
      } else {
        await notifyMasterCancelled(supabaseClient, appointment);
        await sendClientConfirmationEmail(supabaseClient, appointment, false);
      }
    }

    return new Response(
      JSON.stringify({
        success: data.success,
        status: data.new_status,
        message: data.message,
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

async function notifyMasterConfirmed(supabaseClient: any, appointment: any) {
  const master = appointment.master;
  
  // Send push notification if token exists
  if (master.push_token) {
    const message = {
      to: master.push_token,
      sound: "default",
      title: "Appointment Confirmed ✅",
      body: `${appointment.client.full_name || "A client"} confirmed their appointment for ${appointment.service.name} on ${new Date(appointment.start_time).toLocaleDateString()}`,
      data: {
        type: "appointment_confirmed",
        appointment_id: appointment.id,
        screen: "AppointmentDetail",
      },
    };

    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(message),
    });
  }

  // Send email
  const emailContent = {
    to: master.email,
    subject: "✅ Appointment Confirmed",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #28a745;">Appointment Confirmed!</h2>
        
        <p>Hello ${master.full_name},</p>
        
        <p>Great news! Your client has confirmed their upcoming appointment:</p>
        
        <div style="background: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Client:</strong> ${appointment.client.full_name || "Client"}</p>
          <p><strong>Service:</strong> ${appointment.service.name}</p>
          <p><strong>Date:</strong> ${new Date(appointment.start_time).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
          <p><strong>Time:</strong> ${new Date(appointment.start_time).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</p>
        </div>
        
        <p>The client's card is on hold. No-show protection is now active.</p>
        
        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
        <p style="font-size: 12px; color: #999; text-align: center;">
          Meraki App
        </p>
      </div>
    `,
  };

  await supabaseClient.functions.invoke("send-email", { body: emailContent });
}

async function notifyMasterCancelled(supabaseClient: any, appointment: any) {
  const master = appointment.master;
  
  // Send push notification
  if (master.push_token) {
    const message = {
      to: master.push_token,
      sound: "default",
      title: "Appointment Cancelled",
      body: `${appointment.client.full_name || "A client"} cancelled their appointment. The slot is now available.`,
      data: {
        type: "appointment_cancelled",
        appointment_id: appointment.id,
        screen: "Appointments",
      },
    };

    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(message),
    });
  }

  // Send email
  const emailContent = {
    to: master.email,
    subject: "Appointment Cancelled - Slot Available",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #ffc107;">Appointment Cancelled</h2>
        
        <p>Hello ${master.full_name},</p>
        
        <p>A client has cancelled their appointment:</p>
        
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Service:</strong> ${appointment.service.name}</p>
          <p><strong>Date:</strong> ${new Date(appointment.start_time).toLocaleDateString()}</p>
          <p><strong>Time:</strong> ${new Date(appointment.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
        </div>
        
        <div style="background: #d4edda; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; color: #155724;">
            <strong>✓ This time slot is now available for new bookings.</strong>
          </p>
        </div>
        
        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
        <p style="font-size: 12px; color: #999; text-align: center;">
          Meraki App
        </p>
      </div>
    `,
  };

  await supabaseClient.functions.invoke("send-email", { body: emailContent });
}

async function sendClientConfirmationEmail(supabaseClient: any, appointment: any, confirmed: boolean) {
  const subject = confirmed ? "✅ Appointment Confirmed" : "Appointment Cancelled";
  const color = confirmed ? "#28a745" : "#ffc107";
  const statusText = confirmed ? "confirmed" : "cancelled";
  
  const emailContent = {
    to: appointment.client.email,
    subject,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: ${color};">Appointment ${confirmed ? "Confirmed" : "Cancelled"}</h2>
        
        <p>Hello ${appointment.client.full_name || "there"},</p>
        
        <p>Your appointment has been ${statusText}:</p>
        
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Service:</strong> ${appointment.service.name}</p>
          <p><strong>Master:</strong> ${appointment.master.full_name}</p>
          <p><strong>Date:</strong> ${new Date(appointment.start_time).toLocaleDateString()}</p>
          <p><strong>Time:</strong> ${new Date(appointment.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
        </div>
        
        ${confirmed ? `
        <div style="background: #d4edda; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; color: #155724;">
            <strong>✓ Your appointment is confirmed!</strong> We look forward to seeing you.
          </p>
          <p style="margin: 10px 0 0 0; color: #155724; font-size: 14px;">
            Remember: Please arrive on time. If you don't show up or are significantly late, a no-show fee may apply.
          </p>
        </div>
        ` : `
        <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; color: #856404;">
            <strong>Your appointment has been cancelled.</strong>
          </p>
          <p style="margin: 10px 0 0 0; color: #856404; font-size: 14px;">
            Your payment hold has been released. No charges have been made.
          </p>
        </div>
        `}
        
        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
        <p style="font-size: 12px; color: #999; text-align: center;">
          Meraki App
        </p>
      </div>
    `,
  };

  await supabaseClient.functions.invoke("send-email", { body: emailContent });
}
