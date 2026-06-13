-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 012: Capital Events Ledger
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New Query → Run All).
-- Idempotent — safe to run multiple times.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- capital_events — one row per recorded supplier stock purchase. Each row is a
-- snapshot (cost, robux acquired, profit/capital split, business value before
-- and after, protected capital remaining) taken at the moment the purchase was
-- logged, so the dashboard can show a true historical timeline.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.capital_events (
  id                          uuid          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id                     uuid          NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  accounts_purchased          integer       NOT NULL CHECK (accounts_purchased > 0),
  robux_acquired              integer       NOT NULL CHECK (robux_acquired >= 0),
  cost                        numeric(10,2) NOT NULL CHECK (cost >= 0),
  business_value_before       numeric(10,2) NOT NULL,
  business_value_after        numeric(10,2) NOT NULL,
  profit_used                 numeric(10,2) NOT NULL DEFAULT 0,
  capital_used                numeric(10,2) NOT NULL DEFAULT 0,
  protected_capital_remaining numeric(10,2) NOT NULL,
  funding_source              text          NOT NULL CHECK (funding_source IN ('profit', 'mixed', 'capital')),
  notes                       text,
  created_at                  timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_capital_events_user_created
  ON public.capital_events (user_id, created_at DESC);

ALTER TABLE public.capital_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'capital_events' AND policyname = 'Users manage own capital events') THEN
    CREATE POLICY "Users manage own capital events"
      ON public.capital_events FOR ALL
      USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;
