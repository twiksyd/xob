-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 034: Remove Pricing Engine (Bulk Generate / Import Catalog /
-- Find Duplicates) — the feature is being removed after its duplicate-
-- matching logic caused real data loss/corruption on the gamepass catalog.
-- Run in Supabase SQL Editor. Safe to run multiple times (idempotent).
--
-- Drops only the two tables this feature introduced. Does not touch
-- games or gamepasses — those are restored separately (see
-- scripts/restore-catalog.sql) before running this.
-- ─────────────────────────────────────────────────────────────────────────────

DROP TABLE IF EXISTS public.pricing_engine_tiers;
DROP TABLE IF EXISTS public.gamepass_generation_presets;
