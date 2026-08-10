-- Migration 051: Make delete_order logical-order safe for BudgetWise orders.
--
-- BudgetWise Store represents one customer checkout as multiple orders rows
-- sharing the same BW-* order_number. The Orders UI still calls the existing
-- delete_order RPC, but this version makes that RPC delete the entire BW
-- logical order atomically when any sibling row is passed in.

CREATE OR REPLACE FUNCTION public.delete_order(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid        uuid := auth.uid();
  v_seed_order orders%ROWTYPE;
  v_order      orders%ROWTYPE;
  v_account    roblox_accounts%ROWTYPE;
  v_rb_before  integer;
  v_rb_after   integer;
  v_amount     integer;
  v_target_ids uuid[];
  v_target_id  uuid;
  v_deleted    integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_seed_order
  FROM orders
  WHERE id = p_order_id AND user_id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found or access denied';
  END IF;

  IF v_seed_order.order_number LIKE 'BW-%' THEN
    SELECT array_agg(id ORDER BY created_at, id) INTO v_target_ids
    FROM orders
    WHERE user_id = v_uid
      AND order_number = v_seed_order.order_number;
  ELSE
    v_target_ids := ARRAY[p_order_id];
  END IF;

  IF v_target_ids IS NULL OR array_length(v_target_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'Order not found or access denied';
  END IF;

  PERFORM 1
  FROM orders
  WHERE user_id = v_uid
    AND id = ANY(v_target_ids)
  ORDER BY created_at, id
  FOR UPDATE;

  FOREACH v_target_id IN ARRAY v_target_ids LOOP
    SELECT * INTO v_order
    FROM orders
    WHERE id = v_target_id AND user_id = v_uid
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Order row vanished during delete: %', v_target_id;
    END IF;

    v_amount := COALESCE(v_order.effective_robux_amount, v_order.robux_amount, 0);

    IF v_order.status = 'completed'
        AND v_order.roblox_account_id IS NOT NULL
        AND v_amount > 0 THEN

      SELECT * INTO v_account
      FROM roblox_accounts
      WHERE id = v_order.roblox_account_id AND user_id = v_uid
      FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Assigned account not found for order %', v_target_id;
      END IF;

      v_rb_before := v_account.current_robux;
      v_rb_after  := v_rb_before + v_amount;

      UPDATE roblox_accounts SET current_robux = v_rb_after, updated_at = now()
      WHERE id = v_order.roblox_account_id AND user_id = v_uid;

      INSERT INTO transactions (
        user_id, order_id, roblox_account_id, roblox_account_username,
        type, robux_change, balance_before, balance_after, description
      ) VALUES (
        v_uid, v_target_id, v_order.roblox_account_id, v_account.username,
        'adjustment', v_amount, v_rb_before, v_rb_after,
        'Deleted: Order ' || COALESCE(v_order.order_number, v_target_id::text)
      );

      PERFORM public.reverse_order_savings(v_uid, v_target_id);

    ELSIF v_order.status IN ('pending', 'paid')
        AND v_order.roblox_account_id IS NOT NULL
        AND v_amount > 0 THEN

      UPDATE roblox_accounts SET
        reserved_robux = GREATEST(0, reserved_robux - v_amount),
        updated_at     = now()
      WHERE id = v_order.roblox_account_id AND user_id = v_uid;
    END IF;

    DELETE FROM robux_reservations WHERE order_id = v_target_id;

    IF v_order.status IN ('completed', 'refunded', 'cancelled') THEN
      DELETE FROM wallet_transactions WHERE reference_order_id = v_target_id;
    END IF;

    DELETE FROM order_items WHERE order_id = v_target_id;
    DELETE FROM orders      WHERE id       = v_target_id AND user_id = v_uid;

    v_deleted := v_deleted + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'deleted_count', v_deleted,
    'order_number', v_seed_order.order_number
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_order(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.delete_order(uuid) TO authenticated;
