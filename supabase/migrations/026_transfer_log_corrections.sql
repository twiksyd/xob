-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 026: Daily Transfer Tracker — backdated logging + corrections
-- Run in Supabase SQL Editor. Safe to run multiple times (idempotent).
--
-- Closes a real gap: record_transfer always stamped sent_at = now(), so there
-- was no way to log a transfer that already happened (forgot to log it
-- earlier today, or backfilling history from before this feature existed).
--
-- record_transfer now accepts an optional p_sent_at. Two validation modes:
--   - Live send (p_sent_at omitted): unchanged — checks against TODAY's
--     sent total + currently-active reservations (reservations actively hold
--     back today's pool, so they matter here).
--   - Backdated log (p_sent_at given): checks against THAT DAY's other
--     transfer_logs only, ignoring reservations entirely — a reservation
--     active right now has nothing to do with what was actually sent on a
--     past day, so re-validating against it would be meaningless.
--
-- Also adds a free-text note column for manual log entries (e.g. "forgot to
-- log, sent via Roblox app directly"), and update_transfer_log for fixing a
-- mistaken entry (re-validated the same way a backdated log is).
-- Deleting a transfer_logs row is a plain client-side delete — RLS already
-- permits it (FOR ALL policy from migration 025) and a correction tool
-- doesn't need RPC-level ceremony for removing a row the user owns.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.transfer_logs ADD COLUMN IF NOT EXISTS note text;

DROP FUNCTION IF EXISTS public.record_transfer(uuid, integer, timestamptz);

CREATE OR REPLACE FUNCTION public.record_transfer(
  p_account_id     uuid,
  p_amount         integer,
  p_start_of_today timestamptz DEFAULT NULL,
  p_sent_at        timestamptz DEFAULT NULL,
  p_note           text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid        uuid := auth.uid();
  v_account    roblox_accounts%ROWTYPE;
  v_start      timestamptz := COALESCE(p_start_of_today, date_trunc('day', now()));
  v_sent_at    timestamptz := COALESCE(p_sent_at, now());
  v_backdated  boolean := p_sent_at IS NOT NULL;
  v_day_start  timestamptz;
  v_existing   integer;
  v_sent_today integer;
  v_reserved   integer;
  v_new_id     uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;

  SELECT * INTO v_account FROM roblox_accounts WHERE id = p_account_id AND user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Account not found or access denied'; END IF;

  IF v_backdated THEN
    v_day_start := date_trunc('day', v_sent_at);
    SELECT COALESCE(SUM(amount), 0) INTO v_existing
    FROM transfer_logs
    WHERE roblox_account_id = p_account_id AND user_id = v_uid
      AND sent_at >= v_day_start AND sent_at < v_day_start + interval '1 day';

    IF v_existing + p_amount > 500 THEN
      RAISE EXCEPTION 'Would exceed the 500 R$ limit for that day (already logged % + this %)', v_existing, p_amount;
    END IF;
  ELSE
    SELECT COALESCE(SUM(amount), 0) INTO v_sent_today
    FROM transfer_logs WHERE roblox_account_id = p_account_id AND user_id = v_uid AND sent_at >= v_start;

    SELECT COALESCE(SUM(amount), 0) INTO v_reserved
    FROM transfer_reservations WHERE roblox_account_id = p_account_id AND user_id = v_uid AND status = 'reserved';

    IF v_sent_today + v_reserved + p_amount > 500 THEN
      RAISE EXCEPTION 'Would exceed the 500 R$ daily limit (sent % + reserved % + this %)', v_sent_today, v_reserved, p_amount;
    END IF;
  END IF;

  INSERT INTO transfer_logs (user_id, roblox_account_id, amount, sent_at, note)
  VALUES (v_uid, p_account_id, p_amount, v_sent_at, p_note)
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object('success', true, 'id', v_new_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_transfer(uuid, integer, timestamptz, timestamptz, text) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: update_transfer_log — corrects an existing entry's amount/time/note.
-- Re-validated against that day's OTHER entries (excluding itself), same
-- reservation-agnostic rule as a backdated log above.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_transfer_log(
  p_log_id  uuid,
  p_amount  integer,
  p_sent_at timestamptz,
  p_note    text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_log       transfer_logs%ROWTYPE;
  v_day_start timestamptz := date_trunc('day', p_sent_at);
  v_existing  integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;

  SELECT * INTO v_log FROM transfer_logs WHERE id = p_log_id AND user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transfer log not found or access denied'; END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_existing
  FROM transfer_logs
  WHERE roblox_account_id = v_log.roblox_account_id AND user_id = v_uid AND id != p_log_id
    AND sent_at >= v_day_start AND sent_at < v_day_start + interval '1 day';

  IF v_existing + p_amount > 500 THEN
    RAISE EXCEPTION 'Would exceed the 500 R$ limit for that day (other entries % + this %)', v_existing, p_amount;
  END IF;

  UPDATE transfer_logs SET amount = p_amount, sent_at = p_sent_at, note = p_note WHERE id = p_log_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_transfer_log(uuid, integer, timestamptz, text) TO authenticated;
