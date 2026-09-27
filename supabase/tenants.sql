-- Team Ledger: tenants table
-- Run this in your Supabase SQL editor once.
-- The manager dashboard now reads/writes this table via /api/tenants.
-- (Previously the /api/tenats endpoint mistakenly wrote tenants into `transactions`.)

create table if not exists tenants (
  id bigint generated always as identity primary key,
  name text not null,
  phone text not null,
  property text,
  rent numeric,
  deposit numeric,
  start_date timestamptz,
  status text not null default 'active',
  aadhaar text,
  notes text,
  created_by text,
  created_at timestamptz not null default now()
);

-- Allow the service-role key (used by the API routes) full access.
-- No public/anon policies are created on purpose: the API validates
-- the signed session cookie before touching this table.
alter table tenants enable row level security;

drop policy if exists "service role full access" on tenants;
create policy "service role full access"
  on tenants for all
  to service_role
  using (true)
  with check (true);
