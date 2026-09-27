// Monthly collection report engine: rent collected per unit + expense breakdown.
// Shared by the scheduled cron and the manual "send report" endpoint.

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

export type UnitLine = { name: string; room: string; rent: number; paid: boolean }

export type MonthlySummary = {
  year: number
  month: number // 1-12
  label: string // e.g. "August 2026"
  tenantCount: number
  rentTotal: number
  depositTotal: number
  rentUnitsPaid: number
  expenses: { water: number; gas: number; electricity: number; maintenance: number; other: number }
  expenseTotal: number
  units: UnitLine[]
  pending: UnitLine[]
}

export function previousMonth(ref: Date = new Date()): { year: number; month: number } {
  const d = new Date(ref.getFullYear(), ref.getMonth() - 1, 1)
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}

type Db = {
  from: (t: string) => any
}

export async function computeMonthlySummary(db: Db, year: number, month: number): Promise<MonthlySummary> {
  const mm = String(month).padStart(2, "0")
  const start = `${year}-${mm}-01`
  const endDay = new Date(year, month, 0).getDate()
  const end = `${year}-${mm}-${String(endDay).padStart(2, "0")}`

  const { data: tenants } = await db.from("tenants").select("id,full_name,room_number").limit(1000)
  // Pad the range by a day on each side, then filter precisely in JS (same as the Reports page)
  const txnQuery = (cols: string) => db
    .from("transactions")
    .select(cols)
    .gte("date", `${year}-${mm}-00`)
    .lte("date", `${year}-${mm}-32`)
    .limit(5000)

  let txnRes = await txnQuery("tenant_id,tenant_name,type,amount,date,created_at,deleted_at")
  if (txnRes.error && /deleted_at/i.test(String(txnRes.error.message || ""))) {
    // Migration not run yet — fall back to the old column set
    txnRes = await txnQuery("tenant_id,tenant_name,type,amount,date,created_at")
  }
  const txns = txnRes.data || []

  const inMonth = txns.filter((x: any) => {
    if (x.deleted_at) return false // skip soft-deleted
    const d = String(x.date || x.created_at || "").slice(0, 10)
    return d >= start && d <= end
  })

  const byTenantRent: Record<string, number> = {}
  const expenses = { water: 0, gas: 0, electricity: 0, maintenance: 0, other: 0 }
  let rentTotal = 0
  let depositTotal = 0

  for (const x of inMonth) {
    const amt = Number(x.amount) || 0
    const type = String(x.type || "other").toLowerCase()
    if (type === "rent") {
      rentTotal += amt
      const key = x.tenant_id ? String(x.tenant_id) : `name:${String(x.tenant_name || "").toLowerCase()}`
      byTenantRent[key] = (byTenantRent[key] || 0) + amt
    } else if (type === "deposit") {
      depositTotal += amt
    } else if (type === "water") {
      expenses.water += amt
    } else if (type === "gas") {
      expenses.gas += amt
    } else if (type === "electricity") {
      expenses.electricity += amt
    } else if (type === "maintenance") {
      expenses.maintenance += amt
    } else {
      expenses.other += amt
    }
  }

  const tenantList: any[] = tenants || []
  const units: UnitLine[] = tenantList.map((t: any) => {
    const idKey = String(t.id)
    const nameKey = `name:${String(t.full_name || "").toLowerCase()}`
    const rent = byTenantRent[idKey] ?? byTenantRent[nameKey] ?? 0
    return {
      name: t.full_name || "—",
      room: t.room_number || "",
      rent,
      paid: rent > 0,
    }
  })

  const pending = units.filter((u) => !u.paid)

  return {
    year,
    month,
    label: `${MONTH_NAMES[month - 1]} ${year}`,
    tenantCount: tenantList.length,
    rentTotal,
    depositTotal,
    rentUnitsPaid: units.filter((u) => u.paid).length,
    expenses,
    expenseTotal: expenses.water + expenses.gas + expenses.electricity + expenses.maintenance + expenses.other,
    units,
    pending,
  }
}

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN")

export function formatWhatsAppReport(s: MonthlySummary): string {
  const lines: string[] = [
    `📊 *Monthly Report — ${s.label}*`,
    `_Auto-report · Team Ledger_`,
    ``,
    `💰 *Rent collected:* ${inr(s.rentTotal)} (${s.rentUnitsPaid}/${s.tenantCount} units)`,
  ]
  if (s.depositTotal > 0) lines.push(`🏦 *Deposits collected:* ${inr(s.depositTotal)}`)
  lines.push(
    ``,
    `🧾 *Expenses:*`,
    `• Water: ${inr(s.expenses.water)}`,
    `• Gas: ${inr(s.expenses.gas)}`,
    `• Electricity: ${inr(s.expenses.electricity)}`,
    `• Maintenance: ${inr(s.expenses.maintenance)}`
  )
  if (s.expenses.other > 0) lines.push(`• Other: ${inr(s.expenses.other)}`)
  lines.push(`*Total expenses:* ${inr(s.expenseTotal)}`, `📈 *Net (rent − expenses):* ${inr(s.rentTotal - s.expenseTotal)}`)

  // Per-unit rent lines (capped so the message stays deliverable)
  if (s.units.length > 0) {
    lines.push(``, `🏠 *Per unit rent:*`)
    const shown = s.units.slice(0, 25)
    for (const u of shown) {
      const label = [u.room, u.name].filter(Boolean).join(" · ")
      lines.push(`${u.paid ? "✅" : "❌"} ${label} — ${inr(u.rent)}`)
    }
    if (s.units.length > shown.length) lines.push(`…and ${s.units.length - shown.length} more units`)
  }

  if (s.pending.length > 0) {
    lines.push(``, `⚠️ *Rent pending (${s.pending.length}):*`)
    const names = s.pending.slice(0, 12).map((u) => [u.room, u.name].filter(Boolean).join(" "))
    lines.push(names.join(", ") + (s.pending.length > 12 ? `, +${s.pending.length - 12} more` : ""))
  } else if (s.tenantCount > 0) {
    lines.push(``, `🎉 *All units paid rent this month!*`)
  }

  return lines.join("\n")
}
