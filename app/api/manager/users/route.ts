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

export async function GET(req: Request) {
  if (!getSessionPhone(req.headers)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    const supabase = getSupabase()
    const { data, error } = await supabase.from("allowed_users").select("*").order("created_at", { ascending: false })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data || [])
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
