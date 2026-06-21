-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 033: Pricing Engine — master pricing table + generation presets
-- Run in Supabase SQL Editor. Safe to run multiple times (idempotent).
--
-- pricing_engine_tiers — the master Robux-amount -> price/profit reference
-- table, replacing the spreadsheet. Keyed by amount only (not by game or
-- gamepass name), since the same tier list is reused across every game.
--
-- gamepass_generation_presets — a saved paste-box snippet (raw text, not a
-- rigid structure), so a recurring tier ladder ("100/250/500/1000" or
-- "VIP|100, Premium|250...") can be reloaded into the Bulk Generate
-- Gamepasses paste box instead of retyped every time.
--
-- Neither table is read by gamepasses/orders/transactions logic — both are
-- only consumed by the Bulk Generate Gamepasses flow at generation time.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.pricing_engine_tiers (
  id            uuid          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  robux_amount  integer       NOT NULL CHECK (robux_amount > 0),
  selling_price numeric(10,2) NOT NULL CHECK (selling_price >= 0),
  profit        numeric(10,2) NOT NULL,
  created_at    timestamptz   NOT NULL DEFAULT now(),
  updated_at    timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (user_id, robux_amount)
);

CREATE TABLE IF NOT EXISTS public.gamepass_generation_presets (
  id         uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  raw_input  text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

ALTER TABLE public.pricing_engine_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gamepass_generation_presets ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'pricing_engine_tiers' AND policyname = 'Users manage own pricing tiers') THEN
    CREATE POLICY "Users manage own pricing tiers"
      ON public.pricing_engine_tiers FOR ALL
      USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'gamepass_generation_presets' AND policyname = 'Users manage own generation presets') THEN
    CREATE POLICY "Users manage own generation presets"
      ON public.gamepass_generation_presets FOR ALL
      USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;
