-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 037: Discounted Game Status
-- Run in Supabase SQL Editor. Safe to run multiple times (idempotent).
--
-- is_discounted is purely visual — it does not feed any cost, profit, or
-- inventory calculation anywhere. It flags whether a game is currently
-- discounted on specific accounts, shown as a colored badge wherever a game
-- name is displayed. Every games query in this app already uses SELECT * (or
-- a gamepasses(*, games(*)) join), so this column reaches every page with no
-- query changes required.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS is_discounted boolean NOT NULL DEFAULT false;
