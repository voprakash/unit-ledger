import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getSessionUser, isAdmin } from "@/app/lib/authz"
import { computeRentDue } from "@/app/lib/rentDue"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// Rent-due report for a calendar month. Query: ?month=YYYY-MM (default: current).
// Admins see all tenants; managers see only tenants they created.
export async function GET(req: Request) {
  const user = await getSessionUser(req.headers)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const m = new URL(req.url).searchParams.get("month")
  const now = new Date()
  let year = now.getFullYear()
  let month = now.getMonth() + 1
  if (m && /^\d{4}-\d{2}$/.test(m)) {
    year = Number(m.slice(0, 4))
    month = Number(m.slice(5, 7))
  }
  if (month < 1 || month > 12 || year < 2000 || year > 2100) {
    return NextResponse.json({ error: "Invalid month" }, { status: 400 })
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
    )
    const summary = await computeRentDue(supabase, year, month, {
      scopePhone: isAdmin(user) ? undefined : user.phone,
    })
    return NextResponse.json(summary)
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 })
  }
}
