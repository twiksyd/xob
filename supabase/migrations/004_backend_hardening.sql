-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 004: Backend Architecture Hardening (Phase 5)
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New Query → Run All)
-- Safe to run multiple times (idempotent).
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Schema additions
-- ─────────────────────────────────────────────────────────────────────────────

-- Add refunded_at timestamp (was missing from original schema)
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS refunded_at timestamptz;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Fix order number generation (race-condition safe)
--
-- The original generate_order_number() used COUNT(*)+1 which has a race
-- condition: two concurrent inserts both get count=N, both try ORD-000N,
-- one fails with a UNIQUE violation. Also: deleting an order and creating
-- a new one reuses the number.
--
-- Replacement: a proper Postgres sequence (gap-safe, concurrent-safe).
-- The trigger name stays the same; we only replace the function body.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE SEQUENCE IF NOT EXISTS public.order_number_seq START 1000;

CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER AS $$
BEGIN
  IF NEW.order_number IS NULL THEN
    NEW.order_number := 'ORD-' || LPAD(nextval('public.order_number_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END;
$$;
-- Trigger already exists (set_order_number); re-creating the function is enough.
-- Backfill existing orders that have NULL order_number:
UPDATE public.orders
SET order_number = 'ORD-' || LPAD(nextval('public.order_number_seq')::text, 5, '0')
WHERE order_number IS NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Status timestamp auto-population
--
-- handle_order_completion was dropped in migration 002. This re-adds only the
-- timestamp portion (paid_at, completed_at, refunded_at) without any
-- Robux deduction — that is now handled atomically inside transition_order().
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.orders_set_status_timestamps()
RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'paid'      AND OLD.status != 'paid'      THEN NEW.paid_at      := now(); END IF;
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN NEW.completed_at  := now(); END IF;
    IF NEW.status = 'refunded'  AND OLD.status != 'refunded'  THEN NEW.refunded_at   := now(); END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_status_timestamps ON public.orders;
CREATE TRIGGER orders_status_timestamps
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.orders_set_status_timestamps();

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RPC: transition_order
--
-- Atomically transitions an order to a new status, applying all financial
-- effects inside a single transaction:
--   • any → completed   : deduct Robux + write transactions audit + credit wallet
--   • completed → refunded/cancelled : restore Robux + write audit + reverse wallet
--   • anything else     : status update only (no financial effects)
--
-- Uses auth.uid() — never trusts a client-supplied user_id.
-- Row-level FOR UPDATE lock prevents concurrent transitions on the same order.
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
  -- Auth guard (belt-and-suspenders; RLS also protects)
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Lock the order row — prevents two concurrent calls racing on the same order
  SELECT * INTO v_order
  FROM orders
  WHERE id = p_order_id AND user_id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found or access denied';
  END IF;

  -- No-op: already in target status
  IF v_order.status = p_new_status THEN
    RETURN jsonb_build_object('success', true, 'noop', true);
  END IF;

  -- ── Completing an order ───────────────────────────────────────────────────
  IF p_new_status = 'completed' AND v_order.status != 'completed' THEN

    -- Deduct Robux and write the immutable audit record
    IF v_order.roblox_account_id IS NOT NULL AND COALESCE(v_order.robux_amount, 0) > 0 THEN
      SELECT * INTO v_account
      FROM roblox_accounts WHERE id = v_order.roblox_account_id FOR UPDATE;

      v_rb_before := v_account.current_robux;
      v_rb_after  := GREATEST(0, v_rb_before - v_order.robux_amount);

      UPDATE roblox_accounts SET
        current_robux  = v_rb_after,
        reserved_robux = GREATEST(0, reserved_robux - v_order.robux_amount),
        updated_at     = now()
      WHERE id = v_order.roblox_account_id;

      INSERT INTO transactions (
        user_id, order_id, roblox_account_id, roblox_account_username,
        type, robux_change, balance_before, balance_after,
        selling_price, profit, description
      ) VALUES (
        v_uid, p_order_id, v_order.roblox_account_id, v_account.username,
        'sale',
        -v_order.robux_amount,
        v_rb_before, v_rb_after,
        v_order.selling_price, v_order.profit,
        'Order ' || COALESCE(v_order.order_number, p_order_id::text)
          || CASE WHEN v_order.buyer_name IS NOT NULL
               THEN ' — ' || v_order.buyer_name
               ELSE '' END
      );
    END IF;

    -- Credit wallet
    IF COALESCE(v_order.selling_price, 0) > 0 THEN
      INSERT INTO wallet_transactions (
        user_id, type, amount, category, description, reference_order_id
      ) VALUES (
        v_uid, 'income', v_order.selling_price, 'Sale',
        'Order ' || COALESCE(v_order.order_number, '') || ' — '
          || COALESCE(v_order.buyer_name, 'Customer'),
        p_order_id
      );
    END IF;

  -- ── Refunding or cancelling a previously completed order ─────────────────
  ELSIF v_order.status = 'completed' AND p_new_status IN ('refunded', 'cancelled') THEN

    -- Restore Robux and write audit record
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
        'refund',
        v_order.robux_amount,
        v_rb_before, v_rb_after,
        v_order.selling_price, v_order.profit,
        CASE p_new_status
          WHEN 'refunded'  THEN 'Refund'
          ELSE 'Cancellation'
        END || ': Order ' || COALESCE(v_order.order_number, '')
          || CASE WHEN v_order.buyer_name IS NOT NULL
               THEN ' — ' || v_order.buyer_name
               ELSE '' END
      );
    END IF;

    -- Reverse wallet income
    IF COALESCE(v_order.selling_price, 0) > 0 THEN
      INSERT INTO wallet_transactions (
        user_id, type, amount, category, description, reference_order_id
      ) VALUES (
        v_uid, 'expense', -v_order.selling_price,
        CASE p_new_status WHEN 'refunded' THEN 'Refund Issued' ELSE 'Cancellation' END,
        CASE p_new_status WHEN 'refunded' THEN 'Refund' ELSE 'Cancellation' END
          || ': Order ' || COALESCE(v_order.order_number, '')
          || CASE WHEN v_order.buyer_name IS NOT NULL
               THEN ' — ' || v_order.buyer_name
               ELSE '' END,
        p_order_id
      );
    END IF;

  END IF;

  -- Update status (triggers set paid_at / completed_at / refunded_at automatically)
  UPDATE orders SET status = p_new_status WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'success',      true,
    'prev_status',  v_order.status,
    'new_status',   p_new_status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.transition_order(uuid, text) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RPC: delete_order
--
-- Atomically deletes an order and reverses all financial effects:
--   • completed   → restore Robux + delete wallet entries + write audit record
--   • pending/paid → release reserved_robux
--   • refunded/cancelled → delete orphaned wallet entries only
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.delete_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_order   orders%ROWTYPE;
  v_account roblox_accounts%ROWTYPE;
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

  -- Restore Robux for completed orders
  IF v_order.status = 'completed'
      AND v_order.roblox_account_id IS NOT NULL
      AND COALESCE(v_order.robux_amount, 0) > 0 THEN

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
      type, robux_change, balance_before, balance_after, description
    ) VALUES (
      v_uid, p_order_id, v_order.roblox_account_id, v_account.username,
      'adjustment',
      v_order.robux_amount,
      v_rb_before, v_rb_after,
      'Deleted: Order ' || COALESCE(v_order.order_number, p_order_id::text)
    );

  -- Release reserved Robux for pending/paid orders (never deducted, just reserved)
  ELSIF v_order.status IN ('pending', 'paid')
      AND v_order.roblox_account_id IS NOT NULL
      AND COALESCE(v_order.robux_amount, 0) > 0 THEN

    UPDATE roblox_accounts SET
      reserved_robux = GREATEST(0, reserved_robux - v_order.robux_amount),
      updated_at     = now()
    WHERE id = v_order.roblox_account_id;
  END IF;

  -- Clean wallet entries for any status that could have financial records.
  -- Completed orders have a Sale entry; refunded/cancelled have Sale + Reversal.
  -- Deleting them together prevents permanent orphaned clutter in wallet history.
  IF v_order.status IN ('completed', 'refunded', 'cancelled') THEN
    DELETE FROM wallet_transactions WHERE reference_order_id = p_order_id;
  END IF;

  -- order_items has ON DELETE CASCADE but we delete explicitly for clarity
  DELETE FROM order_items WHERE order_id = p_order_id;
  DELETE FROM orders      WHERE id = p_order_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_order(uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Performance indexes
-- ─────────────────────────────────────────────────────────────────────────────

-- Cursor-based pagination: lt('created_at', cursor) on user's orders
CREATE INDEX IF NOT EXISTS idx_orders_user_created_at
  ON public.orders (user_id, created_at DESC);

-- Fast wallet entry lookup by order reference (used in delete cleanup)
CREATE INDEX IF NOT EXISTS idx_wallet_txns_reference_order
  ON public.wallet_transactions (reference_order_id)
  WHERE reference_order_id IS NOT NULL;

-- Fast transactions lookup by order (used in Transactions page join)
CREATE INDEX IF NOT EXISTS idx_transactions_order_id
  ON public.transactions (order_id)
  WHERE order_id IS NOT NULL;
