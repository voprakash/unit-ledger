-- Edit/delete support for transactions: edit stamp + soft delete.
-- Run once in the Supabase SQL editor. Safe to re-run.

alter table transactions
  add column if not exists updated_at timestamptz default now();

alter table transactions
  add column if not exists deleted_at timestamptz;

-- Backfill the edit stamp so existing rows don't show as "edited"
update transactions set updated_at = created_at
  where updated_at is null and created_at is not null;
