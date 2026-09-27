"use client"
import { useEffect, useState } from "react"

type User = { phone: string, name: string, role: string }

export default function TeamLedger() {
  const [authUser, setAuthUser] = useState<User | null>(null)
  const [phone, setPhone] = useState("")
  const [otp, setOtp] = useState("")
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)

  const [tenants, setTenants] = useState<any[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ full_name:"", phone:"", id_number:"", address:"", office_name:"", office_address:"" })
  const [search, setSearch] = useState("")

  useEffect(()=>{
    const saved = localStorage.getItem("unit_ledger_user")
    if (saved) {
      setAuthUser(JSON.parse(saved))
      loadTenants()
    }
  },[])

  async function loadTenants() {
    const res = await fetch("/api/tenants")
    const d = await res.json()
    setTenants(d.tenants || [])
  }

  async function sendOtp() {
    if (!phone) return alert("Enter phone like 9198...")
    setLoading(true)
    const res = await fetch("/api/auth/send-otp", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ phone }) })
    const d = await res.json()
    setLoading(false)
    if (d.error) alert(d.error)
    else { alert("OTP sent to WhatsApp"); setStep(2) }
  }

  async function verifyOtp() {
    setLoading(true)
    const res = await fetch("/api/auth/verify-otp", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ phone, otp }) })
    const d = await res.json()
    setLoading(false)
    if (d.error) alert(d.error)
    else {
      localStorage.setItem("unit_ledger_user", JSON.stringify(d.user))
      setAuthUser(d.user)
      loadTenants()
    }
  }

  function logout() {
    localStorage.removeItem("unit_ledger_user")
    setAuthUser(null)
    setStep(1)
  }

  async function addTenant() {
    if (!form.full_name) return alert("Enter full name")
    await fetch("/api/tenants", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({...form, created_by: authUser?.phone}) })
    setForm({ full_name:"", phone:"", id_number:"", address:"", office_name:"", office_address:"" })
    setShowAdd(false); loadTenants()
  }

  if (!authUser) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
        <div className="bg-white p-6 rounded-2xl shadow w-full max-w-sm space-y-4">
          <h1 className="font-bold text-xl text-center">🏠 Unit Ledger Login</h1>
          <p className="text-xs text-gray-500 text-center">Only authorized team can access</p>
          {step === 1 ? <>
            <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="919876543210" className="w-full border p-3 rounded-lg" />
            <button onClick={sendOtp} disabled={loading} className="w-full bg-black text-white p-3 rounded-xl">{loading?"Sending...":"Send OTP on WhatsApp"}</button>
          </> : <>
            <div className="text-xs">OTP sent to {phone}</div>
            <input value={otp} onChange={e=>setOtp(e.target.value)} placeholder="Enter 6-digit OTP" className="w-full border p-3 rounded-lg" />
            <button onClick={verifyOtp} disabled={loading} className="w-full bg-black text-white p-3 rounded-xl">{loading?"Verifying...":"Verify & Login"}</button>
            <button onClick={()=>setStep(1)} className="w-full text-xs">Change number</button>
          </>}
        </div>
      </div>
    )
  }

  const isManager = authUser.role === 'manager'
  const filtered = tenants.filter(t => t.full_name.toLowerCase().includes(search.toLowerCase()) || t.phone?.includes(search))

  return (
    <div className="min-h-screen bg-gray-50 p-3">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow">
          <div>
            <h1 className="font-bold text-lg">🏠 Team Ledger</h1>
            <div className="text-xs text-gray-500">{authUser.name} • {authUser.role}</div>
          </div>
          <div className="flex gap-2">
            {isManager && <a href="/manager" className="text-xs bg-black text-white px-3 py-2 rounded-lg">👥 Manager</a>}
            <button onClick={logout} className="text-xs bg-gray-100 px-3 py-2 rounded-lg">Logout</button>
          </div>
        </div>

        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name or phone..." className="w-full p-3 rounded-xl border" />

        <button onClick={()=>setShowAdd(!showAdd)} className="w-full bg-black text-white p-3 rounded-xl">{showAdd ? "Close" : "+ Add New Tenant"}</button>

        {showAdd && (
          <div className="bg-white p-4 rounded-2xl shadow space-y-3">
            <h2 className="font-bold">Add New Tenant</h2>
            <input placeholder="Full Name *" value={form.full_name} onChange={e=>setForm({...form, full_name:e.target.value})} className="w-full border p-3 rounded-lg" />
            <div className="grid grid-cols-2 gap-2">
              <input placeholder="Phone" value={form.phone} onChange={e=>setForm({...form, phone:e.target.value})} className="border p-3 rounded-lg" />
              <input placeholder="ID Number (Aadhar/Passport)" value={form.id_number} onChange={e=>setForm({...form, id_number:e.target.value})} className="border p-3 rounded-lg" />
            </div>
            <input placeholder="Home Address" value={form.address} onChange={e=>setForm({...form, address:e.target.value})} className="w-full border p-3 rounded-lg" />
            <input placeholder="Working Office Name" value={form.office_name} onChange={e=>setForm({...form, office_name:e.target.value})} className="w-full border p-3 rounded-lg" />
            <input placeholder="Office Address" value={form.office_address} onChange={e=>setForm({...form, office_address:e.target.value})} className="w-full border p-3 rounded-lg" />
            <button onClick={addTenant} className="w-full bg-black text-white p-3 rounded-xl">Save Tenant</button>
          </div>
        )}

        <div className="space-y-3">
          {filtered.map(t=>(
            <a key={t.id} href={`/tenant/${t.id}`} className="block bg-white p-4 rounded-2xl shadow flex justify-between">
              <div>
                <div className="font-bold">{t.full_name}</div>
                <div className="text-xs text-gray-500">{t.phone} • ID: {t.id_number}</div>
                <div className="text-xs text-gray-500 mt-1">{t.address}</div>
                <div className="text-xs mt-1">🏢 {t.office_name}</div>
              </div>
              <div className="text-xs bg-gray-100 px-2 py-1 rounded h-fit">View →</div>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
