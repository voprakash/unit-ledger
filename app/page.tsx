"use client"
import { useState, useEffect } from "react"
export const dynamic = 'force-dynamic'

export default function Home() {
  const [phone, setPhone] = useState("")
  const [otp, setOtp] = useState("")
  const [step, setStep] = useState<"phone"|"otp">("phone")
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState("")

  useEffect(()=>{ 
    const saved = localStorage.getItem("team_session")
    if(saved) window.location.href="/manager"
  },[])

  const sendOtp = async () => {
    setLoading(true); setMsg("")
    try{
      const res = await fetch("/api/auth/send-otp", { 
        method:"POST", 
        headers:{"Content-Type":"application/json"}, 
        body: JSON.stringify({ phone }),
        signal: AbortSignal.timeout(15000)
      })
      const data = await res.json()
      if(!res.ok) throw new Error(data.error || "Failed to send")
      setMsg(`✅ OTP: ${data.debug_otp} | To: ${data.sent_to} | Name: ${data.user?.name}`)
      setStep("otp")
    }catch(e:any){ 
      setMsg("❌ "+(e.message||"Network error")) 
    } finally{ 
      setLoading(false) 
    }
  }

  const verifyOtp = async () => {
    setLoading(true); setMsg("")
    try{
      const res = await fetch("/api/auth/verify-otp", { 
        method:"POST", 
        headers:{"Content-Type":"application/json"}, 
        body: JSON.stringify({ phone, otp }) 
      })
      const data = await res.json()
      if(!res.ok) throw new Error(data.error || "Invalid OTP")
      localStorage.setItem("team_session", JSON.stringify({ 
        phone: data.phone, 
        name: data.name, 
        role: data.role, 
        country: data.country,
        loginAt: Date.now() 
      }))
      localStorage.setItem("user_phone", data.phone)
      window.location.href="/manager"
    }catch(e:any){ 
      setMsg("❌ "+e.message) 
    } finally{ 
      setLoading(false) 
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f6f8] p-4 max-w-md mx-auto">
      <div className="bg-white rounded-[20px] p-5 shadow-sm border border-gray-100 mb-6 mt-2">
        <h1 className="text-[20px] font-bold text-gray-900">🏠 Team Ledger</h1>
        <p className="text-[14px] text-gray-600">WhatsApp OTP • US & India • Forever Login</p>
      </div>
      <div className="bg-white rounded-[28px] p-6 shadow-sm border border-gray-100">
        <h2 className="text-[18px] font-bold mb-1">Login</h2>
        <p className="text-[13px] text-gray-500 mb-4">Allowed team only. Enter US or India number.</p>
        
        {step==="phone"? (
          <>
            <input 
              value={phone} 
              onChange={e=>setPhone(e.target.value)} 
              placeholder="US: 3108688236 or IN: 9881160765" 
              className="w-full px-5 py-4 rounded-2xl border border-gray-200 bg-white text-[16px] mb-3 focus:outline-none focus:ring-2 focus:ring-black" 
            />
            <button onClick={sendOtp} disabled={loading} className="w-full py-4 rounded-2xl bg-black text-white font-bold text-[16px] disabled:opacity-50">
              {loading?"Sending...":"Send WhatsApp OTP"}
            </button>
          </>
        ) : (
          <>
            <div className="flex justify-between items-center mb-3">
              <p className="text-[13px] text-gray-600">OTP sent to {phone}</p>
              <button onClick={()=>setStep("phone")} className="text-[13px] font-bold underline">Change</button>
            </div>
            <input 
              value={otp} 
              onChange={e=>setOtp(e.target.value)} 
              placeholder="123456" 
              className="w-full px-5 py-4 rounded-2xl border border-gray-200 text-[22px] font-bold tracking-[0.3em] text-center mb-3 focus:outline-none focus:ring-2 focus:ring-black" 
              maxLength={6}
            />
            <button onClick={verifyOtp} disabled={loading} className="w-full py-4 rounded-2xl bg-black text-white font-bold">
              {loading?"Verifying...":"Verify & Login Forever"}
            </button>
            <button onClick={sendOtp} className="w-full py-3 mt-2 rounded-2xl bg-gray-100 font-semibold text-[14px]">Resend OTP</button>
          </>
        )}
        {msg && <div className="mt-4 p-3 rounded-xl bg-gray-100 text-[13px] break-all border">{msg}</div>}
      </div>
    </div>
  )
}
