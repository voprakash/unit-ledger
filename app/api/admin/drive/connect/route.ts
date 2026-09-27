import { NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { getSessionUser, isAdmin } from "@/app/lib/authz"
import { hasDriveClient, driveAuthUrl } from "@/app/lib/driveBackup"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// GET /api/admin/drive/connect -> admin-only start of the Google OAuth flow.
// Sets a short-lived state cookie, then redirects to Google's consent screen.
export async function GET(req: Request) {
  const user = await getSessionUser(req.headers)
  if (!user || !isAdmin(user)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!hasDriveClient()) {
    return NextResponse.json(
      { error: "Add GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET in Vercel env vars first." },
      { status: 500 }
    )
  }
  const state = randomBytes(16).toString("hex")
  const res = NextResponse.redirect(driveAuthUrl(req, state))
  res.cookies.set("drive_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 300,
    path: "/",
  })
  return res
}
