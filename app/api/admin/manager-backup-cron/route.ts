import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import {
  buildManagerBundles,
  managerFolderName,
  managerBackupFileName,
  backupMonth,
} from "@/app/lib/managerBackup"
import {
  isDriveConfigured,
  findOrCreateDriveFolder,
  uploadJsonToDriveFolder,
  pruneDriveFolder,
} from "@/app/lib/driveBackup"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// Called by Vercel Cron just after month-end (see vercel.json).
// Builds one backup JSON per manager — their tenants, every transaction linked
// to those tenants, plus that month's summary — and saves it under
// Team Ledger Backups/Managers/<name>_<phone>/, keeping the newest 12 per manager.
// Secured by CRON_SECRET like the other crons. ?dry_run=1 previews without touching Drive.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured on the server" }, { status: 500 })
  }
  const auth = req.headers.get("authorization") || ""
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const dryRun = new URL(req.url).searchParams.get("dry_run") === "1"

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
    )
    const bundles = await buildManagerBundles(supabase)
    const { key } = backupMonth()
    const fileName = managerBackupFileName(key)

    if (dryRun) {
      return NextResponse.json({
        ok: true,
        dryRun: true,
        backup_month: key,
        fileName,
        managers: bundles.map((b) => ({
          name: b.manager.name,
          phone: b.manager.phone,
          folder: `Managers/${managerFolderName(b.manager.name, b.manager.phone)}`,
          tenants: b.summary.tenants,
          transactions: b.summary.transactions,
          rentCollected: b.summary.rentCollected,
          outstanding: b.summary.totalOutstanding,
        })),
      })
    }

    if (!isDriveConfigured()) {
      return NextResponse.json({
        skipped: true,
        reason:
          "Google Drive backup is not configured. Add GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REFRESH_TOKEN and GOOGLE_DRIVE_BACKUP_FOLDER_ID in Vercel env vars, then connect via the Backup page.",
      })
    }

    const rootId = process.env.GOOGLE_DRIVE_BACKUP_FOLDER_ID!
    const managersId = await findOrCreateDriveFolder("Managers", rootId)
    const results: any[] = []
    for (const b of bundles) {
      try {
        const folderId = await findOrCreateDriveFolder(
          managerFolderName(b.manager.name, b.manager.phone),
          managersId
        )
        const file = await uploadJsonToDriveFolder(fileName, JSON.stringify(b), folderId)
        const prune = await pruneDriveFolder(folderId, "manager-backup-", 12)
        results.push({
          name: b.manager.name,
          phone: b.manager.phone,
          file: file.name,
          link: (file as any).webViewLink || null,
          tenants: b.summary.tenants,
          transactions: b.summary.transactions,
          prune,
        })
      } catch (e: any) {
        results.push({ name: b.manager.name, phone: b.manager.phone, error: String(e?.message || e) })
      }
    }
    return NextResponse.json({ ok: true, backup_month: key, results })
  } catch (e: any) {
    // Detail is safe to expose: this endpoint requires CRON_SECRET bearer auth.
    return NextResponse.json(
      { error: "Manager backup failed", detail: String(e?.message || e) },
      { status: 500 }
    )
  }
}
