-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 008: Account-Level Robux Cost Rate
-- Run in Supabase SQL Editor. Safe to run multiple times (idempotent).
-- ─────────────────────────────────────────────────────────────────────────────

-- Add cost rate to each Roblox account (PHP per 1,000 Robux)
ALTER TABLE public.roblox_accounts
  ADD COLUMN IF NOT EXISTS robux_cost_rate numeric(8,4) NOT NULL DEFAULT 0;

-- Snapshot the rate used at the time an order was fulfilled.
-- Stored once on completion; never recalculated from current account rate.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS account_rate_used numeric(8,4);
