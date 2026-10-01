// Rent-due report engine: who owes rent for a calendar month + WhatsApp reminders.
// Shared by the rent-due report API, the manual send endpoint, and the monthly cron.
// Column names mirror the live schema (tenants: full_name, room_number, rent_amount,
// phone, start_date, created_at, created_by, status; transactions: tenant_id,
// tenant_name, type, amount, date, created_at, deleted_at).

import { sendWhatsAppText, sendWhatsAppTemplate, toWhatsAppNumber } from "./whatsapp"

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

// Tenant statuses that mean "no longer renting" — excluded from dues.
const INACTIVE_STATUS = new Set([
  "inactive", "moved_out", "movedout", "vacated", "left", "closed", "deleted",
])

export type RentDueRow = {
  tenantId: string
  name: string
  room: string
  tenantPhone: string
  expected: number
  expectedInferred: boolean // true when rent_amount was empty and we used the last rent txn
  paid: number
  balance: number
  status: "paid" | "partial" | "due"
  lastPaid: string // YYYY-MM-DD or ""
  grace: boolean // started less than 10 days ago — skipped by reminders
  managerPhone: string // national digits from created_by
}

export type RentDueSummary = {
  year: number
  month: number // 1-12
  label: string // e.g. "September 2026"
  totalOutstanding: number
  dueCount: number
  partialCount: number
  paidCount: number
  rows: RentDueRow[]
}

type Db = { from: (t: string) => any }

export function monthLabel(year: number, month: number): string {
  return `${MONTH_NAMES[month - 1]} ${year}`
}

const inr = (n: number) => "₹" + Math.round(Number(n) || 0).toLocaleString("en-IN")

export async function computeRentDue(
  db: Db,
  year: number,
  month: number,
  opts: { scopePhone?: string; asOf?: Date } = {}
): Promise<RentDueSummary> {
  const asOf = opts.asOf || new Date()
  const mm = String(month).padStart(2, "0")
  const start = `${year}-${mm}-01`
  const endDay = new Date(year, month, 0).getDate()
  const end = `${year}-${mm}-${String(endDay).padStart(2, "0")}`

  let tq = db
    .from("tenants")
    .select("id,full_name,room_number,rent_amount,phone,start_date,created_at,created_by,status")
    .limit(2000)
  if (opts.scopePhone) tq = tq.eq("created_by", opts.scopePhone)
  const { data: tenants } = await tq
  const list = (tenants || []).filter(
    (t: any) => !INACTIVE_STATUS.has(String(t.status || "active").toLowerCase())
  )

  // Rent transactions: pad the range by a day on each side, then filter precisely
  // in JS (same pattern as the monthly report engine).
  const txnQuery = (cols: string) =>
    db.from("transactions").select(cols).gte("date", `${year}-${mm}-00`).lte("date", `${year}-${mm}-32`).limit(5000)
  let txnRes = await txnQuery("tenant_id,tenant_name,type,amount,date,created_at,deleted_at")
  if (txnRes.error && /deleted_at/i.test(String(txnRes.error.message || ""))) {
    // Soft-delete migration not run yet — fall back to the old column set
    txnRes = await txnQuery("tenant_id,tenant_name,type,amount,date,created_at")
  }
  const txns = txnRes.data || []

  const tenantKey = (x: any) =>
    x.tenant_id ? String(x.tenant_id) : `name:${String(x.tenant_name || "").toLowerCase()}`

  const inMonth: Record<string, { paid: number; lastPaid: string }> = {}
  const latestRent: Record<string, { date: string; amount: number }> = {}
  for (const x of txns) {
    if (x.deleted_at) continue // skip soft-deleted
    if (String(x.type || "").toLowerCase() !== "rent") continue
    const d = String(x.date || x.created_at || "").slice(0, 10)
    if (!d) continue
    const key = tenantKey(x)
    const amt = Number(x.amount) || 0
    if (d >= start && d <= end) {
      const e = inMonth[key] || (inMonth[key] = { paid: 0, lastPaid: "" })
      e.paid += amt
      if (d > e.lastPaid) e.lastPaid = d
    }
    if (d <= end) {
      const cur = latestRent[key]
      if (!cur || d > cur.date) latestRent[key] = { date: d, amount: amt }
    }
  }

  const rows: RentDueRow[] = list.map((t: any) => {
    const idKey = String(t.id)
    const nameKey = `name:${String(t.full_name || "").toLowerCase()}`
    const agg = inMonth[idKey] || inMonth[nameKey] || { paid: 0, lastPaid: "" }
    let expected = Number(t.rent_amount) || 0
    let inferred = false
    if (expected <= 0) {
      const cand = latestRent[idKey] || latestRent[nameKey]
      if (cand && cand.amount > 0) {
        expected = cand.amount
        inferred = true
      }
    }
    const balance = expected - agg.paid
    const status: RentDueRow["status"] = balance <= 0 ? "paid" : agg.paid > 0 ? "partial" : "due"
    const startDate =
      String(t.start_date || "").slice(0, 10) || String(t.created_at || "").slice(0, 10)
    let grace = false
    if (startDate) {
      const days = (asOf.getTime() - new Date(startDate + "T00:00:00").getTime()) / 86400000
      grace = days >= 0 && days < 10
    }
    return {
      tenantId: idKey,
      name: t.full_name || "—",
      room: t.room_number || "",
      tenantPhone: t.phone || "",
      expected,
      expectedInferred: inferred,
      paid: agg.paid,
      balance: Math.max(0, balance),
      status,
      lastPaid: agg.lastPaid,
      grace,
      managerPhone: String(t.created_by || "").replace(/\D/g, "").slice(-10),
    }
  })

  const rank = { due: 0, partial: 1, paid: 2 }
  rows.sort((a, b) => rank[a.status] - rank[b.status] || b.balance - a.balance)

  return {
    year,
    month,
    label: monthLabel(year, month),
    totalOutstanding: rows.reduce((s, r) => s + (r.status === "paid" ? 0 : r.balance), 0),
    dueCount: rows.filter((r) => r.status === "due").length,
    partialCount: rows.filter((r) => r.status === "partial").length,
    paidCount: rows.filter((r) => r.status === "paid").length,
    rows,
  }
}

export function formatRentReminder(o: {
  managerName: string
  label: string
  rows: RentDueRow[]
}): string {
  const n = o.rows.length
  const lines = [
    `🏠 *Rent Due Reminder — ${o.label}*`,
    ``,
    `Hi ${o.managerName}, ${n} tenant${n === 1 ? "" : "s"} still owe${n === 1 ? "s" : ""} rent for ${o.label}:`,
    ``,
  ]
  const shown = o.rows.slice(0, 15)
  for (const r of shown) {
    const who = [r.name, r.room ? `(${r.room})` : ""].filter(Boolean).join(" ")
    lines.push(`• ${who} — Due *${inr(r.balance)}*`)
    const bits = [`Paid ${inr(r.paid)} of ${inr(r.expected)}`]
    if (r.tenantPhone) bits.push(`📞 ${r.tenantPhone}`)
    lines.push(`  ${bits.join(" · ")}`)
  }
  if (o.rows.length > shown.length) lines.push(`…and ${o.rows.length - shown.length} more`)
  lines.push(``, `Please follow up with them. — Team Ledger`)
  return lines.join("\n")
}

export type ReminderResult = {
  managerPhone: string
  managerName: string
  tenantCount: number
  outstanding: number
  sent: boolean
  skipped?: boolean
  skipReason?: string
  error?: string
  preview?: string // present only in dry runs
}

export function formatAdminSummary(label: string, results: ReminderResult[]): string {
  const sent = results.filter((r) => r.sent)
  const failed = results.filter((r) => !r.sent && !r.skipped)
  const skipped = results.filter((r) => r.skipped)
  const tenants = sent.reduce((s, r) => s + r.tenantCount, 0)
  const outstanding = sent.reduce((s, r) => s + r.outstanding, 0)
  const lines = [
    `🔔 *Rent reminders — ${label}*`,
    ``,
    `Sent to ${sent.length} manager${sent.length === 1 ? "" : "s"} · ${tenants} tenant${tenants === 1 ? "" : "s"} · ${inr(outstanding)} outstanding.`,
  ]
  for (const f of failed) {
    lines.push(`⚠️ ${f.managerName}: ${f.error || "failed"}`)
  }
  for (const s of skipped) {
    lines.push(`⏭️ ${s.managerName}: ${s.skipReason || "skipped"}`)
  }
  if (failed.length === 0 && skipped.length === 0) lines.push(`All delivered.`)
  return lines.join("\n")
}

/**
 * Compute dues for a month, group unpaid (non-grace) tenants by manager, and
 * WhatsApp each manager their list. In dry-run mode nothing is sent — the
 * would-be messages come back as `preview` for inspection.
 */
export async function runRentReminders(
  db: Db,
  opts: { year: number; month: number; scopePhone?: string; dryRun?: boolean; asOf?: Date }
): Promise<{
  label: string
  summary: RentDueSummary
  results: ReminderResult[]
  adminSummary: string
}> {
  const summary = await computeRentDue(db, opts.year, opts.month, {
    scopePhone: opts.scopePhone,
    asOf: opts.asOf,
  })
  const actionable = summary.rows.filter(
    (r) => r.status !== "paid" && r.balance > 0 && !r.grace
  )
  const byManager: Record<string, RentDueRow[]> = {}
  for (const r of actionable) {
    const k = r.managerPhone || "unassigned"
    ;(byManager[k] || (byManager[k] = [])).push(r)
  }

  // Resolve manager display names from allowed_users
  const names: Record<string, string> = {}
  const phones = Object.keys(byManager).filter((p) => p !== "unassigned")
  if (phones.length > 0) {
    const { data } = await db.from("allowed_users").select("phone,name").limit(2000)
    for (const u of data || []) {
      const nat = String(u.phone || "").replace(/\D/g, "").slice(-10)
      if (nat && !(nat in names)) names[nat] = u.name || nat
    }
  }

  const results: ReminderResult[] = []
  for (const [mp, rows] of Object.entries(byManager)) {
    const outstanding = rows.reduce((s, r) => s + r.balance, 0)
    if (mp === "unassigned") {
      results.push({
        managerPhone: "",
        managerName: "Unassigned",
        tenantCount: rows.length,
        outstanding,
        sent: false,
        skipped: true,
        skipReason: `${rows.length} tenant(s) have no manager (created_by missing) — not messaged`,
      })
      continue
    }
    const to = toWhatsAppNumber(mp)
    const managerName = names[mp] || mp
    const message = formatRentReminder({ managerName, label: summary.label, rows })
    if (!to) {
      results.push({
        managerPhone: mp,
        managerName,
        tenantCount: rows.length,
        outstanding,
        sent: false,
        skipped: true,
        skipReason: "invalid phone number",
      })
      continue
    }
    if (opts.dryRun) {
      results.push({
        managerPhone: mp,
        managerName,
        tenantCount: rows.length,
        outstanding,
        sent: false,
        skipped: true,
        skipReason: "dry run — nothing sent",
        preview: message,
      })
      continue
    }
    const r = await sendWhatsAppText(to, message)
    results.push({
      managerPhone: mp,
      managerName,
      tenantCount: rows.length,
      outstanding,
      sent: r.sent,
      error: r.error,
    })
  }

  return {
    label: summary.label,
    summary,
    results,
    adminSummary: formatAdminSummary(summary.label, results),
  }
}

// ---------------------------------------------------------------------------
// Tenant reminders (sent on the 5th of each month + manual button).
// Free-form text only works inside the 24-hour customer-service window, so
// tenants get an approved UTILITY template instead. Create it in Meta
// WhatsApp Manager with this exact body:
//   "Hello {{1}}, this is a reminder that your rent of ₹{{2}} for {{3}} is
//    still pending. Please pay at the earliest. Thank you!"
// and update the name below if you choose a different template name.
// ---------------------------------------------------------------------------

export const TENANT_REMINDER_TEMPLATE = "rent_due_reminder"
export const TENANT_REMINDER_LANGUAGE = "en"

export function renderTenantReminder(name: string, amount: string, label: string): string {
  return `Hello ${name}, this is a reminder that your rent of ₹${amount} for ${label} is still pending. Please pay at the earliest. Thank you!`
}

export type TenantReminderResult = {
  tenantId: string
  tenantName: string
  room: string
  tenantPhone: string // as stored on the tenant record
  balance: number
  status: "due" | "partial"
  sent: boolean
  skipped?: boolean
  skipReason?: string
  error?: string
  preview?: string // present only in dry runs
}

export function formatTenantAdminSummary(label: string, results: TenantReminderResult[]): string {
  const sent = results.filter((r) => r.sent)
  const failed = results.filter((r) => !r.sent && !r.skipped)
  const skipped = results.filter((r) => r.skipped)
  const outstanding = sent.reduce((s, r) => s + r.balance, 0)
  const lines = [
    `📲 *Tenant rent reminders — ${label}*`,
    ``,
    `Sent to ${sent.length} tenant${sent.length === 1 ? "" : "s"} · ${inr(outstanding)} outstanding.`,
  ]
  for (const f of failed) lines.push(`⚠️ ${f.tenantName}: ${f.error || "failed"}`)
  for (const s of skipped) lines.push(`⏭️ ${s.tenantName}: ${s.skipReason || "skipped"}`)
  if (failed.length === 0 && skipped.length === 0) lines.push(`All delivered.`)
  return lines.join("\n")
}

/**
 * Compute dues for a month and WhatsApp each unpaid (non-grace) tenant their
 * personal reminder via the approved utility template. In dry-run mode nothing
 * is sent — the would-be messages come back as `preview` for inspection.
 */
export async function runTenantReminders(
  db: Db,
  opts: { year: number; month: number; scopePhone?: string; dryRun?: boolean; asOf?: Date }
): Promise<{
  label: string
  summary: RentDueSummary
  results: TenantReminderResult[]
  adminSummary: string
}> {
  const summary = await computeRentDue(db, opts.year, opts.month, {
    scopePhone: opts.scopePhone,
    asOf: opts.asOf,
  })
  const actionable = summary.rows.filter(
    (r) => r.status !== "paid" && r.balance > 0 && !r.grace
  )

  const results: TenantReminderResult[] = []
  for (const r of actionable) {
    const amount = Math.round(r.balance).toLocaleString("en-IN")
    const params = [r.name, amount, summary.label]
    const preview = renderTenantReminder(r.name, amount, summary.label)
    const base = {
      tenantId: r.tenantId,
      tenantName: r.name,
      room: r.room,
      tenantPhone: r.tenantPhone,
      balance: r.balance,
      status: r.status as "due" | "partial",
      preview,
    }
    const to = toWhatsAppNumber(r.tenantPhone)
    if (!to) {
      results.push({
        ...base,
        sent: false,
        skipped: true,
        skipReason: "no valid phone number on file",
      })
      continue
    }
    if (opts.dryRun) {
      results.push({ ...base, sent: false, skipped: true, skipReason: "dry run — nothing sent" })
      continue
    }
    const s = await sendWhatsAppTemplate(to, TENANT_REMINDER_TEMPLATE, TENANT_REMINDER_LANGUAGE, params)
    results.push({ ...base, sent: s.sent, error: s.error })
  }

  return {
    label: summary.label,
    summary,
    results,
    adminSummary: formatTenantAdminSummary(summary.label, results),
  }
}
