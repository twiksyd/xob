-- Add has_super_discount flag to roblox_accounts.
-- Separate from has_active_discount — this is rarer and carries a
-- different visual weight in the UI (intimidating red badge).
alter table public.roblox_accounts
  add column if not exists has_super_discount boolean not null default false;
