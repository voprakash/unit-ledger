import { NextRequest, NextResponse } from "next/server";
import { createClient } from '@supabase/supabase-js'
import { createHmac, timingSafeEqual } from "crypto"

function getSupabase() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY! || process.env.SUPABASE_ANON_KEY! || process.env.SUPABASE_SECRET_KEY! || process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  if (!supabaseUrl) throw new Error("SUPABASE_URL is not configured")
  return createClient(supabaseUrl, supabaseKey)
}

function parseDateFromParts(parts: string[]): string | null {
  for (let p of parts) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(p)) return p;
    if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(p)) {
      let [d,m,y] = p.split(/[\/\-]/);
      if (y.length==2) y='20'+y;
      return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
    }
  }
  return null;
}
function fmtDate(dateStr: string): string {
  const d = new Date(dateStr);
  return `${String(d.getDate()).padStart(2,'0')} ${String(d.getMonth()+1).padStart(2,'0')} ${String(d.getFullYear()).slice(-2)}`;
}

export async function GET(req: NextRequest) {
  const mode = req.nextUrl.searchParams.get("hub.mode");
  const token = req.nextUrl.searchParams.get("hub.verify_token");
  const challenge = req.nextUrl.searchParams.get("hub.challenge");
  if (mode === "subscribe" && token === process.env.VERIFY_TOKEN) return new NextResponse(challenge, { status: 200 });
  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(req: NextRequest) {
  // Verify Meta's webhook signature BEFORE doing anything else.
  // Without this, anyone can forge payloads and impersonate team members.
  const appSecret = process.env.WHATSAPP_APP_SECRET
  if (!appSecret) {
    return NextResponse.json({ ok: false, error: "WHATSAPP_APP_SECRET is not configured" }, { status: 500 })
  }
  const rawBody = await req.text()
  const sigHeader = req.headers.get("x-hub-signature-256") || ""
  const expected = "sha256=" + createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex")
  let valid = false
  if (sigHeader.length === expected.length) {
    try {
      valid = timingSafeEqual(Buffer.from(sigHeader), Buffer.from(expected))
    } catch {
      valid = false
    }
  }
  if (!valid) {
    return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 401 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let supabase: any
  try {
    supabase = getSupabase()
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
  let body: any = {}
  try {
    body = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ ok: true })
  }
  const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (!message) return NextResponse.json({ ok: true });
  const from = message.from;
  const text = message.text?.body || "";
  const parts: string[] = text.trim().split(/\s+/);
  let reply = "";

  try {
    const lower = text.toLowerCase().trim();

    // EXPENSE TYPES - these will SUBTRACT in total
    const expenseTypes = ["expense", "other", "water", "gas", "electricity", "maintenance", "repair", "bill"];
    // INCOME TYPES - these will ADD
    const incomeTypes = ["rent", "deposit", "sale", "payment", "advance"];

    // Only allow team members in allowed_users to use the bot
    const senderDigits = String(from || "").replace(/\D/g, "")
    const senderNational = senderDigits.slice(-10)
    const { data: sender } = await supabase.from("allowed_users")
      .select("id").ilike("phone", `%${senderNational}%`).limit(1).maybeSingle()
    if (!sender) {
      reply = "⛔ This number is not authorized for Team Ledger."
    } else if (lower === "report" || lower === "report all" || lower === "all report") {
      const { data } = await supabase.from("entries").select("*").order("entry_date", {ascending:true}).limit(200);
      if (!data?.length) reply = "No entries yet.";
      else {
        let total = 0;
        let lines = data.map((e:any)=>{
          let amt = Number(e.amount);
          let isExpense = expenseTypes.includes(e.type?.toLowerCase());
          if (isExpense) total -= amt; else total += amt;
          return `${e.unit_code} | ${e.customer_name||'-'} | ${fmtDate(e.entry_date)} | ₹${e.amount} | ${e.type}${e.note?'- '+e.note:''} | #${e.id}`;
        });
        reply = `📊 ALL UNITS REPORT\nUnit | Name | Date(dd mm yy) | Amount | Type\n----------------------------------------\n` + lines.join("\n") + `\n----------------------------------------\nTOTAL NET: ₹${total}`;
      }
    } else {
      const unit_code = parts[0]?.toUpperCase();

      if (parts[1]?.toLowerCase() === "delete") {
        if (parts[2]?.toLowerCase() === "last") {
          const { data } = await supabase.from("entries").select("id").eq("unit_code", unit_code).order("id", {ascending:false}).limit(1).single();
          if (data) { await supabase.from("entries").delete().eq("id", (data as any).id); reply = `🗑️ Deleted last entry for ${unit_code}`; }
        } else {
          let id = parseInt(parts[2]); if (id) { await supabase.from("entries").delete().eq("id", id); reply = `🗑️ Deleted id ${id}`; }
        }
      } else if (parts[1]?.toLowerCase() === "report" || parts[0]?.toLowerCase() === "report") {
        let u = unit_code; if (parts[0].toLowerCase() === "report") u = parts[1]?.toUpperCase();
        const { data } = await supabase.from("entries").select("*").eq("unit_code", u).order("entry_date", {ascending:true}).limit(100);
        if (data?.length) {
          let total = 0;
          let lines = data.map((e:any)=>{
            let amt = Number(e.amount);
            let isExpense = expenseTypes.includes(e.type?.toLowerCase());
            if (isExpense) total -= amt; else total += amt;
            return `${e.unit_code} | ${e.customer_name||'-'} | ${fmtDate(e.entry_date)} | ₹${e.amount} | ${e.type}${e.note?'- '+e.note:''} | #${e.id}`;
          });
          reply = `📊 REPORT: ${u}\nUnit | Name | Date(dd mm yy) | Amount | Type\n----------------------------------------\n` + lines.join("\n") + `\n----------------------------------------\nTOTAL: ₹${total}`;
        } else reply = `No entries for ${u}`;
      } else {
        // ENTRY: G201 other 500 water bill OR G201 John rent 2000
        const customer_name = parts[1] || "";
        let entry_date = parseDateFromParts(parts) || new Date().toISOString().slice(0,10);

        // Find type - check for 'other' first
        let type = "rent";
        let allTypes = [...incomeTypes,...expenseTypes];
        for (let p of parts) {
          let low = p.toLowerCase();
          if (allTypes.includes(low)) { type = low; break; }
        }
        // If second word is 'other', treat as expense type = other
        if (parts[1]?.toLowerCase() === "other") type = "other";

        let amount = 0;
        for (let p of parts) { let n = parseFloat(p); if (!isNaN(n) && n>10 &&!p.includes('/') &&!p.includes('-')) { if (p.length>=2) { amount=n; break; } } }
        if (!amount) for (let p of parts) { let n = parseFloat(p); if (!isNaN(n) && n>0) amount=n; }

        let amountIndex = parts.findIndex((p: string) => parseFloat(p) === amount);
        let noteParts = amountIndex>=0? parts.slice(amountIndex+1) : [];

        if (unit_code && amount > 0) {
          const { data, error } = await supabase.from("entries").insert({ unit_code, customer_name: customer_name.toLowerCase()==="other"?"-":customer_name, type, amount, entry_date, note: noteParts.join(" "), created_by: from }).select().single();
          if (error) throw error;
          let sign = expenseTypes.includes(type)? "-" : "+";
          reply = `✅ Saved #${(data as any).id}: ${unit_code} | ${fmtDate(entry_date)} | ${sign}₹${amount} | ${type} ${noteParts.join(" ")}`;
        } else {
          reply = `Use:\nG201 rent 2000 John\nG201 other 500 water bill\nG201 report`;
        }
      }
    }
  } catch (e:any) { reply = `❌ ${e.message}`; }

  await fetch(`https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_ID || process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${process.env.WHATSAPP_TOKEN || process.env.WA_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to: from, text: { body: reply } })
  }).catch(()=>{});

  return NextResponse.json({ ok: true });
}