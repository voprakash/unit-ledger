import { NextResponse } from "next/server"
import { getSessionUser } from "@/app/lib/authz"

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Returns the currently logged-in user's live profile (role always from DB)
export async function GET(req: Request) {
  const user = await getSessionUser(req.headers)
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  return NextResponse.json(user)
}
