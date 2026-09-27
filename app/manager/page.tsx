"use client"
import { useState } from "react"

export default function ManagerPage() {
  const [search, setSearch] = useState("")
  return (
    <div className="min-h-screen bg-[#f5f6f8] p-4 max-w-md mx-auto">
      <div className="bg-white rounded-[20px] p-5 shadow-sm border border-gray-100 flex justify-between items-center mb-5">
        <div>
          <h1 className="text-[20px] font-bold text-gray-900">🏠 Team Ledger</h1>
          <p className="text-[14px] text-gray-600 font-medium mt-1">Prakash • manager</p>
        </div>
        <div className="flex gap-2 items-center">
          <span className="px-3 py-2 rounded-xl bg-black text-white text-[13px] font-semibold">👥 Manager</span>
          <button className="px-4 py-2 rounded-xl bg-gray-100 text-gray-700 text-[13px] font-bold border border-gray-200">Logout</button>
        </div>
      </div>

      <div className="mb-5">
        <input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Search name or phone..." className="w-full px-5 py-4 rounded-2xl border border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 text-[16px] font-medium focus:outline-none focus:ring-2 focus:ring-black shadow-sm" />
      </div>

      <button className="w-full py-4 rounded-2xl bg-black text-white font-bold text-[16px] shadow-sm">+ Add New Tenant</button>
    </div>
  )
}
