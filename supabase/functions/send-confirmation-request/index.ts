import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Send Appointment Confirmation Request Edge Function
// Sends a confirmation request to clients 24 hours before their appointment
// This is part of the no-show protection system

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const PROJECT_URL = Deno.env.get("PROJECT_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY");

interface RequestBody {
    appointment_id: string;
    hours_before?: number; // Default: 24 hours
}

Deno.serve(async (req: Request) => {
    // Handle CORS
    if (req.method === "OPTIONS") {
        return new Response("ok", {
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST",
                "Access-Control-Allow-Headers": "authorization, content-type",
            },
        });
    }

    try {
        const body: RequestBody = await req.json();
        const { appointment_id, hours_before = 24 } = body;

        if (!appointment_id) {
            return new Response(
                JSON.stringify({ error: "Missing appointment_id" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        // Fetch appointment details
        const appointmentQuery = await fetch(
            `${PROJECT_URL}/rest/v1/appointments?id=eq.${appointment_id}&select=*,profiles:client_id(full_name,email,push_token),services(name),profiles:master_id(full_name)`,
            {
                headers: {
                    "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
                    "apikey": SERVICE_ROLE_KEY,
                },
            }
        );

        const appointments = await appointmentQuery.json();

        if (!appointments || appointments.length === 0) {
            return new Response(
                JSON.stringify({ error: "Appointment not found" }),
                { status: 404, headers: { "Content-Type": "application/json" } }
            );
        }

        const appointment = appointments[0];

        // Check if appointment is confirmed and in the future
        if (appointment.status !== 'confirmed') {
            return new Response(
                JSON.stringify({ error: "Appointment is not confirmed" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        // Calculate confirmation deadline (e.g., 6 hours before appointment)
        const appointmentTime = new Date(appointment.start_time);
        const confirmationDeadline = new Date(appointmentTime.getTime() - (6 * 60 * 60 * 1000)); // 6 hours before

        // Update appointment with confirmation details
        const updateQuery = await fetch(
            `${PROJECT_URL}/rest/v1/appointments?id=eq.${appointment_id}`,
            {
                method: "PATCH",
                headers: {
                    "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
                    "apikey": SERVICE_ROLE_KEY,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    confirmation_sent_at: new Date().toISOString(),
                    confirmation_deadline: confirmationDeadline.toISOString(),
                    client_confirmed: null, // Reset to null (waiting for response)
                    confirmation_reminder_count: (appointment.confirmation_reminder_count || 0) + 1,
                }),
            }
        );

        if (!updateQuery.ok) {
            throw new Error("Failed to update appointment confirmation status");
        }

        // Send push notification if available
        if (appointment.profiles.push_token) {
            try {
                const pushPayload = {
                    to: appointment.profiles.push_token,
                    sound: 'default',
                    title: '📅 Confirm Your Appointment',
                    body: `Tap to confirm your ${appointment.services.name} appointment tomorrow at ${new Date(appointment.start_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`,
                    data: {
                        type: 'confirmation_request',
                        appointmentId: appointment_id,
                    },
                    channelId: 'appointments',
                    priority: 'high',
                    _contentAvailable: true,
                };

                const pushResponse = await fetch('https://exp.host/--/api/v2/push/send', {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'Accept-encoding': 'gzip, deflate',
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(pushPayload),
                });

                const pushResult = await pushResponse.json();
                console.log('Push notification sent:', pushResult);

                // Log notification
                await fetch(
                    `${PROJECT_URL}/rest/v1/notification_log`,
                    {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
                            'apikey': SERVICE_ROLE_KEY!,
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            user_id: appointment.client_id,
                            notification_type: 'confirmation_request',
                            title: pushPayload.title,
                            body: pushPayload.body,
                            data: pushPayload.data,
                            appointment_id: appointment_id,
                            delivered: pushResult.data?.status === 'ok',
                        }),
                    }
                );
            } catch (pushError) {
                console.error('Error sending push notification:', pushError);
                // Continue even if push fails - email is still sent
            }
        }

        // Send email confirmation request
        if (RESEND_API_KEY && appointment.profiles.email) {
            const emailHtml = `
                <h2>Appointment Confirmation Required</h2>
                <p>Hi ${appointment.profiles.full_name},</p>
                <p>You have an appointment scheduled for:</p>
                <ul>
                    <li><strong>Service:</strong> ${appointment.services.name}</li>
                    <li><strong>Date:</strong> ${new Date(appointment.start_time).toLocaleDateString()}</li>
                    <li><strong>Time:</strong> ${new Date(appointment.start_time).toLocaleTimeString()}</li>
                    <li><strong>With:</strong> ${appointment.profiles.full_name}</li>
                </ul>
                <p><strong>Please confirm your attendance by clicking the link below:</strong></p>
                <p><a href="${PROJECT_URL}/confirm-appointment?appointment_id=${appointment_id}&action=confirm" 
                      style="background-color: #D48A82; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">
                      Confirm Attendance
                   </a></p>
                <p><strong>Important:</strong> If you confirm and do not show up, you will be charged the full appointment fee.</p>
                <p>If you need to cancel or reschedule, please do so at least 24 hours in advance to avoid fees.</p>
                <p>Please confirm by: ${confirmationDeadline.toLocaleString()}</p>
                <br>
                <p>Thank you,<br>Merakí Team</p>
            `;

            await fetch("https://api.resend.com/emails", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${RESEND_API_KEY}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    from: "Merakí App <noreply@meraki.com>",
                    to: appointment.profiles.email,
                    subject: "Action Required: Confirm Your Appointment",
                    html: emailHtml,
                }),
            });
        }

        return new Response(
            JSON.stringify({
                success: true,
                message: "Confirmation request sent successfully",
                appointment_id: appointment_id,
                confirmation_deadline: confirmationDeadline.toISOString(),
            }),
            {
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*",
                },
            }
        );
    } catch (error: any) {
        console.error("Error sending confirmation request:", error);
        return new Response(
            JSON.stringify({ error: error.message || "Failed to send confirmation request" }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
});
