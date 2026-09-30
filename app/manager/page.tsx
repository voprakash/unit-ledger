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
  const [editingTenant, setEditingTenant] = useState<any>(null)
  const [detailsTenant, setDetailsTenant] = useState<any>(null)
  const [txns, setTxns] = useState<any[]>([])
  const [editingTxn, setEditingTxn] = useState<any>(null)
  const [txnEditForm, setTxnEditForm] = useState({ amount: "", type: "rent", method: "cash", description: "", date: "" })
  const [showTrash, setShowTrash] = useState(false)
  const [trashTxns, setTrashTxns] = useState<any[]>([])
  const [meAdmin, setMeAdmin] = useState(false)
  const [managers, setManagers] = useState<any[]>([])
  const [selectedManager, setSelectedManager] = useState("all")
  const [editForm, setEditForm] = useState({
    name: "", phone: "", property: "", rent: "", deposit: "",
    aadhaar: "", start_date: "", notes: "",
    office_name: "", office_address: "", status: "active"
  })
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
    loadTxns()
    fetch("/api/auth/me").then(r => r.json()).then(me => {
      if (me && String(me.role || "").toLowerCase() === "admin") {
        setMeAdmin(true)
        // Admins get the manager picker: load all users for name lookup
        fetch("/api/manager/users").then(r => r.json()).then(u => {
          setManagers(Array.isArray(u) ? u : [])
        }).catch(() => {})
      }
    }).catch(() => {})
  }, [])

  const loadTxns = async () => {
    try {
      const res = await fetch("/api/transactions")
      const data = await res.json()
      setTxns(Array.isArray(data) ? data : [])
    } catch { setTxns([]) }
  }

  const loadTrash = async () => {
    try {
      const res = await fetch("/api/transactions?filter=deleted")
      const data = await res.json()
      setTrashTxns(Array.isArray(data) ? data : [])
    } catch { setTrashTxns([]) }
  }

  const tenantTxns = (tenantId: any) =>
    txns
      .filter((x: any) => String(x.tenant_id) === String(tenantId))
      .sort((a: any, b: any) => String(b.date || b.created_at || "").localeCompare(String(a.date || a.created_at || "")))

  const canModifyTxn = (x: any) => meAdmin || String(x.created_by) === String(session?.phone)
  const canModifyTenant = (t: any) => meAdmin || String(t.created_by) === String(session?.phone)
  const isEditedTxn = (x: any) =>
    x.updated_at && x.created_at &&
    (new Date(x.updated_at).getTime() - new Date(x.created_at).getTime() > 60000)

  const loadTenants = async () => {
    const res = await fetch("/api/tenants")
    const data = await res.json()
    setTenants(Array.isArray(data)? data : [])
  }

  const filteredTenants = tenants
    .filter(t => selectedManager === "all" || String(t.created_by) === selectedManager)
    .filter(t =>
      t.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      t.phone?.includes(search) ||
      t.room_number?.toLowerCase().includes(search.toLowerCase())
    )

  // Admin-only: which manager added each tenant (tenants are created with created_by = adder's phone)
  const managerName = (phone: any) => {
    const m = managers.find((u: any) => String(u.phone) === String(phone))
    return m?.name || String(phone || "—")
  }
  const managerOptions = (() => {
    const counts: Record<string, number> = {}
    tenants.forEach(t => {
      const k = String(t.created_by || "unknown")
      counts[k] = (counts[k] || 0) + 1
    })
    return Object.entries(counts)
      .map(([phone, count]) => ({ phone, count, name: managerName(phone) }))
      .sort((a, b) => a.name.localeCompare(b.name))
  })()

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
      await loadTxns()
      alert("Transaction Added!")
    } catch (e: any) {
      alert(e.message)
    } finally {
      setLoading(false)
    }
  }

  const openEditTxn = (x: any) => {
    setEditingTxn(x)
    setTxnEditForm({
      amount: String(x.amount ?? ""),
      type: x.type || "rent",
      method: x.method || "cash",
      description: x.notes || "",
      date: String(x.date || x.created_at || "").slice(0, 10),
    })
  }

  const handleEditTxn = async () => {
    if (!txnEditForm.amount) { alert("Amount required"); return }
    setLoading(true)
    try {
      const res = await fetch("/api/transactions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingTxn.id,
          amount: Number(txnEditForm.amount),
          type: txnEditForm.type,
          method: txnEditForm.method,
          notes: txnEditForm.description,
          date: txnEditForm.date,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Update failed")
      setEditingTxn(null)
      await loadTxns()
    } catch (e: any) { alert(e.message) } finally { setLoading(false) }
  }

  const handleDeleteTxn = async (x: any, permanent = false) => {
    if (!confirm(permanent
      ? "Delete this transaction FOREVER? This cannot be undone."
      : "Delete this transaction? You can restore it from trash.")) return
    try {
      const res = await fetch("/api/transactions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: x.id, permanent }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Delete failed")
      await loadTxns()
      if (showTrash) await loadTrash()
    } catch (e: any) { alert(e.message) }
  }

  const handleRestoreTxn = async (x: any) => {
    try {
      const res = await fetch("/api/transactions/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: x.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Restore failed")
      await loadTxns()
      await loadTrash()
    } catch (e: any) { alert(e.message) }
  }

  const handleDeleteTenant = async (t: Tenant) => {
    if (!confirm(`Delete tenant ${t.full_name} permanently?`)) return
    try {
      const res = await fetch("/api/tenants", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: t.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Delete failed")
      if (detailsTenant?.id === t.id) setDetailsTenant(null)
      await loadTenants()
    } catch (e: any) { alert(e.message) }
  }

  const openEditTenant = (t: Tenant) => {
    setEditingTenant(t)
    setEditForm({
      name: t.full_name || "",
      phone: t.phone || "",
      property: t.room_number || "",
      rent: t.rent_amount != null ? String(t.rent_amount) : "",
      deposit: t.deposit != null ? String(t.deposit) : "",
      aadhaar: t.id_number || "",
      start_date: t.start_date ? String(t.start_date).slice(0, 10) : "",
      notes: t.address || "",
      office_name: t.office_name || "",
      office_address: t.office_address || "",
      status: t.status || "active"
    })
  }

  const handleEditTenant = async () => {
    if (!editForm.name || !editForm.phone) {
      alert("Name and Phone required")
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/tenants", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingTenant.id,
          name: editForm.name,
          phone: editForm.phone,
          property: editForm.property,
          rent: editForm.rent ? Number(editForm.rent) : null,
          deposit: editForm.deposit ? Number(editForm.deposit) : null,
          start_date: editForm.start_date || null,
          status: editForm.status,
          aadhaar: editForm.aadhaar,
          notes: editForm.notes,
          office_name: editForm.office_name,
          office_address: editForm.office_address
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setEditingTenant(null)
      loadTenants()
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
            {meAdmin && <button onClick={() => window.location.href = "/manager/backup"} className="px-4 py-2 bg-gray-100 rounded-full text-[13px] font-bold">💾 Backup</button>}
            <button onClick={() => setShowAddTenant(true)} className="px-4 py-2 bg-black text-white rounded-full text-[13px] font-bold">+ Add Tenant</button>
            <button onClick={handleLogout} className="px-3 py-2 bg-gray-100 rounded-full text-[13px]">Logout</button>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto p-4">
        <div className="bg-white rounded-[20px] p-4 border mb-4">
          <p className="text-[13px] text-gray-500">Welcome, {session?.name} ({session?.phone})</p>
          <p className="text-[20px] font-bold">
            {filteredTenants.length} Tenants
            {meAdmin && selectedManager !== "all" && (
              <span className="text-[14px] font-semibold text-gray-500"> • {managerName(selectedManager)}</span>
            )}
          </p>
        </div>

        {meAdmin && (
          <select
            value={selectedManager}
            onChange={e => setSelectedManager(e.target.value)}
            className="w-full px-5 py-3 rounded-2xl border border-gray-200 bg-white text-[15px] mb-3 outline-none font-bold cursor-pointer"
          >
            <option value="all">All Managers ({tenants.length})</option>
            {managerOptions.map(o => (
              <option key={o.phone} value={o.phone}>{o.name} ({o.count})</option>
            ))}
          </select>
        )}

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
                  {meAdmin && <p className="text-[12px] text-gray-400 mt-0.5">👤 {managerName(t.created_by)}</p>}
                  {t.office_name && <p className="text-[12px] text-gray-400 mt-0.5">🏢 {t.office_name}{t.office_address ? ` • ${t.office_address}` : ""}</p>}
                </div>
                <div className="flex flex-col gap-1.5 shrink-0 ml-2">
                  <button onClick={() => setShowTrans(t)} className="px-3 py-1.5 rounded-xl bg-black text-white font-bold text-[12px]">+ Trans</button>
                  <button onClick={() => openEditTenant(t)} className="px-3 py-1.5 rounded-xl bg-gray-100 text-gray-800 font-bold text-[12px]">Edit</button>
                  <button onClick={() => setDetailsTenant(t)} className="px-3 py-1.5 rounded-xl bg-blue-50 text-blue-600 font-bold text-[12px]">Details</button>
                  {canModifyTenant(t) && (
                    <button onClick={() => handleDeleteTenant(t)} className="px-3 py-1.5 rounded-xl bg-red-50 text-red-600 font-bold text-[12px]">Delete</button>
                  )}
                </div>
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
                <option value="water">Water</option>
                <option value="gas">Gas</option>
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

      {/* ===== EDIT TRANSACTION MODAL ===== */}
      {editingTxn && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center">
          <div className="bg-white w-full max-w-md rounded-t-[32px] sm:rounded-[32px] max-h-[92vh] flex flex-col shadow-2xl overflow-hidden mt-12 sm:mt-0">
            <div className="shrink-0 bg-white rounded-t-[32px] px-6 pt-4 pb-3 border-b border-gray-100">
              <div className="w-10 h-1.5 bg-gray-200 rounded-full mx-auto mb-4 sm:hidden"></div>
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-[20px] font-bold text-gray-900">Edit Transaction</h2>
                  <p className="text-[13px] text-gray-500">{editingTxn.tenant_name || ""}</p>
                </div>
                <button onClick={() => setEditingTxn(null)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-[14px]">✕</button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3 overscroll-contain">
              <input value={txnEditForm.amount} onChange={e => setTxnEditForm({...txnEditForm, amount: e.target.value })} placeholder="Amount ₹" type="number" className="w-full px-5 py-4 rounded-2xl border border-black text-[16px] outline-none" />
              <select value={txnEditForm.type} onChange={e => setTxnEditForm({...txnEditForm, type: e.target.value })} className="w-full px-5 py-4 rounded-2xl border border-black text-[16px] bg-white outline-none">
                <option value="rent">Rent</option>
                <option value="deposit">Deposit</option>
                <option value="maintenance">Maintenance</option>
                <option value="electricity">Electricity</option>
                <option value="water">Water</option>
                <option value="gas">Gas</option>
                <option value="other">Other</option>
              </select>
              <select value={txnEditForm.method} onChange={e => setTxnEditForm({...txnEditForm, method: e.target.value })} className="w-full px-5 py-4 rounded-2xl border border-black text-[16px] bg-white outline-none">
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
                <option value="bank">Bank Transfer</option>
                <option value="other">Other</option>
              </select>
              <input type="date" value={txnEditForm.date} onChange={e => setTxnEditForm({...txnEditForm, date: e.target.value })} className="w-full px-5 py-4 rounded-2xl border border-black text-[16px] outline-none" />
              <input value={txnEditForm.description} onChange={e => setTxnEditForm({...txnEditForm, description: e.target.value })} placeholder="Description / notes" className="w-full px-5 py-4 rounded-2xl border border-black text-[16px] outline-none" />
            </div>

            <div className="shrink-0 bg-white px-5 py-4 pb-[max(16px,env(safe-area-inset-bottom))] border-t border-gray-100 flex gap-3">
              <button onClick={() => setEditingTxn(null)} className="flex-1 py-4 rounded-2xl bg-gray-100 font-bold text-[16px] text-gray-900">Cancel</button>
              <button onClick={handleEditTxn} disabled={loading} className="flex-1 py-4 rounded-2xl bg-black text-white font-bold text-[16px] disabled:opacity-50">{loading ? "Saving..." : "Save Changes"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== EDIT TENANT MODAL ===== */}
      {editingTenant && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center">
          <div className="bg-white w-full max-w-md rounded-t-[32px] sm:rounded-[32px] max-h-[92vh] flex flex-col shadow-2xl overflow-hidden mt-12 sm:mt-0">
            <div className="shrink-0 bg-white rounded-t-[32px] px-6 pt-4 pb-3 border-b border-gray-100">
              <div className="w-10 h-1.5 bg-gray-200 rounded-full mx-auto mb-4 sm:hidden"></div>
              <div className="flex justify-between items-center">
                <h2 className="text-[20px] font-bold text-gray-900">Edit Tenant</h2>
                <button onClick={() => setEditingTenant(null)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-[14px]">✕</button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4 overscroll-contain">
              <div>
                <p className="text-[11px] font-bold tracking-widest text-gray-500 mb-2 ml-1">BASIC</p>
                <div className="space-y-3">
                  <input value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value })} placeholder="Name" className="w-full px-5 py-4 rounded-2xl border border-black text-[16px] outline-none" />
                  <input value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value })} placeholder="Phone" className="w-full px-5 py-4 rounded-2xl border border-black text-[16px] outline-none" />
                  <div className="flex gap-3">
                    <input value={editForm.property} onChange={e => setEditForm({...editForm, property: e.target.value })} placeholder="Room no" className="flex-1 px-5 py-4 rounded-2xl border border-black text-[16px] outline-none" />
                    <input value={editForm.rent} onChange={e => setEditForm({...editForm, rent: e.target.value })} placeholder="Rent" className="flex-1 px-5 py-4 rounded-2xl border border-black text-[16px] outline-none" />
                  </div>
                  <select value={editForm.status} onChange={e => setEditForm({...editForm, status: e.target.value })} className="w-full px-5 py-4 rounded-2xl border border-black text-[16px] bg-white outline-none">
                    <option value="active">Active</option>
                    <option value="notice">Notice</option>
                    <option value="vacated">Vacated</option>
                  </select>
                </div>
              </div>

              <div>
                <p className="text-[11px] font-bold tracking-widest text-gray-500 mb-2 ml-1">OFFICE</p>
                <div className="space-y-3">
                  <input value={editForm.office_name} onChange={e => setEditForm({...editForm, office_name: e.target.value })} placeholder="Office name" className="w-full px-5 py-4 rounded-2xl border border-black text-[16px] outline-none" />
                  <input value={editForm.office_address} onChange={e => setEditForm({...editForm, office_address: e.target.value })} placeholder="Office address" className="w-full px-5 py-4 rounded-2xl border border-black text-[16px] outline-none" />
                </div>
              </div>

              <div>
                <p className="text-[11px] font-bold tracking-widest text-gray-500 mb-2 ml-1">OTHER DETAILS</p>
                <div className="space-y-3">
                  <input value={editForm.deposit} onChange={e => setEditForm({...editForm, deposit: e.target.value })} placeholder="Deposit" className="w-full px-5 py-4 rounded-2xl border border-black text-[16px] outline-none" />
                  <input value={editForm.aadhaar} onChange={e => setEditForm({...editForm, aadhaar: e.target.value })} placeholder="Aadhaar / ID number" className="w-full px-5 py-4 rounded-2xl border border-black text-[16px] outline-none" />
                  <input value={editForm.start_date} onChange={e => setEditForm({...editForm, start_date: e.target.value })} type="date" className="w-full px-5 py-4 rounded-2xl border border-black text-[16px] outline-none" />
                  <input value={editForm.notes} onChange={e => setEditForm({...editForm, notes: e.target.value })} placeholder="Notes / Address" className="w-full px-5 py-4 rounded-2xl border border-black text-[16px] outline-none" />
                </div>
              </div>
            </div>

            <div className="shrink-0 bg-white px-5 py-4 pb-[max(16px,env(safe-area-inset-bottom))] border-t border-gray-100 flex gap-3">
              <button onClick={() => setEditingTenant(null)} className="flex-1 py-4 rounded-2xl bg-gray-100 font-bold text-[16px] text-gray-900">Cancel</button>
              <button onClick={handleEditTenant} disabled={loading} className="flex-1 py-4 rounded-2xl bg-black text-white font-bold text-[16px] disabled:opacity-50">{loading ? "Saving..." : "Save Changes"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== TENANT DETAILS MODAL ===== */}
      {detailsTenant && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center">
          <div className="bg-white w-full max-w-md rounded-t-[32px] sm:rounded-[32px] max-h-[92vh] flex flex-col shadow-2xl overflow-hidden mt-12 sm:mt-0">
            <div className="shrink-0 bg-white rounded-t-[32px] px-6 pt-4 pb-3 border-b border-gray-100">
              <div className="w-10 h-1.5 bg-gray-200 rounded-full mx-auto mb-4 sm:hidden"></div>
              <div className="flex justify-between items-center">
                <h2 className="text-[20px] font-bold text-gray-900">Tenant Details</h2>
                <button onClick={() => { setDetailsTenant(null); setShowTrash(false) }} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-[14px]">✕</button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-4 overscroll-contain">
              <div className="bg-[#f5f6f8] rounded-2xl p-4 space-y-3">
                {[
                  ["NAME", detailsTenant.full_name],
                  ["PHONE", detailsTenant.phone],
                  ["ROOM", detailsTenant.room_number],
                  ["RENT", detailsTenant.rent_amount != null ? `₹${detailsTenant.rent_amount}` : null],
                  ["DEPOSIT", detailsTenant.deposit != null ? `₹${detailsTenant.deposit}` : null],
                  ["STATUS", detailsTenant.status],
                  ["START DATE", detailsTenant.start_date ? new Date(detailsTenant.start_date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : null],
                  ["ID NUMBER", detailsTenant.id_number],
                  ["ADDRESS", detailsTenant.address],
                  ["OFFICE NAME", detailsTenant.office_name],
                  ["OFFICE ADDRESS", detailsTenant.office_address],
                ].map(([label, value]) => value ? (
                  <div key={label}>
                    <p className="text-[11px] font-bold tracking-widest text-gray-400">{label}</p>
                    <p className="text-[16px] font-semibold">{value}</p>
                  </div>
                ) : null)}
              </div>

              {/* ===== TRANSACTIONS (edit / delete / trash) ===== */}
              <div className="mt-4">
                <p className="text-[11px] font-bold tracking-widest text-gray-400 mb-2 ml-1">TRANSACTIONS</p>
                {tenantTxns(detailsTenant.id).length === 0 && (
                  <p className="text-[13px] text-gray-400 ml-1">No transactions yet.</p>
                )}
                {tenantTxns(detailsTenant.id).map((x: any) => (
                  <div key={x.id} className="bg-white border border-gray-100 rounded-2xl p-3 mb-2">
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <p className="font-bold text-[15px]">₹{Number(x.amount).toLocaleString("en-IN")}
                          <span className="ml-2 text-[11px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold capitalize">{x.type || "other"}</span>
                          {isEditedTxn(x) && <span className="ml-1 text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-bold">edited</span>}
                        </p>
                        <p className="text-[12px] text-gray-500">{String(x.date || x.created_at || "").slice(0, 10)}{x.method ? ` • ${x.method}` : ""}</p>
                        {x.notes && <p className="text-[12px] text-gray-500 truncate">{x.notes}</p>}
                      </div>
                      {canModifyTxn(x) && (
                        <div className="flex gap-1.5 shrink-0">
                          <button onClick={() => openEditTxn(x)} className="px-2.5 py-1.5 rounded-xl bg-gray-100 text-gray-800 font-bold text-[11px]">Edit</button>
                          <button onClick={() => handleDeleteTxn(x)} className="px-2.5 py-1.5 rounded-xl bg-red-50 text-red-600 font-bold text-[11px]">Delete</button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                <button
                  onClick={() => { const v = !showTrash; setShowTrash(v); if (v) loadTrash() }}
                  className="w-full mt-1 py-2.5 rounded-2xl bg-gray-50 text-gray-600 font-bold text-[13px]"
                >
                  🗑️ Recently deleted
                </button>
                {showTrash && (
                  <div className="mt-2">
                    {trashTxns.filter((x: any) => String(x.tenant_id) === String(detailsTenant.id)).map((x: any) => (
                      <div key={x.id} className="bg-gray-50 border border-gray-100 rounded-2xl p-3 mb-2">
                        <div className="flex justify-between items-start gap-2">
                          <div className="min-w-0">
                            <p className="font-bold text-[15px] text-gray-500 line-through">₹{Number(x.amount).toLocaleString("en-IN")}</p>
                            <p className="text-[12px] text-gray-400">{String(x.date || x.created_at || "").slice(0, 10)} • {x.type || "other"}</p>
                          </div>
                          {canModifyTxn(x) && (
                            <div className="flex gap-1.5 shrink-0">
                              <button onClick={() => handleRestoreTxn(x)} className="px-2.5 py-1.5 rounded-xl bg-green-100 text-green-700 font-bold text-[11px]">Restore</button>
                              <button onClick={() => handleDeleteTxn(x, true)} className="px-2.5 py-1.5 rounded-xl bg-red-100 text-red-700 font-bold text-[11px]">Delete forever</button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {trashTxns.filter((x: any) => String(x.tenant_id) === String(detailsTenant.id)).length === 0 && (
                      <p className="text-[12px] text-gray-400 text-center py-2">Trash is empty.</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="shrink-0 bg-white px-5 py-4 pb-[max(16px,env(safe-area-inset-bottom))] border-t border-gray-100 flex gap-3">
              <button onClick={() => { setDetailsTenant(null); setShowTrash(false); openEditTenant(detailsTenant) }} className="flex-1 py-4 rounded-2xl bg-gray-100 font-bold text-[16px] text-gray-900">Edit</button>
              <button onClick={() => { setDetailsTenant(null); setShowTrash(false) }} className="flex-1 py-4 rounded-2xl bg-black text-white font-bold text-[16px]">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
