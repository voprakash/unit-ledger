import { NextResponse } from "next/server"
import { clearSessionCookieHeader } from "@/app/lib/session"

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST() {
  return NextResponse.json(
    { ok: true },
    { headers: { "Set-Cookie": clearSessionCookieHeader() } }
  )
}
