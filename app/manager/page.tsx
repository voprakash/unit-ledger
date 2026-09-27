"use client"
import { useState, useEffect } from "react"
import { createClient } from "@supabase/supabase-js"

export const dynamic = 'force-dynamic'

const getSupabase = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_KEY! ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE!

  return createClient(url, key as string)
}

export default function ManagerPage() {
  const [search, setSearch] = useState("")
  const [tenants, setTenants] = useState<any[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [showTrans, setShowTrans] = useState<any>(null)

  const [form, setForm] = useState({
    full_name: "", phone: "", id_number: "", address: "",
    office_name: "", office_address: "",
    room_number: "", rent_amount: "", status: "active"
  })
  const [transForm, setTransForm] = useState({
    amount: "", type: "rent", description: "", date: new Date().toISOString().split('T')[0]
  })

  useEffect(() => { fetchTenants() }, [])

  const fetchTenants = async () => {
    const { data } = await getSupabase().from("tenants").select("*").order("created_at", { ascending: false })
    if(data) setTenants(data)
  }

  const addTenant = async () => {
    if(!form.full_name ||!form.phone) return alert("Name & Phone required")
    const { error } = await getSupabase().from("tenants").insert([{
      full_name: form.full_name,
      phone: form.phone.replace(/\s/g,""),
      id_number: form.id_number,
      address: form.address,
      office_name: form.office_name,
      office_address: form.office_address,
      room_number: form.room_number,
      rent_amount: Number(form.rent_amount) || 0,
      status: form.status,
      created_by: "manager"
    }])
    if(error) alert(error.message)
    else {
      setShowAdd(false)
      setForm({ full_name: "", phone: "", id_number: "", address: "", office_name: "", office_address: "", room_number: "", rent_amount: "", status: "active" })
      fetchTenants()
    }
  }

  const addTransaction = async () => {
    if(!transForm.amount) return alert("Amount required")
    const { error } = await getSupabase().from("transactions").insert([{
      tenant_id: showTrans.id,
      amount: Number(transForm.amount),
      type: transForm.type,
      description: transForm.description,
      date: transForm.date,
      created_by: "manager"
    }])
    if(error) alert(error.message)
    else {
      setShowTrans(null)
      setTransForm({ amount: "", type: "rent", description: "", date: new Date().toISOString().split('T')[0] })
      alert("Transaction Added!")
    }
  }

  const handleLogout = async () => {
    try { await getSupabase().auth.signOut() } catch {}
    localStorage.clear()
    sessionStorage.clear()
    document.cookie.split(";").forEach((c) => {
      document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });
    window.location.replace("/")
  }

  const filtered = tenants.filter(t =>
    t.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    t.phone?.includes(search) ||
    t.room_number?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-[#f5f6f8] p-4 max-w-md mx-auto pb-20">
      <div className="bg-white rounded-[20px] p-5 shadow-sm border border-gray-100 flex justify-between items-center mb-5">
        <div>
          <h1 className="text-[20px] font-bold text-[#111827]">🏠 Team Ledger</h1>
          <p className="text-[14px] text-[#6b7280] font-medium mt-1">Prakash • manager</p>
        </div>
        <div className="flex gap-2">
          <span className="px-3 py-2 rounded-xl bg-black text-white text-[13px] font-semibold">👥 Manager</span>
          <button onClick={handleLogout} className="px-4 py-2 rounded-xl bg-gray-100 text-[#374151] text-[13px] font-bold border">Logout</button>
        </div>
      </div>

      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, phone, room..." className="w-full px-5 py-4 rounded-2xl border border-gray-200 bg-white text-[#111827] text-[16px] font-medium mb-5 focus:outline-none focus:ring-2 focus:ring-black" />
      <button onClick={()=>setShowAdd(true)} className="w-full py-4 rounded-2xl bg-black text-white font-bold text-[16px] mb-6">+ Add New Tenant</button>

      <div className="space-y-3">
        {filtered.map(t => (
          <div key={t.id} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
            <div className="flex justify-between items-start">
              <div>
                <p className="font-bold text-[#111827]">{t.full_name} <span className={`ml-2 text-[11px] px-2 py-1 rounded-full ${t.status==='active'?'bg-green-100 text-green-700':'bg-gray-100 text-gray-600'}`}>{t.status}</span></p>
                <p className="text-[13px] text-[#6b7280]">{t.phone} • Room {t.room_number || "-"}</p>
                <p className="text-[13px] text-[#111827] font-semibold">₹{t.rent_amount} / month</p>
              </div>
              <button onClick={()=>setShowTrans(t)} className="px-4 py-2 rounded-xl bg-[#f3f4f6] text-[#111827] font-bold text-sm">+ Trans</button>
            </div>
          </div>
        ))}
      </div>

      {showAdd && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-t-[28px] sm:rounded-[28px] w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="text-[18px] font-bold text-[#111827] mb-5">Add New Tenant</h2>
            <p className="text-[12px] font-bold text-[#6b7280] mb-2">BASIC</p>
            <input value={form.full_name} onChange={e=>setForm({...form, full_name:e.target.value})} placeholder="Full Name *" className="w-full px-5 py-4 rounded-2xl border bg-white text-[#111827] mb-3" />
            <input value={form.phone} onChange={e=>setForm({...form, phone:e.target.value})} placeholder="Phone *" className="w-full px-5 py-4 rounded-2xl border bg-white text-[#111827] mb-3" />
            <div className="grid grid-cols-2 gap-3">
              <input value={form.room_number} onChange={e=>setForm({...form, room_number:e.target.value})} placeholder="Room No" className="w-full px-5 py-4 rounded-2xl border bg-white text-[#111827] mb-3" />
              <input value={form.rent_amount} onChange={e=>setForm({...form, rent_amount:e.target.value})} placeholder="Rent Amount" type="number" className="w-full px-5 py-4 rounded-2xl border bg-white text-[#111827] mb-3" />
            </div>
            <select value={form.status} onChange={e=>setForm({...form, status:e.target.value})} className="w-full px-5 py-4 rounded-2xl border bg-white text-[#111827] mb-3">
              <option value="active">Active</option>
              <option value="vacated">Vacated</option>
              <option value="notice">On Notice</option>
            </select>
            <p className="text-[12px] font-bold text-[#6b7280] mb-2 mt-2">OTHER DETAILS</p>
            <input value={form.id_number} onChange={e=>setForm({...form, id_number:e.target.value})} placeholder="ID Number" className="w-full px-5 py-4 rounded-2xl border bg-white text-[#111827] mb-3" />
            <input value={form.address} onChange={e=>setForm({...form, address:e.target.value})} placeholder="Address" className="w-full px-5 py-4 rounded-2xl border bg-white text-[#111827] mb-3" />
            <input value={form.office_name} onChange={e=>setForm({...form, office_name:e.target.value})} placeholder="Office Name" className="w-full px-5 py-4 rounded-2xl border bg-white text-[#111827] mb-3" />
            <input value={form.office_address} onChange={e=>setForm({...form, office_address:e.target.value})} placeholder="Office Address" className="w-full px-5 py-4 rounded-2xl border bg-white text-[#111827] mb-5" />
            <div className="flex gap-3">
              <button onClick={()=>setShowAdd(false)} className="flex-1 py-4 rounded-2xl bg-gray-100 text-[#111827] font-bold">Cancel</button>
              <button onClick={addTenant} className="flex-1 py-4 rounded-2xl bg-black text-white font-bold">Save Tenant</button>
            </div>
          </div>
        </div>
      )}

      {showTrans && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-t-[28px] sm:rounded-[28px] w-full max-w-md p-6">
            <h2 className="text-[18px] font-bold text-[#111827]">Add Transaction</h2>
            <p className="text-[#6b7280] text-sm mb-5">{showTrans.full_name} • Room {showTrans.room_number}</p>
            <input value={transForm.amount} onChange={e=>setTransForm({...transForm, amount:e.target.value})} placeholder="Amount ₹" type="number" className="w-full px-5 py-4 rounded-2xl border bg-white text-[#111827] mb-3" />
            <select value={transForm.type} onChange={e=>setTransForm({...transForm, type:e.target.value})} className="w-full px-5 py-4 rounded-2xl border bg-white text-[#111827] mb-3">
              <option value="rent">Rent</option>
              <option value="deposit">Deposit</option>
              <option value="maintenance">Maintenance</option>
              <option value="electricity">Electricity</option>
              <option value="other">Other</option>
            </select>
            <input type="date" value={transForm.date} onChange={e=>setTransForm({...transForm, date:e.target.value})} className="w-full px-5 py-4 rounded-2xl border bg-white text-[#111827] mb-3" />
            <input value={transForm.description} onChange={e=>setTransForm({...transForm, description:e.target.value})} placeholder="Description" className="w-full px-5 py-4 rounded-2xl border bg-white text-[#111827] mb-5" />
            <div className="flex gap-3">
              <button onClick={()=>setShowTrans(null)} className="flex-1 py-4 rounded-2xl bg-gray-100 text-[#111827] font-bold">Cancel</button>
              <button onClick={addTransaction} className="flex-1 py-4 rounded-2xl bg-black text-white font-bold">Add Payment</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
