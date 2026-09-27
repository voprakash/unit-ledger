import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getSessionUser, isAdmin, type SessionUser } from "@/app/lib/authz"

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const getSupabase = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  return createClient(url, key)
}

async function requireUser(req: NextRequest): Promise<SessionUser | NextResponse> {
  const user = await getSessionUser(req.headers)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  return user
}

// Restore a soft-deleted transaction (sets deleted_at back to null)
export async function POST(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const user = auth
  try {
    const body = await req.json().catch(() => ({}))
    if (!body.id) return NextResponse.json({ error: "Transaction id is required" }, { status: 400 })
    const supabase = getSupabase()

    let fq = supabase.from("transactions").select("id").eq("id", body.id)
    if (!isAdmin(user)) fq = fq.eq("created_by", user.phone)
    const { data: existing, error: fetchError } = await fq.maybeSingle()
    if (fetchError) return NextResponse.json({ error: "Server error" }, { status: 500 })
    if (!existing) return NextResponse.json({ error: "Transaction not found" }, { status: 404 })

    let q = supabase.from("transactions").update({ deleted_at: null }).eq("id", body.id)
    if (!isAdmin(user)) q = q.eq("created_by", user.phone)
    const { error } = await q
    if (error) return NextResponse.json({ error: "Server error" }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
