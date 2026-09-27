import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
  if (!url || !key) return NextResponse.json({ error: "Missing env" }, { status: 500 })
  const supabase = createClient(url, key)

  const { phone, otp } = await req.json()
  const cleanPhone = phone.replace("+","").replace(/\s/g,"")

  const { data } = await supabase.from("otp_codes").select("*").eq("phone", cleanPhone).single()
  if (!data || data.otp !== otp) return NextResponse.json({ error: "Invalid OTP" }, { status: 400 })
  if (new Date(data.expires_at) < new Date()) return NextResponse.json({ error: "OTP expired" }, { status: 400 })

  const { data: user } = await supabase.from("allowed_users").select("*").eq("phone", cleanPhone).single()
  await supabase.from("otp_codes").delete().eq("phone", cleanPhone)

  return NextResponse.json({ success: true, user })
}
