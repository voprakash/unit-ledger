"use client"
import { useState } from "react"
import { createClient } from "@supabase/supabase-js"

export const dynamic = 'force-dynamic'

const getSupabase = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_KEY!
  return createClient(url, key as string)
}

export default function Home() {
  const [phone, setPhone] = useState("")
  const [otp, setOtp] = useState("")
  const [step, setStep] = useState<"phone"|"otp">("phone")
  const [loading, setLoading] = useState(false)

  const sendOtp = async () => {
    if(!phone) return alert("Enter phone")
    setLoading(true)
    const supabase = getSupabase()
    // Format: +91xxxxxxxxxx
    let formatted = phone.replace(/\s/g, "")
    if(!formatted.startsWith("+")) formatted = "+91" + formatted

    const { error } = await supabase.auth.signInWithOtp({ phone: formatted })
    setLoading(false)
    if(error) alert(error.message)
    else {
      alert("OTP Sent!")
      setStep("otp")
    }
  }

  const verifyOtp = async () => {
    if(!otp) return alert("Enter OTP")
    setLoading(true)
    const supabase = getSupabase()
    let formatted = phone.replace(/\s/g, "")
    if(!formatted.startsWith("+")) formatted = "+91" + formatted

    const { data, error } = await supabase.auth.verifyOtp({
      phone: formatted,
      token: otp,
      type: "sms"
    })
    setLoading(false)
    if(error) alert(error.message)
    else {
      localStorage.setItem("user_phone", formatted)
      window.location.href = "/manager"
    }
  }

  const handleLogout = async () => {
    try { await getSupabase().auth.signOut() } catch {}
    localStorage.clear()
    sessionStorage.clear()
    window.location.replace("/")
  }

  return (
    <div className="min-h-screen bg-[#f5f6f8] p-4 max-w-md mx-auto flex flex-col">
      <div className="bg-white rounded-[20px] p-5 shadow-sm border border-gray-100 flex justify-between items-center mb-10 mt-2">
        <div>
          <h1 className="text-[20px] font-bold text-gray-900">🏠 Team Ledger</h1>
          <p className="text-[14px] text-gray-600 font-medium mt-1">Login</p>
        </div>
      </div>

      <div className="bg-white rounded-[28px] p-6 shadow-sm border border-gray-100">
        <h2 className="text-[22px] font-bold text-[#111827] mb-2">Welcome Prakash</h2>
        <p className="text-[14px] text-[#6b7280] mb-6">Enter your phone to get OTP</p>

        {step === "phone"? (
          <>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone e.g. 9876543210"
              className="w-full px-5 py-4 rounded-2xl border border-gray-200 bg-white text-gray-900 text-[16px] font-medium mb-4 focus:outline-none focus:ring-2 focus:ring-black"
              type="tel"
            />
            <button onClick={sendOtp} disabled={loading} className="w-full py-4 rounded-2xl bg-black text-white font-bold text-[17px] disabled:opacity-50">
              {loading? "Sending..." : "Send OTP"}
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-gray-600 mb-3">OTP sent to {phone} <button onClick={()=>setStep("phone")} className="text-black font-bold underline ml-2">Change</button></p>
            <input
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              placeholder="Enter 6-digit OTP"
              className="w-full px-5 py-4 rounded-2xl border border-gray-200 bg-white text-gray-900 text-[20px] font-bold tracking-[0.3em] text-center mb-4 focus:outline-none focus:ring-2 focus:ring-black"
              maxLength={6}
            />
            <button onClick={verifyOtp} disabled={loading} className="w-full py-4 rounded-2xl bg-black text-white font-bold text-[17px] disabled:opacity-50">
              {loading? "Verifying..." : "Verify & Login"}
            </button>
            <button onClick={sendOtp} className="w-full py-3 mt-3 rounded-2xl bg-gray-100 text-[#111827] font-semibold">Resend OTP</button>
          </>
        )}
      </div>

      <p className="text-center text-[12px] text-gray-400 mt-8">OTP via Supabase Auth • Make sure phone auth enabled in Supabase</p>
    </div>
  )
}
