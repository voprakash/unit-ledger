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

    // Raw vocab the bot understands (normalized to the app's canonical types below)
    const expenseTypes = ["expense", "other", "water", "gas", "electricity", "maintenance", "repair", "bill"];
    const incomeTypes = ["rent", "deposit", "sale", "payment", "advance"];

    // Canonical transaction types used by the app
    const normalizeType = (t: string): string => {
      const w = String(t || "").toLowerCase()
      if (w === "rent") return "rent"
      if (w === "deposit") return "deposit"
      if (w === "maintenance" || w === "repair") return "maintenance"
      if (w === "electricity" || w === "bill") return "electricity"
      if (w === "water") return "water"
      if (w === "gas") return "gas"
      return "other"
    }
    const EXPENSE = new Set(["water", "gas", "electricity", "maintenance", "other"])

    // Soft-deleted rows are hidden everywhere (JS filter so the bot works
    // even before the transactions_audit.sql migration is run)
    const activeOnly = (rows: any[]) => (rows || []).filter((x: any) => !x.deleted_at)

    const findTenantByUnit = async (unit: string) => {
      const { data } = await supabase.from("tenants")
        .select("id,full_name,room_number").ilike("room_number", unit).limit(1).maybeSingle()
      return data as any
    }

    // Only allow team members in allowed_users to use the bot
    const senderDigits = String(from || "").replace(/\D/g, "")
    const senderNational = senderDigits.slice(-10)
    const { data: sender } = await supabase.from("allowed_users")
      .select("id,role").ilike("phone", `%${senderNational}%`).limit(1).maybeSingle()
    if (!sender) {
      reply = "⛔ This number is not authorized for Team Ledger."
    } else {
      const senderIsAdmin = String((sender as any).role || "").toLowerCase() === "admin"
      // Managers only see/touch their own transactions — same rule as the app
      const scopeByOwner = (q: any) => senderIsAdmin ? q : q.eq("created_by", senderNational)

      if (lower === "report" || lower === "report all" || lower === "all report") {
        const { data: allTenants } = await supabase.from("tenants").select("id,room_number").limit(1000)
        const roomByTenant = new Map<string, string>()
        for (const t of (allTenants || [])) roomByTenant.set(String((t as any).id), (t as any).room_number || "")
        const { data } = await scopeByOwner(supabase.from("transactions").select("*"))
          .order("date", { ascending: true }).limit(200)
        const rows = activeOnly(data)
        if (!rows.length) reply = "No entries yet.";
        else {
          let total = 0;
          let lines = rows.map((e: any) => {
            let amt = Number(e.amount) || 0;
            let t = normalizeType(e.type);
            if (EXPENSE.has(t)) total -= amt; else total += amt;
            const room = roomByTenant.get(String(e.tenant_id)) || "-";
            return `${room} | ${e.tenant_name || '-'} | ${fmtDate(e.date || e.created_at)} | ₹${e.amount} | ${t}`;
          });
          reply = `📊 ALL UNITS REPORT\nRoom | Name | Date(dd mm yy) | Amount | Type\n----------------------------------------\n` + lines.join("\n") + `\n----------------------------------------\nTOTAL NET: ₹${total}`;
        }
      } else {
        const unit_code = parts[0]?.toUpperCase();

        if (parts[1]?.toLowerCase() === "delete") {
          const tenant = await findTenantByUnit(unit_code || "")
          if (!tenant) {
            reply = `No tenant found for ${unit_code}`;
          } else if (!parts[2]) {
            reply = `Use:\n${unit_code} delete last`;
          } else {
            const { data } = await scopeByOwner(supabase.from("transactions").select("*"))
              .eq("tenant_id", tenant.id).order("created_at", { ascending: false }).limit(10)
            const rows = activeOnly(data)
            const softDelete = async (id: number) => {
              const { error } = await supabase.from("transactions")
                .update({ deleted_at: new Date().toISOString() }).eq("id", id)
              if (error) {
                return /deleted_at/i.test(error.message)
                  ? "⚠️ Trash is not set up yet — ask admin to run the migration."
                  : `❌ ${error.message}`
              }
              return null
            }
            if (parts[2].toLowerCase() === "last") {
              const target = rows[0]
              if (target) {
                const err = await softDelete(Number(target.id))
                reply = err || `🗑️ Moved to trash: ${unit_code} | ₹${target.amount} | ${normalizeType(target.type)} (restore from the app)`;
              } else reply = `Nothing to delete for ${unit_code}`;
            } else {
              const id = parseInt(parts[2])
              const target = id ? rows.find((x: any) => Number(x.id) === id) : null
              if (target) {
                const err = await softDelete(Number(target.id))
                reply = err || `🗑️ Moved to trash: #${id} (restore from the app)`;
              } else reply = `No matching entry #${parts[2]} for ${unit_code}`;
            }
          }
        } else if (parts[1]?.toLowerCase() === "report" || parts[0]?.toLowerCase() === "report") {
          let u = unit_code; if (parts[0].toLowerCase() === "report") u = parts[1]?.toUpperCase();
          const tenant = await findTenantByUnit(u || "")
          if (!tenant) {
            reply = `No tenant found for ${u}`;
          } else {
            const { data } = await scopeByOwner(supabase.from("transactions").select("*"))
              .eq("tenant_id", tenant.id).order("date", { ascending: true }).limit(100)
            const rows = activeOnly(data)
            if (rows.length) {
              let total = 0;
              let lines = rows.map((e: any) => {
                let amt = Number(e.amount) || 0;
                let t = normalizeType(e.type);
                if (EXPENSE.has(t)) total -= amt; else total += amt;
                return `${u} | ${e.tenant_name || '-'} | ${fmtDate(e.date || e.created_at)} | ₹${e.amount} | ${t}${e.notes ? ' - ' + e.notes : ''}`;
              });
              reply = `📊 REPORT: ${u}\nRoom | Name | Date(dd mm yy) | Amount | Type\n----------------------------------------\n` + lines.join("\n") + `\n----------------------------------------\nTOTAL: ₹${total}`;
            } else reply = `No entries for ${u}`;
          }
        } else {
          // ENTRY: G201 other 500 water bill OR G201 John rent 2000
          const customer_name = parts[1] || "";
          let entry_date = parseDateFromParts(parts) || new Date().toISOString().slice(0,10);

          // Find type - check for 'other' first
          let rawType = "rent";
          let allTypes = [...incomeTypes,...expenseTypes];
          for (let p of parts) {
            let low = p.toLowerCase();
            if (allTypes.includes(low)) { rawType = low; break; }
          }
          // If second word is 'other', treat as expense type = other
          if (parts[1]?.toLowerCase() === "other") rawType = "other";
          const type = normalizeType(rawType);

          let amount = 0;
          for (let p of parts) { let n = parseFloat(p); if (!isNaN(n) && n>10 &&!p.includes('/') &&!p.includes('-')) { if (p.length>=2) { amount=n; break; } } }
          if (!amount) for (let p of parts) { let n = parseFloat(p); if (!isNaN(n) && n>0) amount=n; }

          let amountIndex = parts.findIndex((p: string) => parseFloat(p) === amount);
          let noteParts = amountIndex>=0? parts.slice(amountIndex+1) : [];

          if (unit_code && amount > 0) {
            const tenant = await findTenantByUnit(unit_code)
            const { data, error } = await supabase.from("transactions").insert({
              tenant_id: tenant?.id || null,
              tenant_name: tenant?.full_name || (customer_name.toLowerCase() === "other" ? "-" : customer_name) || unit_code,
              type,
              amount,
              notes: noteParts.join(" ") || null,
              date: entry_date,
              created_by: senderNational,
            }).select().single();
            if (error) throw error;
            let sign = EXPENSE.has(type) ? "-" : "+";
            reply = `✅ Saved #${(data as any).id}: ${unit_code} | ${fmtDate(entry_date)} | ${sign}₹${amount} | ${type}${noteParts.length ? " " + noteParts.join(" ") : ""}`;
          } else {
            reply = `Use:\nG201 rent 2000 John\nG201 water 500 bill\nG201 report\nG201 delete last`;
          }
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
