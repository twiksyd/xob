-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 016: Account Adjustments (audited corrections to inventory fields)
-- Run in Supabase SQL Editor. Safe to run multiple times (idempotent).
--
-- roblox_accounts.current_robux / reserved_robux / robux_cost_rate must never
-- change silently. The order financial engine (transition_order,
-- reserve_order_robux, etc.) already keeps these in sync for order-driven
-- activity. For manual corrections (e.g. reconciling against the real Roblox
-- balance), adjust_account_field() is the only other path allowed to touch
-- these columns — every call records who changed it, the previous and new
-- value, the reason, and when, in account_adjustments. Adjustments to
-- current_robux additionally write a 'adjustment' row to transactions so the
-- per-account ledger stays consistent.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.account_adjustments (
  id                uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  roblox_account_id uuid        REFERENCES public.roblox_accounts(id) ON DELETE SET NULL,
  field             text        NOT NULL CHECK (field IN ('current_robux', 'reserved_robux', 'robux_cost_rate')),
  old_value         numeric     NOT NULL,
  new_value         numeric     NOT NULL,
  reason            text        NOT NULL CHECK (char_length(trim(reason)) > 0),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_account_adjustments_account_created
  ON public.account_adjustments (roblox_account_id, created_at DESC);

ALTER TABLE public.account_adjustments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'account_adjustments' AND policyname = 'Users manage own account adjustments') THEN
    CREATE POLICY "Users manage own account adjustments"
      ON public.account_adjustments FOR ALL
      USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC: adjust_account_field
--
-- The only allowed path for manually correcting current_robux, reserved_robux,
-- or robux_cost_rate on an existing roblox_accounts row. Locks the account row,
-- validates the field/reason, applies the new value, and records the change in
-- account_adjustments. Adjustments to current_robux also write a transactions
-- row (type='adjustment') so the account's robux ledger reflects the change.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.adjust_account_field(
  p_account_id uuid,
  p_field      text,
  p_new_value  numeric,
  p_reason     text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_account roblox_accounts%ROWTYPE;
  v_old     numeric;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_field NOT IN ('current_robux', 'reserved_robux', 'robux_cost_rate') THEN
    RAISE EXCEPTION 'Invalid field: %', p_field;
  END IF;

  IF p_reason IS NULL OR length(trim(p_reason)) = 0 THEN
    RAISE EXCEPTION 'A reason is required for adjustments';
  END IF;

  IF p_new_value < 0 THEN
    RAISE EXCEPTION 'Value cannot be negative';
  END IF;

  SELECT * INTO v_account
  FROM roblox_accounts
  WHERE id = p_account_id AND user_id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account not found or access denied';
  END IF;

  v_old := CASE p_field
    WHEN 'current_robux'   THEN v_account.current_robux
    WHEN 'reserved_robux'  THEN v_account.reserved_robux
    WHEN 'robux_cost_rate' THEN v_account.robux_cost_rate
  END;

  IF p_field = 'current_robux' THEN
    UPDATE roblox_accounts SET current_robux = p_new_value::integer, updated_at = now() WHERE id = p_account_id;
  ELSIF p_field = 'reserved_robux' THEN
    UPDATE roblox_accounts SET reserved_robux = p_new_value::integer, updated_at = now() WHERE id = p_account_id;
  ELSE
    UPDATE roblox_accounts SET robux_cost_rate = p_new_value, updated_at = now() WHERE id = p_account_id;
  END IF;

  INSERT INTO account_adjustments (user_id, roblox_account_id, field, old_value, new_value, reason)
  VALUES (v_uid, p_account_id, p_field, v_old, p_new_value, p_reason);

  IF p_field = 'current_robux' THEN
    INSERT INTO transactions (
      user_id, roblox_account_id, roblox_account_username,
      type, robux_change, balance_before, balance_after, description
    ) VALUES (
      v_uid, p_account_id, v_account.username,
      'adjustment', (p_new_value - v_old)::integer, v_old::integer, p_new_value::integer,
      'Manual adjustment: ' || p_reason
    );
  END IF;

  RETURN jsonb_build_object(
    'success',   true,
    'field',     p_field,
    'old_value', v_old,
    'new_value', p_new_value
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.adjust_account_field(uuid, text, numeric, text) TO authenticated;
