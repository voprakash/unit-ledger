import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function POST(req: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabase = createClient(url!, key!)
  const { phone } = await req.json()
  const cleanPhone = phone.replace("+","").replace(/\s/g,"")
  const { data: user } = await supabase.from("allowed_users").select("*").eq("phone", cleanPhone).single()
  if (!user) return NextResponse.json({ error: "Not authorized" }, { status: 403 })
  const otp = Math.floor(100000 + Math.random() * 900000).toString()
  await supabase.from("otp_codes").upsert({ phone: cleanPhone, otp, expires_at: new Date(Date.now() + 5*60000) })
  const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN
  const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID
  if (WHATSAPP_TOKEN && PHONE_NUMBER_ID) {
    await fetch(`https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: cleanPhone,
        type: "text",
        text: { body: `Your Unit Ledger OTP is: ${otp} Valid for 5 min.` }
      })
    })
  }
  return NextResponse.json({ success: true })
}
