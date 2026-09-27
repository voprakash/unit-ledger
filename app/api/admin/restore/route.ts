import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getSessionUser, isAdmin } from "@/app/lib/authz"
import { isValidBundle } from "@/app/lib/backup"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const getSupabase = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  )

// Natural upsert key per table. allowed_users may predate the `id` column,
// so it upserts on phone (unique by OTP-login design).
const CONFLICT_KEY: Record<string, string> = {
  allowed_users: "phone",
  tenants: "id",
  transactions: "id",
}

const chunk = <T,>(arr: T[], n: number): T[][] => {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

async function summarize(supabase: ReturnType<typeof getSupabase>, bundle: any) {
  const out: Record<string, { inFile: number; alreadyHave: number; toAdd: number }> = {}
  for (const table of Object.keys(CONFLICT_KEY)) {
    const rows: any[] = bundle.tables[table] || []
    const key = CONFLICT_KEY[table]
    let alreadyHave = 0
    if (rows.length) {
      const keys = [...new Set(rows.map((r) => r[key]).filter((v) => v !== undefined && v !== null))]
      for (const part of chunk(keys, 200)) {
        const { data } = await supabase.from(table).select(key).in(key, part)
        alreadyHave += data?.length || 0
      }
    }
    out[table] = { inFile: rows.length, alreadyHave, toAdd: rows.length - alreadyHave }
  }
  return out
}

// POST /api/admin/restore { bundle, dryRun }
// dryRun=true  -> validates + reports what would change, writes nothing.
// dryRun=false -> upserts every row by its natural key. Never deletes anything,
//                so a wrong file cannot wipe data.
export async function POST(req: Request) {
  const user = await getSessionUser(req.headers)
  if (!user || !isAdmin(user)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const body = await req.json().catch(() => null)
    const bundle = body?.bundle
    const dryRun = body?.dryRun !== false
    if (!isValidBundle(bundle)) {
      return NextResponse.json(
        { error: "That file is not a valid Team Ledger backup (expected version 1 bundle)." },
        { status: 400 }
      )
    }
    const supabase = getSupabase()
    const tables = bundle.tables as Record<string, any[]>
    const summary = await summarize(supabase, { tables })
    if (dryRun) {
      return NextResponse.json({ dryRun: true, exported_at: bundle.exported_at, summary })
    }

    const written: Record<string, number> = {}
    // Restore in dependency order: users, then tenants, then transactions.
    for (const table of Object.keys(CONFLICT_KEY)) {
      const rows: any[] = tables[table] || []
      let count = 0
      for (const part of chunk(rows, 200)) {
        const { error } = await supabase.from(table).upsert(part, { onConflict: CONFLICT_KEY[table] })
        if (error) {
          if (/non-DEFAULT/i.test(error.message)) {
            return NextResponse.json(
              {
                error:
                  "The database refused explicit transaction ids. Run supabase/transactions_backup.sql in the Supabase SQL editor, then restore again.",
              },
              { status: 409 }
            )
          }
          return NextResponse.json({ error: `Restore failed on ${table}` }, { status: 500 })
        }
        count += part.length
      }
      written[table] = count
    }
    return NextResponse.json({ dryRun: false, written, summary })
  } catch {
    return NextResponse.json({ error: "Restore failed" }, { status: 500 })
  }
}
