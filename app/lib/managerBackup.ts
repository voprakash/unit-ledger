import type { SupabaseClient } from "@supabase/supabase-js"
import { computeRentDue, monthLabel } from "@/app/lib/rentDue"

export const MANAGER_BACKUP_VERSION = 1

export type ManagerBundle = {
  version: number
  exported_at: string
  backup_month: string // "2026-09"
  backup_month_label: string // "September 2026"
  manager: { name: string; phone: string } // national 10-digit phone
  summary: {
    tenants: number
    transactions: number
    rentCollected: number
    expenses: Record<string, number>
    totalOutstanding: number
    dueCount: number
    partialCount: number
    paidCount: number
  }
  tenants: any[]
  transactions: any[]
}

const national = (p: any) => String(p || "").replace(/\D/g, "").slice(-10)

/** The month this run backs up: the month that just ended. */
export function backupMonth(d: Date = new Date()) {
  const prev = new Date(d.getFullYear(), d.getMonth() - 1, 1)
  const year = prev.getFullYear()
  const month = prev.getMonth() + 1
  return { year, month, key: `${year}-${String(month).padStart(2, "0")}` }
}

/** Drive-safe folder name, e.g. "Rekha_9881160765". */
export function managerFolderName(name: string, phone: string) {
  const safe = String(name || "manager").replace(/[^\w\- ]+/g, "").trim().slice(0, 40) || "manager"
  return `${safe}_${phone}`
}

export function managerBackupFileName(monthKey: string) {
  return `manager-backup-${monthKey}.json`
}

/**
 * Build one backup bundle per manager (role ilike 'manager' in allowed_users).
 * Each bundle holds the manager's tenants (created_by = their phone), every
 * transaction linked to those tenants (full history, soft-deleted included),
 * and a summary for the backup month: rent collected, expenses by type, and
 * outstanding dues (reusing the rent-due engine).
 * Managers with no tenants are skipped.
 */
export async function buildManagerBundles(supabase: SupabaseClient): Promise<ManagerBundle[]> {
  const { year, month, key } = backupMonth()
  const datePrefix = key // transaction dates are YYYY-MM-DD strings

  const [users, tenantsRes, txnsRes] = await Promise.all([
    supabase.from("allowed_users").select("name,phone,role").ilike("role", "manager").limit(1000),
    supabase.from("tenants").select("*").limit(10000),
    supabase.from("transactions").select("*").order("id", { ascending: true }).limit(20000),
  ])
  if (users.error) throw new Error("allowed_users: " + users.error.message)
  if (tenantsRes.error) throw new Error("tenants: " + tenantsRes.error.message)
  if (txnsRes.error) throw new Error("transactions: " + txnsRes.error.message)

  const tenants = tenantsRes.data || []
  const txns = txnsRes.data || []
  const bundles: ManagerBundle[] = []

  for (const u of users.data || []) {
    const phone = national(u.phone)
    if (!phone) continue
    const myTenants = tenants.filter((t: any) => national(t.created_by) === phone)
    if (myTenants.length === 0) continue
    const ids = new Set(myTenants.map((t: any) => t.id))
    const myTxns = txns.filter((x: any) => ids.has(x.tenant_id))

    const monthTxns = myTxns.filter(
      (x: any) => !x.deleted_at && String(x.date || "").startsWith(datePrefix)
    )
    const rentCollected = monthTxns
      .filter((x: any) => x.type === "Rent")
      .reduce((s: number, x: any) => s + Number(x.amount || 0), 0)
    const expenses: Record<string, number> = {}
    for (const x of monthTxns.filter((x: any) => x.type !== "Rent")) {
      expenses[x.type] = Math.round((expenses[x.type] || 0) + Number(x.amount || 0))
    }

    let due = { totalOutstanding: 0, dueCount: 0, partialCount: 0, paidCount: 0 }
    try {
      const s = await computeRentDue(supabase as any, year, month, { scopePhone: phone })
      due = {
        totalOutstanding: s.totalOutstanding,
        dueCount: s.dueCount,
        partialCount: s.partialCount,
        paidCount: s.paidCount,
      }
    } catch {
      /* summary-only; the bundle is still a valid record without it */
    }

    bundles.push({
      version: MANAGER_BACKUP_VERSION,
      exported_at: new Date().toISOString(),
      backup_month: key,
      backup_month_label: monthLabel(year, month),
      manager: { name: u.name || "", phone },
      summary: {
        tenants: myTenants.length,
        transactions: myTxns.length,
        rentCollected: Math.round(rentCollected),
        expenses,
        totalOutstanding: due.totalOutstanding,
        dueCount: due.dueCount,
        partialCount: due.partialCount,
        paidCount: due.paidCount,
      },
      tenants: myTenants,
      transactions: myTxns,
    })
  }
  return bundles
}
