-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 015: Wallet Balance RPC (single source of truth)
-- Run in Supabase SQL Editor. Safe to run multiple times (idempotent).
--
-- Wallet balance must equal SUM(wallet_transactions.amount) for the current
-- user, computed server-side, so every page (Wallet, Dashboard, Accounts,
-- Capital Position, Capital Safety, Restock Advisor) agrees regardless of
-- any client-side pagination/limits.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_wallet_balance()
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(amount), 0)
  FROM wallet_transactions
  WHERE user_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.get_wallet_balance() TO authenticated;

-- Wallet page needs balance + income/expense totals together so its summary
-- cards never drift from the headline balance.
CREATE OR REPLACE FUNCTION public.get_wallet_summary()
RETURNS TABLE (
  balance        numeric,
  total_income   numeric,
  total_expenses numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(SUM(amount), 0) AS balance,
    COALESCE(SUM(amount) FILTER (WHERE amount > 0), 0) AS total_income,
    COALESCE(SUM(-amount) FILTER (WHERE amount < 0), 0) AS total_expenses
  FROM wallet_transactions
  WHERE user_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.get_wallet_summary() TO authenticated;
