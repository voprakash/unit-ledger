import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getSessionPhone } from "@/app/lib/session"

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const getSupabase = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, key)
}

const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 })

export async function GET(req: Request) {
  if (!getSessionPhone(req.headers)) return unauthorized()
  try {
    const supabase = getSupabase()
    const { data, error } = await supabase.from("allowed_users").select("*").order("created_at", { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data || [])
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  if (!getSessionPhone(req.headers)) return unauthorized()
  try {
    const body = await req.json()
    const name = String(body.name || "").trim()
    const phone = String(body.phone || "").replace(/\D/g, "")
    const role = String(body.role || "member").trim()
    if (!name || !phone) {
      return NextResponse.json({ error: "Name and phone are required" }, { status: 400 })
    }
    const supabase = getSupabase()
    const { data, error } = await supabase.from("allowed_users").insert({
      name,
      phone,
      role,
    }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Server error" }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  if (!getSessionPhone(req.headers)) return unauthorized()
  try {
    const body = await req.json()
    const id = body.id
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })
    const name = String(body.name || "").trim()
    const phone = String(body.phone || "").replace(/\D/g, "")
    const role = String(body.role || "member").trim()
    if (!name || !phone) {
      return NextResponse.json({ error: "Name and phone are required" }, { status: 400 })
    }
    const supabase = getSupabase()
    const { data, error } = await supabase.from("allowed_users")
      .update({ name, phone, role })
      .eq("id", id)
      .select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Server error" }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  if (!getSessionPhone(req.headers)) return unauthorized()
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })
    const supabase = getSupabase()
    const { error } = await supabase.from("allowed_users").delete().eq("id", id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Server error" }, { status: 500 })
  }
}
