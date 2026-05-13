const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = "https://bkxdsxnxrtcqnkdcdist.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJreGRzeG54cnRjcW5rZGNkaXN0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4NDM5MjksImV4cCI6MjA4NDQxOTkyOX0.zL0pnHHeqUSZxSwSSlI1oR747RD747KThVm64_JDziA";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
    // We fetch the 10 most recent appointments to find the one we are likely trying to cancel
    const { data: appointments, error } = await supabase
        .from("appointments")
        .select("*")
        .order("start_time", { ascending: false })
        .limit(10);
    
    if (error) {
        console.error("Failed to fetch appointments:", error);
        return;
    }

    if (!appointments || appointments.length === 0) {
        console.log("No appointments found");
        return;
    }

    const appointment = appointments.find(a => !a.status.startsWith("cancelled"));
    if (!appointment) {
        console.log("All recent appointments are already cancelled. Status:", appointments.map(a => a.status));
        return;
    }

    const latestAptId = appointment.id;
    console.log("Testing with active appointment:", latestAptId, "Status:", appointment.status);

    const res = await fetch(`${supabaseUrl}/functions/v1/cancel-and-refund`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "apikey": supabaseAnonKey
        },
        body: JSON.stringify({
            appointment_id: latestAptId,
            cancelled_by: "master"
        })
    });

    const text = await res.text();
    console.log("Status:", res.status);
    console.log("Response:", text);
}

test().catch(console.error);
