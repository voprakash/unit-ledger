-- Team Ledger: transactions table
-- Run this in your Supabase SQL editor once.
-- The manager dashboard writes here via /api/transactions (Add Transaction
-- button on each tenant card).
--
-- Every statement is IF NOT EXISTS, so running it on your existing table
-- only ADDS what's missing. Nothing existing is changed.

create table if not exists transactions (
  id bigint generated always as identity primary key,
  tenant_id uuid,
  tenant_name text,
  type text,
  amount numeric,
  method text,
  notes text,
  date timestamptz not null default now(),
  created_by text,
  created_at timestamptz not null default now()
);

alter table transactions add column if not exists tenant_id uuid;
alter table transactions add column if not exists tenant_name text;
alter table transactions add column if not exists type text;
alter table transactions add column if not exists amount numeric;
alter table transactions add column if not exists method text;
alter table transactions add column if not exists notes text;
alter table transactions add column if not exists date timestamptz;
alter table transactions add column if not exists created_by text;
alter table transactions add column if not exists created_at timestamptz;

-- Lock the table down: the app uses the service_role key (bypasses RLS),
-- so the API is unaffected, but anon/authenticated keys can't read it directly.
alter table transactions enable row level security;

drop policy if exists "service role full access" on transactions;
create policy "service role full access"
  on transactions for all
  to service_role
  using (true)
  with check (true);
