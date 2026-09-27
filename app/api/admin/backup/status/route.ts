import { NextResponse } from "next/server"
import { getSessionUser, isAdmin } from "@/app/lib/authz"
import { isDriveConfigured } from "@/app/lib/driveBackup"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// GET /api/admin/backup/status -> { driveConfigured } so the UI can show
// whether automatic Drive uploads are active.
export async function GET(req: Request) {
  const user = await getSessionUser(req.headers)
  if (!user || !isAdmin(user)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  return NextResponse.json({ driveConfigured: isDriveConfigured() })
}
