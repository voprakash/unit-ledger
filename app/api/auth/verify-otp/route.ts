import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const dynamic = 'force-dynamic'

const getSupabase = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if(!url || !serviceKey) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY")
  return createClient(url, serviceKey)
}

function normalizePhone(input: string){
  let d = input.replace(/\D/g,"").replace(/^0+/,"")
  let national = d.slice(-10)
  let country: "US"|"IN" = /^[6-9]\d{9}$/.test(national)? "IN" : "US"
  if(d.length===11 && d.startsWith("1")) national=d.slice(1)
  if(d.length===12 && d.startsWith("91")) national=d.slice(2)
  return { national, country }
}

export async function POST(req: NextRequest) {
  try{
    const { phone, otp } = await req.json()
    const norm = normalizePhone(phone)
    const supabase = getSupabase()
    const { data: otpRow, error } = await supabase.from("whatsapp_otps").select("*").eq("phone", norm.national).eq("otp", otp).gt("expires_at", new Date().toISOString()).order("created_at", {ascending:false}).limit(1).maybeSingle()
    if(error) return NextResponse.json({ error: error.message }, { status: 500 })
    if(!otpRow) return NextResponse.json({ error: "Invalid or expired OTP" }, { status: 400 })

    await supabase.from("whatsapp_otps").delete().eq("id", otpRow.id)
    const { data: user } = await supabase.from("allowed_users").select("*").ilike("phone", `%${norm.national}%`).limit(1).maybeSingle()

    return NextResponse.json({ success: true, phone: norm.national, name: user?.name, role: user?.role || "manager", country: norm.country })
  }catch(e:any){
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
