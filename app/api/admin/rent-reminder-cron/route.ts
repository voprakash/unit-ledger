import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { runRentReminders } from "@/app/lib/rentDue"
import { sendWhatsAppText, toWhatsAppNumber } from "@/app/lib/whatsapp"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// Called by Vercel Cron on the 10th of every month (see vercel.json).
// WhatsApps each manager their tenants' unpaid rent for the current month
// (skipping tenants inside the 10-day move-in grace), then sends admins a summary.
// Secured by CRON_SECRET like the other crons. ?dry_run=1 previews without sending.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured on the server" }, { status: 500 })
  }
  const auth = req.headers.get("authorization") || ""
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const dryRun = new URL(req.url).searchParams.get("dry_run") === "1"

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
    )
    const now = new Date()
    const out = await runRentReminders(supabase, {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      dryRun,
    })

    if (dryRun) {
      return NextResponse.json({
        ok: true,
        dryRun: true,
        label: out.label,
        results: out.results,
        adminSummary: out.adminSummary,
      })
    }

    const { data: admins, error } = await supabase
      .from("allowed_users")
      .select("phone,name")
      .ilike("role", "admin")
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    const adminResults: any[] = []
    for (const a of admins || []) {
      const to = toWhatsAppNumber(a.phone || "")
      if (!to) {
        adminResults.push({ name: a.name, phone: a.phone, sent: false, error: "invalid phone" })
        continue
      }
      const r = await sendWhatsAppText(to, out.adminSummary)
      adminResults.push({ name: a.name, phone: a.phone, ...r })
    }

    return NextResponse.json({
      ok: true,
      label: out.label,
      reminders: out.results,
      adminResults,
    })
  } catch (e: any) {
    return NextResponse.json(
      { error: "Rent reminder run failed", detail: String(e?.message || e) },
      { status: 500 }
    )
  }
}
