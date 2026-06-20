-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 027: Daily Transfer Tracker — correct limit to 1000 R$/day
-- Run in Supabase SQL Editor. Safe to run multiple times (idempotent).
--
-- The actual Roblox daily instant-transfer limit is 1000 R$, not 500 — this
-- corrects record_transfer, create_transfer_reservation, update_transfer_log,
-- and get_transfer_allowance_summary, all of which had 500 hardcoded.
--
-- Signatures are unchanged from migrations 025/026, so CREATE OR REPLACE is
-- enough here — no DROP needed.
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

    IF v_existing + p_amount > 1000 THEN
      RAISE EXCEPTION 'Would exceed the 1000 R$ limit for that day (already logged % + this %)', v_existing, p_amount;
    END IF;
  ELSE
    SELECT COALESCE(SUM(amount), 0) INTO v_sent_today
    FROM transfer_logs WHERE roblox_account_id = p_account_id AND user_id = v_uid AND sent_at >= v_start;

    SELECT COALESCE(SUM(amount), 0) INTO v_reserved
    FROM transfer_reservations WHERE roblox_account_id = p_account_id AND user_id = v_uid AND status = 'reserved';

    IF v_sent_today + v_reserved + p_amount > 1000 THEN
      RAISE EXCEPTION 'Would exceed the 1000 R$ daily limit (sent % + reserved % + this %)', v_sent_today, v_reserved, p_amount;
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

  IF v_sent_today + v_reserved + p_amount > 1000 THEN
    RAISE EXCEPTION 'Would exceed the 1000 R$ daily limit (sent % + reserved % + this %)', v_sent_today, v_reserved, p_amount;
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

  IF v_existing + p_amount > 1000 THEN
    RAISE EXCEPTION 'Would exceed the 1000 R$ limit for that day (other entries % + this %)', v_existing, p_amount;
  END IF;

  UPDATE transfer_logs SET amount = p_amount, sent_at = p_sent_at, note = p_note WHERE id = p_log_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_transfer_log(uuid, integer, timestamptz, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_transfer_allowance_summary(p_start_of_today timestamptz DEFAULT NULL)
RETURNS TABLE (
  roblox_account_id uuid,
  sent_today        integer,
  reserved          integer,
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
  sent AS (
    SELECT tl.roblox_account_id, SUM(tl.amount)::integer AS total, MAX(tl.sent_at) AS last_sent_at
    FROM transfer_logs tl, start
    WHERE tl.user_id = auth.uid() AND tl.sent_at >= start.v
    GROUP BY tl.roblox_account_id
  ),
  reserved AS (
    SELECT tr.roblox_account_id, SUM(tr.amount)::integer AS total
    FROM transfer_reservations tr
    WHERE tr.user_id = auth.uid() AND tr.status = 'reserved'
    GROUP BY tr.roblox_account_id
  )
  SELECT
    ra.id,
    COALESCE(sent.total, 0),
    COALESCE(reserved.total, 0),
    1000 - COALESCE(sent.total, 0) - COALESCE(reserved.total, 0),
    sent.last_sent_at
  FROM roblox_accounts ra
  LEFT JOIN sent ON sent.roblox_account_id = ra.id
  LEFT JOIN reserved ON reserved.roblox_account_id = ra.id
  WHERE ra.user_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.get_transfer_allowance_summary(timestamptz) TO authenticated;

-- Force PostgREST to pick up the function changes immediately rather than
-- waiting for its periodic schema-cache refresh.
NOTIFY pgrst, 'reload schema';
