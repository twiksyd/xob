-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 031: Auto-credit the wallet for ANY logged transfer matching a
-- price tier — not just ones logged through "Log Instant Send Sale"
-- Run in Supabase SQL Editor. Safe to run multiple times (idempotent).
--
-- Every instant send is a real sale, regardless of which button created it.
-- Previously only "Log Instant Send Sale" credited the wallet; the quick
-- +50/+100/+250/Custom buttons and "Log a Transfer" did not, even though
-- they're the same kind of event. This adds a trigger on transfer_logs that
-- looks up instant_send_price_tiers by exact amount match and credits
-- wallet_transactions whenever a logged amount happens to match a tier —
-- 100 R$ credits if you have a 100 tier, 50 R$ does nothing if you don't
-- have a 50 tier (add one in Manage Pricing if you want it priced).
--
-- Implemented as a trigger (same pattern as migration 029's current_robux
-- effect) so it applies uniformly no matter which RPC inserts the row:
--   INSERT: credit if NEW.amount matches a tier.
--   UPDATE: reverse the old credit if OLD.amount matched a tier, then apply
--           the new credit if NEW.amount matches a tier — skipped entirely
--           if the amount didn't change, so editing just a note/date doesn't
--           create a no-op reversal+recredit pair.
--   DELETE: reverse the credit if OLD.amount matched a tier.
--
-- This also means log_instant_send_sale's own manual wallet_transactions
-- insert is now REDUNDANT and would double-credit: every chunk it creates
-- is, by construction, an exact tier amount, so this trigger already
-- credits each chunk as it's inserted via record_transfer. That insert is
-- removed below.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.apply_transfer_log_wallet_effect()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_tier instant_send_price_tiers%ROWTYPE;
  v_new_tier instant_send_price_tiers%ROWTYPE;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT * INTO v_new_tier FROM instant_send_price_tiers WHERE user_id = NEW.user_id AND robux_amount = NEW.amount;
    IF FOUND THEN
      INSERT INTO wallet_transactions (user_id, type, amount, category, description, reference_order_id)
      VALUES (NEW.user_id, 'income', v_new_tier.price, 'Sale', 'Instant Send — ' || NEW.amount || ' R$', NULL);
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.amount != OLD.amount THEN
      SELECT * INTO v_old_tier FROM instant_send_price_tiers WHERE user_id = OLD.user_id AND robux_amount = OLD.amount;
      IF FOUND THEN
        INSERT INTO wallet_transactions (user_id, type, amount, category, description, reference_order_id)
        VALUES (OLD.user_id, 'expense', -v_old_tier.price, 'Sale Correction', 'Reversed instant send — ' || OLD.amount || ' R$', NULL);
      END IF;
      SELECT * INTO v_new_tier FROM instant_send_price_tiers WHERE user_id = NEW.user_id AND robux_amount = NEW.amount;
      IF FOUND THEN
        INSERT INTO wallet_transactions (user_id, type, amount, category, description, reference_order_id)
        VALUES (NEW.user_id, 'income', v_new_tier.price, 'Sale', 'Instant Send — ' || NEW.amount || ' R$', NULL);
      END IF;
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    SELECT * INTO v_old_tier FROM instant_send_price_tiers WHERE user_id = OLD.user_id AND robux_amount = OLD.amount;
    IF FOUND THEN
      INSERT INTO wallet_transactions (user_id, type, amount, category, description, reference_order_id)
      VALUES (OLD.user_id, 'expense', -v_old_tier.price, 'Sale Correction', 'Reversed instant send — ' || OLD.amount || ' R$', NULL);
    END IF;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_transfer_log_wallet_effect ON public.transfer_logs;

CREATE TRIGGER trg_transfer_log_wallet_effect
AFTER INSERT OR UPDATE OR DELETE ON public.transfer_logs
FOR EACH ROW EXECUTE FUNCTION public.apply_transfer_log_wallet_effect();

-- Remove the now-redundant manual wallet credit from log_instant_send_sale —
-- the trigger above already credits each chunk as record_transfer inserts it.
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

    -- Routes through record_transfer so the daily/lifetime ceiling checks,
    -- the current_robux-deduction trigger, AND the wallet-crediting trigger
    -- above all apply exactly as they would for any other logged transfer.
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

  RETURN jsonb_build_object('success', true, 'sale_id', v_sale_id, 'price', v_total_price, 'profit', v_total_profit);
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_instant_send_sale(uuid, jsonb, text, timestamptz) TO authenticated;
