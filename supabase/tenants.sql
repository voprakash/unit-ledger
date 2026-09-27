-- Team Ledger: tenants table
-- Run this in your Supabase SQL editor once.
-- The manager dashboard now reads/writes this table via /api/tenants.
-- (Previously the /api/tenats endpoint mistakenly wrote tenants into `transactions`.)
--
-- If your tenants table already exists (with columns like full_name,
-- room_number, rent_amount, id_number, ...), the statements below only
-- ADD the two columns the app also uses. Nothing existing is changed.

alter table tenants add column if not exists deposit numeric;
alter table tenants add column if not exists start_date timestamptz;

-- Column mapping used by /api/tenants (form field -> table column):
--   name      -> full_name
--   phone     -> phone
--   property  -> room_number
--   rent      -> rent_amount
--   deposit   -> deposit
--   start_date-> start_date
--   status    -> status
--   aadhaar   -> id_number
--   notes     -> address
