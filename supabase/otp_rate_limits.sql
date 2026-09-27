-- Rate-limit counters for the OTP flow (send-otp + verify-otp).
-- Run this once in the Supabase SQL editor. Until then the limiter fails
-- open (logins keep working, limits unenforced).

create table if not exists otp_rate_limits (
  key text primary key,
  count integer not null default 1,
  window_start timestamptz not null default now()
);

-- Lock the table down: the app uses the service_role key (bypasses RLS),
-- so the API is unaffected, but anon/authenticated keys can't read it directly.
alter table otp_rate_limits enable row level security;

drop policy if exists "service role full access" on otp_rate_limits;
create policy "service role full access"
  on otp_rate_limits for all
  to service_role
  using (true)
  with check (true);

-- Keys used by the app:
--   otp-send:phone:<national>  - max 3 OTP sends per phone per hour
--   otp-send:ip:<ip>           - max 20 OTP sends per IP per hour
--   otp-verify:phone:<national> - max 5 OTP guesses per phone per 10 min
