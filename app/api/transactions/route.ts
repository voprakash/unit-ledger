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

export async function GET(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const user = auth
  try {
    const supabase = getSupabase()
    const showDeleted = req.nextUrl.searchParams.get("filter") === "deleted"
    let q = supabase.from("transactions").select("*").order("created_at", { ascending: false }).limit(500)
    // Non-admins only see transactions they created
    if (!isAdmin(user)) q = q.eq("created_by", user.phone)
    const { data, error } = await q
    if (error) {
      // Migration not run yet: trash is empty, active list still works
      if (showDeleted && /deleted_at/i.test(error.message)) return NextResponse.json([])
      return NextResponse.json({ error: "Server error" }, { status: 500 })
    }
    // JS-side filter so the list works even before the migration adds deleted_at
    const rows = (data || []).filter((t: any) => showDeleted ? !!t.deleted_at : !t.deleted_at)
    return NextResponse.json(rows)
  } catch (e: any) {
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const user = auth
  try {
    const body = await req.json()
    const supabase = getSupabase()

    const { data, error } = await supabase.from("transactions").insert({
      tenant_id: body.tenant_id,
      tenant_name: body.tenant_name,
      type: body.type,
      amount: body.amount,
      method: body.method,
      notes: body.notes,
      date: body.date || new Date().toISOString(),
      created_by: user.phone
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const user = auth
  try {
    const body = await req.json()
    if (!body.id) return NextResponse.json({ error: "Transaction id is required" }, { status: 400 })
    const supabase = getSupabase()

    // Ownership + not-in-trash check (select * so it works pre-migration too)
    let fq = supabase.from("transactions").select("*").eq("id", body.id)
    if (!isAdmin(user)) fq = fq.eq("created_by", user.phone)
    const { data: existing, error: fetchError } = await fq.maybeSingle()
    if (fetchError) return NextResponse.json({ error: "Server error" }, { status: 500 })
    if (!existing) return NextResponse.json({ error: "Transaction not found" }, { status: 404 })
    if ((existing as any).deleted_at) {
      return NextResponse.json({ error: "Transaction is in trash. Restore it before editing." }, { status: 409 })
    }

    const updates: Record<string, any> = {}
    if (body.amount !== undefined && body.amount !== "") updates.amount = Number(body.amount)
    if (body.type) updates.type = body.type
    if (body.method) updates.method = body.method
    if (body.notes !== undefined) updates.notes = body.notes
    if (body.date) updates.date = body.date

    const doUpdate = (withStamp: boolean) => {
      const u = withStamp ? { ...updates, updated_at: new Date().toISOString() } : { ...updates }
      let q = supabase.from("transactions").update(u).eq("id", body.id)
      if (!isAdmin(user)) q = q.eq("created_by", user.phone)
      return q.select().single()
    }

    let { data, error } = await doUpdate(true)
    if (error && /updated_at/i.test(error.message)) {
      // Migration not run yet — retry without the edit stamp
      ;({ data, error } = await doUpdate(false))
    }
    if (error) return NextResponse.json({ error: "Server error" }, { status: 500 })
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const user = auth
  try {
    const body = await req.json().catch(() => ({}))
    const permanent = req.nextUrl.searchParams.get("permanent") === "true" || body.permanent === true
    if (!body.id) return NextResponse.json({ error: "Transaction id is required" }, { status: 400 })
    const supabase = getSupabase()

    let fq = supabase.from("transactions").select("id").eq("id", body.id)
    if (!isAdmin(user)) fq = fq.eq("created_by", user.phone)
    const { data: existing, error: fetchError } = await fq.maybeSingle()
    if (fetchError) return NextResponse.json({ error: "Server error" }, { status: 500 })
    if (!existing) return NextResponse.json({ error: "Transaction not found" }, { status: 404 })

    let q = permanent
      ? supabase.from("transactions").delete().eq("id", body.id)
      : supabase.from("transactions").update({ deleted_at: new Date().toISOString() }).eq("id", body.id)
    if (!isAdmin(user)) q = q.eq("created_by", user.phone)
    const { error } = await q
    if (error) {
      if (!permanent && /deleted_at/i.test(error.message)) {
        return NextResponse.json(
          { error: "Database update needed: run supabase/transactions_audit.sql in Supabase first." },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: "Server error" }, { status: 500 })
    }
    return NextResponse.json({ ok: true, permanent })
  } catch (e: any) {
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
