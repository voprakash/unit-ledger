import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { buildBackupBundle, backupFileName } from "@/app/lib/backup"
import { isDriveConfigured, uploadBackupToDrive, pruneDriveBackups } from "@/app/lib/driveBackup"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// Called by Vercel Cron weekly (see vercel.json).
// Builds the backup bundle and uploads it to the shared Google Drive folder,
// keeping the newest 8 copies. Secured by CRON_SECRET like the monthly report cron.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured on the server" }, { status: 500 })
  }
  const auth = req.headers.get("authorization") || ""
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!isDriveConfigured()) {
    return NextResponse.json({
      skipped: true,
      reason:
        "Google Drive backup is not configured. Add GOOGLE_OAUTH_CLIENT_ID, GOOGLE_OAUTH_CLIENT_SECRET, GOOGLE_OAUTH_REFRESH_TOKEN and GOOGLE_DRIVE_BACKUP_FOLDER_ID in Vercel env vars, then connect via the Backup page.",
    })
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
    )
    const bundle = await buildBackupBundle(supabase)
    const name = backupFileName()
    const json = JSON.stringify(bundle)
    const file = await uploadBackupToDrive(name, json)
    const prune = await pruneDriveBackups(8)
    return NextResponse.json({
      ok: true,
      file: file.name,
      link: (file as any).webViewLink || null,
      rows: {
        users: bundle.tables.allowed_users.length,
        tenants: bundle.tables.tenants.length,
        transactions: bundle.tables.transactions.length,
      },
      prune,
    })
  } catch (e: any) {
    // Detail is safe to expose: this endpoint requires CRON_SECRET bearer auth.
    return NextResponse.json(
      { error: "Drive backup failed", detail: String(e?.message || e) },
      { status: 500 }
    )
  }
}
