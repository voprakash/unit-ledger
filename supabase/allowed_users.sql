-- Team Ledger: allowed_users table (reference)
-- Run this in your Supabase SQL editor once.
-- These are the team members who can log in (WhatsApp OTP) and use the bot.
-- Manage them from the app: Manager -> Users.
--
-- Every statement is IF NOT EXISTS, so running it on your existing table
-- only ADDS what's missing. Nothing existing is changed.

create table if not exists allowed_users (
  id bigint generated always as identity primary key,
  name text,
  phone text,
  role text not null default 'member',
  created_at timestamptz not null default now()
);

alter table allowed_users add column if not exists name text;
alter table allowed_users add column if not exists phone text;
alter table allowed_users add column if not exists role text;
alter table allowed_users add column if not exists created_at timestamptz;

-- Lock the table down: the app uses the service_role key (bypasses RLS),
-- so the API is unaffected, but anon/authenticated keys can't read it directly.
alter table allowed_users enable row level security;

drop policy if exists "service role full access" on allowed_users;
create policy "service role full access"
  on allowed_users for all
  to service_role
  using (true)
  with check (true);
