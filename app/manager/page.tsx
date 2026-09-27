"use client"
import { useState, useEffect } from "react"

type Tenant = any

export default function ManagerPage() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [showAddTenant, setShowAddTenant] = useState(false)
  const [loading, setLoading] = useState(false)
  const [session, setSession] = useState<any>(null)
  const [search, setSearch] = useState("")
  const [showTrans, setShowTrans] = useState<any>(null)
  const [transForm, setTransForm] = useState({
    amount: "",
    type: "rent",
    method: "cash",
    description: "",
    date: new Date().toISOString().split("T")[0]
  })

  const [form, setForm] = useState({
    name: "",
    phone: "",
    property: "",
    rent: "",
    deposit: "",
    aadhaar: "",
    start_date: "",
    notes: "",
    office_name: "",
    office_address: "",
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

  const filteredTenants = tenants.filter(t =>
    t.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    t.phone?.includes(search) ||
    t.room_number?.toLowerCase().includes(search.toLowerCase())
  )

  const handleAddTransaction = async () => {
    if (!transForm.amount) {
      alert("Amount required")
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenant_id: showTrans.id,
          tenant_name: showTrans.full_name,
          type: transForm.type,
          amount: Number(transForm.amount),
          method: transForm.method,
          notes: transForm.description,
          date: transForm.date,
          created_by: session?.phone
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setShowTrans(null)
      setTransForm({ amount: "", type: "rent", method: "cash", description: "", date: new Date().toISOString().split("T")[0] })
      alert("Transaction Added!")
    } catch (e: any) {
      alert(e.message)
    } finally {
      setLoading(false)
    }
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
          notes: form.notes,
          office_name: form.office_name,
          office_address: form.office_address
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setShowAddTenant(false)
      setForm({ name: "", phone: "", property: "", rent: "", deposit: "", aadhaar: "", start_date: "", notes: "", office_name: "", office_address: "", status: "active" })
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
            <button onClick={() => window.location.href = "/manager/reports"} className="px-4 py-2 bg-gray-100 rounded-full text-[13px] font-bold">📊 Reports</button>
            <button onClick={() => window.location.href = "/manager/users"} className="px-4 py-2 bg-gray-100 rounded-full text-[13px] font-bold">👥 Users</button>
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

        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search name, phone, room..."
          className="w-full px-5 py-3 rounded-2xl border border-gray-200 bg-white text-[15px] mb-4 outline-none focus:ring-2 focus:ring-black"
        />

        <div className="space-y-3">
          {filteredTenants.map((t) => (
            <div key={t.id} className="bg-white rounded-2xl p-4 border">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-bold">{t.full_name} <span className={`ml-1 text-[11px] px-2 py-0.5 rounded-full ${t.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"}`}>{t.status}</span></p>
                  <p className="text-[13px] text-gray-500">{t.room_number ? `Room ${t.room_number}` : ""} • ₹{t.rent_amount} / month</p>
                  <p className="text-[13px] text-gray-500">{t.phone}</p>
                  {t.office_name && <p className="text-[12px] text-gray-400 mt-0.5">🏢 {t.office_name}{t.office_address ? ` • ${t.office_address}` : ""}</p>}
                </div>
                <button onClick={() => setShowTrans(t)} className="px-4 py-2 rounded-xl bg-black text-white font-bold text-[13px] shrink-0 ml-2">+ Trans</button>
              </div>
            </div>
          ))}
          {filteredTenants.length === 0 && (
            <p className="text-center text-gray-400 text-[14px] py-6">No tenants found</p>
          )}
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
                <p className="text-[11px] font-bold tracking-widest text-gray-500 mb-2 ml-1">OFFICE</p>
                <div className="space-y-3">
                  <input value={form.office_name} onChange={e => setForm({...form, office_name: e.target.value })} placeholder="Office name" className="w-full px-5 py-4 rounded-2xl border border-black text-[16px] outline-none" />
                  <input value={form.office_address} onChange={e => setForm({...form, office_address: e.target.value })} placeholder="Office address" className="w-full px-5 py-4 rounded-2xl border border-black text-[16px] outline-none" />
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

      {/* ===== ADD TRANSACTION MODAL ===== */}
      {showTrans && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center">
          <div className="bg-white w-full max-w-md rounded-t-[32px] sm:rounded-[32px] max-h-[92vh] flex flex-col shadow-2xl overflow-hidden mt-12 sm:mt-0">
            <div className="shrink-0 bg-white rounded-t-[32px] px-6 pt-4 pb-3 border-b border-gray-100">
              <div className="w-10 h-1.5 bg-gray-200 rounded-full mx-auto mb-4 sm:hidden"></div>
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-[20px] font-bold text-gray-900">Add Transaction</h2>
                  <p className="text-[13px] text-gray-500">{showTrans.full_name} • {showTrans.room_number ? `Room ${showTrans.room_number}` : ""}</p>
                </div>
                <button onClick={() => setShowTrans(null)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-[14px]">✕</button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3 overscroll-contain">
              <input value={transForm.amount} onChange={e => setTransForm({...transForm, amount: e.target.value })} placeholder="Amount ₹" type="number" className="w-full px-5 py-4 rounded-2xl border border-black text-[16px] outline-none" />
              <select value={transForm.type} onChange={e => setTransForm({...transForm, type: e.target.value })} className="w-full px-5 py-4 rounded-2xl border border-black text-[16px] bg-white outline-none">
                <option value="rent">Rent</option>
                <option value="deposit">Deposit</option>
                <option value="maintenance">Maintenance</option>
                <option value="electricity">Electricity</option>
                <option value="other">Other</option>
              </select>
              <select value={transForm.method} onChange={e => setTransForm({...transForm, method: e.target.value })} className="w-full px-5 py-4 rounded-2xl border border-black text-[16px] bg-white outline-none">
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="bank">Bank Transfer</option>
                <option value="other">Other</option>
              </select>
              <input type="date" value={transForm.date} onChange={e => setTransForm({...transForm, date: e.target.value })} className="w-full px-5 py-4 rounded-2xl border border-black text-[16px] outline-none" />
              <input value={transForm.description} onChange={e => setTransForm({...transForm, description: e.target.value })} placeholder="Description / notes" className="w-full px-5 py-4 rounded-2xl border border-black text-[16px] outline-none" />
            </div>

            <div className="shrink-0 bg-white px-5 py-4 pb-[max(16px,env(safe-area-inset-bottom))] border-t border-gray-100 flex gap-3">
              <button onClick={() => setShowTrans(null)} className="flex-1 py-4 rounded-2xl bg-gray-100 font-bold text-[16px] text-gray-900">Cancel</button>
              <button onClick={handleAddTransaction} disabled={loading} className="flex-1 py-4 rounded-2xl bg-black text-white font-bold text-[16px] disabled:opacity-50">{loading? "Adding..." : "Add Payment"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
