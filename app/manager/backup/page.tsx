"use client"
import { useEffect, useState } from "react"

type Summary = Record<string, { inFile: number; alreadyHave: number; toAdd: number }>

export default function BackupPage() {
  const [admin, setAdmin] = useState<boolean | null>(null)
  const [driveOn, setDriveOn] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState("")
  const [plan, setPlan] = useState<{ summary: Summary; exported_at: string } | null>(null)
  const [bundle, setBundle] = useState<any>(null)

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((me) => {
        const ok = me && String(me.role || "").toLowerCase() === "admin"
        setAdmin(ok)
        if (ok) {
          fetch("/api/admin/backup/status")
            .then((r) => r.json())
            .then((s) => setDriveOn(!!s.driveConfigured))
            .catch(() => setDriveOn(false))
        }
      })
      .catch(() => setAdmin(false))
  }, [])

  async function download() {
    setBusy(true); setMsg("")
    try {
      const r = await fetch("/api/admin/backup")
      if (!r.ok) throw new Error("download failed")
      const blob = await r.blob()
      const a = document.createElement("a")
      a.href = URL.createObjectURL(blob)
      a.download = `ledger-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(a.href)
      setMsg("Backup downloaded. Keep a copy somewhere safe (e.g. Google Drive).")
    } catch {
      setMsg("Download failed. Try again.")
    }
    setBusy(false)
  }

  async function onFile(f: File) {
    setBusy(true); setMsg(""); setPlan(null); setBundle(null)
    try {
      const parsed = JSON.parse(await f.text())
      const r = await fetch("/api/admin/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bundle: parsed, dryRun: true }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || "invalid file")
      setBundle(parsed)
      setPlan({ summary: j.summary, exported_at: j.exported_at })
    } catch (e: any) {
      setMsg(e.message || "Could not read that file.")
    }
    setBusy(false)
  }

  async function confirmRestore() {
    if (!bundle) return
    setBusy(true); setMsg("")
    try {
      const r = await fetch("/api/admin/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bundle, dryRun: false }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || "restore failed")
      setMsg(`Restore complete. Users: ${j.written.allowed_users}, tenants: ${j.written.tenants}, transactions: ${j.written.transactions}.`)
      setPlan(null); setBundle(null)
    } catch (e: any) {
      setMsg(e.message || "Restore failed.")
    }
    setBusy(false)
  }

  if (admin === null) return <div className="p-6 text-center text-gray-500">Loading…</div>
  if (!admin) return <div className="p-6 text-center text-gray-500">Not authorized.</div>

  const labels: Record<string, string> = { allowed_users: "Users", tenants: "Tenants", transactions: "Transactions" }

  return (
    <div className="min-h-screen bg-[#f5f6f8]">
      <div className="sticky top-0 z-40 bg-white border-b border-gray-100">
        <div className="max-w-md mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="font-bold text-[18px]">💾 Backup</h1>
          <button onClick={() => window.location.href = "/manager"} className="px-4 py-2 bg-gray-100 rounded-full text-[13px] font-bold">← Manager</button>
        </div>
      </div>
      <div className="max-w-md mx-auto px-4 py-4 space-y-4">
        {msg && <div className="bg-white border border-gray-200 rounded-xl p-3 text-[13px]">{msg}</div>}

        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="font-bold text-[15px] mb-1">Automatic weekly backup</div>
          <div className="text-[13px] text-gray-600 mb-2">
            Every Sunday ~2:00 AM UTC, a full backup is uploaded to your Google Drive folder{" "}
            <b>Team Ledger Backups</b>. The newest 8 copies are kept.
          </div>
          <div className="text-[13px]">
            {driveOn === null ? "Checking…" : driveOn
              ? <span className="text-green-700 font-bold">● Google Drive connected — auto-backups active</span>
              : <span className="text-amber-700 font-bold">● Google Drive not connected — auto-backups paused until setup is done</span>}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="font-bold text-[15px] mb-1">Manual backup</div>
          <div className="text-[13px] text-gray-600 mb-3">Downloads everything (users, tenants, transactions) as one file.</div>
          <button disabled={busy} onClick={download} className="w-full py-3 bg-black text-white rounded-xl font-bold text-[14px] disabled:opacity-50">
            ⬇ Download backup now
          </button>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="font-bold text-[15px] mb-1">Restore from backup</div>
          <div className="text-[13px] text-gray-600 mb-3">
            Upload a backup file. It adds missing rows and updates changed ones — it never deletes anything, so a wrong file can't wipe your data.
          </div>
          <label className="block w-full py-3 bg-gray-100 rounded-xl font-bold text-[14px] text-center cursor-pointer">
            📂 Choose backup file
            <input type="file" accept="application/json,.json" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = "" }} />
          </label>

          {plan && (
            <div className="mt-3 border border-gray-200 rounded-xl p-3">
              <div className="text-[12px] text-gray-500 mb-2">Backup from {new Date(plan.exported_at).toLocaleString()}</div>
              {Object.keys(plan.summary).map((t) => (
                <div key={t} className="flex justify-between text-[13px] py-1 border-b border-gray-100 last:border-0">
                  <span className="font-bold">{labels[t] || t}</span>
                  <span>{plan.summary[t].toAdd} new · {plan.summary[t].alreadyHave} already here</span>
                </div>
              ))}
              <button disabled={busy} onClick={confirmRestore} className="w-full mt-3 py-3 bg-black text-white rounded-xl font-bold text-[14px] disabled:opacity-50">
                ✓ Confirm restore
              </button>
              <button disabled={busy} onClick={() => { setPlan(null); setBundle(null) }} className="w-full mt-2 py-2 text-[13px] text-gray-500">
                Cancel
              </button>
            </div>
          )}
        </div>

        <div className="text-[12px] text-gray-400 px-1">
          Backups contain tenant details (names, phones, Aadhaar). Keep the Drive folder private and never share backup files publicly.
        </div>
      </div>
    </div>
  )
}
