-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 029: Transfer logs dated today deduct from current_robux
-- Run in Supabase SQL Editor. Safe to run multiple times (idempotent).
--
-- An instant send is a real outflow of Robux from the account, so logging
-- one for TODAY should immediately reduce roblox_accounts.current_robux —
-- whether it came from the live +50/+100/+250/Custom buttons or from
-- "Log a Transfer" with today's date/time. Logging a transfer for a PREVIOUS
-- day (backfilling history from before this feature existed) does NOT touch
-- current_robux — the operator's current balance is assumed to already
-- reflect that historical send, so deducting again would double-count it.
--
-- Implemented as a trigger rather than duplicating the logic in
-- record_transfer / update_transfer_log separately, so it applies uniformly
-- no matter which RPC (or a raw delete) touches transfer_logs:
--   INSERT: deduct amount if the new row's sent_at falls on today.
--   UPDATE: refund the old amount if the old row was today, then deduct the
--           new amount if the new row is today — correctly handles edits
--           that change the amount, move the date in or out of today, or both.
--   DELETE: refund the amount if the deleted row was today.
-- Runs inside the same transaction as record_transfer/update_transfer_log,
-- which already lock the account row first, so it inherits that lock; a raw
-- delete is a single atomic UPDATE statement, safe without extra locking.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.apply_transfer_log_robux_effect()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today_start timestamptz := date_trunc('day', now());
  v_today_end   timestamptz := v_today_start + interval '1 day';
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.sent_at >= v_today_start AND NEW.sent_at < v_today_end THEN
      UPDATE roblox_accounts SET current_robux = current_robux - NEW.amount WHERE id = NEW.roblox_account_id;
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.sent_at >= v_today_start AND OLD.sent_at < v_today_end THEN
      UPDATE roblox_accounts SET current_robux = current_robux + OLD.amount WHERE id = OLD.roblox_account_id;
    END IF;
    IF NEW.sent_at >= v_today_start AND NEW.sent_at < v_today_end THEN
      UPDATE roblox_accounts SET current_robux = current_robux - NEW.amount WHERE id = NEW.roblox_account_id;
    END IF;
    RETURN NEW;

  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.sent_at >= v_today_start AND OLD.sent_at < v_today_end THEN
      UPDATE roblox_accounts SET current_robux = current_robux + OLD.amount WHERE id = OLD.roblox_account_id;
    END IF;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_transfer_log_robux_effect ON public.transfer_logs;

CREATE TRIGGER trg_transfer_log_robux_effect
AFTER INSERT OR UPDATE OR DELETE ON public.transfer_logs
FOR EACH ROW EXECUTE FUNCTION public.apply_transfer_log_robux_effect();
