import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const dynamic = 'force-dynamic'

const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL! || process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function normalizePhone(input: string){
  let d = input.replace(/\D/g,"").replace(/^0+/,"")
  let national = d.slice(-10)
  let country: "US"|"IN" = /^[6-9]\d{9}$/.test(national)? "IN" : "US"
  let waTo = country==="IN"? "91"+national : "1"+national
  let isValid = national.length===10 && (country==="IN"? /^[6-9]\d{9}$/.test(national) : /^[2-9]\d{9}$/.test(national))
  if(d.length===11 && d.startsWith("1")){ national=d.slice(1); waTo=d; country="US"; isValid=/^[2-9]\d{9}$/.test(national) }
  if(d.length===12 && d.startsWith("91")){ national=d.slice(2); waTo=d; country="IN"; isValid=/^[6-9]\d{9}$/.test(national) }
  return { national, waTo, country, isValid, rawDigits: d }
}

export async function POST(req: NextRequest) {
  const { phone } = await req.json()
  const norm = normalizePhone(phone)
  if(!norm.isValid) return NextResponse.json({ error: "Invalid phone format" }, { status: 400 })

  const supabase = getSupabase()
  const { data: allowed } = await supabase.from("allowed_users").select("*").ilike("phone", `%${norm.national}%`).limit(1).maybeSingle()
  if(!allowed) return NextResponse.json({ error: `Phone ${norm.national} not in allowed_users` }, { status: 403 })

  const otp = Math.floor(100000 + Math.random()*900000).toString()
  const expires_at = new Date(Date.now() + 10*60*1000).toISOString()
  await supabase.from("whatsapp_otps").insert({ phone: norm.national, otp, expires_at })

  try{
    await fetch(`https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_ID}/messages`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp", to: norm.waTo, type: "text",
        text: { body: `Team Ledger OTP: ${otp} - valid 10 mins for ${allowed.name} (${norm.country})` }
      })
    })
  } catch(e){ console.log(e) }

  return NextResponse.json({ success: true, debug_otp: otp, sent_to: norm.waTo, country: norm.country, user: allowed })
}
