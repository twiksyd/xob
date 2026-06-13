-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 021: Financial Integrity Reconciliation Checks (Phase 4)
-- Run in Supabase SQL Editor. Safe to run multiple times (idempotent).
--
-- get_financial_integrity_checks() computes, server-side and per-user, five
-- reconciliation checks — one per FINAL GOAL formula from the remediation
-- plan. Each check compares two INDEPENDENTLY-MAINTAINED numbers that must
-- always agree if every financial write went through its authoritative RPC.
-- A non-zero "difference" pinpoints exactly which ledger/cache pair has
-- drifted, and "details" explains what that drift means.
--
--   1. Wallet Balance — Σ wallet_transactions (order-linked) vs
--      Σ transactions.selling_price (order-linked). transition_order writes
--      both in the same call; if they disagree, an order-linked wallet entry
--      and its sales-ledger counterpart have diverged (e.g. a completed order
--      was deleted, removing its wallet_transactions row but leaving the
--      original 'sale' transactions row in place).
--
--   2. Savings Balance — Σ savings_transactions.amount vs
--      Σ savings_goals.current_amount. allocate_order_savings /
--      reverse_order_savings update both together; disagreement means a goal
--      balance changed without a matching ledger entry.
--
--   3. Reserved Robux — Σ robux_reservations.robux_amount (active) vs
--      Σ roblox_accounts.reserved_robux. The column is a running cache of the
--      reservation ledger; disagreement means reserved_robux was changed
--      without creating/releasing a matching reservation row.
--
--   4. Inventory Value — Σ (available robux × cost rate), unfloored, vs the
--      displayed Σ (MAX(0, available robux) × cost rate). A positive
--      difference means at least one account has reserved_robux >
--      current_robux — more Robux promised to orders than the account holds.
--
--   5. Capital Usage — Σ capital_events.cost vs Σ (profit_used +
--      capital_used). classifyPurchase() guarantees profit_used + capital_used
--      = cost for every row; disagreement means a capital_events row was
--      inserted outside that function with an inconsistent split.
--
-- Status classification: PASS if |difference| < 0.01 (effectively zero);
-- WARNING if |difference| is within 1% of |expected| (or <= 1 unit when
-- expected is ~0) — small enough to be a rounding artifact; otherwise FAIL.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_financial_integrity_checks()
RETURNS TABLE (
  check_name text,
  formula    text,
  expected   numeric,
  actual     numeric,
  difference numeric,
  status     text,
  details    text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();

  v_wallet_expected   numeric;
  v_wallet_actual     numeric;
  v_savings_expected  numeric;
  v_savings_actual    numeric;
  v_reserved_expected numeric;
  v_reserved_actual   numeric;
  v_inventory_expected numeric;
  v_inventory_actual   numeric;
  v_capital_expected  numeric;
  v_capital_actual    numeric;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 1. Wallet Balance — order-linked sales ledger vs order-linked wallet ledger
  SELECT COALESCE(SUM(
    CASE
      WHEN type = 'sale' THEN selling_price
      WHEN type IN ('refund', 'adjustment') THEN -selling_price
      ELSE 0
    END
  ), 0)
  INTO v_wallet_expected
  FROM transactions
  WHERE user_id = v_uid AND order_id IS NOT NULL AND selling_price IS NOT NULL;

  SELECT COALESCE(SUM(amount), 0)
  INTO v_wallet_actual
  FROM wallet_transactions
  WHERE user_id = v_uid
    AND reference_order_id IS NOT NULL
    AND category IN ('Sale', 'Refund Issued', 'Cancellation', 'Reversal');

  -- 2. Savings Balance — ledger sum vs goal running totals
  SELECT COALESCE(SUM(amount), 0) INTO v_savings_expected
  FROM savings_transactions WHERE user_id = v_uid;

  SELECT COALESCE(SUM(current_amount), 0) INTO v_savings_actual
  FROM savings_goals WHERE user_id = v_uid;

  -- 3. Reserved Robux — reservation ledger vs denormalized account cache
  SELECT COALESCE(SUM(robux_amount), 0) INTO v_reserved_expected
  FROM robux_reservations WHERE user_id = v_uid AND status = 'active';

  SELECT COALESCE(SUM(reserved_robux), 0) INTO v_reserved_actual
  FROM roblox_accounts WHERE user_id = v_uid;

  -- 4. Inventory Value — true (unfloored) vs displayed (floored per account)
  SELECT
    COALESCE(SUM((current_robux - reserved_robux) * robux_cost_rate / 1000.0), 0),
    COALESCE(SUM(GREATEST(0, current_robux - reserved_robux) * robux_cost_rate / 1000.0), 0)
  INTO v_inventory_expected, v_inventory_actual
  FROM roblox_accounts WHERE user_id = v_uid;

  -- 5. Capital Usage — purchase cost vs profit/capital attribution
  SELECT COALESCE(SUM(cost), 0), COALESCE(SUM(profit_used) + SUM(capital_used), 0)
  INTO v_capital_expected, v_capital_actual
  FROM capital_events WHERE user_id = v_uid;

  RETURN QUERY
  SELECT
    t.check_name,
    t.formula,
    ROUND(t.expected, 2),
    ROUND(t.actual, 2),
    ROUND(t.difference, 2),
    CASE
      WHEN ABS(t.difference) < 0.01 THEN 'PASS'
      WHEN ABS(t.difference) <= GREATEST(1, ABS(t.expected) * 0.01) THEN 'WARNING'
      ELSE 'FAIL'
    END,
    t.details
  FROM (VALUES
    ('Wallet Balance',
     'SUM(wallet_transactions, order-linked) = SUM(transactions.selling_price, order-linked)',
     v_wallet_expected, v_wallet_actual, v_wallet_actual - v_wallet_expected,
     'Every order-driven sale/refund recorded in the Robux ledger (transactions) must have a matching wallet_transactions entry for the same amount, written together by transition_order. A non-zero difference usually means a completed order was deleted, removing its wallet entry but leaving its sales-ledger entry in place.'
    ),
    ('Savings Balance',
     'SUM(savings_transactions.amount) = SUM(savings_goals.current_amount)',
     v_savings_expected, v_savings_actual, v_savings_actual - v_savings_expected,
     'Each savings goal''s running balance (current_amount) is updated in lockstep with the savings_transactions ledger by allocate_order_savings / reverse_order_savings. A non-zero difference means a goal balance changed without a matching ledger entry.'
    ),
    ('Reserved Robux',
     'SUM(robux_reservations.robux_amount WHERE active) = SUM(roblox_accounts.reserved_robux)',
     v_reserved_expected, v_reserved_actual, v_reserved_actual - v_reserved_expected,
     'roblox_accounts.reserved_robux is a running cache of active reservations. A non-zero difference means an account''s reserved_robux was changed without a matching robux_reservations row being created or released.'
    ),
    ('Inventory Value',
     'SUM(available robux x cost rate) = SUM(MAX(0, available robux) x cost rate)',
     v_inventory_expected, v_inventory_actual, v_inventory_actual - v_inventory_expected,
     'Displayed inventory value floors each account''s available Robux at zero. A positive difference means at least one account has reserved_robux > current_robux — more Robux is promised to orders than the account actually holds.'
    ),
    ('Capital Usage',
     'SUM(capital_events.cost) = SUM(capital_events.profit_used + capital_used)',
     v_capital_expected, v_capital_actual, v_capital_actual - v_capital_expected,
     'classifyPurchase() guarantees profit_used + capital_used = cost for every recorded purchase. A non-zero difference means a capital_events row was inserted with an inconsistent profit/capital split.'
    )
  ) AS t(check_name, formula, expected, actual, difference, details);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_financial_integrity_checks() TO authenticated;
