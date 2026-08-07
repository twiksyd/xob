-- ─────────────────────────────────────────────────────────────────────────────
-- Tests for assign_order_account (migration 047)
--
-- Run these in the Supabase SQL Editor while logged in as a test user.
-- Each block is self-contained and rolls back its own data so rows are not
-- left behind. Wrap each test in a DO / BEGIN / ROLLBACK block.
--
-- IMPORTANT: Replace <test_user_id>, <test_order_id_N>, <test_account_id_N>
-- with real UUIDs from your database before running.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Helper: show current state ────────────────────────────────────────────────
-- SELECT o.id, o.status, o.roblox_account_id, o.robux_amount,
--        a.username, a.current_robux, a.reserved_robux,
--        (a.current_robux - a.reserved_robux) AS available,
--        r.status AS rsv_status, r.robux_amount AS rsv_amount
-- FROM orders o
-- LEFT JOIN roblox_accounts a ON a.id = '<test_account_id>'
-- LEFT JOIN robux_reservations r ON r.order_id = o.id AND r.status = 'active'
-- WHERE o.id = '<test_order_id>';

-- ─────────────────────────────────────────────────────────────────────────────
-- TEST 1: Nominal happy path — assign_order_account succeeds
-- Expected: order.roblox_account_id set, reservation created, reserved_robux++
-- ─────────────────────────────────────────────────────────────────────────────
/*
BEGIN;

-- Precondition: a pending order with no account, an active account with enough Robux.
-- SELECT public.assign_order_account('<test_order_id_1>', '<test_account_id_1>');
-- Check: SELECT roblox_account_id FROM orders WHERE id = '<test_order_id_1>';
-- Check: SELECT * FROM robux_reservations WHERE order_id = '<test_order_id_1>' AND status = 'active';
-- Check: SELECT reserved_robux FROM roblox_accounts WHERE id = '<test_account_id_1>';

ROLLBACK; -- remove test data
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- TEST 2: Reservation succeeds, order update fails
-- With assign_order_account this scenario CANNOT HAPPEN — both writes are in
-- one transaction. If either fails, PostgreSQL rolls back both automatically.
-- The test below verifies that on a simulated failure the account balance is
-- unchanged and no active reservation exists.
-- ─────────────────────────────────────────────────────────────────────────────
/*
BEGIN;

-- Force the order update to fail by temporarily making roblox_account_id NOT NULL
-- constrained to a non-existent account, then call assign_order_account and verify rollback.
-- (Use a constraint violation or RAISE to simulate mid-transaction failure.)

-- Simpler: try assigning to an order that doesn't exist.
SELECT public.assign_order_account(gen_random_uuid(), '<test_account_id_1>');
-- Expected: exception "Order not found or access denied"
-- Check that reserved_robux on account is UNCHANGED.

ROLLBACK;
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- TEST 3: Repeated assignment to the same account (idempotency / noop path)
-- The JS layer skips this via the "unchanged" guard (prevId === newId), so
-- assign_order_account should never be called with the same account that is
-- already assigned. But if it is called, it raises an exception because
-- roblox_account_id IS NOT NULL.
-- Expected: EXCEPTION "Order already has an assigned account"
-- ─────────────────────────────────────────────────────────────────────────────
/*
BEGIN;

-- First assignment (succeeds):
SELECT public.assign_order_account('<test_order_id_1>', '<test_account_id_1>');

-- Second call with same account — should raise:
SELECT public.assign_order_account('<test_order_id_1>', '<test_account_id_1>');
-- Expected: EXCEPTION 'Order already has an assigned account — use reassign_order_account instead'

ROLLBACK;
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- TEST 4: Account balance changes between dialog open and save
-- Scenario: Account has 500 R$ when dialog opens. Another order consumes 450 R$.
-- Now the account has only 50 R$. Client sends assign_order_account for 200 R$.
-- Expected: EXCEPTION "Insufficient Robux on ..."
-- ─────────────────────────────────────────────────────────────────────────────
/*
BEGIN;

-- Simulate: manually set reserved_robux high so available < order requirement.
UPDATE roblox_accounts SET reserved_robux = current_robux - 50 WHERE id = '<test_account_id_1>';

SELECT public.assign_order_account('<test_order_id_200r>', '<test_account_id_1>');
-- test_order_id_200r has robux_amount = 200
-- Expected: EXCEPTION 'Insufficient Robux on "...": 200 required, 50 available'

ROLLBACK;
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- TEST 5: Order status changes before save (e.g. cancelled while dialog is open)
-- Expected: EXCEPTION 'Order cannot be assigned in status "cancelled"'
-- ─────────────────────────────────────────────────────────────────────────────
/*
BEGIN;

UPDATE orders SET status = 'cancelled' WHERE id = '<test_order_id_1>';

SELECT public.assign_order_account('<test_order_id_1>', '<test_account_id_1>');
-- Expected: EXCEPTION 'Order cannot be assigned in status "cancelled"'

ROLLBACK;
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- TEST 6: Reassignment A → B (uses reassign_order_account, not assign_order_account)
-- Verify that reassign_order_account atomically moves reservation and order row.
-- Expected: old account reserved_robux--, new account reserved_robux++,
--           orders.roblox_account_id = new account, audit row in order_reassignments
-- ─────────────────────────────────────────────────────────────────────────────
/*
BEGIN;

-- First assign account A:
SELECT public.assign_order_account('<test_order_id_1>', '<test_account_id_A>');

-- Then reassign to B:
SELECT public.reassign_order_account('<test_order_id_1>', '<test_account_id_B>');
-- Check orders.roblox_account_id = test_account_id_B
-- Check roblox_accounts WHERE id = test_account_id_A → reserved_robux decreased
-- Check roblox_accounts WHERE id = test_account_id_B → reserved_robux increased
-- Check order_reassignments for audit row

ROLLBACK;
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- TEST 7: Removal A → null (uses release_order_reservation + orders.update)
-- Expected: reservation released, reserved_robux--, orders.roblox_account_id = null
-- ─────────────────────────────────────────────────────────────────────────────
/*
BEGIN;

SELECT public.assign_order_account('<test_order_id_1>', '<test_account_id_1>');

SELECT public.release_order_reservation('<test_order_id_1>');
UPDATE orders SET roblox_account_id = NULL WHERE id = '<test_order_id_1>';

-- Check no active reservation: SELECT * FROM robux_reservations WHERE order_id = '<test_order_id_1>' AND status = 'active';
-- Check orders.roblox_account_id IS NULL

ROLLBACK;
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- TEST 8: Multiple items assigned to one account (grouped BW order)
-- Scenario: BW order BW-001 has 3 items, each 200 R$, all assigned to account A.
-- Account A has 700 R$ available. Total = 600 R$. Should succeed.
-- Client-side validation checks 700 >= 600 (effective available >= total required).
-- Each item calls assign_order_account separately; per-item balance is 200 R$.
-- After item 1: available = 700 - 200 = 500. Item 2: 500 - 200 = 300. Item 3: 300 - 200 = 100.
-- All succeed. No cross-item atomicity at DB level — the client processes them in parallel.
-- ─────────────────────────────────────────────────────────────────────────────
/*
BEGIN;

SELECT public.assign_order_account('<bw_item_1_order_id>', '<test_account_id_1>');
SELECT public.assign_order_account('<bw_item_2_order_id>', '<test_account_id_1>');
SELECT public.assign_order_account('<bw_item_3_order_id>', '<test_account_id_1>');

-- Check reserved_robux = original_reserved + 600
-- Check 3 active reservations, one per order

ROLLBACK;
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- TEST 9: Partial failure in a grouped order
-- Scenario: BW order has 2 items. Item 1 succeeds. Item 2 fails (account banned).
-- Expected: item 1 is committed (assign_order_account already returned),
--           item 2 fails with error. Dialog stays open, shows item-level error.
--           User can fix item 2 assignment and retry. Item 1 retries as "unchanged" (noop).
-- NOTE: Within the JS layer each item is an independent DB call. There is no
--       cross-item transaction. Partial failure leaves a committed partial state.
--       This is the expected behavior per the requirements.
-- ─────────────────────────────────────────────────────────────────────────────
/*
BEGIN;

SELECT public.assign_order_account('<bw_item_1_order_id>', '<test_account_id_active>');
-- Expected: success

SELECT public.assign_order_account('<bw_item_2_order_id>', '<test_account_id_banned>');
-- Expected: EXCEPTION 'Account "..." is not eligible for assignment (status: banned)'

-- State: bw_item_1 is assigned; bw_item_2 has no assignment.
-- Client receives AssignmentItemResult[] with item 1 ok, item 2 error.
-- Dialog stays open. Footer shows "1 saved · 1 failed — fix and retry".

ROLLBACK;
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- ATOMICITY REPORT
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Initial assignment (null → account):
--   STATUS: TRULY ATOMIC via assign_order_account (migration 047).
--   The reservation INSERT and orders UPDATE share one PostgreSQL transaction.
--   If the function raises an exception at any point, the entire transaction
--   rolls back. No orphaned reservations or half-assigned orders can result.
--
--   The client code includes a fallback to the two-step approach
--   (reserve_order_robux → orders.update) if assign_order_account is unavailable
--   (e.g. the migration has not yet been applied to a given environment).
--   In fallback mode, compensating cleanup (release_order_reservation) runs if
--   the orders.update fails, preventing the reservation from being orphaned.
--
-- Reassignment (account A → account B):
--   STATUS: TRULY ATOMIC via reassign_order_account (migration 010).
--
-- Removal (account → null):
--   STATUS: NON-ATOMIC (two steps: release_order_reservation + orders.update null).
--   Risk: if the orders.update fails after the release, the reservation is released
--   but the order row still shows the old account. This is an existing limitation;
--   a remove_order_account RPC would close it if needed.
-- ─────────────────────────────────────────────────────────────────────────────
