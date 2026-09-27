import type { SupabaseClient } from "@supabase/supabase-js"

export const BACKUP_VERSION = 1

export type BackupBundle = {
  version: number
  exported_at: string
  tables: {
    allowed_users: any[]
    tenants: any[]
    transactions: any[]
  }
}

/**
 * Build a complete, portable backup of every table that matters.
 * Includes soft-deleted transactions (deleted_at set) so a restore is exact.
 * Ephemeral tables (whatsapp_otps, otp_rate_limits) are intentionally skipped.
 */
export async function buildBackupBundle(supabase: SupabaseClient): Promise<BackupBundle> {
  const [users, tenants, transactions] = await Promise.all([
    supabase.from("allowed_users").select("*").limit(10000),
    supabase.from("tenants").select("*").limit(10000),
    supabase.from("transactions").select("*").order("id", { ascending: true }).limit(20000),
  ])
  if (users.error) throw new Error("allowed_users: " + users.error.message)
  if (tenants.error) throw new Error("tenants: " + tenants.error.message)
  if (transactions.error) throw new Error("transactions: " + transactions.error.message)
  return {
    version: BACKUP_VERSION,
    exported_at: new Date().toISOString(),
    tables: {
      allowed_users: users.data || [],
      tenants: tenants.data || [],
      transactions: transactions.data || [],
    },
  }
}

export function backupFileName(d: Date = new Date()): string {
  return `ledger-backup-${d.toISOString().slice(0, 10)}.json`
}

export function isValidBundle(b: any): b is BackupBundle {
  return (
    !!b &&
    typeof b === "object" &&
    b.version === BACKUP_VERSION &&
    !!b.tables &&
    Array.isArray(b.tables.allowed_users) &&
    Array.isArray(b.tables.tenants) &&
    Array.isArray(b.tables.transactions)
  )
}
