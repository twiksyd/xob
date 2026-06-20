-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 028: Daily Transfer Tracker — correct two-cap model
-- Run in Supabase SQL Editor. Safe to run multiple times (idempotent).
--
-- Corrects migration 027's mistake: the daily limit is 500 R$ (back to its
-- original value, NOT 1000), and 1000 R$ is actually a separate LIFETIME cap
-- per account that never resets — once an account has sent 1000 R$ total,
-- cumulative across all time, it can never instant-send again even though
-- its daily counter keeps resetting to 0 every midnight.
--
-- available = min(daily remaining, lifetime remaining), so whichever cap is
-- more restrictive wins. Active reservations count against BOTH caps (they
-- represent committed-but-not-yet-sent amounts that will become real sends
-- if fulfilled, so they have to be held back from both pools).
--
-- get_transfer_allowance_summary now also returns lifetime_sent so the UI
-- can show it; record_transfer / create_transfer_reservation /
-- update_transfer_log all re-validate against both caps.
-- ─────────────────────────────────────────────────────────────────────────────

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
  v_uid          uuid := auth.uid();
  v_account      roblox_accounts%ROWTYPE;
  v_start        timestamptz := COALESCE(p_start_of_today, date_trunc('day', now()));
  v_sent_at      timestamptz := COALESCE(p_sent_at, now());
  v_backdated    boolean := p_sent_at IS NOT NULL;
  v_day_start    timestamptz;
  v_day_existing integer;
  v_sent_today   integer;
  v_reserved     integer;
  v_lifetime     integer;
  v_new_id       uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;

  SELECT * INTO v_account FROM roblox_accounts WHERE id = p_account_id AND user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Account not found or access denied'; END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_reserved
  FROM transfer_reservations WHERE roblox_account_id = p_account_id AND user_id = v_uid AND status = 'reserved';

  SELECT COALESCE(SUM(amount), 0) INTO v_lifetime
  FROM transfer_logs WHERE roblox_account_id = p_account_id AND user_id = v_uid;

  IF v_lifetime + v_reserved + p_amount > 1000 THEN
    RAISE EXCEPTION 'Would exceed the 1000 R$ lifetime limit for this account (sent % + reserved % + this %)', v_lifetime, v_reserved, p_amount;
  END IF;

  IF v_backdated THEN
    v_day_start := date_trunc('day', v_sent_at);
    SELECT COALESCE(SUM(amount), 0) INTO v_day_existing
    FROM transfer_logs
    WHERE roblox_account_id = p_account_id AND user_id = v_uid
      AND sent_at >= v_day_start AND sent_at < v_day_start + interval '1 day';

    IF v_day_existing + p_amount > 500 THEN
      RAISE EXCEPTION 'Would exceed the 500 R$ daily limit for that day (already logged % + this %)', v_day_existing, p_amount;
    END IF;
  ELSE
    SELECT COALESCE(SUM(amount), 0) INTO v_sent_today
    FROM transfer_logs WHERE roblox_account_id = p_account_id AND user_id = v_uid AND sent_at >= v_start;

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

CREATE OR REPLACE FUNCTION public.create_transfer_reservation(
  p_account_id     uuid,
  p_amount         integer,
  p_customer_label text DEFAULT NULL,
  p_order_id       uuid DEFAULT NULL,
  p_note           text DEFAULT NULL,
  p_scheduled_for  timestamptz DEFAULT NULL,
  p_start_of_today timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid        uuid := auth.uid();
  v_account    roblox_accounts%ROWTYPE;
  v_sent_today integer;
  v_reserved   integer;
  v_lifetime   integer;
  v_start      timestamptz := COALESCE(p_start_of_today, date_trunc('day', now()));
  v_new_id     uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;

  SELECT * INTO v_account FROM roblox_accounts WHERE id = p_account_id AND user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Account not found or access denied'; END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_sent_today
  FROM transfer_logs WHERE roblox_account_id = p_account_id AND user_id = v_uid AND sent_at >= v_start;

  SELECT COALESCE(SUM(amount), 0) INTO v_reserved
  FROM transfer_reservations WHERE roblox_account_id = p_account_id AND user_id = v_uid AND status = 'reserved';

  SELECT COALESCE(SUM(amount), 0) INTO v_lifetime
  FROM transfer_logs WHERE roblox_account_id = p_account_id AND user_id = v_uid;

  IF v_sent_today + v_reserved + p_amount > 500 THEN
    RAISE EXCEPTION 'Would exceed the 500 R$ daily limit (sent % + reserved % + this %)', v_sent_today, v_reserved, p_amount;
  END IF;

  IF v_lifetime + v_reserved + p_amount > 1000 THEN
    RAISE EXCEPTION 'Would exceed the 1000 R$ lifetime limit for this account (sent % + reserved % + this %)', v_lifetime, v_reserved, p_amount;
  END IF;

  INSERT INTO transfer_reservations (user_id, roblox_account_id, amount, customer_label, order_id, note, scheduled_for)
  VALUES (v_uid, p_account_id, p_amount, p_customer_label, p_order_id, p_note, p_scheduled_for)
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object('success', true, 'id', v_new_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_transfer_reservation(uuid, integer, text, uuid, text, timestamptz, timestamptz) TO authenticated;

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
  v_uid            uuid := auth.uid();
  v_log            transfer_logs%ROWTYPE;
  v_day_start      timestamptz := date_trunc('day', p_sent_at);
  v_day_existing   integer;
  v_lifetime_other integer;
  v_reserved       integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Amount must be positive'; END IF;

  SELECT * INTO v_log FROM transfer_logs WHERE id = p_log_id AND user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Transfer log not found or access denied'; END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_day_existing
  FROM transfer_logs
  WHERE roblox_account_id = v_log.roblox_account_id AND user_id = v_uid AND id != p_log_id
    AND sent_at >= v_day_start AND sent_at < v_day_start + interval '1 day';

  IF v_day_existing + p_amount > 500 THEN
    RAISE EXCEPTION 'Would exceed the 500 R$ limit for that day (other entries % + this %)', v_day_existing, p_amount;
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO v_lifetime_other
  FROM transfer_logs WHERE roblox_account_id = v_log.roblox_account_id AND user_id = v_uid AND id != p_log_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_reserved
  FROM transfer_reservations WHERE roblox_account_id = v_log.roblox_account_id AND user_id = v_uid AND status = 'reserved';

  IF v_lifetime_other + v_reserved + p_amount > 1000 THEN
    RAISE EXCEPTION 'Would exceed the 1000 R$ lifetime limit for this account (other entries % + reserved % + this %)', v_lifetime_other, v_reserved, p_amount;
  END IF;

  UPDATE transfer_logs SET amount = p_amount, sent_at = p_sent_at, note = p_note WHERE id = p_log_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_transfer_log(uuid, integer, timestamptz, text) TO authenticated;

-- Return shape changed (added lifetime_sent) — CREATE OR REPLACE can't alter
-- a function's OUT columns, so the old version has to be dropped first.
DROP FUNCTION IF EXISTS public.get_transfer_allowance_summary(timestamptz);

CREATE OR REPLACE FUNCTION public.get_transfer_allowance_summary(p_start_of_today timestamptz DEFAULT NULL)
RETURNS TABLE (
  roblox_account_id uuid,
  sent_today        integer,
  reserved          integer,
  lifetime_sent     integer,
  available         integer,
  last_sent_at      timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH start AS (
    SELECT COALESCE(p_start_of_today, date_trunc('day', now())) AS v
  ),
  sent_today_cte AS (
    SELECT tl.roblox_account_id, SUM(tl.amount)::integer AS total, MAX(tl.sent_at) AS last_sent_at
    FROM transfer_logs tl, start
    WHERE tl.user_id = auth.uid() AND tl.sent_at >= start.v
    GROUP BY tl.roblox_account_id
  ),
  lifetime_cte AS (
    SELECT tl.roblox_account_id, SUM(tl.amount)::integer AS total
    FROM transfer_logs tl
    WHERE tl.user_id = auth.uid()
    GROUP BY tl.roblox_account_id
  ),
  reserved_cte AS (
    SELECT tr.roblox_account_id, SUM(tr.amount)::integer AS total
    FROM transfer_reservations tr
    WHERE tr.user_id = auth.uid() AND tr.status = 'reserved'
    GROUP BY tr.roblox_account_id
  )
  SELECT
    ra.id,
    COALESCE(sent_today_cte.total, 0),
    COALESCE(reserved_cte.total, 0),
    COALESCE(lifetime_cte.total, 0),
    GREATEST(0, LEAST(
      500  - COALESCE(sent_today_cte.total, 0) - COALESCE(reserved_cte.total, 0),
      1000 - COALESCE(lifetime_cte.total, 0)    - COALESCE(reserved_cte.total, 0)
    )),
    sent_today_cte.last_sent_at
  FROM roblox_accounts ra
  LEFT JOIN sent_today_cte ON sent_today_cte.roblox_account_id = ra.id
  LEFT JOIN lifetime_cte ON lifetime_cte.roblox_account_id = ra.id
  LEFT JOIN reserved_cte ON reserved_cte.roblox_account_id = ra.id
  WHERE ra.user_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.get_transfer_allowance_summary(timestamptz) TO authenticated;

NOTIFY pgrst, 'reload schema';
