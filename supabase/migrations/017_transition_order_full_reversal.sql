-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 017: transition_order — full reversal on completed → any status
-- Run in Supabase SQL Editor. Safe to run multiple times (idempotent).
--
-- Previously, the "completed → X" reversal branch (restore Robux, reverse
-- wallet income, reverse savings allocation) only fired for X IN
-- ('refunded', 'cancelled'). The Edit form also allows completed → pending
-- and completed → paid, which fell through to the no-op default and left
-- robux/wallet/savings untouched while the order's status silently changed —
-- a parallel, incomplete reversal path. This migration broadens the branch to
-- v_order.status = 'completed' AND p_new_status != 'completed', covering every
-- way a completed order can be un-completed, so transition_order is once again
-- the single, complete financial engine for all order status transitions.
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
  v_label     text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_order
  FROM orders WHERE id = p_order_id AND user_id = v_uid FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found or access denied'; END IF;

  IF v_order.status = p_new_status THEN
    RETURN jsonb_build_object('success', true, 'noop', true);
  END IF;

  -- ── any → completed ────────────────────────────────────────────────────────
  IF p_new_status = 'completed' AND v_order.status != 'completed' THEN

    IF v_order.roblox_account_id IS NOT NULL AND COALESCE(v_order.robux_amount, 0) > 0 THEN
      SELECT * INTO v_account FROM roblox_accounts WHERE id = v_order.roblox_account_id FOR UPDATE;
      v_rb_before := v_account.current_robux;
      v_rb_after  := GREATEST(0, v_rb_before - v_order.robux_amount);

      UPDATE roblox_accounts SET
        current_robux  = v_rb_after,
        reserved_robux = GREATEST(0, reserved_robux - COALESCE(v_order.robux_amount, 0)),
        updated_at     = now()
      WHERE id = v_order.roblox_account_id;

      UPDATE robux_reservations SET status = 'released', released_at = now()
      WHERE order_id = p_order_id AND status = 'active';

      INSERT INTO transactions (
        user_id, order_id, roblox_account_id, roblox_account_username,
        type, robux_change, balance_before, balance_after, selling_price, profit, description
      ) VALUES (
        v_uid, p_order_id, v_order.roblox_account_id, v_account.username,
        'sale', -v_order.robux_amount, v_rb_before, v_rb_after,
        v_order.selling_price, v_order.profit,
        'Order ' || COALESCE(v_order.order_number, p_order_id::text)
          || CASE WHEN v_order.buyer_name IS NOT NULL THEN ' — ' || v_order.buyer_name ELSE '' END
      );
    END IF;

    -- Credit wallet with full selling price
    IF COALESCE(v_order.selling_price, 0) > 0 THEN
      INSERT INTO wallet_transactions (user_id, type, amount, category, description, reference_order_id)
      VALUES (v_uid, 'income', v_order.selling_price, 'Sale',
        'Order ' || COALESCE(v_order.order_number, '') || ' — ' || COALESCE(v_order.buyer_name, 'Customer'),
        p_order_id);
    END IF;

    -- Allocate savings from profit
    IF COALESCE(v_order.profit, 0) > 0 THEN
      PERFORM public.allocate_order_savings(
        v_uid, p_order_id, v_order.profit,
        v_order.order_number, v_order.buyer_name
      );
    END IF;

  -- ── pending/paid → cancelled/refunded: release reservation ────────────────
  ELSIF v_order.status IN ('pending', 'paid') AND p_new_status IN ('cancelled', 'refunded') THEN

    IF v_order.roblox_account_id IS NOT NULL AND COALESCE(v_order.robux_amount, 0) > 0 THEN
      UPDATE roblox_accounts SET
        reserved_robux = GREATEST(0, reserved_robux - COALESCE(v_order.robux_amount, 0)),
        updated_at = now()
      WHERE id = v_order.roblox_account_id;
    END IF;

    UPDATE robux_reservations SET status = 'released', released_at = now()
    WHERE order_id = p_order_id AND status = 'active';

  -- ── completed → any other status: restore Robux + reverse wallet/savings ──
  ELSIF v_order.status = 'completed' AND p_new_status != 'completed' THEN

    IF v_order.roblox_account_id IS NOT NULL AND COALESCE(v_order.robux_amount, 0) > 0 THEN
      SELECT * INTO v_account FROM roblox_accounts WHERE id = v_order.roblox_account_id FOR UPDATE;
      v_rb_before := v_account.current_robux;
      v_rb_after  := v_rb_before + v_order.robux_amount;

      UPDATE roblox_accounts SET current_robux = v_rb_after, updated_at = now()
      WHERE id = v_order.roblox_account_id;

      v_label := CASE p_new_status
        WHEN 'refunded'  THEN 'Refund'
        WHEN 'cancelled' THEN 'Cancellation'
        ELSE 'Reverted to ' || p_new_status
      END;

      INSERT INTO transactions (
        user_id, order_id, roblox_account_id, roblox_account_username,
        type, robux_change, balance_before, balance_after, selling_price, profit, description
      ) VALUES (
        v_uid, p_order_id, v_order.roblox_account_id, v_account.username,
        CASE WHEN p_new_status IN ('refunded', 'cancelled') THEN 'refund' ELSE 'adjustment' END,
        v_order.robux_amount, v_rb_before, v_rb_after,
        v_order.selling_price, v_order.profit,
        v_label || ': Order ' || COALESCE(v_order.order_number, '')
          || CASE WHEN v_order.buyer_name IS NOT NULL THEN ' — ' || v_order.buyer_name ELSE '' END
      );
    END IF;

    IF COALESCE(v_order.selling_price, 0) > 0 THEN
      v_label := CASE p_new_status
        WHEN 'refunded'  THEN 'Refund'
        WHEN 'cancelled' THEN 'Cancellation'
        ELSE 'Reverted to ' || p_new_status
      END;

      INSERT INTO wallet_transactions (user_id, type, amount, category, description, reference_order_id)
      VALUES (
        v_uid, 'expense', -v_order.selling_price,
        CASE p_new_status
          WHEN 'refunded'  THEN 'Refund Issued'
          WHEN 'cancelled' THEN 'Cancellation'
          ELSE 'Reversal'
        END,
        v_label || ': Order ' || COALESCE(v_order.order_number, '')
          || CASE WHEN v_order.buyer_name IS NOT NULL THEN ' — ' || v_order.buyer_name ELSE '' END,
        p_order_id
      );
    END IF;

    -- Reverse savings allocation
    PERFORM public.reverse_order_savings(v_uid, p_order_id);

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
