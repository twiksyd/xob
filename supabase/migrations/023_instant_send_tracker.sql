-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 023: Instant Send Tracker (simple version)
-- Run in Supabase SQL Editor. Safe to run multiple times (idempotent).
--
-- Tracks the once-per-day 500 R$ instant-send allowance per account as a
-- simple append-only log, not a mutable counter — availability for "today"
-- is just "does this account have a log row with sent_at >= start of today."
-- No monthly quotas, no rolling windows: accounts are usually depleted and
-- replaced within a week, so there's nothing longer-lived worth tracking.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.instant_send_logs (
  id                uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  roblox_account_id uuid        NOT NULL REFERENCES public.roblox_accounts(id) ON DELETE CASCADE,
  sent_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_instant_send_logs_account_sent_at
  ON public.instant_send_logs (roblox_account_id, sent_at DESC);

ALTER TABLE public.instant_send_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'instant_send_logs' AND policyname = 'Users manage own instant send logs') THEN
    CREATE POLICY "Users manage own instant send logs"
      ON public.instant_send_logs FOR ALL
      USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;
