"use client"
import { useState, useEffect, useMemo } from "react"
import RentDueTab from "./RentDueTab"

type Tenant = any
type Txn = any

const inr = (n: number) => "₹" + (Number(n) || 0).toLocaleString("en-IN")
const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"

// Local (non-UTC) YYYY-MM-DD
const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

// Full calendar month `offset` months from the current one (0 = this month).
// For the current month the range ends today; otherwise it ends on the month's last day.
function monthRange(offset: number): [string, string] {
  const now = new Date()
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  const last = offset === 0 ? now : new Date(now.getFullYear(), now.getMonth() + offset + 1, 0)
  return [isoDay(first), isoDay(last)]
}

const PRESETS: { label: string; get: () => [string, string] }[] = [
  { label: "This Month", get: () => monthRange(0) },
  { label: "Last Month", get: () => monthRange(-1) },
  { label: "Last 3 Months", get: () => [monthRange(-2)[0], isoDay(new Date())] },
]

export default function ReportsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [txns, setTxns] = useState<Txn[]>([])
  const [loading, setLoading] = useState(true)
  const [tenantFilter, setTenantFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [fromDate, setFromDate] = useState(() => monthRange(0)[0])
  const [toDate, setToDate] = useState(() => isoDay(new Date()))
  const [isAdminUI, setIsAdminUI] = useState(false)
  const [sending, setSending] = useState(false)
  const [tab, setTab] = useState<"txns" | "rentdue">("txns")

  const resetDates = () => {
    const [f, t] = monthRange(0)
    setFromDate(f)
    setToDate(t)
  }

  // Highlight the preset pill when the chosen dates exactly match it
  const activePreset = useMemo(() => {
    for (const p of PRESETS) {
      const [f, t] = p.get()
      if (f === fromDate && t === toDate) return p.label
    }
    return null
  }, [fromDate, toDate])

  useEffect(() => {
    const s = localStorage.getItem("team_session")
    if (!s) { window.location.href = "/"; return }
    Promise.all([
      fetch("/api/tenants").then(r => r.json()),
      fetch("/api/transactions").then(r => r.json()),
    ]).then(([t, x]) => {
      setTenants(Array.isArray(t) ? t : [])
      setTxns(Array.isArray(x) ? x : [])
      setLoading(false)
    }).catch(() => setLoading(false))
    fetch("/api/auth/me").then(r => r.json()).then(me => {
      if (me && String(me.role || "").toLowerCase() === "admin") setIsAdminUI(true)
    }).catch(() => {})
  }, [])

  const sendWhatsAppReport = async () => {
    setSending(true)
    try {
      const res = await fetch("/api/reports/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(30000),
      })
      const data = await res.json().catch(() => ({} as any))
      if (!res.ok) throw new Error(data.error || `Server error (${res.status})`)
      alert(`Monthly report for ${data.month} sent to your WhatsApp ✓`)
    } catch (e: any) {
      const msg = e?.name === "TimeoutError"
        ? "Request timed out — the server took too long. Please try again."
        : e?.message === "Failed to fetch"
          ? "Couldn't reach the server. Check your internet connection and try again."
          : (e?.message || "Send failed")
      alert(msg)
    } finally {
      setSending(false)
    }
  }

  const tenantById = useMemo(() => {
    const m: Record<string, Tenant> = {}
    tenants.forEach(t => { m[t.id] = t })
    return m
  }, [tenants])

  const filtered = useMemo(() => {
    return txns.filter(x => {
      if (tenantFilter !== "all" && String(x.tenant_id) !== tenantFilter) return false
      if (typeFilter !== "all" && x.type !== typeFilter) return false
      const d = (x.date || x.created_at || "").slice(0, 10)
      if (fromDate && d < fromDate) return false
      if (toDate && d > toDate) return false
      return true
    })
  }, [txns, tenantFilter, typeFilter, fromDate, toDate])

  const total = filtered.reduce((s, x) => s + (Number(x.amount) || 0), 0)
  const byType = useMemo(() => {
    const m: Record<string, number> = {}
    filtered.forEach(x => { m[x.type || "other"] = (m[x.type || "other"] || 0) + (Number(x.amount) || 0) })
    return m
  }, [filtered])

  const perTenant = useMemo(() => {
    const m: Record<string, { key: string; name: string; room: string; total: number; count: number; last: string }> = {}
    filtered.forEach(x => {
      const t = tenantById[x.tenant_id]
      const key = String(x.tenant_id || x.tenant_name || "?")
      if (!m[key]) m[key] = { key, name: t?.full_name || x.tenant_name || "—", room: t?.room_number || "", total: 0, count: 0, last: "" }
      m[key].total += Number(x.amount) || 0
      m[key].count += 1
      const d = (x.date || x.created_at || "").slice(0, 10)
      if (d && (!m[key].last || d > m[key].last)) m[key].last = d
    })
    return Object.values(m).sort((a, b) => b.total - a.total)
  }, [filtered, tenantById])

  const handleLogout = async () => {
    try { await fetch("/api/auth/logout", { method: "POST" }) } catch {}
    localStorage.clear()
    window.location.href = "/"
  }

  const selectedTenant = tenantFilter !== "all" ? tenantById[tenantFilter] : null

  return (
    <div className="min-h-screen bg-[#f5f6f8]">
      {/* Top Menu */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-100 print:hidden">
        <div className="max-w-md mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="font-bold text-[18px]">📊 Reports</h1>
          <div className="flex gap-2">
            <button onClick={() => window.location.href = "/manager"} className="px-4 py-2 bg-gray-100 rounded-full text-[13px] font-bold">🏠 Tenants</button>
            <button onClick={handleLogout} className="px-3 py-2 bg-gray-100 rounded-full text-[13px]">Logout</button>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto p-4">
        {/* Report type tabs */}
        <div className="flex gap-2 mb-4 print:hidden">
          <button
            onClick={() => setTab("txns")}
            className={`flex-1 py-3 rounded-2xl text-[15px] font-bold ${tab === "txns" ? "bg-black text-white" : "bg-white border text-gray-700"}`}
          >
            🧾 Transactions
          </button>
          <button
            onClick={() => setTab("rentdue")}
            className={`flex-1 py-3 rounded-2xl text-[15px] font-bold ${tab === "rentdue" ? "bg-black text-white" : "bg-white border text-gray-700"}`}
          >
            🏠 Rent Due
          </button>
        </div>

        {tab === "rentdue" ? <RentDueTab /> : (
        <>
        {/* Filters */}
        <div className="bg-white rounded-[20px] p-4 border mb-4 space-y-3 print:hidden">
          <div>
            <p className="text-[11px] font-bold tracking-widest text-gray-500 mb-1 ml-1">TENANT</p>
            <select value={tenantFilter} onChange={e => setTenantFilter(e.target.value)} className="w-full px-4 py-3 rounded-2xl border border-gray-200 bg-white text-[15px] outline-none">
              <option value="all">All tenants</option>
              {tenants.map(t => <option key={t.id} value={t.id}>{t.full_name}{t.room_number ? ` • Room ${t.room_number}` : ""}</option>)}
            </select>
          </div>
          <div>
            <p className="text-[11px] font-bold tracking-widest text-gray-500 mb-1 ml-1">TYPE</p>
            <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} className="w-full px-4 py-3 rounded-2xl border border-gray-200 bg-white text-[15px] outline-none">
              <option value="all">All types</option>
              <option value="rent">Rent</option>
              <option value="deposit">Deposit</option>
              <option value="maintenance">Maintenance</option>
              <option value="electricity">Electricity</option>
              <option value="water">Water</option>
              <option value="gas">Gas</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div>
            <p className="text-[11px] font-bold tracking-widest text-gray-500 mb-1 ml-1">PERIOD</p>
            <div className="flex gap-2 mb-3">
              {PRESETS.map(p => (
                <button
                  key={p.label}
                  onClick={() => { const [f, t] = p.get(); setFromDate(f); setToDate(t) }}
                  className={`px-4 py-2 rounded-full text-[13px] font-bold ${activePreset === p.label ? "bg-black text-white" : "bg-gray-100 text-gray-700"}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <p className="text-[11px] font-bold tracking-widest text-gray-500 mb-1 ml-1">FROM</p>
                <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-full px-4 py-3 rounded-2xl border border-gray-200 bg-white text-[15px] outline-none" />
              </div>
              <div className="flex-1">
                <p className="text-[11px] font-bold tracking-widest text-gray-500 mb-1 ml-1">TO</p>
                <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-full px-4 py-3 rounded-2xl border border-gray-200 bg-white text-[15px] outline-none" />
              </div>
            </div>
          </div>
          {(tenantFilter !== "all" || typeFilter !== "all" || activePreset !== "This Month") && (
            <button onClick={() => { setTenantFilter("all"); setTypeFilter("all"); resetDates() }} className="text-[13px] text-gray-500 underline">Clear filters</button>
          )}
        </div>

        {loading ? (
          <p className="text-center text-gray-400 py-10">Loading report...</p>
        ) : (
          <>
            {/* Report header */}
            <div className="bg-white rounded-[20px] p-5 border mb-4">
              <p className="text-[11px] font-bold tracking-widest text-gray-400">TRANSACTION REPORT</p>
              <h2 className="text-[20px] font-bold mt-1">{selectedTenant ? selectedTenant.full_name : "All Tenants"}</h2>
              <p className="text-[13px] text-gray-500">
                {selectedTenant && selectedTenant.room_number ? `Room ${selectedTenant.room_number} • ` : ""}
                {fromDate || toDate ? `${fromDate ? fmtDate(fromDate) : "…"} → ${toDate ? fmtDate(toDate) : "…"} • ` : "All time • "}
                {typeFilter === "all" ? "All types" : typeFilter}
              </p>
              <div className="flex gap-3 mt-4">
                <div className="flex-1 bg-[#f5f6f8] rounded-2xl p-3">
                  <p className="text-[11px] text-gray-500 font-bold">TOTAL</p>
                  <p className="text-[22px] font-bold">{inr(total)}</p>
                </div>
                <div className="flex-1 bg-[#f5f6f8] rounded-2xl p-3">
                  <p className="text-[11px] text-gray-500 font-bold">TRANSACTIONS</p>
                  <p className="text-[22px] font-bold">{filtered.length}</p>
                </div>
              </div>
              {Object.keys(byType).length > 1 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {Object.entries(byType).map(([k, v]) => (
                    <span key={k} className="text-[12px] px-3 py-1.5 rounded-full bg-gray-100 font-semibold capitalize">{k}: {inr(v)}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Per-tenant breakdown (only when viewing all) */}
            {tenantFilter === "all" && perTenant.length > 0 && (
              <div className="bg-white rounded-[20px] p-4 border mb-4">
                <p className="text-[11px] font-bold tracking-widest text-gray-400 mb-3 px-1">BY TENANT</p>
                <div className="space-y-2">
                  {perTenant.map((p) => (
                    <button key={p.key} onClick={() => tenantById[p.key] && setTenantFilter(p.key)} className="w-full text-left bg-[#f5f6f8] rounded-2xl p-3 flex justify-between items-center">
                      <div>
                        <p className="font-bold text-[15px]">{p.name}{p.room ? <span className="text-gray-500 font-normal text-[13px]"> • Room {p.room}</span> : ""}</p>
                        <p className="text-[12px] text-gray-500">{p.count} payment{p.count !== 1 ? "s" : ""}{p.last ? ` • last ${fmtDate(p.last)}` : ""}</p>
                      </div>
                      <p className="font-bold text-[16px]">{inr(p.total)}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Transaction list */}
            <div className="bg-white rounded-[20px] p-4 border mb-4">
              <p className="text-[11px] font-bold tracking-widest text-gray-400 mb-3 px-1">TRANSACTIONS</p>
              {filtered.length === 0 ? (
                <p className="text-center text-gray-400 text-[14px] py-6">No transactions match</p>
              ) : (
                <div className="space-y-2">
                  {filtered.map((x) => {
                    const t = tenantById[x.tenant_id]
                    return (
                      <div key={x.id} className="border-b border-gray-100 last:border-0 pb-2.5 last:pb-0">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold text-[15px]">{t?.full_name || x.tenant_name || "—"}</p>
                            <p className="text-[12px] text-gray-500">{fmtDate(x.date || x.created_at)}{x.method ? ` • ${x.method}` : ""}{x.notes ? ` • ${x.notes}` : ""}</p>
                          </div>
                          <div className="text-right shrink-0 ml-2">
                            <p className="font-bold text-[16px]">{inr(Number(x.amount))}</p>
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold capitalize">{x.type || "other"}</span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <button onClick={() => window.print()} className="w-full py-4 rounded-2xl bg-black text-white font-bold text-[16px] mb-3 print:hidden">🖨️ Print / Save PDF</button>
            {isAdminUI && (
              <button onClick={sendWhatsAppReport} disabled={sending} className="w-full py-4 rounded-2xl bg-green-600 text-white font-bold text-[16px] mb-8 disabled:opacity-50 print:hidden">
                {sending ? "Sending..." : "📤 Send Monthly Report on WhatsApp"}
              </button>
            )}
            {!isAdminUI && <div className="mb-8" />}
          </>
        )}
        </>
        )}
      </div>
    </div>
  )
}
