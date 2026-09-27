-- Team Ledger: tenants table (merged schema)
-- Run this in your Supabase SQL editor once.
-- The manager dashboard reads/writes this table via /api/tenants.
-- (Previously the /api/tenats endpoint mistakenly wrote tenants into `transactions`.)
--
-- This merges your original columns with the two extra columns the app uses
-- (deposit, start_date). Every statement is IF NOT EXISTS, so running it on
-- your existing table only ADDS what's missing. Nothing existing is changed.

create table if not exists tenants (
  id uuid primary key default gen_random_uuid(),
  full_name text,
  phone text,
  id_number text,
  address text,
  office_name text,
  office_address text,
  created_by text,
  created_at timestamptz not null default now(),
  room_number text,
  rent_amount numeric,
  status text not null default 'active',
  deposit numeric,
  start_date timestamptz
);

alter table tenants add column if not exists full_name text;
alter table tenants add column if not exists phone text;
alter table tenants add column if not exists id_number text;
alter table tenants add column if not exists address text;
alter table tenants add column if not exists office_name text;
alter table tenants add column if not exists office_address text;
alter table tenants add column if not exists created_by text;
alter table tenants add column if not exists created_at timestamptz;
alter table tenants add column if not exists room_number text;
alter table tenants add column if not exists rent_amount numeric;
alter table tenants add column if not exists status text;
alter table tenants add column if not exists deposit numeric;
alter table tenants add column if not exists start_date timestamptz;

-- Column mapping used by /api/tenants (form field -> table column):
--   name          -> full_name
--   phone         -> phone
--   property      -> room_number
--   rent          -> rent_amount
--   deposit       -> deposit
--   start_date    -> start_date
--   status        -> status
--   aadhaar       -> id_number
--   notes         -> address
--   office_name   -> office_name
--   office_address-> office_address
