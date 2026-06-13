-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 014: Capital Events — automatic purchase tracking
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New Query → Run All).
-- Idempotent — safe to run multiple times.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- capital_events — add optional supplier name and a link back to the Roblox
-- account this purchase created, so events generated automatically when an
-- account is added can be traced and the ledger can show where stock came from.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.capital_events ADD COLUMN IF NOT EXISTS supplier text;
ALTER TABLE public.capital_events ADD COLUMN IF NOT EXISTS roblox_account_id uuid REFERENCES public.roblox_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_capital_events_roblox_account
  ON public.capital_events (roblox_account_id)
  WHERE roblox_account_id IS NOT NULL;
