-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 007: Savings Goals System
-- Run in Supabase SQL Editor. Safe to run multiple times (idempotent).
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. savings_goals — goal definitions and running balances
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.savings_goals (
  id              uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            text        NOT NULL,
  target_amount   numeric(10,2) NOT NULL CHECK (target_amount > 0),
  current_amount  numeric(10,2) NOT NULL DEFAULT 0 CHECK (current_amount >= 0),
  allocation_pct  numeric(5,2) NOT NULL DEFAULT 10 CHECK (allocation_pct > 0 AND allocation_pct <= 100),
  priority        integer     NOT NULL DEFAULT 1,
  status          text        NOT NULL DEFAULT 'locked'
                  CHECK (status IN ('active', 'completed', 'locked')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_savings_goals_user_priority
  ON public.savings_goals (user_id, priority);

CREATE INDEX IF NOT EXISTS idx_savings_goals_user_status
  ON public.savings_goals (user_id, status);

ALTER TABLE public.savings_goals ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'savings_goals' AND policyname = 'Users manage own savings goals') THEN
    CREATE POLICY "Users manage own savings goals"
      ON public.savings_goals FOR ALL
      USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. savings_transactions — allocation and reversal audit trail
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.savings_transactions (
  id          uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  goal_id     uuid        NOT NULL REFERENCES public.savings_goals(id) ON DELETE CASCADE,
  order_id    uuid        REFERENCES public.orders(id) ON DELETE SET NULL,
  amount      numeric(10,2) NOT NULL,  -- positive = allocation, negative = reversal
  type        text        NOT NULL DEFAULT 'allocation' CHECK (type IN ('allocation', 'reversal')),
  description text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_savings_txns_order
  ON public.savings_transactions (order_id) WHERE order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_savings_txns_user_created
  ON public.savings_transactions (user_id, created_at DESC);

ALTER TABLE public.savings_transactions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'savings_transactions' AND policyname = 'Users manage own savings transactions') THEN
    CREATE POLICY "Users manage own savings transactions"
      ON public.savings_transactions FOR ALL
      USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RPC: initialize_savings_goals
-- Creates the two default savings goals for the current user if they don't
-- already exist. Safe to call multiple times (idempotent).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.initialize_savings_goals()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_count integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT COUNT(*) INTO v_count FROM savings_goals WHERE user_id = v_uid;

  IF v_count = 0 THEN
    INSERT INTO savings_goals (user_id, name, target_amount, allocation_pct, priority, status)
    VALUES
      (v_uid, 'Primary Savings',   470, 10, 1, 'active'),
      (v_uid, 'Secondary Savings', 140,  5, 2, 'locked');

    RETURN jsonb_build_object('success', true, 'created', 2);
  END IF;

  RETURN jsonb_build_object('success', true, 'created', 0, 'noop', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.initialize_savings_goals() TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. RPC: allocate_order_savings
-- Called after an order completes. Finds the active savings goal, calculates
-- the allocation (capped at the remaining amount needed), updates the goal
-- balance, promotes the next goal if this one completes, and inserts both
-- a savings_transaction and a wallet_transaction (expense).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.allocate_order_savings(
  p_user_id      uuid,
  p_order_id     uuid,
  p_gross_profit numeric,
  p_order_number text DEFAULT NULL,
  p_buyer_name   text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_goal       savings_goals%ROWTYPE;
  v_allocation numeric;
  v_new_total  numeric;
  v_label      text;
BEGIN
  -- No profit, nothing to allocate
  IF COALESCE(p_gross_profit, 0) <= 0 THEN
    RETURN jsonb_build_object('success', true, 'noop', true);
  END IF;

  -- Find the active goal (priority order)
  SELECT * INTO v_goal
  FROM savings_goals
  WHERE user_id = p_user_id AND status = 'active'
  ORDER BY priority
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', true, 'noop', true, 'reason', 'no active goal');
  END IF;

  -- Allocation = pct of profit, capped at remaining space in goal
  v_allocation := LEAST(
    ROUND(p_gross_profit * v_goal.allocation_pct / 100, 2),
    v_goal.target_amount - v_goal.current_amount
  );

  IF v_allocation <= 0 THEN
    RETURN jsonb_build_object('success', true, 'noop', true, 'reason', 'goal full');
  END IF;

  v_new_total := v_goal.current_amount + v_allocation;

  -- Update goal balance
  UPDATE savings_goals SET
    current_amount = v_new_total,
    status = CASE WHEN v_new_total >= v_goal.target_amount THEN 'completed' ELSE 'active' END,
    updated_at = now()
  WHERE id = v_goal.id;

  -- If this goal just completed, activate the next priority goal
  IF v_new_total >= v_goal.target_amount THEN
    UPDATE savings_goals SET
      status = 'active',
      updated_at = now()
    WHERE user_id = p_user_id AND priority = v_goal.priority + 1 AND status = 'locked';
  END IF;

  -- Build description
  v_label := v_goal.name || ': Order ' || COALESCE(p_order_number, '')
    || CASE WHEN p_buyer_name IS NOT NULL THEN ' — ' || p_buyer_name ELSE '' END;

  -- Savings transaction audit record
  INSERT INTO savings_transactions (user_id, goal_id, order_id, amount, type, description)
  VALUES (p_user_id, v_goal.id, p_order_id, v_allocation, 'allocation', v_label);

  -- Wallet expense (savings come out of profit)
  INSERT INTO wallet_transactions (user_id, type, amount, category, description, reference_order_id)
  VALUES (p_user_id, 'expense', -v_allocation, 'Savings', v_label, p_order_id);

  RETURN jsonb_build_object(
    'success',       true,
    'goal',          v_goal.name,
    'allocated',     v_allocation,
    'goal_total',    v_new_total,
    'goal_complete', v_new_total >= v_goal.target_amount
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.allocate_order_savings(uuid, uuid, numeric, text, text) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. RPC: reverse_order_savings
-- Called when a completed order is refunded, cancelled, or deleted. Finds the
-- savings allocation for the order, subtracts it from the goal, re-activates
-- the goal if it was completed, and re-locks the next goal if needed.
-- Inserts a savings_transaction (reversal) and a wallet_transaction (income).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.reverse_order_savings(
  p_user_id  uuid,
  p_order_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stx  savings_transactions%ROWTYPE;
  v_goal savings_goals%ROWTYPE;
  v_new_total numeric;
BEGIN
  -- Find the allocation for this order (if any)
  SELECT * INTO v_stx
  FROM savings_transactions
  WHERE order_id = p_order_id AND type = 'allocation' AND user_id = p_user_id
  ORDER BY created_at
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', true, 'noop', true);
  END IF;

  -- Lock the goal for update
  SELECT * INTO v_goal
  FROM savings_goals WHERE id = v_stx.goal_id FOR UPDATE;

  v_new_total := GREATEST(0, v_goal.current_amount - v_stx.amount);

  -- Update goal balance
  UPDATE savings_goals SET
    current_amount = v_new_total,
    updated_at = now()
  WHERE id = v_goal.id;

  -- If goal was completed and is now below target, re-activate it
  IF v_goal.status = 'completed' AND v_new_total < v_goal.target_amount THEN
    UPDATE savings_goals SET status = 'active', updated_at = now() WHERE id = v_goal.id;
    -- Lock the next goal back (only if it is still 'active', not 'completed')
    UPDATE savings_goals SET status = 'locked', updated_at = now()
    WHERE user_id = p_user_id
      AND priority = v_goal.priority + 1
      AND status   = 'active';
  END IF;

  -- Savings reversal audit record
  INSERT INTO savings_transactions (user_id, goal_id, order_id, amount, type, description)
  VALUES (p_user_id, v_goal.id, p_order_id, -v_stx.amount, 'reversal',
    'Reversal: ' || v_goal.name);

  -- Restore amount to wallet
  INSERT INTO wallet_transactions (user_id, type, amount, category, description, reference_order_id)
  VALUES (p_user_id, 'income', v_stx.amount, 'Savings Reversal',
    'Reversal: ' || v_goal.name, p_order_id);

  RETURN jsonb_build_object(
    'success',  true,
    'reversed', v_stx.amount,
    'goal',     v_goal.name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reverse_order_savings(uuid, uuid) TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Update transition_order — add savings allocation / reversal calls
-- Full replacement (idempotent).
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

  -- ── completed → refunded/cancelled: restore Robux + reverse savings ────────
  ELSIF v_order.status = 'completed' AND p_new_status IN ('refunded', 'cancelled') THEN

    IF v_order.roblox_account_id IS NOT NULL AND COALESCE(v_order.robux_amount, 0) > 0 THEN
      SELECT * INTO v_account FROM roblox_accounts WHERE id = v_order.roblox_account_id FOR UPDATE;
      v_rb_before := v_account.current_robux;
      v_rb_after  := v_rb_before + v_order.robux_amount;

      UPDATE roblox_accounts SET current_robux = v_rb_after, updated_at = now()
      WHERE id = v_order.roblox_account_id;

      INSERT INTO transactions (
        user_id, order_id, roblox_account_id, roblox_account_username,
        type, robux_change, balance_before, balance_after, selling_price, profit, description
      ) VALUES (
        v_uid, p_order_id, v_order.roblox_account_id, v_account.username,
        'refund', v_order.robux_amount, v_rb_before, v_rb_after,
        v_order.selling_price, v_order.profit,
        CASE p_new_status WHEN 'refunded' THEN 'Refund' ELSE 'Cancellation' END
          || ': Order ' || COALESCE(v_order.order_number, '')
          || CASE WHEN v_order.buyer_name IS NOT NULL THEN ' — ' || v_order.buyer_name ELSE '' END
      );
    END IF;

    IF COALESCE(v_order.selling_price, 0) > 0 THEN
      INSERT INTO wallet_transactions (user_id, type, amount, category, description, reference_order_id)
      VALUES (
        v_uid, 'expense', -v_order.selling_price,
        CASE p_new_status WHEN 'refunded' THEN 'Refund Issued' ELSE 'Cancellation' END,
        CASE p_new_status WHEN 'refunded' THEN 'Refund' ELSE 'Cancellation' END
          || ': Order ' || COALESCE(v_order.order_number, '')
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

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Update delete_order — reverse savings on completed order deletion
-- Full replacement (idempotent).
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
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_order FROM orders WHERE id = p_order_id AND user_id = v_uid FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found or access denied'; END IF;

  IF v_order.status = 'completed'
      AND v_order.roblox_account_id IS NOT NULL
      AND COALESCE(v_order.robux_amount, 0) > 0 THEN

    SELECT * INTO v_account FROM roblox_accounts WHERE id = v_order.roblox_account_id FOR UPDATE;
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

    -- Reverse savings before wallet cleanup
    PERFORM public.reverse_order_savings(v_uid, p_order_id);

  ELSIF v_order.status IN ('pending', 'paid')
      AND v_order.roblox_account_id IS NOT NULL
      AND COALESCE(v_order.robux_amount, 0) > 0 THEN

    UPDATE roblox_accounts SET
      reserved_robux = GREATEST(0, reserved_robux - v_order.robux_amount),
      updated_at = now()
    WHERE id = v_order.roblox_account_id;
  END IF;

  DELETE FROM robux_reservations WHERE order_id = p_order_id;

  -- This also deletes savings wallet_transactions (income reversal inserted above)
  IF v_order.status IN ('completed', 'refunded', 'cancelled') THEN
    DELETE FROM wallet_transactions WHERE reference_order_id = p_order_id;
  END IF;

  DELETE FROM order_items WHERE order_id = p_order_id;
  DELETE FROM orders      WHERE id       = p_order_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_order(uuid) TO authenticated;
