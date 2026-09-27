"use client"
import { useState, useEffect } from "react"
export const dynamic = 'force-dynamic'

export default function Home() {
  const [phone, setPhone] = useState("")
  const [otp, setOtp] = useState("")
  const [step, setStep] = useState<"phone"|"otp">("phone")
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState("")

  useEffect(()=>{ if(localStorage.getItem("team_session")) window.location.href="/manager" },[])

  const sendOtp = async () => {
    setLoading(true); setMsg("")
    try{
      const res = await fetch("/api/send-otp", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ phone }), signal: AbortSignal.timeout(15000) })
      const data = await res.json()
      if(!res.ok) throw new Error(data.error || "Failed")
      setMsg(`✅ OTP: ${data.debug_otp} | To: ${data.sent_to} | ${data.user?.name}`)
      setStep("otp")
    }catch(e:any){ setMsg("❌ "+(e.message||"Network error. Check Vercel logs")) }
    finally{ setLoading(false) }
  }

  const verifyOtp = async () => {
    setLoading(true); setMsg("")
    try{
      const res = await fetch("/api/verify-otp", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ phone, otp }) })
      const data = await res.json()
      if(!res.ok) throw new Error(data.error)
      localStorage.setItem("team_session", JSON.stringify({ phone: data.phone, name: data.name, role: data.role, loginAt: Date.now() }))
      window.location.href="/manager"
    }catch(e:any){ setMsg("❌ "+e.message) }
    finally{ setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-[#f5f6f8] p-4 max-w-md mx-auto">
      <div className="bg-white rounded-[20px] p-5 shadow-sm border mb-6 mt-2"><h1 className="text-[20px] font-bold">🏠 Team Ledger</h1><p className="text-[14px] text-gray-600">Debug Mode</p></div>
      <div className="bg-white rounded-[28px] p-6 shadow-sm border">
        <h2 className="text-[18px] font-bold mb-4">Login {step==="otp" && ` - ${phone}`}</h2>
        {step==="phone"? (
          <>
            <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="3108688236" className="w-full px-5 py-4 rounded-2xl border text-[16px] mb-3" />
            <button onClick={sendOtp} disabled={loading} className="w-full py-4 rounded-2xl bg-black text-white font-bold disabled:opacity-50">{loading?"Sending (15s timeout)...":"Send OTP"}</button>
          </>
        ) : (
          <>
            <input value={otp} onChange={e=>setOtp(e.target.value)} placeholder="123456" className="w-full px-5 py-4 rounded-2xl border text-[20px] font-bold tracking-widest text-center mb-3" />
            <button onClick={verifyOtp} disabled={loading} className="w-full py-4 rounded-2xl bg-black text-white font-bold">{loading?"Verifying...":"Verify & Login Forever"}</button>
            <button onClick={()=>setStep("phone")} className="w-full py-3 mt-2 rounded-2xl bg-gray-100">Change Phone</button>
          </>
        )}
        {msg && <div className="mt-4 p-3 rounded-xl bg-gray-100 text-[13px] break-all">{msg}</div>}
      </div>
      <div className="mt-4 text-[11px] text-gray-500">If stuck, open Vercel Logs section in dashboard</div>
    </div>
  )
}
