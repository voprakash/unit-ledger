import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getSessionUser, isAdmin } from "@/app/lib/authz"
import { computeMonthlySummary, formatWhatsAppReport, previousMonth } from "@/app/lib/monthlyReport"
import { sendWhatsAppText, toWhatsAppNumber } from "@/app/lib/whatsapp"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// Manual trigger (admin only): send the monthly report to your own WhatsApp now.
// Body: { year?: number, month?: number } — defaults to the previous month.
export async function POST(req: Request) {
  const user = await getSessionUser(req.headers)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!isAdmin(user)) return NextResponse.json({ error: "Admin only" }, { status: 403 })

  try {
    const body = await req.json().catch(() => ({}))
    const pm = previousMonth()
    const year = Number(body.year) || pm.year
    const month = Number(body.month) || pm.month

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
    )

    const summary = await computeMonthlySummary(supabase, year, month)
    const message = formatWhatsAppReport(summary)

    const to = toWhatsAppNumber(user.phone || "")
    if (!to) return NextResponse.json({ error: "Your phone number is invalid" }, { status: 400 })

    const result = await sendWhatsAppText(to, message)
    if (!result.sent) return NextResponse.json({ error: result.error || "Send failed" }, { status: 500 })
    return NextResponse.json({ ok: true, month: summary.label })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Server error" }, { status: 500 })
  }
}
