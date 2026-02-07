import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@12.0.0?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
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
    const { appointment_id, charge_now } = await req.json();

    if (!appointment_id) {
      return new Response(
        JSON.stringify({ error: "appointment_id is required" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

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

    // Get appointment details
    const { data: appointment, error: apptError } = await supabaseClient
      .from("appointments")
      .select(`
        *,
        master:master_id (full_name, email),
        client:client_id (full_name, email, push_token),
        service:service_id (name)
      `)
      .eq("id", appointment_id)
      .single();

    if (apptError || !appointment) {
      console.error("Appointment fetch error:", apptError);
      throw new Error("Appointment not found");
    }

    // Get master settings for no-show charge percentage
    const { data: masterSettings } = await supabaseClient
      .from("master_settings")
      .select("no_show_charge_percent, grace_period_multiplier, auto_charge_after_grace_period")
      .eq("master_id", appointment.master_id)
      .single();

    const noShowChargePercent = masterSettings?.no_show_charge_percent || 100;
    const gracePeriodMultiplier = masterSettings?.grace_period_multiplier || 0.5;
    const serviceDuration = appointment.service_duration_minutes || 60;
    const gracePeriodMinutes = Math.max(15, Math.ceil(serviceDuration * gracePeriodMultiplier));
    const chargeAmount = (appointment.price * noShowChargePercent) / 100;
    const gracePeriodEndsAt = new Date();
    gracePeriodEndsAt.setMinutes(gracePeriodEndsAt.getMinutes() + gracePeriodMinutes);

    if (charge_now !== false) {
      // Mark appointment as no_show immediately
      await supabaseClient
        .from("appointments")
        .update({
          status: "no_show",
          no_show_charge_amount: chargeAmount,
          no_show_processed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("id", appointment_id);

      // Update confirmation record
      await supabaseClient
        .from("appointment_confirmations")
        .update({
          no_show_charge_captured: true,
          grace_period_ends_at: gracePeriodEndsAt.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("appointment_id", appointment_id);

      // Try to capture the payment if there's a payment intent
      if (appointment.stripe_payment_intent_id) {
        try {
          // Check if this is a mock payment intent (for testing)
          if (appointment.stripe_payment_intent_id.startsWith('mock_pi_')) {
            console.log('Mock payment - skipping Stripe charge');
          } else {
            // Cancel the original hold first
            try {
              await stripe.paymentIntents.cancel(appointment.stripe_payment_intent_id);
            } catch (e) {
              console.log("Original payment intent already cancelled or captured");
            }

            // Only charge if we have customer and payment method
            if (appointment.stripe_customer_id && appointment.stripe_payment_method_id) {
              const paymentIntent = await stripe.paymentIntents.create({
                amount: Math.round(chargeAmount * 100),
                currency: "eur",
                customer: appointment.stripe_customer_id,
                payment_method: appointment.stripe_payment_method_id,
                off_session: true,
                confirm: true,
                description: `No-show fee for ${appointment.service?.name || 'appointment'} - ${appointment.master?.full_name || 'Master'}`,
                metadata: {
                  appointment_id: appointment_id,
                  type: "no_show_charge",
                  master_id: appointment.master_id,
                  client_id: appointment.client_id,
                },
              });

              // Update with receipt URL
              if (paymentIntent.charges?.data?.[0]?.receipt_url) {
                await supabaseClient
                  .from("appointment_confirmations")
                  .update({
                    no_show_charge_receipt_url: paymentIntent.charges.data[0].receipt_url,
                    updated_at: new Date().toISOString(),
                  })
                  .eq("appointment_id", appointment_id);
              }
            }
          }
        } catch (stripeError: any) {
          console.error("Stripe charge error:", stripeError.message);
          // Continue - the DB is already updated
        }
      }
    } else {
      // Just set grace period - will auto-charge after unless client arrives
      await supabaseClient
        .from("appointment_confirmations")
        .update({
          grace_period_ends_at: gracePeriodEndsAt.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("appointment_id", appointment_id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        appointment_id,
        charge_amount: chargeAmount,
        grace_period_minutes: gracePeriodMinutes,
        grace_period_ends_at: gracePeriodEndsAt.toISOString(),
        message: charge_now !== false
          ? `No-show charge of ${noShowChargePercent}% (€${chargeAmount.toFixed(2)}) processed`
          : `Grace period set for ${gracePeriodMinutes} minutes`,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error processing no-show:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
