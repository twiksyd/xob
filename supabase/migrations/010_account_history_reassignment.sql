-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 010: Account Purchase History + Reassignment System
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New Query → Run All).
-- Safe to run multiple times (idempotent).
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. order_reassignments — append-only audit trail for account corrections
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.order_reassignments (
  id                    uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id               uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id              uuid        NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  from_account_id       uuid        REFERENCES public.roblox_accounts(id) ON DELETE SET NULL,
  from_account_username text        NOT NULL,
  to_account_id         uuid        REFERENCES public.roblox_accounts(id) ON DELETE SET NULL,
  to_account_username   text        NOT NULL,
  robux_amount          integer     NOT NULL DEFAULT 0,
  order_status_at_time  text        NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reassignments_order
  ON public.order_reassignments (order_id);

CREATE INDEX IF NOT EXISTS idx_reassignments_from_account
  ON public.order_reassignments (from_account_id);

CREATE INDEX IF NOT EXISTS idx_reassignments_to_account
  ON public.order_reassignments (to_account_id);

ALTER TABLE public.order_reassignments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'order_reassignments' AND policyname = 'Users view own reassignments'
  ) THEN
    CREATE POLICY "Users view own reassignments"
      ON public.order_reassignments
      FOR SELECT
      USING (user_id = auth.uid());
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Index for the account ledger page (orders filtered by account)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_orders_account_id
  ON public.orders (roblox_account_id, created_at DESC)
  WHERE roblox_account_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RPC: reassign_order_account
--
-- Moves an order (and its in-flight Robux) from one account to another.
--
--   • completed orders   : restores Robux to the old account's current_robux
--                           and deducts it from the new account's current_robux
--                           (raises if the new account can't cover it), and
--                           writes two 'adjustment' rows to `transactions` for
--                           per-account audit history.
--   • pending/paid/delivering orders : moves the active reservation —
--                           releases it on the old account (reserved_robux--)
--                           and creates a fresh one on the new account
--                           (reserved_robux++), mirroring reserve_order_robux.
--
-- In both cases the order's cost/profit/selling_price/account_rate_used are
-- left untouched (no recalculation), and wallet_transactions / savings_* are
-- not touched — profit didn't change, so revenue and savings history stay
-- correct with no duplicate entries.
--
-- Every call writes one row to order_reassignments for the account timeline.
-- Uses auth.uid() — never trusts a client-supplied user_id. Row-level
-- FOR UPDATE locks (accounts locked in id order) prevent races/deadlocks.
-- ─────────────────────────────────────────────────────────────────────────────

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
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Lock the order row
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

    IF COALESCE(v_order.robux_amount, 0) > 0 THEN
      v_old_before := v_old_acct.current_robux;
      v_old_after  := v_old_before + v_order.robux_amount;

      v_new_before := v_new_acct.current_robux;
      v_new_after  := v_new_before - v_order.robux_amount;

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
        'adjustment', v_order.robux_amount, v_old_before, v_old_after, 0, 0,
        'Reassigned away: Order ' || COALESCE(v_order.order_number, p_order_id::text)
          || ' → ' || v_new_acct.username
      );

      INSERT INTO transactions (
        user_id, order_id, roblox_account_id, roblox_account_username,
        type, robux_change, balance_before, balance_after, selling_price, profit, description
      ) VALUES (
        v_uid, p_order_id, v_new_acct.id, v_new_acct.username,
        'adjustment', -v_order.robux_amount, v_new_before, v_new_after, 0, 0,
        'Reassigned in: Order ' || COALESCE(v_order.order_number, p_order_id::text)
          || ' from ' || v_old_acct.username
      );
    END IF;

  -- ── Active orders: move the in-flight reservation ────────────────────────
  ELSE

    IF COALESCE(v_order.robux_amount, 0) > 0 THEN
      UPDATE roblox_accounts SET
        reserved_robux = GREATEST(0, reserved_robux - v_order.robux_amount),
        updated_at     = now()
      WHERE id = v_old_acct.id;

      SELECT COALESCE(string_agg(gamepass_name, ', '), '') INTO v_gamepass_names
      FROM order_items WHERE order_id = p_order_id;

      UPDATE robux_reservations SET status = 'released', released_at = now()
      WHERE order_id = p_order_id AND status = 'active';

      INSERT INTO robux_reservations (user_id, order_id, account_id, robux_amount, gamepass_names)
      VALUES (v_uid, p_order_id, v_new_acct.id, v_order.robux_amount, v_gamepass_names);

      UPDATE roblox_accounts SET
        reserved_robux = reserved_robux + v_order.robux_amount,
        updated_at     = now()
      WHERE id = v_new_acct.id;
    END IF;

  END IF;

  -- Move the order. cost/profit/selling_price/account_rate_used are preserved.
  UPDATE orders SET roblox_account_id = p_new_account_id, updated_at = now()
  WHERE id = p_order_id;

  -- Audit trail entry for the account timeline
  INSERT INTO order_reassignments (
    user_id, order_id, from_account_id, from_account_username,
    to_account_id, to_account_username, robux_amount, order_status_at_time
  ) VALUES (
    v_uid, p_order_id, v_old_acct.id, v_old_acct.username,
    v_new_acct.id, v_new_acct.username, COALESCE(v_order.robux_amount, 0), v_order.status
  );

  RETURN jsonb_build_object(
    'success',               true,
    'order_id',              p_order_id,
    'from_account_id',       v_old_acct.id,
    'from_account_username', v_old_acct.username,
    'to_account_id',         v_new_acct.id,
    'to_account_username',   v_new_acct.username,
    'robux_amount',          COALESCE(v_order.robux_amount, 0),
    'order_status',          v_order.status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reassign_order_account(uuid, uuid) TO authenticated;
