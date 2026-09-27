import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY!
  return createClient(url, key)
}

export async function GET(req: NextRequest) {
  const supabase = getSupabase()
  const tenant_id = req.nextUrl.searchParams.get("tenant_id")
  let query = supabase.from("transactions").select("*").order("date", { ascending: false })
  if (tenant_id) query = query.eq("tenant_id", tenant_id)
  const { data } = await query
  return NextResponse.json({ transactions: data })
}

export async function POST(req: Request) {
  const supabase = getSupabase()
  const body = await req.json()
  const { data, error } = await supabase.from("transactions").insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ transaction: data })
}

export async function DELETE(req: NextRequest) {
  const supabase = getSupabase()
  const id = req.nextUrl.searchParams.get("id")
  await supabase.from("transactions").delete().eq("id", id)
  return NextResponse.json({ success: true })
}
