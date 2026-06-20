-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 025: Daily Transfer Tracker + Reservation System
-- Run in Supabase SQL Editor. Safe to run multiple times (idempotent), except
-- the DROP TABLE step at the bottom, which is one-way.
--
-- Replaces instant_send_logs (migrations 023-024), which could only model
-- "sent or not" — one row per day. This models partial amounts (50/100/250/
-- custom) plus a reservation queue for customers who want delivery later or
-- after the daily reset.
--
-- Two tables, mirroring the existing transactions/robux_reservations split:
--   transfer_reservations — small mutable lifecycle (reserved -> fulfilled/
--     cancelled), kept forever for audit. NOT date-scoped: a reservation made
--     today for "tomorrow 12:00 AM" stays active across the reset, still
--     holding its chunk of the (now fresh) allowance until fulfilled/cancelled.
--   transfer_logs — append-only, permanent record of actual sends. Never
--     updated or deleted by the app.
--
-- Validation ("sent + reserved can never exceed 500") happens server-side in
-- the RPCs below, with the account row locked first — the same pattern
-- transition_order/adjust_account_field already use — so two concurrent
-- requests for the same account can't both pass a stale check (the second
-- blocks until the first's transaction commits, then re-checks against the
-- now-current totals).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.transfer_reservations (
  id                uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  roblox_account_id uuid        NOT NULL REFERENCES public.roblox_accounts(id) ON DELETE CASCADE,
  amount            integer     NOT NULL CHECK (amount > 0),
  customer_label    text,
  order_id          uuid        REFERENCES public.orders(id) ON DELETE SET NULL,
  note              text,
  scheduled_for     timestamptz,
  status            text        NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved', 'fulfilled', 'cancelled')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  fulfilled_at      timestamptz,
  cancelled_at      timestamptz
);

CREATE TABLE IF NOT EXISTS public.transfer_logs (
  id                uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  roblox_account_id uuid        NOT NULL REFERENCES public.roblox_accounts(id) ON DELETE CASCADE,
  amount            integer     NOT NULL CHECK (amount > 0),
  reservation_id    uuid        REFERENCES public.transfer_reservations(id) ON DELETE SET NULL,
  sent_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transfer_reservations_account_status
  ON public.transfer_reservations (roblox_account_id, status);
CREATE INDEX IF NOT EXISTS idx_transfer_logs_account_sent_at
  ON public.transfer_logs (roblox_account_id, sent_at DESC);

ALTER TABLE public.transfer_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transfer_logs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'transfer_reservations' AND policyname = 'Users manage own transfer reservations') THEN
    CREATE POLICY "Users manage own transfer reservations"
      ON public.transfer_reservations FOR ALL
      USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'transfer_logs' AND policyname = 'Users manage own transfer logs') THEN
    CREATE POLICY "Users manage own transfer logs"
      ON public.transfer_logs FOR ALL
      USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: record_transfer — a direct +50/+100/+250/custom send, not via a
-- reservation. Validates the 500 ceiling, then logs it.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.record_transfer(
  p_account_id     uuid,
  p_amount         integer,
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

  IF v_sent_today + v_reserved + p_amount > 500 THEN
    RAISE EXCEPTION 'Would exceed the 500 R$ daily limit (sent % + reserved % + this %)', v_sent_today, v_reserved, p_amount;
  END IF;

  INSERT INTO transfer_logs (user_id, roblox_account_id, amount)
  VALUES (v_uid, p_account_id, p_amount)
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object('success', true, 'id', v_new_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_transfer(uuid, integer, timestamptz) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: create_transfer_reservation — earmarks part of today's allowance for a
-- customer without sending yet. Same 500 ceiling validation as record_transfer.
-- ─────────────────────────────────────────────────────────────────────────────
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

  IF v_sent_today + v_reserved + p_amount > 500 THEN
    RAISE EXCEPTION 'Would exceed the 500 R$ daily limit (sent % + reserved % + this %)', v_sent_today, v_reserved, p_amount;
  END IF;

  INSERT INTO transfer_reservations (user_id, roblox_account_id, amount, customer_label, order_id, note, scheduled_for)
  VALUES (v_uid, p_account_id, p_amount, p_customer_label, p_order_id, p_note, p_scheduled_for)
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object('success', true, 'id', v_new_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_transfer_reservation(uuid, integer, text, uuid, text, timestamptz, timestamptz) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: fulfill_transfer_reservation — moves a reservation's amount from
-- Reserved to Sent: inserts the transfer_logs row, marks the reservation
-- fulfilled. No re-validation needed — the amount was already accounted for
-- in the 500 ceiling at reservation time, and this doesn't add any new amount.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.fulfill_transfer_reservation(p_reservation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_res    transfer_reservations%ROWTYPE;
  v_log_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_res FROM transfer_reservations WHERE id = p_reservation_id AND user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reservation not found or access denied'; END IF;
  IF v_res.status != 'reserved' THEN RAISE EXCEPTION 'Reservation is not active (status: %)', v_res.status; END IF;

  INSERT INTO transfer_logs (user_id, roblox_account_id, amount, reservation_id)
  VALUES (v_uid, v_res.roblox_account_id, v_res.amount, v_res.id)
  RETURNING id INTO v_log_id;

  UPDATE transfer_reservations SET status = 'fulfilled', fulfilled_at = now() WHERE id = p_reservation_id;

  RETURN jsonb_build_object('success', true, 'log_id', v_log_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.fulfill_transfer_reservation(uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: cancel_transfer_reservation — releases a reservation without sending
-- anything. No transfer_logs row.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.cancel_transfer_reservation(p_reservation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_res transfer_reservations%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_res FROM transfer_reservations WHERE id = p_reservation_id AND user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reservation not found or access denied'; END IF;
  IF v_res.status != 'reserved' THEN RAISE EXCEPTION 'Reservation is not active (status: %)', v_res.status; END IF;

  UPDATE transfer_reservations SET status = 'cancelled', cancelled_at = now() WHERE id = p_reservation_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_transfer_reservation(uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: get_transfer_allowance_summary — sent/reserved/available for every
-- account in one query, aggregated server-side (same pattern as
-- get_wallet_summary/get_sales_summary) so the client never has to pull and
-- sum the full (permanently-growing) transfer_logs history itself.
-- Also returns last_sent_at for the "Most Recently Used" sort.
-- ─────────────────────────────────────────────────────────────────────────────
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
    500 - COALESCE(sent.total, 0) - COALESCE(reserved.total, 0),
    sent.last_sent_at
  FROM roblox_accounts ra
  LEFT JOIN sent ON sent.roblox_account_id = ra.id
  LEFT JOIN reserved ON reserved.roblox_account_id = ra.id
  WHERE ra.user_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.get_transfer_allowance_summary(timestamptz) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Cleanup: drop the simplistic version this replaces. One-way — comment out
-- if you want to keep the old table around for any reason.
-- ─────────────────────────────────────────────────────────────────────────────
DROP TABLE IF EXISTS public.instant_send_logs;
