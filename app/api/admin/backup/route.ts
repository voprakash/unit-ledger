import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { getSessionUser, isAdmin } from "@/app/lib/authz"
import { buildBackupBundle, backupFileName } from "@/app/lib/backup"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const getSupabase = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  )

// GET /api/admin/backup -> admin-only download of the full JSON backup bundle
export async function GET(req: Request) {
  const user = await getSessionUser(req.headers)
  if (!user || !isAdmin(user)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    const bundle = await buildBackupBundle(getSupabase())
    return new NextResponse(JSON.stringify(bundle, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${backupFileName()}"`,
      },
    })
  } catch (e: any) {
    return NextResponse.json({ error: "Backup failed" }, { status: 500 })
  }
}
