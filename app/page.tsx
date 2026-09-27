"use client"
import { useState, useEffect } from "react"

export const dynamic = 'force-dynamic'

function normalizePhone(input: string){
  let d = input.replace(/\D/g,"").replace(/^0+/,"")
  let national = d.slice(-10)
  let country: "US"|"IN" = /^[6-9]\d{9}$/.test(national)? "IN" : "US"
  let waTo = country==="IN"? "91"+national : "1"+national
  let isValid = national.length===10 && (country==="IN"? /^[6-9]\d{9}$/.test(national) : /^[2-9]\d{9}$/.test(national))
  if(d.length===11 && d.startsWith("1")){ national=d.slice(1); waTo=d; country="US"; isValid=/^[2-9]\d{9}$/.test(national) }
  if(d.length===12 && d.startsWith("91")){ national=d.slice(2); waTo=d; country="IN"; isValid=/^[6-9]\d{9}$/.test(national) }
  return { national, waTo, country, isValid }
}

export default function Home() {
  const [phone, setPhone] = useState("")
  const [otp, setOtp] = useState("")
  const [step, setStep] = useState<"phone"|"otp">("phone")
  const [loading, setLoading] = useState(false)
  const [info, setInfo] = useState<any>(null)

  useEffect(()=>{
    const saved = localStorage.getItem("team_session")
    if(saved) window.location.href = "/manager"
  },[])

  const sendOtp = async () => {
    const norm = normalizePhone(phone)
    if(!norm.isValid) return alert(`Invalid phone. Use 10-digit US (310...) or IN (98...)`)
    setLoading(true)
    const res = await fetch("/api/send-otp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone }) })
    const data = await res.json()
    setLoading(false)
    if(!res.ok) return alert(data.error)
    setInfo(data)
    alert(`OTP Sent to ${data.sent_to} (${data.country}). Debug OTP: ${data.debug_otp}`)
    setStep("otp")
  }

  const verifyOtp = async () => {
    setLoading(true)
    const res = await fetch("/api/verify-otp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone, otp }) })
    const data = await res.json()
    setLoading(false)
    if(!res.ok) return alert(data.error)
    localStorage.setItem("team_session", JSON.stringify({ phone: data.phone, name: data.name, role: data.role, country: data.country, loginAt: Date.now() }))
    localStorage.setItem("user_phone", data.phone)
    window.location.href = "/manager"
  }

  return (
    <div className="min-h-screen bg-[#f5f6f8] p-4 max-w-md mx-auto">
      <div className="bg-white rounded-[20px] p-5 shadow-sm border border-gray-100 flex justify-between items-center mb-10 mt-2">
        <div><h1 className="text-[20px] font-bold text-gray-900">🏠 Team Ledger</h1><p className="text-[14px] text-gray-600">WhatsApp OTP • US & India</p></div>
      </div>
      <div className="bg-white rounded-[28px] p-6 shadow-sm border border-gray-100">
        <h2 className="text-[22px] font-bold text-[#111827] mb-2">Login</h2>
        <p className="text-[14px] text-[#6b7280] mb-6">Allowed team only. OTP via WhatsApp. Forever session.</p>
        {step==="phone"?(
          <>
            <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="US: 3108688236 or IN: 9881160765" className="w-full px-5 py-4 rounded-2xl border border-gray-200 bg-white text-[16px] mb-4 focus:outline-none focus:ring-2 focus:ring-black" />
            <button onClick={sendOtp} disabled={loading} className="w-full py-4 rounded-2xl bg-black text-white font-bold text-[17px] disabled:opacity-50">{loading?"Sending...":"Send WhatsApp OTP"}</button>
            {info && <p className="text-xs text-gray-500 mt-3 text-center">Last: {info.sent_to} • {info.country}</p>}
          </>
        ):(
          <>
            <p className="text-sm text-gray-600 mb-3">OTP to {phone} <button onClick={()=>setStep("phone")} className="font-bold underline ml-2">Change</button></p>
            <input value={otp} onChange={e=>setOtp(e.target.value)} placeholder="6-digit OTP" className="w-full px-5 py-4 rounded-2xl border text-[20px] font-bold tracking-[0.3em] text-center mb-4 focus:ring-2 focus:ring-black outline-none" maxLength={6} />
            <button onClick={verifyOtp} disabled={loading} className="w-full py-4 rounded-2xl bg-black text-white font-bold">{loading?"Verifying...":"Verify & Login Forever"}</button>
            <button onClick={sendOtp} className="w-full py-3 mt-3 rounded-2xl bg-gray-100 font-semibold">Resend</button>
          </>
        )}
      </div>
    </div>
  )
}
