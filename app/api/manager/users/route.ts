import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY!
  return createClient(url, key)
}

export async function GET() {
  const supabase = getSupabase()
  const { data } = await supabase.from("allowed_users").select("*").order("created_at")
  return NextResponse.json({ users: data })
}

export async function POST(req: NextRequest) {
  const supabase = getSupabase()
  const { phone, name, role } = await req.json()
  const clean = phone.replace("+","").replace(/\s/g,"")
  await supabase.from("allowed_users").upsert({ phone: clean, name, role })
  return NextResponse.json({ success: true })
}

export async function DELETE(req: NextRequest) {
  const supabase = getSupabase()
  const phone = req.nextUrl.searchParams.get("phone")
  await supabase.from("allowed_users").delete().eq("phone", phone)
  return NextResponse.json({ success: true })
}
