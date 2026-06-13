-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 019: Capital Events Immutable (H2)
-- Run in Supabase SQL Editor. Safe to run multiple times (idempotent).
--
-- After C3, every capital_events row corresponds 1:1 with a real
-- roblox_accounts purchase, and Capital Usage = SUM(capital_events.cost).
-- The previous "FOR ALL" policy allowed UPDATE/DELETE, letting a row vanish
-- (or be edited) with no audit trail and no corresponding inventory change —
-- silent drift in Capital Usage. Capital events are now insert-once,
-- append-only: replace the FOR ALL policy with separate SELECT and INSERT
-- policies, leaving no UPDATE/DELETE policy at all.
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users manage own capital events" ON public.capital_events;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'capital_events' AND policyname = 'Users view own capital events') THEN
    CREATE POLICY "Users view own capital events"
      ON public.capital_events FOR SELECT
      USING (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'capital_events' AND policyname = 'Users insert own capital events') THEN
    CREATE POLICY "Users insert own capital events"
      ON public.capital_events FOR INSERT
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;
