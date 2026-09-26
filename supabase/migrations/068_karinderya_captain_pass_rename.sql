-- Migration 068: Rename Karinderya "Captain Pass" -> "Sakura Pass"
--
--   game     Karinderya  84372024-ee1c-43a0-bbfb-6227c43039d3  (existing, untouched)
--   product  1 existing row UPDATEd in place by exact live UUID
--            0 new rows, 0 deletions, 0 deactivations
--
-- Product id 138b0931-102a-4125-a899-e34fee5a1dad was recorded as Captain
-- Pass in migration 065 (299 R$ / 109 PHP / rate 290.00 / cost 86.71 /
-- profit 22.29 / Good). This is a name-only change: every pricing field is
-- asserted to still match those values before the write, and none of them
-- are written. BudgetWise Store presentation metadata is keyed on
-- gamepasses.id, so the id is preserved exactly; only gamepasses.name moves.
--
-- Identity rules honoured by this file (same contract as migrations 065/067):
--   * No games.id or gamepasses.id changes. The product is UPDATEd by its
--     exact audited production UUID, after asserting the row exists, belongs
--     to the catalog owner, belongs to Karinderya, and is named either
--     "Captain Pass" (first run) or already "Sakura Pass" (re-run).
--   * No DELETE, no delete-and-reinsert, no INSERT path at all. If the id is
--     missing, belongs to another game, or carries an unexpected name, the
--     migration ABORTS rather than inventing a substitute row.
--   * Only name is written. robux_amount, your_price, robux_rate, your_cost,
--     profit and status are asserted unchanged, not rewritten.
--   * is_active is NOT written. Section 4 asserts Karinderya still ends at
--     10 total / 7 active, with the same 7 active identities as migration
--     065 (Captain Pass's identity now expressed as Sakura Pass) and the
--     same 3 retired products left untouched.
--   * A rerun after the rename finds the row already named "Sakura Pass",
--     skips the write, and still passes every assertion.
--
-- Run in Supabase SQL Editor. Safe to run multiple times.

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Preconditions
-- -----------------------------------------------------------------------------

DO $$
BEGIN
  IF to_regclass('public.games') IS NULL OR to_regclass('public.gamepasses') IS NULL THEN
    RAISE EXCEPTION 'Migration 068 requires public.games and public.gamepasses';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2. Desired product identity (literals, audited against migration 065)
-- -----------------------------------------------------------------------------

CREATE TEMP TABLE migration_068_product (
  live_id      uuid NOT NULL PRIMARY KEY,
  game_id      uuid NOT NULL,
  old_name     text NOT NULL,
  new_name     text NOT NULL,
  robux_amount integer NOT NULL,
  your_price   numeric(10,2) NOT NULL,
  robux_rate   numeric(10,2) NOT NULL,
  your_cost    numeric(10,2) NOT NULL,
  profit       numeric(10,2) NOT NULL,
  status       text NOT NULL
) ON COMMIT DROP;

INSERT INTO migration_068_product
  (live_id, game_id, old_name, new_name, robux_amount, your_price, robux_rate, your_cost, profit, status)
VALUES
  ('138b0931-102a-4125-a899-e34fee5a1dad', '84372024-ee1c-43a0-bbfb-6227c43039d3',
   'Captain Pass', 'Sakura Pass', 299, 109.00, 290.00, 86.71, 22.29, 'Good');

-- -----------------------------------------------------------------------------
-- 3. Self-check of the supplied figures
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  v_bad text;
BEGIN
  SELECT string_agg(new_name, ', ')
  INTO v_bad
  FROM migration_068_product
  WHERE round(robux_amount * robux_rate / 1000.0, 2) <> your_cost
     OR your_price - your_cost <> profit
     OR status <> CASE WHEN profit >= 20 THEN 'Good' WHEN profit >= 5 THEN 'Okay' ELSE 'Bad' END;

  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 068 internal figures are inconsistent: %', v_bad;
  END IF;

  RAISE NOTICE '[068] desired change: Karinderya / Captain Pass -> Sakura Pass, id 138b0931-102a-4125-a899-e34fee5a1dad, pricing unchanged';
END $$;

-- -----------------------------------------------------------------------------
-- 4. Rename the product in place, by exact id
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  v_user_id     uuid;
  v_owner_count integer;
  p             record;
  live          record;
  v_new_name_id text;
BEGIN
  -- Catalog-owner detection in two explicit steps (PostgreSQL defines no
  -- min/max aggregate for uuid, and casting to text to invent one would order
  -- meaninglessly).
  SELECT count(DISTINCT user_id) INTO v_owner_count
  FROM public.games
  WHERE user_id IS NOT NULL;

  IF v_owner_count <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one XOB catalog owner from public.games, found %', v_owner_count;
  END IF;

  SELECT user_id INTO v_user_id
  FROM public.games
  WHERE user_id IS NOT NULL
  GROUP BY user_id;

  SELECT * INTO p FROM migration_068_product;

  SELECT gp.game_id, gp.name, gp.robux_amount, gp.your_price, gp.robux_rate,
         gp.your_cost, gp.profit, gp.status, gp.is_active
  INTO live
  FROM public.gamepasses gp
  WHERE gp.id = p.live_id AND gp.user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'Expected existing product % (was "%") does not exist for the catalog owner. Refusing to insert a substitute.',
      p.live_id, p.old_name;
  END IF;

  IF live.game_id IS DISTINCT FROM p.game_id THEN
    RAISE EXCEPTION
      'Product % ("%") belongs to game %, not Karinderya (%). Refusing to move or rename it.',
      p.live_id, live.name, live.game_id, p.game_id;
  END IF;

  v_new_name_id := regexp_replace(lower(p.new_name), '[^a-z0-9]+', '', 'g');

  IF regexp_replace(lower(live.name), '[^a-z0-9]+', '', 'g')
       NOT IN (regexp_replace(lower(p.old_name), '[^a-z0-9]+', '', 'g'), v_new_name_id) THEN
    RAISE EXCEPTION
      'Product % is named "%" in production but this migration expects "%" or already "%". Refusing to rename the wrong product.',
      p.live_id, live.name, p.old_name, p.new_name;
  END IF;

  -- Pricing/product identity must be exactly as audited, regardless of which
  -- of the two valid names the row currently carries.
  IF live.robux_amount IS DISTINCT FROM p.robux_amount
     OR live.your_price   IS DISTINCT FROM p.your_price
     OR live.robux_rate   IS DISTINCT FROM p.robux_rate
     OR live.your_cost    IS DISTINCT FROM p.your_cost
     OR live.profit       IS DISTINCT FROM p.profit
     OR live.status       IS DISTINCT FROM p.status THEN
    RAISE EXCEPTION
      'Product % ("%") does not match the audited pricing (R$ % / PHP % / rate % / cost % / profit % / %). Found R$ % / PHP % / rate % / cost % / profit % / %. Refusing to rename under mismatched pricing.',
      p.live_id, live.name,
      p.robux_amount, p.your_price, p.robux_rate, p.your_cost, p.profit, p.status,
      live.robux_amount, live.your_price, live.robux_rate, live.your_cost, live.profit, live.status;
  END IF;

  IF regexp_replace(lower(live.name), '[^a-z0-9]+', '', 'g') = v_new_name_id THEN
    RAISE NOTICE '[068] already renamed: Karinderya / % (id %) -- no write', live.name, p.live_id;
    RETURN;
  END IF;

  UPDATE public.gamepasses
  SET name       = p.new_name,
      updated_at = now()
  WHERE id = p.live_id;

  RAISE NOTICE '[068] RENAMED Karinderya / % -> % (id %); robux_amount, your_price, robux_rate, your_cost, profit, status, is_active all unchanged',
    live.name, p.new_name, p.live_id;
END $$;

-- -----------------------------------------------------------------------------
-- 5. Post-conditions
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  v_user_id uuid;
  v_game_id uuid := '84372024-ee1c-43a0-bbfb-6227c43039d3';
  v_bad     text;
  v_total   integer;
  v_active  integer;
BEGIN
  SELECT user_id INTO v_user_id FROM public.games WHERE user_id IS NOT NULL GROUP BY user_id;

  -- The renamed row itself: id, pricing and active flag exactly as audited;
  -- name now Sakura Pass.
  PERFORM 1
  FROM public.gamepasses gp
  WHERE gp.id = '138b0931-102a-4125-a899-e34fee5a1dad'
    AND gp.user_id = v_user_id
    AND gp.game_id = v_game_id
    AND gp.name = 'Sakura Pass'
    AND gp.robux_amount = 299
    AND gp.your_price = 109.00
    AND gp.robux_rate = 290.00
    AND gp.your_cost = 86.71
    AND gp.profit = 22.29
    AND gp.status = 'Good';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Migration 068 post-condition failed -- Sakura Pass (id 138b0931-102a-4125-a899-e34fee5a1dad) is not in the expected final state';
  END IF;

  -- Karinderya must still total 10 products / 7 active (migration 065's
  -- baseline), with exactly the seven names below active.
  SELECT count(*), count(*) FILTER (WHERE gp.is_active)
  INTO v_total, v_active
  FROM public.gamepasses gp
  WHERE gp.user_id = v_user_id AND gp.game_id = v_game_id;

  IF v_total <> 10 OR v_active <> 7 THEN
    RAISE EXCEPTION
      'Migration 068 post-condition failed -- Karinderya holds % products (% active), expected 10 / 7. Nothing was deleted or deactivated by this migration.',
      v_total, v_active;
  END IF;

  SELECT string_agg(gp.name, ', ' ORDER BY gp.name)
  INTO v_bad
  FROM public.gamepasses gp
  WHERE gp.user_id = v_user_id
    AND gp.game_id = v_game_id
    AND gp.is_active
    AND gp.name NOT IN (
      'VIP Pass', 'Sakura Pass', 'Starter Pack', 'Premium pack',
      'Double Cash', 'Double Luck', 'Ultra Lucky'
    );

  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Karinderya has unexpected active products after migration 068: %', v_bad;
  END IF;

  RAISE NOTICE '[068] post-conditions OK -- Karinderya: 10 products / 7 active, Sakura Pass carries the former Captain Pass id and pricing unchanged';
END $$;

COMMIT;
