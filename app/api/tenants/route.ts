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
    let q = supabase.from("tenants").select("*").order("created_at", { ascending: false }).limit(500)
    // Non-admins only see tenants they created
    if (!isAdmin(user)) q = q.eq("created_by", user.phone)
    const { data, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data || [])
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const user = auth
  try {
    const body = await req.json()
    if (!body.name || !body.phone) {
      return NextResponse.json({ error: "Name and phone are required" }, { status: 400 })
    }
    const supabase = getSupabase()

    const { data, error } = await supabase.from("tenants").insert({
      full_name: body.name,
      phone: body.phone,
      room_number: body.property || null,
      rent_amount: body.rent ? Number(body.rent) : null,
      deposit: body.deposit ? Number(body.deposit) : null,
      start_date: body.start_date || null,
      status: body.status || "active",
      id_number: body.aadhaar || null,
      address: body.notes || null,
      office_name: body.office_name || null,
      office_address: body.office_address || null,
      created_by: user.phone,
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
    if (!body.id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 })
    }
    if (!body.name || !body.phone) {
      return NextResponse.json({ error: "Name and phone are required" }, { status: 400 })
    }
    const supabase = getSupabase()

    let q = supabase.from("tenants").update({
      full_name: body.name,
      phone: body.phone,
      room_number: body.property || null,
      rent_amount: body.rent ? Number(body.rent) : null,
      deposit: body.deposit ? Number(body.deposit) : null,
      start_date: body.start_date || null,
      status: body.status || "active",
      id_number: body.aadhaar || null,
      address: body.notes || null,
      office_name: body.office_name || null,
      office_address: body.office_address || null,
    }).eq("id", body.id)
    // Non-admins can only edit tenants they created
    if (!isAdmin(user)) q = q.eq("created_by", user.phone)
    const { data, error } = await q.select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
