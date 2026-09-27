import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY!
  return createClient(url, key)
}

export async function GET() {
  const supabase = getSupabase()
  const { data } = await supabase.from("tenants").select("*").order("created_at", { ascending: false })
  return NextResponse.json({ tenants: data })
}

export async function POST(req: Request) {
  const supabase = getSupabase()
  const body = await req.json()
  const { data, error } = await supabase.from("tenants").insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ tenant: data })
}
