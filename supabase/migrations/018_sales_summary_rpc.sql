-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 018: Sales Summary RPC (Transactions page metrics, H1)
-- Run in Supabase SQL Editor. Safe to run multiple times (idempotent).
--
-- The Transactions page computed its "Overall"/"Today" metric cards (revenue,
-- profit, orders, robux) by reducing over a client-side query capped at the
-- 500 most recent transactions. Once a user passes 500 transactions, "Overall"
-- totals silently undercounted. get_sales_summary() aggregates all matching
-- 'sale' transactions server-side, optionally filtered by a start timestamp,
-- so the metric cards stay correct regardless of any client-side row cap.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_sales_summary(p_since timestamptz DEFAULT NULL)
RETURNS TABLE (
  orders_count bigint,
  revenue      numeric,
  profit       numeric,
  robux        numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(DISTINCT order_id)            AS orders_count,
    COALESCE(SUM(selling_price), 0)     AS revenue,
    COALESCE(SUM(profit), 0)            AS profit,
    COALESCE(SUM(ABS(robux_change)), 0) AS robux
  FROM transactions
  WHERE user_id = auth.uid()
    AND type = 'sale'
    AND (p_since IS NULL OR created_at >= p_since);
$$;

GRANT EXECUTE ON FUNCTION public.get_sales_summary(timestamptz) TO authenticated;
