import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getSessionUser, isAdmin } from "@/app/lib/authz"
import { runRentReminders } from "@/app/lib/rentDue"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// Manual trigger: WhatsApp rent-due reminders to managers.
// Body: { month?: "YYYY-MM" (default current), dry_run?: true }.
// Admins message all managers; a manager messages only themselves (their own tenants).
// With dry_run nothing is sent — the response shows who would be messaged and the
// exact message text, for preview/confirmation.
export async function POST(req: Request) {
  const user = await getSessionUser(req.headers)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => ({} as any))
  const m = typeof body.month === "string" ? body.month : ""
  const now = new Date()
  let year = now.getFullYear()
  let month = now.getMonth() + 1
  if (/^\d{4}-\d{2}$/.test(m)) {
    year = Number(m.slice(0, 4))
    month = Number(m.slice(5, 7))
  }
  if (month < 1 || month > 12) return NextResponse.json({ error: "Invalid month" }, { status: 400 })

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
    )
    const dryRun = body.dry_run === true
    const out = await runRentReminders(supabase, {
      year,
      month,
      scopePhone: isAdmin(user) ? undefined : user.phone,
      dryRun,
    })
    return NextResponse.json({
      ok: true,
      dryRun,
      label: out.label,
      summary: {
        totalOutstanding: out.summary.totalOutstanding,
        dueCount: out.summary.dueCount,
        partialCount: out.summary.partialCount,
        paidCount: out.summary.paidCount,
      },
      results: out.results,
      adminSummary: out.adminSummary,
    })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 })
  }
}
