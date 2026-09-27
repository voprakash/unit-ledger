import { NextResponse } from "next/server"
import { getSessionUser, isAdmin } from "@/app/lib/authz"
import { hasDriveClient, isDriveConfigured } from "@/app/lib/driveBackup"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// GET /api/admin/backup/status -> drive setup state for the Backup page UI:
// "missing_client" (add OAuth client id/secret in Vercel),
// "needs_connect"  (tap Connect Google Drive),
// "ready"          (weekly uploads active).
export async function GET(req: Request) {
  const user = await getSessionUser(req.headers)
  if (!user || !isAdmin(user)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const state = !hasDriveClient() ? "missing_client" : !isDriveConfigured() ? "needs_connect" : "ready"
  return NextResponse.json({ state, driveConfigured: state === "ready" })
}
