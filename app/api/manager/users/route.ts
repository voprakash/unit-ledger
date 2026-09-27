import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getSessionUser, isAdmin, type SessionUser } from "@/app/lib/authz"

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const getSupabase = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, key)
}

function normalizeRole(input: any): string {
  return String(input || "manager").trim().toLowerCase() === "admin" ? "admin" : "manager"
}

async function requireUser(req: Request): Promise<SessionUser | NextResponse> {
  const user = await getSessionUser(req.headers)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  return user
}

export async function GET(req: Request) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const user = auth
  try {
    const supabase = getSupabase()
    let q = supabase.from("allowed_users").select("*").order("created_at", { ascending: false })
    // Non-admins only see users they created
    if (!isAdmin(user)) q = q.eq("created_by", user.phone)
    const { data, error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data || [])
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const user = auth
  try {
    const body = await req.json()
    const name = String(body.name || "").trim()
    const phone = String(body.phone || "").replace(/\D/g, "")
    // Only admins can grant the admin role - prevents privilege escalation.
    // Roles are normalized to admin/manager (legacy "member" becomes "manager").
    const role = normalizeRole(isAdmin(user) ? body.role : "manager")
    if (!name || !phone) {
      return NextResponse.json({ error: "Name and phone are required" }, { status: 400 })
    }
    const supabase = getSupabase()
    const { data, error } = await supabase.from("allowed_users").insert({
      name,
      phone,
      role,
      created_by: user.phone,
    }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Server error" }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const user = auth
  try {
    const body = await req.json()
    // Identify the row by id when present, otherwise by exact phone (unique per OTP login)
    const id = body.id ?? null
    const keyPhone = String(body.originalPhone || "").trim()
    if ((id === undefined || id === null) && !keyPhone) {
      return NextResponse.json({ error: "id or phone is required" }, { status: 400 })
    }
    const name = String(body.name || "").trim()
    const phone = String(body.phone || "").replace(/\D/g, "")
    if (!name || !phone) {
      return NextResponse.json({ error: "Name and phone are required" }, { status: 400 })
    }
    const updates: Record<string, string> = { name, phone }
    // Only admins can change roles (normalized to admin/manager)
    if (isAdmin(user) && body.role) updates.role = normalizeRole(body.role)
    const supabase = getSupabase()
    let q = supabase.from("allowed_users").update(updates)
    if (id !== undefined && id !== null) q = q.eq("id", id)
    else q = q.eq("phone", keyPhone)
    // Non-admins can only edit users they created
    if (!isAdmin(user)) q = q.eq("created_by", user.phone)
    const { data, error } = await q.select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Server error" }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  const auth = await requireUser(req)
  if (auth instanceof NextResponse) return auth
  const user = auth
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")
    const phone = searchParams.get("phone")
    if (!id && !phone) return NextResponse.json({ error: "id or phone is required" }, { status: 400 })
    const supabase = getSupabase()
    let q = supabase.from("allowed_users").delete()
    if (id) q = q.eq("id", id)
    else q = q.eq("phone", phone)
    // Non-admins can only remove users they created
    if (!isAdmin(user)) q = q.eq("created_by", user.phone)
    const { error } = await q
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Server error" }, { status: 500 })
  }
}
