import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY! || process.env.SUPABASE_SECRET_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)


// VERIFY - for Meta
export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get("hub.mode");
  const token = req.nextUrl.searchParams.get("hub.verify_token");
  const challenge = req.nextUrl.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

// RECEIVE MESSAGE
export async function POST(req: NextRequest) {
  const body = await req.json();

  const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!message) return NextResponse.json({ ok: true });

  const from = message.from; // user phone
  const text = message.text?.body || "";
  const created_by = from;

  console.log("Received:", text);

  // --- Simple Parser for Unit Ledger ---
  // Example: G201 John rent 2000 cash
  // Example: F102 A Kumar electricity 500
  let reply = "";
  try {
    const parts = text.trim().split(/\s+/);
    const unit_code = parts[0]?.toUpperCase(); // G201
    const customer_name = parts[1] || "";
    const type = parts[2]?.toLowerCase() || "rent"; // rent/deposit
    const amount = parseFloat(parts[3]) || 0;
    const note = parts.slice(4).join(" ");

    if (unit_code && amount > 0) {
      const { error } = await supabase.from("entries").insert({
        unit_code,
        customer_name,
        type,
        amount,
        note,
        created_by
      });
      if (error) throw error;
      reply = `✅ Saved: ${unit_code} ${customer_name} ${type} ₹${amount} ${note}`;
    } else {
      reply = `Send like: G201 John rent 2000 cash\nOr: G201 report`;
    }

    // Handle report command
    if (text.toLowerCase().includes("report")) {
      const code = unit_code;
      const { data } = await supabase.from("entries").select("*").eq("unit_code", code).order("created_at", {ascending:false}).limit(5);
      if (data?.length) {
        reply = `📊 ${code} Last 5:\n` + data.map((e:any)=>`${e.type} ₹${e.amount} - ${e.customer_name}`).join("\n");
      } else {
        reply = `No entries for ${code}`;
      }
    }

  } catch (e:any) {
    reply = `❌ Error: ${e.message}`;
  }

  // --- Send WhatsApp Reply ---
  await fetch(`https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_ID}/messages`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.WHATSAPP_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: from,
      text: { body: reply }
    })
  });

  return NextResponse.json({ ok: true });
}
