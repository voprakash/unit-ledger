import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { computeMonthlySummary, formatWhatsAppReport, previousMonth } from "@/app/lib/monthlyReport"
import { sendWhatsAppText, toWhatsAppNumber } from "@/app/lib/whatsapp"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// Called by Vercel Cron on the 10th of every month (see vercel.json).
// Sends the previous month's collection report to all admin users via WhatsApp.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured on the server" },
      { status: 500 }
    )
  }
  const auth = req.headers.get("authorization") || ""
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
    )

    const { year, month } = previousMonth()
    const summary = await computeMonthlySummary(supabase, year, month)
    const message = formatWhatsAppReport(summary)

    const { data: admins, error } = await supabase
      .from("allowed_users")
      .select("phone,name")
      .ilike("role", "admin")
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const results: any[] = []
    for (const a of admins || []) {
      const to = toWhatsAppNumber(a.phone || "")
      if (!to) {
        results.push({ name: a.name, phone: a.phone, sent: false, error: "invalid phone" })
        continue
      }
      const r = await sendWhatsAppText(to, message)
      results.push({ name: a.name, phone: a.phone, ...r })
    }

    return NextResponse.json({ ok: true, month: summary.label, recipients: results.length, results })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Server error" }, { status: 500 })
  }
}
