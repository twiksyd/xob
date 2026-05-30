-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 005: Robux Reservation System
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New Query → Run All)
-- Safe to run multiple times (idempotent).
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. robux_reservations table
--
-- One active reservation per order (enforced by partial unique index).
-- Reservations are never deleted — they are marked released for audit history.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.robux_reservations (
  id             uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id       uuid        NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  account_id     uuid        NOT NULL REFERENCES public.roblox_accounts(id) ON DELETE CASCADE,
  robux_amount   integer     NOT NULL CHECK (robux_amount > 0),
  gamepass_names text        NOT NULL DEFAULT '',
  status         text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'released')),
  released_at    timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Only one active reservation allowed per order at any time
CREATE UNIQUE INDEX IF NOT EXISTS idx_reservations_order_active
  ON public.robux_reservations (order_id)
  WHERE status = 'active';

-- Fast lookup for the accounts page panel
CREATE INDEX IF NOT EXISTS idx_reservations_user_status
  ON public.robux_reservations (user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reservations_account_status
  ON public.robux_reservations (account_id, status)
  WHERE status = 'active';

ALTER TABLE public.robux_reservations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'robux_reservations' AND policyname = 'Users manage own reservations'
  ) THEN
    CREATE POLICY "Users manage own reservations"
      ON public.robux_reservations
      FOR ALL
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. RPC: reserve_order_robux
--
-- Creates or replaces the active reservation for an order.
-- If a reservation already exists for the same order (possibly on a different
-- account or with a different amount), it is released first and a new one is
-- created. This makes the function safe to call on every order save.
--
-- Atomically updates roblox_accounts.reserved_robux.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.reserve_order_robux(
  p_order_id       uuid,
  p_account_id     uuid,
  p_robux_amount   integer,
  p_gamepass_names text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_existing robux_reservations%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Lock any existing active reservation for this order
  SELECT * INTO v_existing
  FROM robux_reservations
  WHERE order_id = p_order_id AND status = 'active'
  FOR UPDATE;

  IF FOUND THEN
    -- Release old reservation: decrement reserved_robux on old account
    UPDATE roblox_accounts SET
      reserved_robux = GREATEST(0, reserved_robux - v_existing.robux_amount),
      updated_at     = now()
    WHERE id = v_existing.account_id;

    -- Mark reservation as released
    UPDATE robux_reservations SET
      status      = 'released',
      released_at = now()
    WHERE id = v_existing.id;
  END IF;

  -- Create new active reservation
  INSERT INTO robux_reservations (
    user_id, order_id, account_id, robux_amount, gamepass_names
  ) VALUES (
    v_uid, p_order_id, p_account_id, p_robux_amount, p_gamepass_names
  );

  -- Increment reserved_robux on new account
  UPDATE roblox_accounts SET
    reserved_robux = reserved_robux + p_robux_amount,
    updated_at     = now()
  WHERE id = p_account_id AND user_id = v_uid;

  RETURN jsonb_build_object('success', true, 'robux_reserved', p_robux_amount);
END;
$$;

GRANT EXECUTE ON FUNCTION public.reserve_order_robux(uuid, uuid, integer, text) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RPC: release_order_reservation
--
-- Releases the active reservation for an order without any other financial
-- effects. Called by the client edit path when a pending/paid order is moved
-- to completed/cancelled/refunded without going through transition_order.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.release_order_reservation(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_res robux_reservations%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_res
  FROM robux_reservations
  WHERE order_id = p_order_id AND status = 'active' AND user_id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', true, 'noop', true);
  END IF;

  UPDATE roblox_accounts SET
    reserved_robux = GREATEST(0, reserved_robux - v_res.robux_amount),
    updated_at     = now()
  WHERE id = v_res.account_id;

  UPDATE robux_reservations SET
    status      = 'released',
    released_at = now()
  WHERE id = v_res.id;

  RETURN jsonb_build_object('success', true, 'robux_released', v_res.robux_amount);
END;
$$;

GRANT EXECUTE ON FUNCTION public.release_order_reservation(uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Update transition_order
--
-- Adds reservation release for the previously unhandled case:
--   pending/paid → cancelled or refunded
--
-- This path existed in the function but had no financial effects at all,
-- so reserved_robux was never decremented. Now it releases the reservation.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.transition_order(
  p_order_id   uuid,
  p_new_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       uuid    := auth.uid();
  v_order     orders%ROWTYPE;
  v_account   roblox_accounts%ROWTYPE;
  v_rb_before integer;
  v_rb_after  integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_order
  FROM orders
  WHERE id = p_order_id AND user_id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found or access denied';
  END IF;

  IF v_order.status = p_new_status THEN
    RETURN jsonb_build_object('success', true, 'noop', true);
  END IF;

  -- ── any → completed ────────────────────────────────────────────────────────
  IF p_new_status = 'completed' AND v_order.status != 'completed' THEN

    IF v_order.roblox_account_id IS NOT NULL AND COALESCE(v_order.robux_amount, 0) > 0 THEN
      SELECT * INTO v_account
      FROM roblox_accounts WHERE id = v_order.roblox_account_id FOR UPDATE;

      v_rb_before := v_account.current_robux;
      v_rb_after  := GREATEST(0, v_rb_before - v_order.robux_amount);

      UPDATE roblox_accounts SET
        current_robux  = v_rb_after,
        reserved_robux = GREATEST(0, reserved_robux - COALESCE(v_order.robux_amount, 0)),
        updated_at     = now()
      WHERE id = v_order.roblox_account_id;

      -- Release the reservation record
      UPDATE robux_reservations SET
        status      = 'released',
        released_at = now()
      WHERE order_id = p_order_id AND status = 'active';

      INSERT INTO transactions (
        user_id, order_id, roblox_account_id, roblox_account_username,
        type, robux_change, balance_before, balance_after,
        selling_price, profit, description
      ) VALUES (
        v_uid, p_order_id, v_order.roblox_account_id, v_account.username,
        'sale', -v_order.robux_amount, v_rb_before, v_rb_after,
        v_order.selling_price, v_order.profit,
        'Order ' || COALESCE(v_order.order_number, p_order_id::text)
          || CASE WHEN v_order.buyer_name IS NOT NULL
               THEN ' — ' || v_order.buyer_name ELSE '' END
      );
    END IF;

    IF COALESCE(v_order.selling_price, 0) > 0 THEN
      INSERT INTO wallet_transactions (user_id, type, amount, category, description, reference_order_id)
      VALUES (
        v_uid, 'income', v_order.selling_price, 'Sale',
        'Order ' || COALESCE(v_order.order_number, '') || ' — '
          || COALESCE(v_order.buyer_name, 'Customer'),
        p_order_id
      );
    END IF;

  -- ── pending/paid → cancelled/refunded: release reservation only ───────────
  ELSIF v_order.status IN ('pending', 'paid') AND p_new_status IN ('cancelled', 'refunded') THEN

    IF v_order.roblox_account_id IS NOT NULL AND COALESCE(v_order.robux_amount, 0) > 0 THEN
      UPDATE roblox_accounts SET
        reserved_robux = GREATEST(0, reserved_robux - COALESCE(v_order.robux_amount, 0)),
        updated_at     = now()
      WHERE id = v_order.roblox_account_id;
    END IF;

    UPDATE robux_reservations SET
      status      = 'released',
      released_at = now()
    WHERE order_id = p_order_id AND status = 'active';

  -- ── completed → refunded/cancelled: restore Robux ─────────────────────────
  ELSIF v_order.status = 'completed' AND p_new_status IN ('refunded', 'cancelled') THEN

    IF v_order.roblox_account_id IS NOT NULL AND COALESCE(v_order.robux_amount, 0) > 0 THEN
      SELECT * INTO v_account
      FROM roblox_accounts WHERE id = v_order.roblox_account_id FOR UPDATE;

      v_rb_before := v_account.current_robux;
      v_rb_after  := v_rb_before + v_order.robux_amount;

      UPDATE roblox_accounts SET
        current_robux = v_rb_after,
        updated_at    = now()
      WHERE id = v_order.roblox_account_id;

      INSERT INTO transactions (
        user_id, order_id, roblox_account_id, roblox_account_username,
        type, robux_change, balance_before, balance_after,
        selling_price, profit, description
      ) VALUES (
        v_uid, p_order_id, v_order.roblox_account_id, v_account.username,
        'refund', v_order.robux_amount, v_rb_before, v_rb_after,
        v_order.selling_price, v_order.profit,
        CASE p_new_status WHEN 'refunded' THEN 'Refund' ELSE 'Cancellation' END
          || ': Order ' || COALESCE(v_order.order_number, '')
          || CASE WHEN v_order.buyer_name IS NOT NULL
               THEN ' — ' || v_order.buyer_name ELSE '' END
      );
    END IF;

    IF COALESCE(v_order.selling_price, 0) > 0 THEN
      INSERT INTO wallet_transactions (user_id, type, amount, category, description, reference_order_id)
      VALUES (
        v_uid, 'expense', -v_order.selling_price,
        CASE p_new_status WHEN 'refunded' THEN 'Refund Issued' ELSE 'Cancellation' END,
        CASE p_new_status WHEN 'refunded' THEN 'Refund' ELSE 'Cancellation' END
          || ': Order ' || COALESCE(v_order.order_number, '')
          || CASE WHEN v_order.buyer_name IS NOT NULL
               THEN ' — ' || v_order.buyer_name ELSE '' END,
        p_order_id
      );
    END IF;

  END IF;

  UPDATE orders SET status = p_new_status WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'success',     true,
    'prev_status', v_order.status,
    'new_status',  p_new_status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.transition_order(uuid, text) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Update delete_order: clean reservation records on deletion
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.delete_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_order     orders%ROWTYPE;
  v_account   roblox_accounts%ROWTYPE;
  v_rb_before integer;
  v_rb_after  integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_order
  FROM orders WHERE id = p_order_id AND user_id = v_uid FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found or access denied';
  END IF;

  -- Completed: restore Robux
  IF v_order.status = 'completed'
      AND v_order.roblox_account_id IS NOT NULL
      AND COALESCE(v_order.robux_amount, 0) > 0 THEN

    SELECT * INTO v_account
    FROM roblox_accounts WHERE id = v_order.roblox_account_id FOR UPDATE;

    v_rb_before := v_account.current_robux;
    v_rb_after  := v_rb_before + v_order.robux_amount;

    UPDATE roblox_accounts SET current_robux = v_rb_after, updated_at = now()
    WHERE id = v_order.roblox_account_id;

    INSERT INTO transactions (
      user_id, order_id, roblox_account_id, roblox_account_username,
      type, robux_change, balance_before, balance_after, description
    ) VALUES (
      v_uid, p_order_id, v_order.roblox_account_id, v_account.username,
      'adjustment', v_order.robux_amount, v_rb_before, v_rb_after,
      'Deleted: Order ' || COALESCE(v_order.order_number, p_order_id::text)
    );

  -- Pending/paid: release the reservation
  ELSIF v_order.status IN ('pending', 'paid')
      AND v_order.roblox_account_id IS NOT NULL
      AND COALESCE(v_order.robux_amount, 0) > 0 THEN

    UPDATE roblox_accounts SET
      reserved_robux = GREATEST(0, reserved_robux - v_order.robux_amount),
      updated_at     = now()
    WHERE id = v_order.roblox_account_id;
  END IF;

  -- Clean reservation records (cascade also deletes on order delete, but be explicit)
  DELETE FROM robux_reservations WHERE order_id = p_order_id;

  IF v_order.status IN ('completed', 'refunded', 'cancelled') THEN
    DELETE FROM wallet_transactions WHERE reference_order_id = p_order_id;
  END IF;

  DELETE FROM order_items WHERE order_id = p_order_id;
  DELETE FROM orders      WHERE id       = p_order_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_order(uuid) TO authenticated;
