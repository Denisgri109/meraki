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

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-IE", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency.toUpperCase()}`;
  }
}

/**
 * The card to charge comes from the SetupIntent the client completed when they booked.
 * The previous version read appointment.stripe_payment_method_id, a column that does not
 * exist on appointments, so Stripe was always called with payment_method: undefined.
 */
async function resolvePaymentMethod(appointment: any): Promise<string | null> {
  if (appointment.stripe_setup_intent_id) {
    try {
      const setupIntent = await stripe.setupIntents.retrieve(appointment.stripe_setup_intent_id);
      if (typeof setupIntent.payment_method === "string") return setupIntent.payment_method;
      if (setupIntent.payment_method?.id) return setupIntent.payment_method.id;
    } catch (error) {
      console.error("Could not read the booking's setup intent:", error);
    }
  }

  const customerId = appointment.client?.stripe_customer_id;
  if (!customerId) return null;

  try {
    const methods = await stripe.paymentMethods.list({ customer: customerId, type: "card", limit: 1 });
    return methods.data[0]?.id ?? null;
  } catch (error) {
    console.error("Could not list the customer's payment methods:", error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: appointments, error: fetchError } = await supabaseClient.rpc(
      "get_appointments_for_auto_charge"
    );

    if (fetchError) throw fetchError;

    if (!appointments || appointments.length === 0) {
      return new Response(
        JSON.stringify({ message: "No appointments ready for auto-charge" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const results = [];

    for (const appt of appointments) {
      try {
        const { data: confirmation } = await supabaseClient
          .from("appointment_confirmations")
          .select("client_arrived_at, grace_period_ends_at")
          .eq("appointment_id", appt.appointment_id)
          .single();

        if (confirmation?.client_arrived_at) {
          results.push({
            appointment_id: appt.appointment_id,
            status: "skipped",
            reason: "Client arrived during grace period",
          });
          continue;
        }

        const { data: appointment } = await supabaseClient
          .from("appointments")
          .select(`
            *,
            client:client_id (full_name, email, stripe_customer_id),
            master:master_id (full_name, email, stripe_connect_id, currency_code),
            service:service_id (name)
          `)
          .eq("id", appt.appointment_id)
          .single();

        if (!appointment) throw new Error("Appointment not found");

        const paymentMethodId = await resolvePaymentMethod(appointment);
        if (!paymentMethodId) {
          // Nothing to charge. Settle the row so the job does not reconsider it every five
          // minutes forever, and leave the fee for the master to take manually.
          await supabaseClient
            .from("appointments")
            .update({
              no_show_processed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", appt.appointment_id);

          results.push({
            appointment_id: appt.appointment_id,
            status: "skipped",
            reason: "No saved card to charge",
          });
          continue;
        }

        const currency = (appointment.master?.currency_code || "eur").toLowerCase();

        // The idempotency key is the safety net that matters here: if this function throws
        // after Stripe has taken the money, the next run reuses the same PaymentIntent
        // instead of creating a second charge.
        const paymentIntent = await stripe.paymentIntents.create(
          {
            amount: Math.round(appt.no_show_charge_amount * 100),
            currency,
            customer: appointment.client?.stripe_customer_id,
            payment_method: paymentMethodId,
            off_session: true,
            confirm: true,
            description: `Auto no-show fee for ${appointment.service.name} - Grace period expired`,
            metadata: {
              appointment_id: appt.appointment_id,
              type: "auto_no_show_charge",
              master_id: appointment.master_id,
              client_id: appointment.client_id,
              grace_period_ended: confirmation?.grace_period_ends_at ?? "",
            },
          },
          { idempotencyKey: `no-show-${appt.appointment_id}` }
        );

        if (paymentIntent.status !== "succeeded") {
          throw new Error(`Charge did not succeed (status: ${paymentIntent.status})`);
        }

        // Record the outcome before anything that can throw. The previous version read
        // paymentIntent.charges.data[0], which does not exist on API version 2023-10-16, so
        // it threw here — after the card had been charged but before the appointment was
        // marked processed, leaving the row to be charged again on the next run.
        await supabaseClient
          .from("appointments")
          .update({
            status: "no_show",
            no_show_processed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", appt.appointment_id);

        let receiptUrl: string | null = null;
        try {
          const chargeId = typeof paymentIntent.latest_charge === "string"
            ? paymentIntent.latest_charge
            : paymentIntent.latest_charge?.id;
          if (chargeId) {
            const charge = await stripe.charges.retrieve(chargeId);
            receiptUrl = charge.receipt_url ?? null;
          }
        } catch (error) {
          console.error("Could not read the receipt URL:", error);
        }

        await supabaseClient
          .from("appointment_confirmations")
          .update({
            no_show_charge_captured: true,
            no_show_charge_receipt_url: receiptUrl,
          })
          .eq("appointment_id", appt.appointment_id);

        await sendAutoChargeEmail(supabaseClient, appointment, appt.no_show_charge_amount, receiptUrl, currency);
        await sendMasterAutoChargeEmail(supabaseClient, appointment, appt.no_show_charge_amount, currency);

        results.push({
          appointment_id: appt.appointment_id,
          status: "charged",
          charge_amount: appt.no_show_charge_amount,
          payment_intent_id: paymentIntent.id,
        });
      } catch (error) {
        console.error(`Error auto-charging appointment ${appt.appointment_id}:`, error);
        results.push({
          appointment_id: appt.appointment_id,
          status: "error",
          error: error.message,
        });
      }
    }

    return new Response(
      JSON.stringify({
        message: `Processed ${appointments.length} appointments for auto-charge`,
        charged: results.filter((r) => r.status === "charged").length,
        skipped: results.filter((r) => r.status === "skipped").length,
        errors: results.filter((r) => r.status === "error").length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});

async function sendAutoChargeEmail(
  supabaseClient: any,
  appointment: any,
  chargeAmount: number,
  receiptUrl: string | null,
  currency: string
) {
  const emailContent = {
    to: appointment.client.email,
    subject: `No-Show Fee Applied (Grace Period Expired) - ${appointment.service.name}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc3545;">No-Show Fee Applied</h2>

        <p>Hello ${appointment.client.full_name || "there"},</p>

        <p>You were given a grace period to arrive for your appointment, but the grace period has now expired. A no-show fee has been automatically applied.</p>

        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Service:</strong> ${appointment.service.name}</p>
          <p><strong>Master:</strong> ${appointment.master.full_name}</p>
          <p><strong>Original Time:</strong> ${new Date(appointment.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
        </div>

        <div style="background: #f8d7da; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #721c24;">Charge Applied</h3>
          <p style="font-size: 24px; font-weight: bold; margin: 10px 0; color: #721c24;">
            ${formatMoney(chargeAmount, currency)}
          </p>
          <p style="margin: 0; color: #721c24;">No-show fee (grace period expired)</p>
          ${receiptUrl ? `<p style="margin-top: 15px;"><a href="${receiptUrl}" style="color: #721c24; text-decoration: underline;">View Receipt</a></p>` : ''}
        </div>

        <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 0; color: #856404; font-size: 14px;">
            <strong>Questions or believe this was applied in error?</strong><br>
            Please contact ${appointment.master.full_name} directly through the Meraki app.
          </p>
        </div>

        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
        <p style="font-size: 12px; color: #999; text-align: center;">
          This is an automated message from Meraki App.
        </p>
      </div>
    `,
  };

  await supabaseClient.functions.invoke("send-email", { body: emailContent });
}

async function sendMasterAutoChargeEmail(
  supabaseClient: any,
  appointment: any,
  chargeAmount: number,
  currency: string
) {
  const emailContent = {
    to: appointment.master.email,
    subject: `Auto No-Show Fee Applied - ${appointment.service.name}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #28a745;">No-Show Fee Auto-Applied</h2>

        <p>Hello ${appointment.master.full_name},</p>

        <p>The grace period for a no-show appointment has expired, and the no-show fee has been automatically charged:</p>

        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Client:</strong> ${appointment.client.full_name || "Client"}</p>
          <p><strong>Service:</strong> ${appointment.service.name}</p>
          <p><strong>Date:</strong> ${new Date(appointment.start_time).toLocaleDateString()}</p>
          <p><strong>Original Time:</strong> ${new Date(appointment.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
        </div>

        <div style="background: #d4edda; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: #155724;">Charge Applied</h3>
          <p style="font-size: 24px; font-weight: bold; margin: 10px 0; color: #155724;">
            ${formatMoney(chargeAmount, currency)}
          </p>
          <p style="margin: 0; color: #155724;">No-show fee has been charged to the client's card</p>
          <p style="margin: 10px 0 0 0; color: #155724; font-size: 14px;">
            This amount will be transferred to your account according to your payout schedule.
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
