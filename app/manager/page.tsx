"use client"
import { useState, useEffect } from "react"

type Tenant = any

export default function ManagerPage() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [showAddTenant, setShowAddTenant] = useState(false)
  const [loading, setLoading] = useState(false)
  const [session, setSession] = useState<any>(null)

  const [form, setForm] = useState({
    name: "",
    phone: "",
    property: "",
    rent: "",
    deposit: "",
    aadhhaar: "",
    aadhaar: "",
    start_date: "",
    notes: "",
    status: "active"
  })

  useEffect(() => {
    const s = localStorage.getItem("team_session")
    if (s) setSession(JSON.parse(s))
    else window.location.href = "/"
    loadTenants()
  }, [])

  const loadTenants = async () => {
    const res = await fetch("/api/tenants")
    const data = await res.json()
    setTenants(Array.isArray(data)? data : [])
  }

  const handleLogout = async () => {
    try { await fetch("/api/auth/logout", { method: "POST" }) } catch {}
    localStorage.clear()
    window.location.href = "/"
  }

  const handleAddTenant = async () => {
    if (!form.name ||!form.phone) {
      alert("Name and Phone required")
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/tenants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          property: form.property,
          rent: form.rent? Number(form.rent) : null,
          deposit: form.deposit? Number(form.deposit) : null,
          start_date: form.start_date || new Date().toISOString(),
          created_by: session?.phone,
          status: form.status,
          aadhaar: form.aadhaar,
          notes: form.notes
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setShowAddTenant(false)
      setForm({ name: "", phone: "", property: "", rent: "", deposit: "", aadhhaar: "", aadhaar: "", start_date: "", notes: "", status: "active" })
      loadTenants()
    } catch (e: any) {
      alert(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f5f6f8]">
      {/* Top Menu - fixed height */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-100">
        <div className="max-w-md mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="font-bold text-[18px]">🏠 Manager</h1>
          <div className="flex gap-2">
            <button onClick={() => setShowAddTenant(true)} className="px-4 py-2 bg-black text-white rounded-full text-[13px] font-bold">+ Add Tenant</button>
            <button onClick={handleLogout} className="px-3 py-2 bg-gray-100 rounded-full text-[13px]">Logout</button>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto p-4">
        <div className="bg-white rounded-[20px] p-4 border mb-4">
          <p className="text-[13px] text-gray-500">Welcome, {session?.name} ({session?.phone})</p>
          <p className="text-[20px] font-bold">{tenants.length} Tenants</p>
        </div>

        <div className="space-y-3">
          {tenants.map((t) => (
            <div key={t.id} className="bg-white rounded-2xl p-4 border flex justify-between">
              <div>
                <p className="font-bold">{t.name}</p>
                <p className="text-[13px] text-gray-500">{t.property} • ₹{t.rent} • {t.status}</p>
              </div>
              <p className="text-[13px]">{t.phone}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ===== FIXED ADD TENANT MODAL - NO MORE OVERLAP ===== */}
      {showAddTenant && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center">
          <div className="bg-white w-full max-w-md rounded-t-[32px] sm:rounded-[32px] max-h-[92vh] flex flex-col shadow-2xl overflow-hidden mt-12 sm:mt-0">

            {/* Header - sticky, never cut off */}
            <div className="shrink-0 bg-white rounded-t-[32px] px-6 pt-4 pb-3 border-b border-gray-100">
              <div className="w-10 h-1.5 bg-gray-200 rounded-full mx-auto mb-4 sm:hidden"></div>
              <div className="flex justify-between items-center">
                <h2 className="text-[20px] font-bold text-gray-900">Add New Tenant</h2>
                <button onClick={() => setShowAddTenant(false)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-[14px]">✕</button>
              </div>
            </div>

            {/* Scrollable Form - with your exact fields from screenshot */}
            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4 overscroll-contain">
              <div>
                <p className="text-[11px] font-bold tracking-widest text-gray-500 mb-2 ml-1">BASIC</p>
                <div className="space-y-3">
                  <input value={form.name} onChange={e => setForm({...form, name: e.target.value })} placeholder="Name" className="w-full px-5 py-4 rounded-2xl border border-black text-[16px] outline-none focus:ring-2 focus:ring-black" />
                  <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value })} placeholder="Phone" className="w-full px-5 py-4 rounded-2xl border border-black text-[16px] outline-none focus:ring-2 focus:ring-black" />
                  <div className="flex gap-3">
                    <input value={form.property} onChange={e => setForm({...form, property: e.target.value })} placeholder="201" className="flex-1 px-5 py-4 rounded-2xl border border-black text-[16px] outline-none" />
                    <input value={form.rent} onChange={e => setForm({...form, rent: e.target.value })} placeholder="5000" className="flex-1 px-5 py-4 rounded-2xl border border-black text-[16px] outline-none" />
                  </div>
                  <select value={form.status} onChange={e => setForm({...form, status: e.target.value })} className="w-full px-5 py-4 rounded-2xl border border-black text-[16px] bg-white outline-none">
                    <option value="active">Active</option>
                    <option value="notice">Notice</option>
                    <option value="vacated">Vacated</option>
                  </select>
                </div>
              </div>

              <div>
                <p className="text-[11px] font-bold tracking-widest text-gray-500 mb-2 ml-1">OTHER DETAILS</p>
                <div className="space-y-3">
                  <input value={form.deposit} onChange={e => setForm({...form, deposit: e.target.value })} placeholder="Deposit" className="w-full px-5 py-4 rounded-2xl border border-black text-[16px] outline-none" />
                  <input value={form.aadhaar} onChange={e => setForm({...form, aadhaar: e.target.value })} placeholder="Aadhaar" className="w-full px-5 py-4 rounded-2xl border border-black text-[16px] outline-none" />
                  <input value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value })} type="date" className="w-full px-5 py-4 rounded-2xl border border-black text-[16px] outline-none" />
                  <input value={form.notes} onChange={e => setForm({...form, notes: e.target.value })} placeholder="Notes / Address" className="w-full px-5 py-4 rounded-2xl border border-black text-[16px] outline-none" />
                </div>
              </div>
            </div>

            {/* Footer - always visible */}
            <div className="shrink-0 bg-white px-5 py-4 pb-[max(16px,env(safe-area-inset-bottom))] border-t border-gray-100 flex gap-3">
              <button onClick={() => setShowAddTenant(false)} className="flex-1 py-4 rounded-2xl bg-gray-100 font-bold text-[16px] text-gray-900">Cancel</button>
              <button onClick={handleAddTenant} disabled={loading} className="flex-1 py-4 rounded-2xl bg-black text-white font-bold text-[16px] disabled:opacity-50">{loading? "Saving..." : "Save Tenant"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
