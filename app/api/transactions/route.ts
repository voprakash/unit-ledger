import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getSessionPhone } from "@/app/lib/session"

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const getSupabase = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  return createClient(url, key)
}

function requireAuth(req: NextRequest) {
  const phone = getSessionPhone(req.headers)
  if (!phone) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  return null
}

export async function GET(req: NextRequest) {
  const authErr = requireAuth(req)
  if (authErr) return authErr
  try {
    const supabase = getSupabase()
    const { data, error } = await supabase.from("transactions").select("*").order("created_at", { ascending: false }).limit(500)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data || [])
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const authErr = requireAuth(req)
  if (authErr) return authErr
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
      created_by: body.created_by
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
