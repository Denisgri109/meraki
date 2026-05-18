import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

// ───────────────────────────────────────────────────────────────────────
// test-panel-seed
// QA edge function. Whitelisted test accounts seed/manipulate the DB from
// the in-app TestPanel using service-role (bypasses RLS).
//
// SAFETY: params.client_id and params.master_id may be overridden, but ONLY
// to one of the 3 known test account UUIDs. Any other value is rejected and
// the default test client/master is used instead. This guarantees seeded
// data can only ever involve test accounts.
// ───────────────────────────────────────────────────────────────────────

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const TEST_EMAILS = new Set([
    "test@gmail.com",
    "testclient@gmail.com",
    "daxyburn@gmail.com",
]);

const TEST_CLIENT_ID = "3f19e0f2-7e0b-4dc2-8a8e-3ac1939d9f1f"; // testclient@gmail.com
const TEST_OWNER_ID = "744b77f1-e94f-4918-9c04-3b9f47288377";  // test@gmail.com
const TEST_MASTER_ID = "aab4ab46-76d5-4a98-8487-2a6f1b8a2a1b"; // daxyburn@gmail.com
const TEST_IDS = new Set([TEST_CLIENT_ID, TEST_OWNER_ID, TEST_MASTER_ID]);

const CORS_HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
}

function pickActor(raw: unknown, fallback: string): string {
    if (typeof raw === "string" && TEST_IDS.has(raw)) return raw;
    return fallback;
}

function pickString(raw: unknown): string | undefined {
    if (typeof raw !== "string") return undefined;
    const t = raw.trim();
    return t.length > 0 ? t : undefined;
}

function pickNumber(raw: unknown): number | undefined {
    if (typeof raw === "number" && Number.isFinite(raw)) return raw;
    if (typeof raw === "string" && raw.trim() !== "" && Number.isFinite(Number(raw))) return Number(raw);
    return undefined;
}

type ActionParams = Record<string, unknown>;

Deno.serve(async (req: Request) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: CORS_HEADERS });
    }
    if (req.method !== "POST") {
        return jsonResponse({ error: "Method not allowed" }, 405);
    }

    try {
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
            return jsonResponse({ error: "Missing Authorization header" }, 401);
        }
        const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            global: { headers: { Authorization: authHeader } },
        });
        const { data: { user }, error: authError } = await userClient.auth.getUser();
        if (authError || !user) {
            return jsonResponse({ error: "Unauthorized", details: authError?.message }, 401);
        }
        const callerEmail = (user.email || "").toLowerCase();
        if (!TEST_EMAILS.has(callerEmail)) {
            return jsonResponse({ error: "This endpoint is restricted to test accounts" }, 403);
        }

        let body: { action?: string; params?: ActionParams };
        try {
            body = await req.json();
        } catch {
            return jsonResponse({ error: "Invalid JSON body" }, 400);
        }
        const action = (body.action || "").trim();
        const params: ActionParams = body.params || {};
        if (!action) {
            return jsonResponse({ error: "Missing 'action' in body" }, 400);
        }

        const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
            auth: { persistSession: false, autoRefreshToken: false },
        });

        const clientId = pickActor(params.client_id, TEST_CLIENT_ID);
        const masterId = pickActor(params.master_id, TEST_MASTER_ID);
        const customNotes = pickString(params.notes);
        const customMessage = pickString(params.message);

        switch (action) {
            case "create_appointment": {
                const status = (params.status as string) || "pending";
                const when = (params.when as string) || "future";
                const offset = pickNumber(params.minutes_offset);
                const offsetMinutes = offset !== undefined ? offset : (when === "past" ? -1440 : 60);
                const startMs = Date.now() + offsetMinutes * 60 * 1000;

                let serviceId = pickString(params.service_id);
                let durationMinutes = pickNumber(params.duration_minutes) || 60;
                let price = pickNumber(params.price) ?? 50;
                let serviceName: string | null = null;

                if (!serviceId) {
                    const { data: svc } = await admin
                        .from("services")
                        .select("id, duration_minutes, base_price, name")
                        .eq("is_active", true)
                        .or(`created_by.eq.${masterId},created_by.is.null`)
                        .limit(1)
                        .maybeSingle();
                    if (svc) {
                        serviceId = svc.id;
                        if (pickNumber(params.duration_minutes) === undefined) durationMinutes = svc.duration_minutes || 60;
                        if (pickNumber(params.price) === undefined) price = Number(svc.base_price) || price;
                        serviceName = svc.name;
                    }
                } else {
                    const { data: svc } = await admin
                        .from("services")
                        .select("duration_minutes, base_price, name")
                        .eq("id", serviceId)
                        .maybeSingle();
                    if (svc) {
                        if (pickNumber(params.duration_minutes) === undefined) durationMinutes = svc.duration_minutes || 60;
                        if (pickNumber(params.price) === undefined) price = Number(svc.base_price) || price;
                        serviceName = svc.name;
                    }
                }

                const startTime = new Date(startMs).toISOString();
                const endTime = new Date(startMs + durationMinutes * 60 * 1000).toISOString();

                const { data, error } = await admin
                    .from("appointments")
                    .insert({
                        client_id: clientId,
                        master_id: masterId,
                        service_id: serviceId || null,
                        start_time: startTime,
                        end_time: endTime,
                        status,
                        price,
                        service_name: serviceName,
                        service_duration_minutes: durationMinutes,
                        notes: customNotes || "[QA] Seeded by test panel",
                        requires_confirmation: false,
                    })
                    .select("id, start_time, end_time, status, price")
                    .single();

                if (error) throw error;
                return jsonResponse({ ok: true, action, row: data });
            }

            case "create_photo_consultation": {
                const status = (params.status as string) || "pending";
                const photoUrl = pickString(params.photo_url) || "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600";
                const clientMessage = customMessage || "[QA] Could you do this style for me?";
                const masterReply = pickString(params.master_reply);

                const payload: Record<string, unknown> = {
                    client_id: clientId,
                    master_id: masterId,
                    photo_url: photoUrl,
                    client_message: clientMessage,
                    status,
                    title: "[QA] Test consultation",
                    description: clientMessage,
                };
                if (masterReply) {
                    payload.master_reply = masterReply;
                    payload.replied_at = new Date().toISOString();
                    payload.responded_by = masterId;
                    if (status === "pending") payload.status = "responded";
                }

                const { data, error } = await admin
                    .from("photo_consultations")
                    .insert(payload)
                    .select("id, status")
                    .single();
                if (error) throw error;
                return jsonResponse({ ok: true, action, row: data });
            }

            case "create_booking_consultation": {
                let serviceId = pickString(params.service_id);
                if (!serviceId) {
                    const { data: svc } = await admin
                        .from("services")
                        .select("id")
                        .eq("is_active", true)
                        .or(`created_by.eq.${masterId},created_by.is.null`)
                        .limit(1)
                        .maybeSingle();
                    if (!svc) return jsonResponse({ error: "No active service found to attach consultation to" }, 400);
                    serviceId = svc.id;
                }

                const { data, error } = await admin
                    .from("booking_consultations")
                    .insert({
                        client_id: clientId,
                        master_id: masterId,
                        service_id: serviceId,
                        had_before: false,
                        additional_notes: customNotes || "[QA] Seeded by test panel",
                        status: (params.status as string) || "pending",
                    })
                    .select("id, status")
                    .single();
                if (error) throw error;
                return jsonResponse({ ok: true, action, row: data });
            }

            case "create_conversation_with_message": {
                const content = customMessage || "[QA] Hello from the test panel!";
                const senderId = clientId;

                const { data: existing } = await admin
                    .from("conversations")
                    .select("id")
                    .eq("client_id", clientId)
                    .eq("master_id", masterId)
                    .maybeSingle();

                let convId: string;
                if (existing) {
                    convId = existing.id;
                } else {
                    const { data: convo, error: convoErr } = await admin
                        .from("conversations")
                        .insert({ client_id: clientId, master_id: masterId })
                        .select("id")
                        .single();
                    if (convoErr) throw convoErr;
                    convId = convo.id;
                }

                const { data: msg, error: msgErr } = await admin
                    .from("messages")
                    .insert({
                        conversation_id: convId,
                        sender_id: senderId,
                        content,
                    })
                    .select("id, conversation_id")
                    .single();
                if (msgErr) throw msgErr;

                await admin
                    .from("conversations")
                    .update({ last_message_at: new Date().toISOString() })
                    .eq("id", convId);

                return jsonResponse({ ok: true, action, row: msg, conversation_id: convId });
            }

            case "add_chat_message": {
                const content = pickString(params.content) || customMessage || "[QA] Follow-up message from test panel";
                const senderSide = (params.sender as string) === "client" ? "client" : "master";
                const senderId = senderSide === "client" ? clientId : masterId;

                const { data: convo } = await admin
                    .from("conversations")
                    .select("id")
                    .eq("client_id", clientId)
                    .eq("master_id", masterId)
                    .maybeSingle();
                if (!convo) return jsonResponse({ error: "No conversation exists yet. Run 'Start Chat' first." }, 400);
                const conversationId = convo.id;

                const { data: msg, error } = await admin
                    .from("messages")
                    .insert({
                        conversation_id: conversationId,
                        sender_id: senderId,
                        content,
                    })
                    .select("id, conversation_id")
                    .single();
                if (error) throw error;

                await admin
                    .from("conversations")
                    .update({ last_message_at: new Date().toISOString() })
                    .eq("id", conversationId);

                return jsonResponse({ ok: true, action, row: msg });
            }

            case "add_loyalty_points": {
                const amount = pickNumber(params.amount) ?? 100;

                const { data: prof } = await admin
                    .from("profiles")
                    .select("loyalty_points")
                    .eq("id", clientId)
                    .single();
                const current = (prof?.loyalty_points as number) || 0;
                const next = Math.max(0, current + amount);

                const { data, error } = await admin
                    .from("profiles")
                    .update({ loyalty_points: next })
                    .eq("id", clientId)
                    .select("id, loyalty_points")
                    .single();
                if (error) throw error;
                return jsonResponse({ ok: true, action, row: data });
            }

            case "create_order": {
                const quantity = pickNumber(params.quantity) ?? 1;
                let productId = pickString(params.product_id);
                let productName = "Test Product";
                let price = pickNumber(params.price) ?? 30;
                const usedDefaultPrice = pickNumber(params.price) === undefined;
                if (!productId) {
                    const { data: prod } = await admin
                        .from("products")
                        .select("id, name, retail_price")
                        .eq("is_active", true)
                        .limit(1)
                        .maybeSingle();
                    if (!prod) return jsonResponse({ error: "No active product found to create order with" }, 400);
                    productId = prod.id;
                    productName = prod.name;
                    if (usedDefaultPrice) price = Number(prod.retail_price) || price;
                } else {
                    const { data: prod } = await admin
                        .from("products")
                        .select("name, retail_price")
                        .eq("id", productId)
                        .maybeSingle();
                    if (prod) {
                        productName = prod.name;
                        if (usedDefaultPrice) price = Number(prod.retail_price) || price;
                    }
                }
                const total = price * quantity;

                const { data: order, error: orderErr } = await admin
                    .from("orders")
                    .insert({
                        user_id: clientId,
                        status: (params.status as string) || "pending",
                        total,
                        shipping_address: "[QA] 123 Test Street",
                        shipping_name: "QA Tester",
                        notes: customNotes || "[QA] Seeded by test panel",
                    })
                    .select("id, status, total")
                    .single();
                if (orderErr) throw orderErr;

                const { error: itemErr } = await admin
                    .from("order_items")
                    .insert({
                        order_id: order.id,
                        product_id: productId,
                        product_name: productName,
                        quantity,
                        price,
                    });
                if (itemErr) throw itemErr;

                return jsonResponse({ ok: true, action, row: order });
            }

            case "clear_test_data": {
                const testIds = [TEST_CLIENT_ID, TEST_OWNER_ID, TEST_MASTER_ID];
                const summary: Record<string, number> = {};

                {
                    const { count } = await admin
                        .from("messages")
                        .delete({ count: "exact" })
                        .in("sender_id", testIds);
                    summary["messages"] = count || 0;
                }
                {
                    const { count } = await admin
                        .from("conversations")
                        .delete({ count: "exact" })
                        .or(`client_id.in.(${testIds.join(",")}),master_id.in.(${testIds.join(",")})`);
                    summary["conversations"] = count || 0;
                }
                {
                    const { count } = await admin
                        .from("photo_consultations")
                        .delete({ count: "exact" })
                        .or(`client_id.in.(${testIds.join(",")}),master_id.in.(${testIds.join(",")})`);
                    summary["photo_consultations"] = count || 0;
                }
                {
                    const { count } = await admin
                        .from("booking_consultations")
                        .delete({ count: "exact" })
                        .or(`client_id.in.(${testIds.join(",")}),master_id.in.(${testIds.join(",")})`);
                    summary["booking_consultations"] = count || 0;
                }
                {
                    const { data: apts } = await admin
                        .from("appointments")
                        .select("id")
                        .or(`client_id.in.(${testIds.join(",")}),master_id.in.(${testIds.join(",")})`);
                    const aptIds = (apts || []).map((r) => r.id as string);
                    if (aptIds.length > 0) {
                        await admin.from("appointment_confirmations").delete().in("appointment_id", aptIds);
                        const { count } = await admin
                            .from("appointments")
                            .delete({ count: "exact" })
                            .in("id", aptIds);
                        summary["appointments"] = count || 0;
                    } else {
                        summary["appointments"] = 0;
                    }
                }
                {
                    const { data: orders } = await admin
                        .from("orders")
                        .select("id")
                        .in("user_id", testIds);
                    const orderIds = (orders || []).map((r) => r.id as string);
                    if (orderIds.length > 0) {
                        await admin.from("order_items").delete().in("order_id", orderIds);
                        const { count } = await admin
                            .from("orders")
                            .delete({ count: "exact" })
                            .in("id", orderIds);
                        summary["orders"] = count || 0;
                    } else {
                        summary["orders"] = 0;
                    }
                }
                {
                    const { count } = await admin
                        .from("profiles")
                        .update({ loyalty_points: 0 }, { count: "exact" })
                        .in("id", testIds);
                    summary["profiles_loyalty_reset"] = count || 0;
                }

                return jsonResponse({ ok: true, action, summary });
            }

            default:
                return jsonResponse({ error: `Unknown action: ${action}` }, 400);
        }
    } catch (error) {
        console.error("test-panel-seed error:", error);
        const message = error instanceof Error ? error.message : String(error);
        return jsonResponse({ error: "Internal server error", details: message }, 500);
    }
});
