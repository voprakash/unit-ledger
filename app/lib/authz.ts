import { createClient } from "@supabase/supabase-js"
import { getSessionPhone } from "./session"

export type SessionUser = {
  phone: string      // national 10-digit number from the signed cookie
  name: string | null
  role: string       // lowercased role from allowed_users, defaults to "manager"
}

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createClient(url, key)
}

/**
 * Resolve the logged-in user from the signed session cookie.
 * Role always comes from the database - never trust the client.
 */
export async function getSessionUser(headers: Headers): Promise<SessionUser | null> {
  const phone = getSessionPhone(headers)
  if (!phone) return null
  try {
    const supabase = getSupabase()
    const national = phone.replace(/\D/g, "").slice(-10)
    const { data } = await supabase
      .from("allowed_users")
      .select("phone,name,role")
      .ilike("phone", `%${national}%`)
      .limit(1)
      .maybeSingle()
    if (!data) return null
    return {
      phone: String(data.phone).replace(/\D/g, "").slice(-10),
      name: data.name || null,
      role: String(data.role || "manager").toLowerCase(),
    }
  } catch {
    return null
  }
}

export function isAdmin(user: SessionUser | null): boolean {
  return !!user && user.role === "admin"
}
