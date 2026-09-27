import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { checkRateLimit } from "@/app/lib/rateLimit"

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function getSupabase(){
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ""
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  if(!url) return { error: "Missing NEXT_PUBLIC_SUPABASE_URL" } as any
  if(!key) return { error: "Missing SUPABASE_SERVICE_ROLE_KEY or ANON_KEY" } as any
  return createClient(url, key)
}

function normalizePhone(input: string){
  let d = input.replace(/\D/g,"").replace(/^0+/,"")
  let national = d.slice(-10)
  if(national.length < 10) return { national:"", waTo:"", country:"US" as const, isValid:false }
  let country: "US"|"IN" = /^[6-9]\d{9}$/.test(national)? "IN" : "US"
  let waTo = country==="IN"? "91"+national : "1"+national
  if(d.length===11 && d.startsWith("1")){ national=d.slice(1); waTo=d; country="US" }
  if(d.length===12 && d.startsWith("91")){ national=d.slice(2); waTo=d; country="IN" }
  return { national, waTo, country, isValid: national.length===10 }
}

export async function GET(){
  return NextResponse.json({ ok:true, path:"/api/auth/send-otp works. Use POST with phone" })
}

export async function POST(req: NextRequest) {
  try{
    const sb = getSupabase() as any
    if(sb.error) return NextResponse.json({ error: sb.error }, { status:500 })
    const supabase = sb

    const body = await req.json().catch(()=>({}))
    const norm = normalizePhone(body.phone||"")
    if(!norm.isValid) return NextResponse.json({ error:"Enter 10-digit US or India phone" }, { status:400 })

    // Rate limits: 20 sends/IP/hour (slows enumeration), 3 sends/phone/hour (stops OTP bombing)
    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "unknown"
    const ipOk = await checkRateLimit(supabase, `otp-send:ip:${ip}`, 20, 60*60*1000)
    if(!ipOk.allowed) return NextResponse.json({ error:"Too many requests. Try again later." }, { status:429 })
    const phoneOk = await checkRateLimit(supabase, `otp-send:phone:${norm.national}`, 3, 60*60*1000)
    if(!phoneOk.allowed) return NextResponse.json({ error:"Too many OTP requests for this number. Try again in an hour." }, { status:429 })

    const { data: allowed, error } = await supabase.from("allowed_users").select("*").ilike("phone", `%${norm.national}%`).limit(1).maybeSingle()
    if(error) return NextResponse.json({ error:"DB allowed_users: "+error.message }, { status:500 })
    if(!allowed) return NextResponse.json({ error:`Phone ${norm.national} not in allowed_users table` }, { status:403 })

    const otp = Math.floor(100000+Math.random()*900000).toString()
    const expires_at = new Date(Date.now()+10*60*1000).toISOString()
    
    const { error: ins } = await supabase.from("whatsapp_otps").insert({ phone: norm.national, otp, expires_at })
    if(ins) return NextResponse.json({ error:"DB whatsapp_otps: "+ins.message }, { status:500 })

    // WhatsApp send - awaited so failures are visible instead of silent
    let whatsapp: { sent: boolean; error?: string } = { sent: false }
    if (process.env.WHATSAPP_PHONE_ID && process.env.WHATSAPP_TOKEN) {
      try {
        const waRes = await fetch(`https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_ID}/messages`, {
          method: "POST",
          headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            messaging_product: "whatsapp", to: norm.waTo, type: "text",
            text: { body: `Team Ledger OTP: ${otp} - valid 10 mins for ${allowed.name} (${norm.country})` }
          }),
          signal: AbortSignal.timeout(15000),
        })
        const waData = await waRes.json().catch(() => ({} as any))
        if (!waRes.ok) {
          whatsapp = { sent: false, error: waData?.error?.message || `WhatsApp API returned ${waRes.status}` }
        } else {
          whatsapp = { sent: true }
        }
      } catch (e: any) {
        whatsapp = { sent: false, error: e?.message || "WhatsApp request failed" }
      }
    } else {
      whatsapp = { sent: false, error: "WHATSAPP_PHONE_ID or WHATSAPP_TOKEN not set on the server" }
    }

    // Only expose the OTP in the response when explicitly enabled for local/dev testing.
    // Keep DEBUG_OTP unset (or "false") in production so the OTP is not leaked.
    const debugFields = process.env.DEBUG_OTP === "true" ? { debug_otp: otp } : {}

    return NextResponse.json({ success: true, ...debugFields, whatsapp, sent_to: norm.waTo, country: norm.country, user: allowed })
  }catch(e:any){
    return NextResponse.json({ error: e.message||"Server error" }, { status:500 })
  }
}
