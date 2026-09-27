"use client"
import { useState, useEffect } from "react"

type User = any

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [search, setSearch] = useState("")
  const [showAdd, setShowAdd] = useState(false)
  const [loading, setLoading] = useState(false)
  const [session, setSession] = useState<any>(null)
  const [form, setForm] = useState({ name: "", phone: "", role: "member" })
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [editForm, setEditForm] = useState({ name: "", phone: "", role: "member" })
  const [detailsUser, setDetailsUser] = useState<User | null>(null)

  useEffect(() => {
    const s = localStorage.getItem("team_session")
    if (s) setSession(JSON.parse(s))
    else window.location.href = "/"
    loadUsers()
  }, [])

  const loadUsers = async () => {
    const res = await fetch("/api/manager/users")
    const data = await res.json()
    setUsers(Array.isArray(data) ? data : [])
  }

  const handleLogout = async () => {
    try { await fetch("/api/auth/logout", { method: "POST" }) } catch {}
    localStorage.clear()
    window.location.href = "/"
  }

  const handleAddUser = async () => {
    if (!form.name || !form.phone) {
      alert("Name and Phone required")
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/manager/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setShowAdd(false)
      setForm({ name: "", phone: "", role: "member" })
      loadUsers()
    } catch (e: any) {
      alert(e.message)
    } finally {
      setLoading(false)
    }
  }

  const openEdit = (u: User) => {
    setEditingUser(u)
    setEditForm({ name: u.name || "", phone: u.phone || "", role: u.role || "member" })
  }

  const handleEditUser = async () => {
    if (!editForm.name || !editForm.phone) {
      alert("Name and Phone required")
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/manager/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingUser.id, ...editForm })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setEditingUser(null)
      loadUsers()
    } catch (e: any) {
      alert(e.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteUser = async (u: User) => {
    if (!confirm(`Remove ${u.name} (${u.phone})? They will no longer be able to log in or use the WhatsApp bot.`)) return
    try {
      const res = await fetch(`/api/manager/users?id=${u.id}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      loadUsers()
    } catch (e: any) {
      alert(e.message)
    }
  }

  const filtered = users.filter(u =>
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.phone?.includes(search) ||
    u.role?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-[#f5f6f8]">
      {/* Top Menu */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-100">
        <div className="max-w-md mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="font-bold text-[18px]">👥 Users</h1>
          <div className="flex gap-2">
            <button onClick={() => window.location.href = "/manager"} className="px-4 py-2 bg-gray-100 rounded-full text-[13px] font-bold">🏠 Tenants</button>
            <button onClick={() => window.location.href = "/manager/reports"} className="px-4 py-2 bg-gray-100 rounded-full text-[13px] font-bold">📊 Reports</button>
            <button onClick={handleLogout} className="px-3 py-2 bg-gray-100 rounded-full text-[13px]">Logout</button>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto p-4">
        <div className="bg-white rounded-[20px] p-4 border mb-4">
          <p className="text-[13px] text-gray-500">Team members who can log in & use the bot</p>
          <p className="text-[20px] font-bold">{users.length} Users</p>
        </div>

        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search name, phone, role..."
          className="w-full px-5 py-3 rounded-2xl border border-gray-200 bg-white text-[15px] mb-4 outline-none focus:ring-2 focus:ring-black"
        />

        <button onClick={() => setShowAdd(true)} className="w-full py-4 rounded-2xl bg-black text-white font-bold text-[16px] mb-4">+ Add User</button>

        <div className="space-y-3">
          {filtered.map((u) => (
            <div key={u.id} className="bg-white rounded-2xl p-4 border flex justify-between items-center">
              <div>
                <p className="font-bold">{u.name} <span className={`ml-1 text-[11px] px-2 py-0.5 rounded-full ${u.role === "admin" ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-600"}`}>{u.role || "member"}</span></p>
                <p className="text-[13px] text-gray-500">{u.phone}</p>
              </div>
              <div className="flex gap-2 shrink-0 ml-2">
                <button onClick={() => openEdit(u)} className="px-3 py-2 rounded-xl bg-gray-100 text-gray-800 font-bold text-[13px]">Edit</button>
                <button onClick={() => setDetailsUser(u)} className="px-3 py-2 rounded-xl bg-blue-50 text-blue-600 font-bold text-[13px]">Details</button>
                <button onClick={() => handleDeleteUser(u)} className="px-3 py-2 rounded-xl bg-red-50 text-red-600 font-bold text-[13px]">Remove</button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-center text-gray-400 text-[14px] py-6">No users found</p>
          )}
        </div>
      </div>

      {/* ===== ADD USER MODAL ===== */}
      {showAdd && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center">
          <div className="bg-white w-full max-w-md rounded-t-[32px] sm:rounded-[32px] max-h-[92vh] flex flex-col shadow-2xl overflow-hidden mt-12 sm:mt-0">
            <div className="shrink-0 bg-white rounded-t-[32px] px-6 pt-4 pb-3 border-b border-gray-100">
              <div className="w-10 h-1.5 bg-gray-200 rounded-full mx-auto mb-4 sm:hidden"></div>
              <div className="flex justify-between items-center">
                <h2 className="text-[20px] font-bold text-gray-900">Add User</h2>
                <button onClick={() => setShowAdd(false)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-[14px]">✕</button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3 overscroll-contain">
              <input value={form.name} onChange={e => setForm({...form, name: e.target.value })} placeholder="Name" className="w-full px-5 py-4 rounded-2xl border border-black text-[16px] outline-none" />
              <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value })} placeholder="Phone (10 digits)" className="w-full px-5 py-4 rounded-2xl border border-black text-[16px] outline-none" />
              <select value={form.role} onChange={e => setForm({...form, role: e.target.value })} className="w-full px-5 py-4 rounded-2xl border border-black text-[16px] bg-white outline-none">
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
              <p className="text-[12px] text-gray-400 px-1">They'll log in with WhatsApp OTP on this phone number and can use the bot.</p>
            </div>

            <div className="shrink-0 bg-white px-5 py-4 pb-[max(16px,env(safe-area-inset-bottom))] border-t border-gray-100 flex gap-3">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-4 rounded-2xl bg-gray-100 font-bold text-[16px] text-gray-900">Cancel</button>
              <button onClick={handleAddUser} disabled={loading} className="flex-1 py-4 rounded-2xl bg-black text-white font-bold text-[16px] disabled:opacity-50">{loading ? "Adding..." : "Add User"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== EDIT USER MODAL ===== */}
      {editingUser && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center">
          <div className="bg-white w-full max-w-md rounded-t-[32px] sm:rounded-[32px] max-h-[92vh] flex flex-col shadow-2xl overflow-hidden mt-12 sm:mt-0">
            <div className="shrink-0 bg-white rounded-t-[32px] px-6 pt-4 pb-3 border-b border-gray-100">
              <div className="w-10 h-1.5 bg-gray-200 rounded-full mx-auto mb-4 sm:hidden"></div>
              <div className="flex justify-between items-center">
                <h2 className="text-[20px] font-bold text-gray-900">Edit User</h2>
                <button onClick={() => setEditingUser(null)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-[14px]">✕</button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3 overscroll-contain">
              <input value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value })} placeholder="Name" className="w-full px-5 py-4 rounded-2xl border border-black text-[16px] outline-none" />
              <input value={editForm.phone} onChange={e => setEditForm({...editForm, phone: e.target.value })} placeholder="Phone (10 digits)" className="w-full px-5 py-4 rounded-2xl border border-black text-[16px] outline-none" />
              <select value={editForm.role} onChange={e => setEditForm({...editForm, role: e.target.value })} className="w-full px-5 py-4 rounded-2xl border border-black text-[16px] bg-white outline-none">
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div className="shrink-0 bg-white px-5 py-4 pb-[max(16px,env(safe-area-inset-bottom))] border-t border-gray-100 flex gap-3">
              <button onClick={() => setEditingUser(null)} className="flex-1 py-4 rounded-2xl bg-gray-100 font-bold text-[16px] text-gray-900">Cancel</button>
              <button onClick={handleEditUser} disabled={loading} className="flex-1 py-4 rounded-2xl bg-black text-white font-bold text-[16px] disabled:opacity-50">{loading ? "Saving..." : "Save Changes"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== USER DETAILS MODAL ===== */}
      {detailsUser && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center">
          <div className="bg-white w-full max-w-md rounded-t-[32px] sm:rounded-[32px] max-h-[92vh] flex flex-col shadow-2xl overflow-hidden mt-12 sm:mt-0">
            <div className="shrink-0 bg-white rounded-t-[32px] px-6 pt-4 pb-3 border-b border-gray-100">
              <div className="w-10 h-1.5 bg-gray-200 rounded-full mx-auto mb-4 sm:hidden"></div>
              <div className="flex justify-between items-center">
                <h2 className="text-[20px] font-bold text-gray-900">User Details</h2>
                <button onClick={() => setDetailsUser(null)} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-[14px]">✕</button>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 px-5 py-4 overscroll-contain">
              <div className="bg-[#f5f6f8] rounded-2xl p-4 space-y-3">
                <div>
                  <p className="text-[11px] font-bold tracking-widest text-gray-400">NAME</p>
                  <p className="text-[16px] font-semibold">{detailsUser.name}</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold tracking-widest text-gray-400">PHONE</p>
                  <p className="text-[16px] font-semibold">{detailsUser.phone}</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold tracking-widest text-gray-400">ROLE</p>
                  <p className="text-[16px] font-semibold capitalize">{detailsUser.role || "member"}</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold tracking-widest text-gray-400">ADDED ON</p>
                  <p className="text-[16px] font-semibold">{detailsUser.created_at ? new Date(detailsUser.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}</p>
                </div>
              </div>
              <p className="text-[12px] text-gray-400 px-1 mt-3">This user can log in with WhatsApp OTP and use the Team Ledger bot.</p>
            </div>

            <div className="shrink-0 bg-white px-5 py-4 pb-[max(16px,env(safe-area-inset-bottom))] border-t border-gray-100 flex gap-3">
              <button onClick={() => { setDetailsUser(null); openEdit(detailsUser) }} className="flex-1 py-4 rounded-2xl bg-gray-100 font-bold text-[16px] text-gray-900">Edit</button>
              <button onClick={() => setDetailsUser(null)} className="flex-1 py-4 rounded-2xl bg-black text-white font-bold text-[16px]">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
