-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 036: Plus accounts — Robux fulfillment discount (corrected model)
-- Run in Supabase SQL Editor. Safe to run multiple times (idempotent).
--
-- Correction to migration 035's approach: Roblox Plus does NOT discount an
-- account's cost rate (₱/1,000 R$) — that stays untouched everywhere
-- (inventory/capital/business valuation, cost-per-1000 displays). What Plus
-- actually does is let the account spend ~10% less Robux to deliver the same
-- gamepass when an order is fulfilled through it.
--
-- effective_robux_amount snapshots, at order creation/edit time, the actual
-- amount that should move against roblox_accounts.current_robux /
-- reserved_robux for this order (same pattern as the existing account_rate_used
-- snapshot — computed once client-side, never recomputed server-side).
-- orders.robux_amount keeps its original meaning: the nominal Robux amount of
-- the gamepass(es) sold, unrelated to which account fulfills it (used for
-- buyer-facing display, order_items, and sales-volume reporting).
--
-- transition_order / delete_order / reassign_order_account are the only RPCs
-- that read robux_amount directly to move real account balances — each now
-- falls back to robux_amount when effective_robux_amount is null (orders
-- created before this migration). reserve_order_robux / release_order_reservation
-- need no change: they already just store/release whatever amount the caller
-- gives them via robux_reservations.robux_amount.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS effective_robux_amount integer;

-- ── transition_order ────────────────────────────────────────────────────────
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
  v_amount    integer;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_order
  FROM orders WHERE id = p_order_id AND user_id = v_uid FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found or access denied'; END IF;

  IF v_order.status = p_new_status THEN
    RETURN jsonb_build_object('success', true, 'noop', true);
  END IF;

  v_amount := COALESCE(v_order.effective_robux_amount, v_order.robux_amount, 0);

  -- ── any → completed ────────────────────────────────────────────────────────
  IF p_new_status = 'completed' AND v_order.status != 'completed' THEN

    IF v_order.roblox_account_id IS NOT NULL AND v_amount > 0 THEN
      SELECT * INTO v_account FROM roblox_accounts WHERE id = v_order.roblox_account_id FOR UPDATE;
      v_rb_before := v_account.current_robux;
      v_rb_after  := GREATEST(0, v_rb_before - v_amount);

      UPDATE roblox_accounts SET
        current_robux  = v_rb_after,
        reserved_robux = GREATEST(0, reserved_robux - v_amount),
        updated_at     = now()
      WHERE id = v_order.roblox_account_id;

      UPDATE robux_reservations SET status = 'released', released_at = now()
      WHERE order_id = p_order_id AND status = 'active';

      INSERT INTO transactions (
        user_id, order_id, roblox_account_id, roblox_account_username,
        type, robux_change, balance_before, balance_after, selling_price, profit, description
      ) VALUES (
        v_uid, p_order_id, v_order.roblox_account_id, v_account.username,
        'sale', -v_amount, v_rb_before, v_rb_after,
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

    IF v_order.roblox_account_id IS NOT NULL AND v_amount > 0 THEN
      UPDATE roblox_accounts SET
        reserved_robux = GREATEST(0, reserved_robux - v_amount),
        updated_at = now()
      WHERE id = v_order.roblox_account_id;
    END IF;

    UPDATE robux_reservations SET status = 'released', released_at = now()
    WHERE order_id = p_order_id AND status = 'active';

  -- ── completed → any other status: restore Robux + reverse wallet/savings ──
  ELSIF v_order.status = 'completed' AND p_new_status != 'completed' THEN

    IF v_order.roblox_account_id IS NOT NULL AND v_amount > 0 THEN
      SELECT * INTO v_account FROM roblox_accounts WHERE id = v_order.roblox_account_id FOR UPDATE;
      v_rb_before := v_account.current_robux;
      v_rb_after  := v_rb_before + v_amount;

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
        v_amount, v_rb_before, v_rb_after,
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

-- ── delete_order ────────────────────────────────────────────────────────────
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
  v_amount    integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_order
  FROM orders WHERE id = p_order_id AND user_id = v_uid FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found or access denied';
  END IF;

  v_amount := COALESCE(v_order.effective_robux_amount, v_order.robux_amount, 0);

  -- Completed: restore Robux
  IF v_order.status = 'completed'
      AND v_order.roblox_account_id IS NOT NULL
      AND v_amount > 0 THEN

    SELECT * INTO v_account
    FROM roblox_accounts WHERE id = v_order.roblox_account_id FOR UPDATE;

    v_rb_before := v_account.current_robux;
    v_rb_after  := v_rb_before + v_amount;

    UPDATE roblox_accounts SET current_robux = v_rb_after, updated_at = now()
    WHERE id = v_order.roblox_account_id;

    INSERT INTO transactions (
      user_id, order_id, roblox_account_id, roblox_account_username,
      type, robux_change, balance_before, balance_after, description
    ) VALUES (
      v_uid, p_order_id, v_order.roblox_account_id, v_account.username,
      'adjustment', v_amount, v_rb_before, v_rb_after,
      'Deleted: Order ' || COALESCE(v_order.order_number, p_order_id::text)
    );

  -- Pending/paid: release the reservation
  ELSIF v_order.status IN ('pending', 'paid')
      AND v_order.roblox_account_id IS NOT NULL
      AND v_amount > 0 THEN

    UPDATE roblox_accounts SET
      reserved_robux = GREATEST(0, reserved_robux - v_amount),
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

-- ── reassign_order_account ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.reassign_order_account(
  p_order_id       uuid,
  p_new_account_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid            uuid := auth.uid();
  v_order          orders%ROWTYPE;
  v_old_acct       roblox_accounts%ROWTYPE;
  v_new_acct       roblox_accounts%ROWTYPE;
  v_first_id       uuid;
  v_second_id      uuid;
  v_first          roblox_accounts%ROWTYPE;
  v_second         roblox_accounts%ROWTYPE;
  v_old_before     integer;
  v_old_after      integer;
  v_new_before     integer;
  v_new_after      integer;
  v_gamepass_names text;
  v_amount         integer;
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

  IF v_order.roblox_account_id IS NULL THEN
    RAISE EXCEPTION 'Order has no assigned account';
  END IF;

  IF v_order.status NOT IN ('pending', 'paid', 'delivering', 'completed') THEN
    RAISE EXCEPTION 'Only active or completed orders can be reassigned';
  END IF;

  IF v_order.roblox_account_id = p_new_account_id THEN
    RETURN jsonb_build_object('success', true, 'noop', true);
  END IF;

  v_amount := COALESCE(v_order.effective_robux_amount, v_order.robux_amount, 0);

  -- Lock both accounts in a stable order (smallest id first) so two
  -- concurrent reassignments between the same pair of accounts can't deadlock.
  IF v_order.roblox_account_id < p_new_account_id THEN
    v_first_id  := v_order.roblox_account_id;
    v_second_id := p_new_account_id;
  ELSE
    v_first_id  := p_new_account_id;
    v_second_id := v_order.roblox_account_id;
  END IF;

  SELECT * INTO v_first FROM roblox_accounts WHERE id = v_first_id AND user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account not found or access denied';
  END IF;

  SELECT * INTO v_second FROM roblox_accounts WHERE id = v_second_id AND user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account not found or access denied';
  END IF;

  IF v_first.id = v_order.roblox_account_id THEN
    v_old_acct := v_first;
    v_new_acct := v_second;
  ELSE
    v_old_acct := v_second;
    v_new_acct := v_first;
  END IF;

  -- ── Completed orders: move real Robux balances ───────────────────────────
  IF v_order.status = 'completed' THEN

    IF v_amount > 0 THEN
      v_old_before := v_old_acct.current_robux;
      v_old_after  := v_old_before + v_amount;

      v_new_before := v_new_acct.current_robux;
      v_new_after  := v_new_before - v_amount;

      IF v_new_after < 0 THEN
        RAISE EXCEPTION 'Target account does not have enough Robux balance for this reassignment';
      END IF;

      UPDATE roblox_accounts SET current_robux = v_old_after, updated_at = now()
      WHERE id = v_old_acct.id;

      UPDATE roblox_accounts SET current_robux = v_new_after, updated_at = now()
      WHERE id = v_new_acct.id;

      INSERT INTO transactions (
        user_id, order_id, roblox_account_id, roblox_account_username,
        type, robux_change, balance_before, balance_after, selling_price, profit, description
      ) VALUES (
        v_uid, p_order_id, v_old_acct.id, v_old_acct.username,
        'adjustment', v_amount, v_old_before, v_old_after, 0, 0,
        'Reassigned away: Order ' || COALESCE(v_order.order_number, p_order_id::text)
          || ' → ' || v_new_acct.username
      );

      INSERT INTO transactions (
        user_id, order_id, roblox_account_id, roblox_account_username,
        type, robux_change, balance_before, balance_after, selling_price, profit, description
      ) VALUES (
        v_uid, p_order_id, v_new_acct.id, v_new_acct.username,
        'adjustment', -v_amount, v_new_before, v_new_after, 0, 0,
        'Reassigned in: Order ' || COALESCE(v_order.order_number, p_order_id::text)
          || ' from ' || v_old_acct.username
      );
    END IF;

  -- ── Active orders: move the in-flight reservation ────────────────────────
  ELSE

    IF v_amount > 0 THEN
      UPDATE roblox_accounts SET
        reserved_robux = GREATEST(0, reserved_robux - v_amount),
        updated_at     = now()
      WHERE id = v_old_acct.id;

      SELECT COALESCE(string_agg(gamepass_name, ', '), '') INTO v_gamepass_names
      FROM order_items WHERE order_id = p_order_id;

      UPDATE robux_reservations SET status = 'released', released_at = now()
      WHERE order_id = p_order_id AND status = 'active';

      INSERT INTO robux_reservations (user_id, order_id, account_id, robux_amount, gamepass_names)
      VALUES (v_uid, p_order_id, v_new_acct.id, v_amount, v_gamepass_names);

      UPDATE roblox_accounts SET
        reserved_robux = reserved_robux + v_amount,
        updated_at     = now()
      WHERE id = v_new_acct.id;
    END IF;

  END IF;

  -- Move the order. cost/profit/selling_price/account_rate_used/effective_robux_amount are preserved.
  UPDATE orders SET roblox_account_id = p_new_account_id, updated_at = now()
  WHERE id = p_order_id;

  -- Audit trail entry for the account timeline
  INSERT INTO order_reassignments (
    user_id, order_id, from_account_id, from_account_username,
    to_account_id, to_account_username, robux_amount, order_status_at_time
  ) VALUES (
    v_uid, p_order_id, v_old_acct.id, v_old_acct.username,
    v_new_acct.id, v_new_acct.username, v_amount, v_order.status
  );

  RETURN jsonb_build_object(
    'success',               true,
    'order_id',              p_order_id,
    'from_account_id',       v_old_acct.id,
    'from_account_username', v_old_acct.username,
    'to_account_id',         v_new_acct.id,
    'to_account_username',   v_new_acct.username,
    'robux_amount',          v_amount,
    'order_status',          v_order.status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reassign_order_account(uuid, uuid) TO authenticated;
