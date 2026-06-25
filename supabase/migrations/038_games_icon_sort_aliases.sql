-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 038: Game Selector redesign — schema prep
-- Run in Supabase SQL Editor. Safe to run multiple times (idempotent).
--
-- icon_url    — optional thumbnail shown wherever a game is represented,
--               falling back to the existing color dot when missing/broken.
--               No management UI yet — set directly via SQL for now (most
--               games already have a Roblox thumbnail URL to paste in).
-- sort_order  — hidden manual-ranking field for future use (e.g. forcing
--               "Anime Rangers / Anime Saga / Anime Last Stand" to the top
--               regardless of activity once the catalog grows past 100+
--               games). Not read by any UI yet — pure schema prep.
-- aliases     — optional alternate names/abbreviations (e.g. "AW3" for
--               "Anime Warriors III") so the game selector's search can
--               match on them without changing the displayed name.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.games
  ADD COLUMN IF NOT EXISTS icon_url text,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS aliases text[] NOT NULL DEFAULT '{}'::text[];
