-- Migration 067: Evomon catalog re-price at robux_rate 290
--
--   game     Evomon  49b001cd-30a1-4062-a564-b78f646fb2fa  (existing, untouched)
--   products 10 existing rows UPDATEd in place by exact live UUID
--            0 new rows, 0 deletions, 0 deactivations
--
-- Every product id below was audited from production on 2026-09-24 and is the
-- authoritative identity for its row. The name beside each id is asserted, not
-- searched for. All ten rows UPDATE in place; there is no INSERT path.
--
-- Production state at that audit -- recorded for provenance only. NOTHING in
-- this file reads, compares against or depends on these numbers; the skip
-- check in section 5 compares the live row to the DESIRED values, so this
-- migration converges correctly no matter what it finds:
--
--   product                 R$    PHP   rate    cost     profit   status
--   50 Storage                49    20    310     15.19     4.81   Bad
--   2x Faster                 99    39    310     30.69     8.31   Okay
--   King Ball                 99    39    310     30.69     8.31   Okay
--   VIP                      195    79    310     60.45    18.55   Okay
--   Premium Level Rewards    239    95    310     74.09    20.91   Good
--   Prismatic Ball           385   139    310    119.35    19.65   Okay
--   Season Pass              435   159    310    134.85    24.15   Good
--   Advanced Battlepass      479   175    310    148.49    26.51   Good
--   10x King Ball            849   305    310    263.19    41.81   Good
--   10x Prismatic Ball      3409  1229    310   1056.79   172.21   Good
--
-- All ten rows change (every robux_amount, price, rate, cost and profit
-- moves), but exactly ONE margin label moves with them:
--   Prismatic Ball  Okay -> Good  (profit 19.65 -> 22.49, crossing 20)
-- 50 Storage is already Bad and Premium Level Rewards is already Good; both
-- keep their label. This supersedes the pre-audit desk comparison against
-- migration 054, whose recorded prices were stale -- production had drifted
-- by roughly +/-1 PHP per product since 054 was applied.
--
-- Identity rules honoured by this file (same contract as migration 065):
--   * No games.id or gamepasses.id changes. Every product is UPDATEd by its
--     exact audited production UUID, after asserting the row exists, belongs
--     to the catalog owner, belongs to Evomon, and still carries the expected
--     name. Normalized name is a guard, never a search key.
--   * No DELETE, no delete-and-reinsert. Migration 054 wiped this game's rows
--     and re-inserted them; that is precisely what this file does not do.
--   * No INSERT path at all. All ten products are expected to exist. If one is
--     missing the migration ABORTS rather than inventing a substitute row --
--     BudgetWise Store presentation metadata is keyed on gamepasses.id.
--   * is_active is NOT written. This is a pricing change. Section 7 asserts
--     the game ends at 10 total / 10 active rather than forcing that state.
--   * Rows already holding the desired values are skipped entirely, so a
--     re-run writes nothing and does not bump updated_at.
--   * public.games and public.game_roblox_identity are never written. Section
--     7 asserts the Evomon identity row is still present and untouched.
--
-- Margin label: gamepasses.status ('Good' >= 20, 'Okay' >= 5, else 'Bad' --
-- calculateStatus() in src/lib/utils/pricing.ts). No new column.
--
-- Cost rate: every supplied row is exactly robux_amount * 290 / 1000, and
-- profit = your_price - your_cost. Section 3 asserts both before writing.
--
-- Run in Supabase SQL Editor. Safe to run multiple times.

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Preconditions
-- -----------------------------------------------------------------------------

DO $$
BEGIN
  IF to_regclass('public.games') IS NULL OR to_regclass('public.gamepasses') IS NULL THEN
    RAISE EXCEPTION 'Migration 067 requires public.games and public.gamepasses';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2. Desired catalog (literals)
-- -----------------------------------------------------------------------------

CREATE TEMP TABLE migration_067_game (
  game_id           uuid NOT NULL,
  display_name      text NOT NULL,
  expected_identity text NOT NULL
) ON COMMIT DROP;

INSERT INTO migration_067_game VALUES
  ('49b001cd-30a1-4062-a564-b78f646fb2fa', 'Evomon', 'evomon');

CREATE TEMP TABLE migration_067_product (
  live_id      uuid NOT NULL PRIMARY KEY,
  name         text NOT NULL,
  robux_amount integer NOT NULL,
  your_price   numeric(10,2) NOT NULL,
  robux_rate   numeric(10,2) NOT NULL,
  your_cost    numeric(10,2) NOT NULL,
  profit       numeric(10,2) NOT NULL,
  status       text NOT NULL
) ON COMMIT DROP;

-- Owner-supplied pricelist against production ids audited 2026-09-24.
-- The id is the identity; the name is a guard that must still match.
INSERT INTO migration_067_product
  (live_id, name, robux_amount, your_price, robux_rate, your_cost, profit, status)
VALUES
  ('4e31956b-6f03-4501-9320-3a51a546bef2', '50 Storage',             39,   15, 290.00,  11.31,   3.69, 'Bad'),
  ('b129d667-0c07-4bdc-b159-f0d0d3321935', '2x Faster',              79,   31, 290.00,  22.91,   8.09, 'Okay'),
  ('d8f797c8-7ac1-4928-87c1-2c7628900570', 'King Ball',              79,   31, 290.00,  22.91,   8.09, 'Okay'),
  ('68b2d7dd-7970-48e6-86f2-574d3ea39e1a', 'VIP',                   159,   65, 290.00,  46.11,  18.89, 'Okay'),
  ('e89ba8c5-65ca-45c9-bc47-982ee33822fe', 'Premium Level Rewards', 199,   79, 290.00,  57.71,  21.29, 'Good'),
  ('2978208f-2cd6-4fbb-86f8-a8c7ffceaa1f', 'Prismatic Ball',        319,  115, 290.00,  92.51,  22.49, 'Good'),
  ('f67bfce6-9a2b-405c-9722-0cd928ce6c26', 'Season Pass',           359,  130, 290.00, 104.11,  25.89, 'Good'),
  ('d5ea70c8-5881-4ef5-b2e7-24d4bc8f4357', 'Advanced Battlepass',   399,  145, 290.00, 115.71,  29.29, 'Good'),
  ('449c8cb4-f996-4ea8-bb4c-50234d6909ff', '10x King Ball',         709,  255, 290.00, 205.61,  49.39, 'Good'),
  ('93d44bf2-ea1d-4d5d-812c-5ad42f0d714d', '10x Prismatic Ball',   2839, 1025, 290.00, 823.31, 201.69, 'Good');

-- -----------------------------------------------------------------------------
-- 3. Self-check of the supplied figures, and the placeholder gate
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  v_bad text;
BEGIN
  -- Placeholder gate. All ten ids are real as of 2026-09-24, so this finds
  -- nothing; it stays as a guard against a future edit leaving a stub id in,
  -- which would otherwise fail later with a confusing "does not exist".
  SELECT string_agg(format('%s (%s)', name, live_id), ', ' ORDER BY robux_amount)
  INTO v_bad
  FROM migration_067_product
  WHERE live_id::text LIKE '00000000-0000-0000-0000-%';

  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION
      'Migration 067 still carries placeholder production ids for: %. Run the read-only Evomon audit, paste the real 36-character public.gamepasses.id over each placeholder, then re-run. Nothing has been written.',
      v_bad;
  END IF;

  SELECT string_agg(name, ', ' ORDER BY name)
  INTO v_bad
  FROM migration_067_product
  WHERE round(robux_amount * robux_rate / 1000.0, 2) <> your_cost
     OR your_price - your_cost <> profit
     OR status <> CASE WHEN profit >= 20 THEN 'Good' WHEN profit >= 5 THEN 'Okay' ELSE 'Bad' END
     OR robux_rate <> 290.00;

  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 067 internal figures are inconsistent at rate 290: %', v_bad;
  END IF;

  SELECT string_agg(identity || ' (' || n || ' rows)', ', ' ORDER BY identity)
  INTO v_bad
  FROM (
    SELECT regexp_replace(lower(name), '[^a-z0-9]+', '', 'g') AS identity, count(*) AS n
    FROM migration_067_product
    GROUP BY 1
    HAVING count(*) > 1
  ) d;

  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 067 desired list repeats a product identity: %', v_bad;
  END IF;

  IF (SELECT count(*) FROM migration_067_product) <> 10 THEN
    RAISE EXCEPTION 'Migration 067 expects exactly 10 desired products, found %',
      (SELECT count(*) FROM migration_067_product);
  END IF;

  RAISE NOTICE '[067] desired catalog: 10 Evomon products, all rate 290.00, all UPDATE-in-place';
END $$;

-- -----------------------------------------------------------------------------
-- 4. Resolve the game by its pinned id
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  v_user_id     uuid;
  v_owner_count integer;
  v_name        text;
  g             record;
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

  SELECT * INTO g FROM migration_067_game;

  SELECT name INTO v_name
  FROM public.games
  WHERE id = g.game_id AND user_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expected existing game % (%) was not found for the catalog owner',
      g.display_name, g.game_id;
  END IF;

  IF regexp_replace(lower(v_name), '[^a-z0-9]+', '', 'g') <> g.expected_identity THEN
    RAISE EXCEPTION 'Game % is named "%", which no longer matches expected identity "%"',
      g.game_id, v_name, g.expected_identity;
  END IF;

  RAISE NOTICE '[067] game % -> % (existing, not written to)', g.display_name, g.game_id;
END $$;

-- -----------------------------------------------------------------------------
-- 5. Update the ten products in place, by exact id
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  v_user_id uuid;
  v_game_id uuid;
  v_dupes   text;
  v_updated integer := 0;
  v_skipped integer := 0;
  live      record;
  r         record;
BEGIN
  -- Section 4 already asserted exactly one catalog owner, so this is
  -- single-valued. GROUP BY (not DISTINCT INTO) keeps that explicit.
  SELECT user_id INTO v_user_id FROM public.games WHERE user_id IS NOT NULL GROUP BY user_id;
  SELECT game_id INTO v_game_id FROM migration_067_game;

  -- Existing Evomon products must have unambiguous identities, or the name
  -- guard below could pass against the wrong row.
  SELECT string_agg(identity || ' (' || n || ' rows)', ', ' ORDER BY identity)
  INTO v_dupes
  FROM (
    SELECT regexp_replace(lower(name), '[^a-z0-9]+', '', 'g') AS identity, count(*) AS n
    FROM public.gamepasses
    WHERE user_id = v_user_id AND game_id = v_game_id
    GROUP BY 1
    HAVING count(*) > 1
  ) d;

  IF v_dupes IS NOT NULL THEN
    RAISE EXCEPTION 'Ambiguous Evomon product identities in production: %. Resolve by hand first.', v_dupes;
  END IF;

  FOR r IN SELECT * FROM migration_067_product ORDER BY robux_amount, name LOOP
    SELECT gp.game_id, gp.name, gp.robux_amount, gp.your_price, gp.robux_rate,
           gp.your_cost, gp.profit, gp.status, gp.is_active
    INTO live
    FROM public.gamepasses gp
    WHERE gp.id = r.live_id AND gp.user_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION
        'Expected existing product % ("%") does not exist for the catalog owner. Refusing to insert a substitute.',
        r.live_id, r.name;
    END IF;

    IF live.game_id IS DISTINCT FROM v_game_id THEN
      RAISE EXCEPTION
        'Product % ("%") belongs to game %, not Evomon (%). Refusing to move or replace it.',
        r.live_id, r.name, live.game_id, v_game_id;
    END IF;

    IF regexp_replace(lower(live.name), '[^a-z0-9]+', '', 'g')
       <> regexp_replace(lower(r.name), '[^a-z0-9]+', '', 'g') THEN
      RAISE EXCEPTION
        'Product % is named "%" in production but this migration expects "%". Refusing to update the wrong product.',
        r.live_id, live.name, r.name;
    END IF;

    IF live.name         IS NOT DISTINCT FROM r.name
       AND live.robux_amount IS NOT DISTINCT FROM r.robux_amount
       AND live.your_price   IS NOT DISTINCT FROM r.your_price
       AND live.robux_rate   IS NOT DISTINCT FROM r.robux_rate
       AND live.your_cost    IS NOT DISTINCT FROM r.your_cost
       AND live.profit       IS NOT DISTINCT FROM r.profit
       AND live.status       IS NOT DISTINCT FROM r.status THEN
      v_skipped := v_skipped + 1;
      RAISE NOTICE '[067] unchanged: % (%) -- no write', r.name, r.live_id;
      CONTINUE;
    END IF;

    -- name is written too: it normalizes capitalisation/spacing drift on the
    -- SAME row. It never selects a row and never creates one.
    UPDATE public.gamepasses
    SET name         = r.name,
        robux_amount = r.robux_amount,
        your_price   = r.your_price,
        robux_rate   = r.robux_rate,
        your_cost    = r.your_cost,
        profit       = r.profit,
        status       = r.status,
        updated_at   = now()
    WHERE id = r.live_id;

    v_updated := v_updated + 1;

    RAISE NOTICE '[067] UPDATED % (%): R$ % -> %, PHP % -> %, rate % -> %, cost % -> %, profit % -> %, status % -> %, is_active % (untouched)',
      r.name, r.live_id,
      live.robux_amount, r.robux_amount,
      live.your_price,   r.your_price,
      live.robux_rate,   r.robux_rate,
      live.your_cost,    r.your_cost,
      live.profit,       r.profit,
      live.status,       r.status,
      live.is_active;
  END LOOP;

  RAISE NOTICE '[067] products: % updated, % already correct', v_updated, v_skipped;
END $$;

-- -----------------------------------------------------------------------------
-- 6. Report Evomon products absent from the desired list
-- -----------------------------------------------------------------------------
-- Reported only. Nothing is deleted and nothing is deactivated. The owner
-- decides whether these were removed from the game.

DO $$
DECLARE
  v_user_id uuid;
  v_game_id uuid;
  v_any     boolean := false;
  r         record;
BEGIN
  SELECT user_id INTO v_user_id FROM public.games WHERE user_id IS NOT NULL GROUP BY user_id;
  SELECT game_id INTO v_game_id FROM migration_067_game;

  FOR r IN
    SELECT gp.id, gp.name, gp.robux_amount, gp.your_price, gp.robux_rate, gp.is_active
    FROM public.gamepasses gp
    WHERE gp.user_id = v_user_id
      AND gp.game_id = v_game_id
      AND NOT EXISTS (SELECT 1 FROM migration_067_product p WHERE p.live_id = gp.id)
    ORDER BY gp.name
  LOOP
    v_any := true;
    RAISE NOTICE '[067] NOT IN DESIRED LIST: Evomon / % (id %, R$ %, PHP %, rate %, is_active=%) -- left untouched',
      r.name, r.id, r.robux_amount, r.your_price, r.robux_rate, r.is_active;
  END LOOP;

  IF NOT v_any THEN
    RAISE NOTICE '[067] every existing Evomon product is in the desired list';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 7. Post-conditions
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  v_user_id uuid;
  v_game_id uuid;
  v_bad     text;
  v_total   integer;
  v_extra   integer;
  v_active  integer;
BEGIN
  SELECT user_id INTO v_user_id FROM public.games WHERE user_id IS NOT NULL GROUP BY user_id;
  SELECT game_id INTO v_game_id FROM migration_067_game;

  SELECT string_agg(format('%s (%s)', p.name, p.live_id), ', ' ORDER BY p.name)
  INTO v_bad
  FROM migration_067_product p
  LEFT JOIN public.gamepasses gp
    ON gp.id = p.live_id AND gp.user_id = v_user_id AND gp.game_id = v_game_id
  WHERE gp.id IS NULL
     OR gp.name         IS DISTINCT FROM p.name
     OR gp.robux_amount IS DISTINCT FROM p.robux_amount
     OR gp.your_price   IS DISTINCT FROM p.your_price
     OR gp.robux_rate   IS DISTINCT FROM p.robux_rate
     OR gp.your_cost    IS DISTINCT FROM p.your_cost
     OR gp.profit       IS DISTINCT FROM p.profit
     OR gp.status       IS DISTINCT FROM p.status;

  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 067 post-condition failed -- these products are not in the desired state: %', v_bad;
  END IF;

  -- Roblox identity, the games row, artwork and sort order are out of scope:
  -- this migration issues no write against public.games or
  -- public.game_roblox_identity at all, so there is nothing to restore here.
  -- The presence check is a cheap tripwire only -- a missing row means
  -- migration 064 was never applied, not that this file disturbed anything.
  IF to_regclass('public.game_roblox_identity') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM public.game_roblox_identity WHERE game_id = v_game_id) THEN
    RAISE NOTICE '[067] WARNING: Evomon has no game_roblox_identity row (expected one from migration 064). Not written by this migration; check 064 separately.';
  END IF;

  -- The owner audited Evomon on 2026-09-24 as exactly these ten products, all
  -- active. Asserting that turns the expectation into a guarantee: a product
  -- nobody has reviewed, or one that has since been deactivated, rolls the
  -- whole transaction back instead of committing a catalog silently out of
  -- step with BudgetWise Store. Section 6 has already named the offender in
  -- the notice log by the time this fires.
  SELECT count(*),
         count(*) FILTER (WHERE p.live_id IS NULL),
         count(*) FILTER (WHERE gp.is_active)
  INTO v_total, v_extra, v_active
  FROM public.gamepasses gp
  LEFT JOIN migration_067_product p ON p.live_id = gp.id
  WHERE gp.user_id = v_user_id AND gp.game_id = v_game_id;

  IF v_total <> 10 OR v_active <> 10 THEN
    RAISE EXCEPTION
      'Migration 067 post-condition failed -- Evomon holds % products (% active), expected 10 / 10. % of them are not in the desired list (see the section 6 notices). Nothing was committed; no row was deleted or deactivated.',
      v_total, v_active, v_extra;
  END IF;

  RAISE NOTICE '[067] post-conditions OK -- Evomon: 10 products / 10 active, all at rate 290.00, all ids unchanged';
END $$;

COMMIT;
