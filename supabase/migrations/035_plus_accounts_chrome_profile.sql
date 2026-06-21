-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 035: Roblox Plus accounts + Chrome profile tracking
-- Run in Supabase SQL Editor. Safe to run multiple times (idempotent).
--
-- is_plus_account — accounts with Roblox Plus get ~10% better Robux
-- acquisition economics. The discount itself lives in ONE shared TS helper
-- (getEffectiveCostRate in src/lib/utils/pricing.ts), applied wherever
-- robux_cost_rate currently feeds a cost/profit/inventory-value calculation.
-- No server-side cost math exists in this app (orders store a cost/profit
-- snapshot at creation time), so no RPC changes are needed here.
--
-- chrome_profile — free text, purely operational (which Chrome profile a
-- Roblox account's session lives in), never read by any calculation.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.roblox_accounts
  ADD COLUMN IF NOT EXISTS is_plus_account boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS chrome_profile text;
