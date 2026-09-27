"use client"
import { useState, useEffect, useCallback } from "react"

const inr = (n: number) => "₹" + (Number(n) || 0).toLocaleString("en-IN")
const nowMonth = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}
const monthName = (ym: string) => {
  const [y, m] = ym.split("-").map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" })
}
const fmtDate = (d: string) =>
  d ? new Date(d + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—"

type Row = {
  tenantId: string
  name: string
  room: string
  tenantPhone: string
  expected: number
  expectedInferred: boolean
  paid: number
  balance: number
  status: "paid" | "partial" | "due"
  lastPaid: string
  grace: boolean
  managerPhone: string
}

type Summary = {
  label: string
  totalOutstanding: number
  dueCount: number
  partialCount: number
  paidCount: number
  rows: Row[]
}

const statusPill: Record<Row["status"], string> = {
  due: "bg-red-100 text-red-700",
  partial: "bg-amber-100 text-amber-700",
  paid: "bg-green-100 text-green-700",
}

export default function RentDueTab() {
  const [month, setMonth] = useState(nowMonth())
  const [data, setData] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)
  const [showPaid, setShowPaid] = useState(false)
  const [working, setWorking] = useState(false)
  const [preview, setPreview] = useState<any | null>(null)
  const [results, setResults] = useState<any | null>(null)
  const [error, setError] = useState("")

  const load = useCallback(async (ym: string) => {
    setLoading(true)
    setError("")
    setPreview(null)
    setResults(null)
    try {
      const res = await fetch(`/api/reports/rent-due?month=${ym}`, { signal: AbortSignal.timeout(30000) })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || `Server error (${res.status})`)
      setData(j)
    } catch (e: any) {
      setError(e?.message || "Could not load rent dues")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(month) }, [month, load])

  const startSend = async () => {
    setWorking(true)
    setError("")
    try {
      const res = await fetch("/api/admin/send-rent-reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, dry_run: true }),
        signal: AbortSignal.timeout(60000),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || `Server error (${res.status})`)
      setPreview(j)
    } catch (e: any) {
      setError(e?.message || "Preview failed")
    } finally {
      setWorking(false)
    }
  }

  const confirmSend = async () => {
    setWorking(true)
    setError("")
    try {
      const res = await fetch("/api/admin/send-rent-reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month }),
        signal: AbortSignal.timeout(90000),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || `Server error (${res.status})`)
      setResults(j)
      setPreview(null)
    } catch (e: any) {
      setError(e?.message || "Send failed")
    } finally {
      setWorking(false)
    }
  }

  const unpaid = (data?.rows || []).filter((r) => r.status !== "paid")
  const paidRows = (data?.rows || []).filter((r) => r.status === "paid")

  return (
    <div>
      {/* Month picker */}
      <div className="bg-white rounded-[20px] p-4 border mb-4 print:hidden">
        <p className="text-[11px] font-bold tracking-widest text-gray-500 mb-1 ml-1">MONTH</p>
        <input
          type="month"
          value={month}
          max={nowMonth()}
          onChange={(e) => e.target.value && setMonth(e.target.value)}
          className="w-full px-4 py-3 rounded-2xl border border-gray-200 bg-white text-[15px] outline-none"
        />
        <p className="text-[12px] text-gray-500 mt-2 px-1">
          Tenants who moved in less than 10 days ago get a grace badge and are skipped by reminders.
        </p>
      </div>

      {loading ? (
        <p className="text-center text-gray-400 py-10">Loading rent dues...</p>
      ) : error && !data ? (
        <p className="text-center text-red-500 py-10 text-[14px]">{error}</p>
      ) : data ? (
        <>
          {/* Summary cards */}
          <div className="bg-white rounded-[20px] p-5 border mb-4">
            <p className="text-[11px] font-bold tracking-widest text-gray-400">RENT DUE — {data.label.toUpperCase()}</p>
            <div className="flex gap-3 mt-4">
              <div className="flex-1 bg-[#f5f6f8] rounded-2xl p-3">
                <p className="text-[11px] text-gray-500 font-bold">OUTSTANDING</p>
                <p className="text-[22px] font-bold">{inr(data.totalOutstanding)}</p>
              </div>
              <div className="flex-1 bg-[#f5f6f8] rounded-2xl p-3">
                <p className="text-[11px] text-gray-500 font-bold">DUE</p>
                <p className="text-[22px] font-bold">{data.dueCount}</p>
              </div>
              <div className="flex-1 bg-[#f5f6f8] rounded-2xl p-3">
                <p className="text-[11px] text-gray-500 font-bold">PARTIAL</p>
                <p className="text-[22px] font-bold">{data.partialCount}</p>
              </div>
            </div>
          </div>

          {/* Due / partial list */}
          <div className="bg-white rounded-[20px] p-4 border mb-4">
            <p className="text-[11px] font-bold tracking-widest text-gray-400 mb-3 px-1">
              UNPAID ({unpaid.length})
            </p>
            {unpaid.length === 0 ? (
              <p className="text-center text-gray-400 text-[14px] py-6">🎉 Everyone has paid rent for {data.label}!</p>
            ) : (
              <div className="space-y-2">
                {unpaid.map((r) => (
                  <div key={r.tenantId} className="bg-[#f5f6f8] rounded-2xl p-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold text-[15px]">
                          {r.name}
                          {r.room ? <span className="text-gray-500 font-normal text-[13px]"> • {r.room}</span> : ""}
                        </p>
                        <p className="text-[12px] text-gray-500">
                          Expected {inr(r.expected)}{r.expectedInferred ? " *" : ""} • Paid {inr(r.paid)}
                          {r.lastPaid ? ` • last ${fmtDate(r.lastPaid)}` : ""}
                          {r.tenantPhone ? ` • 📞 ${r.tenantPhone}` : ""}
                        </p>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <p className="font-bold text-[16px]">{inr(r.balance)}</p>
                        <span className={`text-[11px] px-2 py-0.5 rounded-full font-semibold capitalize ${statusPill[r.status]}`}>
                          {r.status}
                        </span>
                      </div>
                    </div>
                    {r.grace && (
                      <p className="mt-1.5 inline-block text-[11px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold">
                        ⏳ grace — moved in recently, skipped by reminders
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
            {unpaid.some((r) => r.expectedInferred) && (
              <p className="text-[11px] text-gray-400 mt-2 px-1">* Expected rent estimated from last payment — tenant has no rent amount saved.</p>
            )}
          </div>

          {/* Paid (collapsed) */}
          {paidRows.length > 0 && (
            <div className="bg-white rounded-[20px] p-4 border mb-4">
              <button onClick={() => setShowPaid(!showPaid)} className="w-full text-left flex justify-between items-center px-1">
                <p className="text-[11px] font-bold tracking-widest text-gray-400">PAID ({paidRows.length})</p>
                <span className="text-gray-400 text-[13px]">{showPaid ? "▲" : "▼"}</span>
              </button>
              {showPaid && (
                <div className="space-y-2 mt-3">
                  {paidRows.map((r) => (
                    <div key={r.tenantId} className="flex justify-between items-center bg-[#f5f6f8] rounded-2xl px-3 py-2">
                      <p className="text-[14px] font-semibold">{r.name}{r.room ? <span className="text-gray-500 font-normal"> • {r.room}</span> : ""}</p>
                      <p className="text-[14px] font-bold text-green-700">{inr(r.paid)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Send reminders */}
          <div className="print:hidden">
            {!preview && !results && (
              <button
                onClick={startSend}
                disabled={working || unpaid.filter((r) => !r.grace).length === 0}
                className="w-full py-4 rounded-2xl bg-green-600 text-white font-bold text-[16px] mb-8 disabled:opacity-50"
              >
                {working ? "Checking..." : "📲 Send WhatsApp reminders"}
              </button>
            )}

            {preview && (
              <div className="bg-white rounded-[20px] p-5 border mb-8">
                <p className="font-bold text-[16px] mb-1">Confirm reminders — {preview.label}</p>
                <p className="text-[14px] text-gray-600 mb-3">
                  This will WhatsApp <b>{preview.results.filter((r: any) => !r.skipped).length} manager(s)</b> about{" "}
                  <b>{preview.results.filter((r: any) => !r.skipped).reduce((s: number, r: any) => s + r.tenantCount, 0)} tenant(s)</b>.
                  {preview.results.some((r: any) => r.skipped) && " Some recipients will be skipped (see below)."}
                </p>
                <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
                  {preview.results.map((r: any, i: number) => (
                    <div key={i} className="bg-[#f5f6f8] rounded-2xl p-3 text-[13px]">
                      <p className="font-bold">{r.managerName} <span className="font-normal text-gray-500">• {r.tenantCount} tenant(s) • {inr(r.outstanding)}</span></p>
                      {r.preview && <p className="text-gray-600 mt-1 whitespace-pre-wrap text-[12px]">{r.preview.slice(0, 220)}{r.preview.length > 220 ? "…" : ""}</p>}
                      {r.skipped && <p className="text-amber-700 mt-1">⏭️ {r.skipReason}</p>}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setPreview(null)} disabled={working} className="flex-1 py-3 rounded-2xl bg-gray-100 font-bold text-[15px]">Cancel</button>
                  <button onClick={confirmSend} disabled={working} className="flex-1 py-3 rounded-2xl bg-green-600 text-white font-bold text-[15px] disabled:opacity-50">
                    {working ? "Sending..." : "Confirm & send"}
                  </button>
                </div>
              </div>
            )}

            {results && (
              <div className="bg-white rounded-[20px] p-5 border mb-8">
                <p className="font-bold text-[16px] mb-3">Reminders — {results.label}</p>
                <div className="space-y-2 mb-4">
                  {results.results.map((r: any, i: number) => (
                    <div key={i} className="bg-[#f5f6f8] rounded-2xl p-3 text-[13px] flex justify-between items-center">
                      <div>
                        <p className="font-bold">{r.managerName}</p>
                        <p className="text-gray-500">{r.tenantCount} tenant(s) • {inr(r.outstanding)}</p>
                        {r.error && <p className="text-red-600">⚠️ {r.error}</p>}
                        {r.skipped && <p className="text-amber-700">⏭️ {r.skipReason}</p>}
                      </div>
                      <span className="text-[18px]">{r.sent ? "✅" : r.skipped ? "⏭️" : "❌"}</span>
                    </div>
                  ))}
                </div>
                <button onClick={() => setResults(null)} className="w-full py-3 rounded-2xl bg-gray-100 font-bold text-[15px]">Done</button>
              </div>
            )}
          </div>
          {error && <p className="text-center text-red-500 text-[13px] mb-8">{error}</p>}
        </>
      ) : null}
    </div>
  )
}
