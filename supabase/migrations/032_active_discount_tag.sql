-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 032: Roblox Discount Active tagging
-- Run in Supabase SQL Editor. Safe to run multiple times (idempotent).
--
-- Purely operational tag — "this account currently has a Roblox discount
-- active" — replacing the previous practice of encoding it into the account
-- username. Deliberately just one boolean column: it is never read by any
-- financial RPC (adjust_account_field, transition_order, record_transfer,
-- etc.) or by any inventory/profit/capital/forecast calculation in the app,
-- so toggling it has zero effect on business numbers.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.roblox_accounts
  ADD COLUMN IF NOT EXISTS has_active_discount boolean NOT NULL DEFAULT false;
