import { createHmac, timingSafeEqual } from "crypto"

const COOKIE_NAME = "tl_session"
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

function getSecret(): string {
  const secret = process.env.SESSION_SECRET
  if (!secret) throw new Error("SESSION_SECRET is not configured")
  return secret
}

export function createSessionToken(phone: string): string {
  const secret = getSecret()
  const exp = Date.now() + SESSION_TTL_MS
  const payload = `${phone}.${exp}`
  const sig = createHmac("sha256", secret).update(payload).digest("hex")
  return `${payload}.${sig}`
}

export function verifySessionToken(token: string | null | undefined): string | null {
  let secret: string
  try {
    secret = getSecret()
  } catch {
    return null
  }
  if (!token) return null
  const parts = token.split(".")
  if (parts.length !== 3) return null
  const [phone, expStr, sig] = parts
  const exp = Number(expStr)
  if (!phone || !exp || exp < Date.now()) return null
  const expected = createHmac("sha256", secret).update(`${phone}.${expStr}`).digest("hex")
  try {
    if (sig.length !== expected.length) return null
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null
  } catch {
    return null
  }
  return phone
}

export function sessionCookieHeader(token: string): string {
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL_MS / 1000}; Secure`
}

export function clearSessionCookieHeader(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
}

export function getSessionPhone(headers: Headers): string | null {
  const cookie = headers.get("cookie") || ""
  const match = cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(COOKIE_NAME + "="))
  if (!match) return null
  return verifySessionToken(match.slice(COOKIE_NAME.length + 1))
}
