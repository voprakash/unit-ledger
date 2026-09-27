// Fixed-window rate limiter backed by Supabase so it works across
// serverless instances. Table: otp_rate_limits(key text pk, count int, window_start timestamptz)
// See supabase/otp_rate_limits.sql — run it once in the Supabase SQL editor.

type Db = { from: (t: string) => any }

export async function checkRateLimit(
  db: Db,
  key: string,
  maxAttempts: number,
  windowMs: number
): Promise<{ allowed: boolean }> {
  const now = Date.now()
  try {
    const { data: row } = await db
      .from("otp_rate_limits")
      .select("count,window_start")
      .eq("key", key)
      .maybeSingle()

    if (!row || now - new Date(row.window_start).getTime() >= windowMs) {
      await db.from("otp_rate_limits").upsert(
        { key, count: 1, window_start: new Date(now).toISOString() },
        { onConflict: "key" }
      )
      return { allowed: true }
    }

    if ((row.count || 0) >= maxAttempts) return { allowed: false }

    await db.from("otp_rate_limits").update({ count: (row.count || 0) + 1 }).eq("key", key)
    // Opportunistic cleanup of stale counters
    await db
      .from("otp_rate_limits")
      .delete()
      .lt("window_start", new Date(now - 24 * 3600 * 1000).toISOString())
    return { allowed: true }
  } catch {
    // Fail open if the table doesn't exist yet (migration not run) so logins
    // keep working. Run supabase/otp_rate_limits.sql to enforce limits.
    return { allowed: true }
  }
}
