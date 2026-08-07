-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 047: Atomic initial account assignment
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New Query → Run All).
-- Safe to run multiple times (idempotent via CREATE OR REPLACE).
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Adds assign_order_account(p_order_id, p_account_id):
--
--   Prior code (Phase 2) handled null → account via two sequential steps:
--     1. reserve_order_robux   → creates reservation, bumps reserved_robux
--     2. orders.update         → writes roblox_account_id
--   If step 2 failed after step 1 succeeded the reservation was orphaned:
--   the account's reserved_robux was inflated with no order pointing to it.
--
--   This RPC closes the gap by executing both writes in a single PostgreSQL
--   transaction. On any failure the entire transaction rolls back automatically
--   so neither the reservation nor the order-row update can partially persist.
--
-- Validations (all server-side, cannot be bypassed by the browser client):
--   1. Order exists and belongs to the calling user (via auth.uid())
--   2. Order status is pending or paid (initial assignment only)
--   3. Order currently has no assigned account (use reassign_order_account if it does)
--   4. Account exists and belongs to the calling user
--   5. Account status is not inactive or banned
--   6. Available Robux on the account (current_robux − reserved_robux) ≥ orders.robux_amount
--
-- Access: authenticated role only. Anonymous clients cannot call this function.
--         The service_role bypasses all grants and can always call it.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.assign_order_account(
  p_order_id   uuid,
  p_account_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid            uuid := auth.uid();
  v_order          orders%ROWTYPE;
  v_account        roblox_accounts%ROWTYPE;
  v_stale_rsv      robux_reservations%ROWTYPE;
  v_available      integer;
  v_robux_amount   integer;
  v_gamepass_names text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- ── 1. Lock and validate the order ─────────────────────────────────────────
  SELECT * INTO v_order
  FROM orders
  WHERE id = p_order_id AND user_id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found or access denied';
  END IF;

  IF v_order.status NOT IN ('pending', 'paid') THEN
    RAISE EXCEPTION 'Order cannot be assigned in status "%"', v_order.status;
  END IF;

  IF v_order.roblox_account_id IS NOT NULL THEN
    RAISE EXCEPTION 'Order already has an assigned account — use reassign_order_account instead';
  END IF;

  v_robux_amount := COALESCE(v_order.robux_amount, 0);

  -- ── 2. Lock and validate the account ───────────────────────────────────────
  SELECT * INTO v_account
  FROM roblox_accounts
  WHERE id = p_account_id AND user_id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Account not found or access denied';
  END IF;

  IF v_account.status IN ('inactive', 'banned') THEN
    RAISE EXCEPTION 'Account "%" is not eligible for assignment (status: %)',
      v_account.username, v_account.status;
  END IF;

  -- ── 3. Server-side available Robux re-validation ───────────────────────────
  -- Reads the DB values at commit time, so stale client-side caches cannot
  -- over-commit an account that was spent down between dialog-open and save.
  v_available := COALESCE(v_account.current_robux, 0) - COALESCE(v_account.reserved_robux, 0);

  IF v_available < v_robux_amount THEN
    RAISE EXCEPTION 'Insufficient Robux on "%": % required, % available',
      v_account.username, v_robux_amount, v_available;
  END IF;

  -- ── 4. Resolve gamepass name for the reservation record ────────────────────
  -- BW orders: resolve via orders.gamepass_id → gamepasses.name
  -- XOB orders: aggregate from order_items (same approach as reassign_order_account)
  SELECT COALESCE(g.name, '') INTO v_gamepass_names
  FROM gamepasses g WHERE g.id = v_order.gamepass_id;

  IF v_gamepass_names IS NULL OR v_gamepass_names = '' THEN
    SELECT COALESCE(string_agg(gamepass_name, ', '), '') INTO v_gamepass_names
    FROM order_items WHERE order_id = p_order_id;
  END IF;

  v_gamepass_names := COALESCE(v_gamepass_names, '');

  -- ── 5. Release any stale reservation (defensive) ───────────────────────────
  -- A null-account order should have no active reservation, but guard anyway.
  SELECT * INTO v_stale_rsv
  FROM robux_reservations
  WHERE order_id = p_order_id AND status = 'active'
  FOR UPDATE;

  IF FOUND THEN
    UPDATE roblox_accounts SET
      reserved_robux = GREATEST(0, reserved_robux - v_stale_rsv.robux_amount),
      updated_at     = now()
    WHERE id = v_stale_rsv.account_id;

    UPDATE robux_reservations SET
      status      = 'released',
      released_at = now()
    WHERE id = v_stale_rsv.id;
  END IF;

  -- ── 6. Create active reservation ───────────────────────────────────────────
  INSERT INTO robux_reservations (
    user_id, order_id, account_id, robux_amount, gamepass_names
  ) VALUES (
    v_uid, p_order_id, p_account_id, v_robux_amount, v_gamepass_names
  );

  -- ── 7. Increment account's reserved_robux ──────────────────────────────────
  UPDATE roblox_accounts SET
    reserved_robux = reserved_robux + v_robux_amount,
    updated_at     = now()
  WHERE id = p_account_id;

  -- ── 8. Assign the order ────────────────────────────────────────────────────
  UPDATE orders SET
    roblox_account_id = p_account_id,
    updated_at        = now()
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'success',               true,
    'order_id',              p_order_id,
    'account_id',            p_account_id,
    'account_username',      v_account.username,
    'robux_reserved',        v_robux_amount,
    'account_available_after', v_available - v_robux_amount
  );
END;
$$;

-- Deny anonymous access. Authenticated dashboard users and service_role can call it.
REVOKE EXECUTE ON FUNCTION public.assign_order_account(uuid, uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.assign_order_account(uuid, uuid) TO authenticated;
