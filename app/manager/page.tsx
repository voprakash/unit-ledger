"use client"
import { useState, useEffect } from "react"

export default function ManagerPage() {
  const [isAuth, setIsAuth] = useState(false)
  const [phone, setPhone] = useState("")
  const [otp, setOtp] = useState("")
  const [step, setStep] = useState(1)
  const [users, setUsers] = useState<any[]>([])
  const [newPhone, setNewPhone] = useState("")
  const [newName, setNewName] = useState("")
  const [newRole, setNewRole] = useState("staff")

  async function sendOtp() {
    const res = await fetch("/api/auth/send-otp", { method: "POST", body: JSON.stringify({ phone }), headers: { "Content-Type": "application/json" } })
    const d = await res.json()
    if (d.error) alert(d.error); else { alert("OTP sent on WhatsApp"); setStep(2) }
  }

  async function verifyOtp() {
    const res = await fetch("/api/auth/verify-otp", { method: "POST", body: JSON.stringify({ phone, otp }), headers: { "Content-Type": "application/json" } })
    const d = await res.json()
    if (d.error) alert(d.error)
    else {
      if (d.user.role !== 'manager') return alert("Only Manager can access this page")
      setIsAuth(true); loadUsers()
    }
  }

  async function loadUsers() {
    const res = await fetch("/api/manager/users")
    const d = await res.json()
    setUsers(d.users || [])
  }

  async function addUser() {
    await fetch("/api/manager/users", { method: "POST", body: JSON.stringify({ phone: newPhone, name: newName, role: newRole }), headers: { "Content-Type": "application/json" } })
    setNewPhone(""); setNewName(""); loadUsers()
  }

  async function removeUser(p: string) {
    if (!confirm("Remove?")) return
    await fetch(`/api/manager/users?phone=${p}`, { method: "DELETE" })
    loadUsers()
  }

  if (!isAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
        <div className="bg-white p-6 rounded-2xl shadow w-full max-w-sm space-y-4">
          <h1 className="font-bold text-xl">Manager Login</h1>
          {step === 1 ? <>
            <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="919876543210" className="w-full border p-3 rounded-lg" />
            <button onClick={sendOtp} className="w-full bg-black text-white p-3 rounded-xl">Send OTP on WhatsApp</button>
          </> : <>
            <input value={otp} onChange={e=>setOtp(e.target.value)} placeholder="Enter 6-digit OTP" className="w-full border p-3 rounded-lg" />
            <button onClick={verifyOtp} className="w-full bg-black text-white p-3 rounded-xl">Verify OTP</button>
          </>}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-lg mx-auto bg-white rounded-2xl shadow p-5 space-y-5">
        <h1 className="text-xl font-bold">👥 Manage Team</h1>
        <div className="space-y-3 border p-3 rounded-xl bg-gray-50">
          <input value={newPhone} onChange={e=>setNewPhone(e.target.value)} placeholder="Phone 9198..." className="w-full border p-3 rounded-lg" />
          <input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Name" className="w-full border p-3 rounded-lg" />
          <select value={newRole} onChange={e=>setNewRole(e.target.value)} className="w-full border p-3 rounded-lg">
            <option value="staff">Staff</option><option value="manager">Manager</option>
          </select>
          <button onClick={addUser} className="w-full bg-black text-white p-3 rounded-xl">+ Add User</button>
        </div>
        {users.map(u=>(
          <div key={u.phone} className="flex justify-between items-center border p-3 rounded-lg">
            <div><div className="font-bold">{u.name}</div><div className="text-xs">{u.phone} • {u.role}</div></div>
            <button onClick={()=>removeUser(u.phone)} className="bg-red-500 text-white px-3 py-1 rounded">Remove</button>
          </div>
        ))}
      </div>
    </div>
  )
}
