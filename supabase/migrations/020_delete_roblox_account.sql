-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 020: Guarded Account Deletion (H3)
-- Run in Supabase SQL Editor. Safe to run multiple times (idempotent).
--
-- roblox_accounts.id is referenced by orders, robux_reservations (ON DELETE
-- CASCADE), transactions, capital_events, and account_adjustments. A raw
-- DELETE on roblox_accounts could:
--   1. Cascade-delete robux_reservations for orders that are still
--      pending/paid — destroying the audit trail behind
--      Reserved Robux = SUM(active reservations) for those orders.
--   2. Make any non-zero current_robux vanish with the row — no
--      account_adjustments/transactions write-off, breaking the
--      "no silent balance changes" invariant from C2.
--
-- delete_roblox_account() is now the only allowed path: it blocks deletion
-- while active orders depend on the account, and writes off any remaining
-- current_robux via the same audited adjustment pattern as
-- adjust_account_field() (migration 016) before deleting the row.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.delete_roblox_account(p_account_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_account roblox_accounts%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_account
  FROM roblox_accounts
  WHERE id = p_account_id AND user_id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account not found or access denied';
  END IF;

  IF EXISTS (
    SELECT 1 FROM orders
    WHERE roblox_account_id = p_account_id AND status IN ('pending', 'paid')
  ) THEN
    RAISE EXCEPTION 'Cannot delete: this account still has pending or paid orders depending on it';
  END IF;

  IF v_account.current_robux != 0 THEN
    INSERT INTO account_adjustments (user_id, roblox_account_id, field, old_value, new_value, reason)
    VALUES (v_uid, p_account_id, 'current_robux', v_account.current_robux, 0, 'Account deleted — inventory written off');

    INSERT INTO transactions (
      user_id, roblox_account_id, roblox_account_username,
      type, robux_change, balance_before, balance_after, description
    ) VALUES (
      v_uid, p_account_id, v_account.username,
      'adjustment', -v_account.current_robux, v_account.current_robux, 0,
      'Account deleted: write-off remaining inventory'
    );
  END IF;

  DELETE FROM roblox_accounts WHERE id = p_account_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_roblox_account(uuid) TO authenticated;
