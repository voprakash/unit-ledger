import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getSessionUser, isAdmin } from "@/app/lib/authz"

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const getSupabase = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  return createClient(url, key)
}

async function requireUser(req: NextRequest) {
  const user = await getSessionUser(req.headers)
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) as NextResponse | null, user: null }
  return { error: null, user }
}

export async function GET(req: NextRequest) {
  const { error, user } = await requireUser(req)
  if (error || !user) return error
  try {
    const supabase = getSupabase()
    let q = supabase.from("transactions").select("*").order("created_at", { ascending: false }).limit(500)
    // Non-admins only see transactions they created
    if (!isAdmin(user)) q = q.eq("created_by", user.phone)
    const { data, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data || [])
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const { error, user } = await requireUser(req)
  if (error || !user) return error
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
