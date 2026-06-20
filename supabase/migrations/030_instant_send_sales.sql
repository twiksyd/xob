-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 030: Instant Send Sales — price tiers + wallet crediting
-- Run in Supabase SQL Editor. Safe to run multiple times (idempotent).
--
-- Instant sends are real sales (a customer is buying Robux, just delivered
-- by instant transfer instead of a gamepass order), but until now nothing
-- credited revenue/profit for them. This adds:
--
--   instant_send_price_tiers — editable robux_amount -> price/profit table
--     (e.g. 500 R$ = PHP 210, profit PHP 164.45). Managed in-app, not seeded
--     by this migration (no way to know the user's id at migration time).
--
--   instant_send_sales — one row per "sale": a customer bought N robux
--     total, which may need to be sent across more than one day since each
--     individual transfer is capped at 500/day (e.g. 700 = 500 + 200).
--     Records the combined price/profit and a breakdown of which tier
--     amounts made it up.
--
--   log_instant_send_sale RPC — takes a list of {amount, sent_at} chunks,
--     looks up each chunk's price/profit from instant_send_price_tiers
--     SERVER-SIDE (never trusts client-supplied price/profit, so a tampered
--     client can't credit arbitrary money to the wallet), inserts each chunk
--     through record_transfer (so the existing daily/lifetime ceiling
--     validation and the current_robux-deduction trigger both apply exactly
--     as they would for any other logged transfer — no separate Robux
--     deduction here, no double-counting), then credits wallet_transactions
--     once for the combined price. Deliberately does NOT touch orders or
--     transactions — keeps this fully decoupled from the gamepass-order
--     pipeline, which is the whole point (avoids double-deducting Robux).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.instant_send_price_tiers (
  id           uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  robux_amount integer     NOT NULL CHECK (robux_amount > 0),
  price        numeric(10,2) NOT NULL CHECK (price >= 0),
  profit       numeric(10,2) NOT NULL,
  status       text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, robux_amount)
);

CREATE TABLE IF NOT EXISTS public.instant_send_sales (
  id                uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  roblox_account_id uuid        NOT NULL REFERENCES public.roblox_accounts(id) ON DELETE CASCADE,
  robux_amount      integer     NOT NULL CHECK (robux_amount > 0),
  price             numeric(10,2) NOT NULL,
  profit            numeric(10,2) NOT NULL,
  breakdown         jsonb       NOT NULL,
  customer_label    text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_instant_send_sales_account ON public.instant_send_sales (roblox_account_id, created_at DESC);

ALTER TABLE public.instant_send_price_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instant_send_sales ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'instant_send_price_tiers' AND policyname = 'Users manage own price tiers') THEN
    CREATE POLICY "Users manage own price tiers"
      ON public.instant_send_price_tiers FOR ALL
      USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'instant_send_sales' AND policyname = 'Users manage own instant send sales') THEN
    CREATE POLICY "Users manage own instant send sales"
      ON public.instant_send_sales FOR ALL
      USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.log_instant_send_sale(
  p_account_id     uuid,
  p_chunks         jsonb,
  p_customer_label text DEFAULT NULL,
  p_start_of_today timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid           uuid := auth.uid();
  v_account       roblox_accounts%ROWTYPE;
  v_chunk         jsonb;
  v_chunk_amount  integer;
  v_chunk_sent_at timestamptz;
  v_tier          instant_send_price_tiers%ROWTYPE;
  v_total_amount  integer := 0;
  v_total_price   numeric := 0;
  v_total_profit  numeric := 0;
  v_breakdown     jsonb := '[]'::jsonb;
  v_sale_id       uuid;
  v_log_result    jsonb;
  v_note          text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_chunks IS NULL OR jsonb_array_length(p_chunks) = 0 THEN RAISE EXCEPTION 'At least one chunk is required'; END IF;

  SELECT * INTO v_account FROM roblox_accounts WHERE id = p_account_id AND user_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Account not found or access denied'; END IF;

  v_note := 'Instant Send Sale' || CASE WHEN p_customer_label IS NOT NULL AND p_customer_label != '' THEN ' — ' || p_customer_label ELSE '' END;

  FOR v_chunk IN SELECT * FROM jsonb_array_elements(p_chunks) LOOP
    v_chunk_amount  := (v_chunk->>'amount')::integer;
    v_chunk_sent_at := (v_chunk->>'sent_at')::timestamptz;

    IF v_chunk_amount IS NULL OR v_chunk_amount <= 0 THEN RAISE EXCEPTION 'Invalid chunk amount'; END IF;
    IF v_chunk_sent_at IS NULL THEN RAISE EXCEPTION 'Invalid chunk date'; END IF;

    SELECT * INTO v_tier FROM instant_send_price_tiers WHERE user_id = v_uid AND robux_amount = v_chunk_amount;
    IF NOT FOUND THEN RAISE EXCEPTION 'No price tier defined for % R$ — add one in Manage Pricing first', v_chunk_amount; END IF;

    -- Routes through record_transfer so the daily/lifetime ceiling checks
    -- and the current_robux-deduction trigger apply exactly as they would
    -- for any other logged transfer.
    v_log_result := public.record_transfer(p_account_id, v_chunk_amount, p_start_of_today, v_chunk_sent_at, v_note);

    v_total_amount := v_total_amount + v_chunk_amount;
    v_total_price  := v_total_price + v_tier.price;
    v_total_profit := v_total_profit + v_tier.profit;
    v_breakdown := v_breakdown || jsonb_build_object(
      'amount', v_chunk_amount, 'price', v_tier.price, 'profit', v_tier.profit,
      'sent_at', v_chunk_sent_at, 'log_id', v_log_result->>'id'
    );
  END LOOP;

  INSERT INTO instant_send_sales (user_id, roblox_account_id, robux_amount, price, profit, breakdown, customer_label)
  VALUES (v_uid, p_account_id, v_total_amount, v_total_price, v_total_profit, v_breakdown, p_customer_label)
  RETURNING id INTO v_sale_id;

  IF v_total_price > 0 THEN
    INSERT INTO wallet_transactions (user_id, type, amount, category, description, reference_order_id)
    VALUES (
      v_uid, 'income', v_total_price, 'Sale',
      'Instant Send — ' || v_total_amount || ' R$' || CASE WHEN p_customer_label IS NOT NULL AND p_customer_label != '' THEN ' (' || p_customer_label || ')' ELSE '' END,
      NULL
    );
  END IF;

  RETURN jsonb_build_object('success', true, 'sale_id', v_sale_id, 'price', v_total_price, 'profit', v_total_profit);
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_instant_send_sale(uuid, jsonb, text, timestamptz) TO authenticated;
