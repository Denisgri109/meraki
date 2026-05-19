import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

interface Product {
    id: string;
    name: string;
    stock_count: number;
    low_stock_threshold: number;
}

interface AdminProfile {
    id: string;
    push_token: string | null;
}

Deno.serve(async (req: Request) => {
    // Dynamic CORS implementation
    const origin = req.headers.get("origin") || "";
    const allowedOriginsStr = Deno.env.get("ALLOWED_ORIGINS") || "";
    const allowedOrigins = allowedOriginsStr.split(",").map(o => o.trim()).filter(Boolean);

    const corsHeaders: Record<string, string> = {
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    };

    if (allowedOrigins.includes(origin)) {
        corsHeaders["Access-Control-Allow-Origin"] = origin;
    }

    // Handle CORS preflight
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // Find products with low stock (stock_count < low_stock_threshold)
        const { data: lowStockProducts, error: productsError } = await supabase
            .from("products")
            .select("id, name, stock_count, low_stock_threshold")
            .filter("stock_count", "lt", supabase.rpc("get_low_stock_threshold"))
            .eq("is_active", true);

        // Alternative query since the above might not work
        const { data: products, error } = await supabase
            .from("products")
            .select("id, name, stock_count, low_stock_threshold")
            .eq("is_active", true);

        if (error) throw error;

        // Filter products where stock is below threshold
        const lowStock = (products as Product[]).filter(
            (p) => p.stock_count < (p.low_stock_threshold || 5)
        );

        if (lowStock.length === 0) {
            return new Response(
                JSON.stringify({ message: "No low stock products found" }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
        }

        // Get admin users with push tokens
        const { data: admins, error: adminsError } = await supabase
            .from("profiles")
            .select("id, push_token")
            .in("role", ["admin", "owner"])
            .not("push_token", "is", null);

        if (adminsError) throw adminsError;

        // Send push notifications to admins
        const notifications = [];
        for (const product of lowStock) {
            for (const admin of admins as AdminProfile[]) {
                if (admin.push_token) {
                    notifications.push({
                        to: admin.push_token,
                        sound: "default",
                        title: "⚠️ Low Stock Alert",
                        body: `${product.name} has only ${product.stock_count} units left!`,
                        data: { type: "low_stock", productId: product.id },
                    });
                }
            }
        }

        // Send to Expo push notification service
        if (notifications.length > 0) {
            const response = await fetch("https://exp.host/--/api/v2/push/send", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                body: JSON.stringify(notifications),
            });

            const result = await response.json();
            console.log("Push notification result:", result);
        }

        return new Response(
            JSON.stringify({
                message: `Sent ${notifications.length} low stock alerts`,
                products: lowStock.map((p) => p.name),
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    } catch (error) {
        console.error("Error:", error);
        return new Response(
            JSON.stringify({ error: (error as Error).message }),
            {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            }
        );
    }
});
