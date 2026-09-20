-- Migration 065: Catalog/pricelist update
--   existing games  ROBUX PLUS, Karinderya          (products updated in place)
--   new games       Ghost Driver, Steal An Egg, Ihaw Ihaw
--
-- XOB is the source of truth for games, products, required Robux, selling
-- price, cost, profit and the margin label. BudgetWise Store reads this data;
-- nothing here is written into the Store.
--
-- Identity rules honoured by this file:
--   * No existing games.id or gamepasses.id changes. Existing products are
--     matched on normalized name and UPDATEd in place.
--   * No DELETE, no delete-and-reinsert, no fuzzy/rename matching.
--   * Three Karinderya products the owner has confirmed are no longer in the
--     game are RETIRED: is_active = false, by exact id, nothing else touched
--     (section 7). Their rows, ids, prices and order history all stay. Any
--     other product absent from the desired lists is only REPORTED (section 6)
--     and left alone.
--   * Genuinely new games and products carry pinned UUIDs written into this
--     file, so re-running is a no-op and the ids are stable forever.
--   * Products that already exist in production (all ten ROBUX PLUS tiers and
--     five of the seven Karinderya products) are identified by their ACTUAL
--     live UUID, audited from production on 2026-09-20 -- not by name. Each is
--     UPDATEd by exact id after asserting that the row exists, belongs to the
--     catalog owner, belongs to the expected game, and still carries the
--     expected product name. Normalized name is a sanity check only. Any of
--     those assertions failing ABORTS the transaction; no substitute row is
--     ever inserted, so a production product id cannot be shadowed.
--
-- Margin label: gamepasses.status already is that field
-- ('Good' >= 20, 'Okay' >= 5, 'Bad' otherwise -- see calculateStatus() in
-- src/lib/utils/pricing.ts). No new column is created.
--
-- Cost rate: every supplied row is exactly robux_amount * 290 / 1000, so
-- robux_rate = 290.00 throughout. The migration asserts this, and asserts
-- profit = your_price - your_cost and that status matches calculateStatus().
--
-- Roblox identity (public.game_roblox_identity, migration 063):
--   Ghost Driver  verified      universe 10173311467  gamepass_overlap
--   Ihaw Ihaw     verified      universe 10764431367  owner_confirmed
--   Steal An Egg  needs_review  -- see the review_note; the exact-name
--                                  candidate's live game pass prices
--                                  contradict the supplied pricelist.
-- The existing verified Karinderya identity and the not_roblox ROBUX PLUS
-- identity are not touched.
--
-- Requires migrations 063 and 064. Run in Supabase SQL Editor.
-- Safe to run multiple times.

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Preconditions
-- -----------------------------------------------------------------------------

DO $$
BEGIN
  IF to_regclass('public.games') IS NULL OR to_regclass('public.gamepasses') IS NULL THEN
    RAISE EXCEPTION 'Migration 065 requires public.games and public.gamepasses';
  END IF;

  IF to_regclass('public.game_roblox_identity') IS NULL THEN
    RAISE EXCEPTION 'Migration 065 requires migration 063 (public.game_roblox_identity)';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    WHERE t.tgrelid = 'public.game_roblox_identity'::regclass
      AND t.tgname = 'game_roblox_identity_audit_direct_write'
      AND t.tgenabled IN ('O', 'A')
  ) THEN
    RAISE EXCEPTION 'Migration 065 requires the enabled migration 063 audit trigger game_roblox_identity_audit_direct_write';
  END IF;

  IF current_setting('session_replication_role') <> 'origin' THEN
    RAISE EXCEPTION 'Migration 065 must run with session_replication_role = origin so its identity writes are audited';
  END IF;

  IF current_setting('xob.game_roblox_identity_rpc', true) = 'on' THEN
    RAISE EXCEPTION 'Migration 065 must not run with xob.game_roblox_identity_rpc = on (it suppresses direct_sql audit entries)';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 2. Desired catalog (literals)
-- -----------------------------------------------------------------------------

CREATE TEMP TABLE migration_065_game (
  game_key          text PRIMARY KEY,
  pinned_game_id    uuid,          -- set = the game must already exist under this id
  new_game_id       uuid NOT NULL, -- used only when the game has to be created
  display_name      text NOT NULL,
  expected_identity text NOT NULL, -- normalized name guard
  category          text,
  color             text,
  resolved_game_id  uuid
) ON COMMIT DROP;

INSERT INTO migration_065_game
  (game_key, pinned_game_id, new_game_id, display_name, expected_identity, category, color)
VALUES
  ('robux_plus',   'cc1ec858-663c-4ff2-9185-e3d587780b46', 'cc1ec858-663c-4ff2-9185-e3d587780b46',
   'ROBUX PLUS',   'robuxplus',   'Service',   '#8b5cf6'),
  ('karinderya',   '84372024-ee1c-43a0-bbfb-6227c43039d3', '84372024-ee1c-43a0-bbfb-6227c43039d3',
   'Karinderya',   'karinderya',  'Simulator', '#f97316'),
  ('ghost_driver',  NULL, 'fd196c4a-ee2e-4b49-9f2e-374cf90dd299',
   'Ghost Driver', 'ghostdriver', 'Driving',   '#3b82f6'),
  ('steal_an_egg',  NULL, '8270d1ad-2f63-4a52-aa78-f4dac8cb65c2',
   'Steal An Egg', 'stealanegg',  'Simulator', '#22c55e'),
  ('ihaw_ihaw',     NULL, 'ffaed1d3-3544-4340-9703-d8f014af5331',
   'Ihaw Ihaw',    'ihawihaw',    'Simulator', '#f97316');

CREATE TEMP TABLE migration_065_product (
  game_key        text    NOT NULL,
  expect_existing boolean NOT NULL, -- true = must already be in the database
  live_id         uuid,             -- authoritative identity; NOT NULL exactly when expect_existing
  new_id          uuid,             -- pinned id for a new row; NULL exactly when expect_existing
  name            text    NOT NULL,
  robux_amount    integer NOT NULL,
  your_price      numeric(10,2) NOT NULL,
  robux_rate      numeric(10,2) NOT NULL,
  your_cost       numeric(10,2) NOT NULL,
  profit          numeric(10,2) NOT NULL,
  status          text    NOT NULL,

  CONSTRAINT migration_065_product_id_shape_check
    CHECK (expect_existing = (new_id IS NULL)
       AND expect_existing = (live_id IS NOT NULL))
) ON COMMIT DROP;

-- ROBUX PLUS -- existing game cc1ec858-663c-4ff2-9185-e3d587780b46.
-- live_id values audited from production on 2026-09-20. Identity is the id;
-- the name beside it is asserted, not searched for. All ten rows UPDATE in
-- place by exact id. There is no insert path for any of them.
INSERT INTO migration_065_product
  (game_key, expect_existing, live_id, new_id, name, robux_amount, your_price, robux_rate, your_cost, profit, status)
VALUES
  ('robux_plus', true, 'db06eb18-7538-4470-ae90-735e3111b63c', NULL, 'R$100 Plus',    100,  65, 290.00,  29.00,  36.00, 'Good'),
  ('robux_plus', true, '7e50eb82-b888-461e-9d10-bfc55fffe601', NULL, 'R$200 Plus',    200, 130, 290.00,  58.00,  72.00, 'Good'),
  ('robux_plus', true, 'b40803bb-3d85-48c4-8cf6-8a8190e8016a', NULL, 'R$300 Plus',    300, 195, 290.00,  87.00, 108.00, 'Good'),
  ('robux_plus', true, 'a7041cb9-93a7-44c3-9a23-86294e5bc370', NULL, 'R$400 Plus',    400, 260, 290.00, 116.00, 144.00, 'Good'),
  ('robux_plus', true, '13fa905e-3f33-415f-96a0-e1db2deb902e', NULL, 'R$500 Plus',    500, 325, 290.00, 145.00, 180.00, 'Good'),
  ('robux_plus', true, '8f38d447-4b49-4d11-8e07-79e4970c8211', NULL, 'R$600 Plus',    600, 390, 290.00, 174.00, 216.00, 'Good'),
  ('robux_plus', true, '81f3294f-585d-4f92-afb5-5b0b02ddcf15', NULL, 'R$700 Plus',    700, 455, 290.00, 203.00, 252.00, 'Good'),
  ('robux_plus', true, '5bac6eaf-f5e5-4e06-be2d-b9de5cabd157', NULL, 'R$800 Plus',    800, 520, 290.00, 232.00, 288.00, 'Good'),
  ('robux_plus', true, 'bd1816bd-321b-4e6f-8011-86a4bf4c8bc7', NULL, 'R$900 Plus',    900, 585, 290.00, 261.00, 324.00, 'Good'),
  ('robux_plus', true, 'd40166cc-b36a-4233-b30b-1b995f0fb591', NULL, 'R$1,000 Plus', 1000, 650, 290.00, 290.00, 360.00, 'Good');

-- Karinderya -- existing game 84372024-ee1c-43a0-bbfb-6227c43039d3.
-- VIP Pass, Starter Pack, Double Cash, Double Luck and Ultra Lucky UPDATE by
-- exact live id. Captain Pass and Premium pack are the only new rows here.
-- Starter Pack's 39 R$/PHP 15 -> 49 R$/PHP 21 change is intentional and
-- owner-confirmed; it is the same product row, id unchanged.
INSERT INTO migration_065_product
  (game_key, expect_existing, live_id, new_id, name, robux_amount, your_price, robux_rate, your_cost, profit, status)
VALUES
  ('karinderya', true,  'ad7baaaa-78a4-4c9d-888c-1904ab86fc52', NULL,                                   'VIP Pass',     259, 105, 290.00, 75.11, 29.89, 'Good'),
  ('karinderya', false, NULL,                                   '138b0931-102a-4125-a899-e34fee5a1dad', 'Captain Pass', 299, 109, 290.00, 86.71, 22.29, 'Good'),
  ('karinderya', true,  '6d80bb89-8a4c-4168-9cb0-7c16b2c7fa9d', NULL,                                   'Starter Pack',  49,  21, 290.00, 14.21,  6.79, 'Okay'),
  ('karinderya', false, NULL,                                   '399ce578-f3c1-4d0c-821f-763a59f6a794', 'Premium pack', 249,  99, 290.00, 72.21, 26.79, 'Good'),
  ('karinderya', true,  'dadccde3-9529-494a-96c0-1ee2164c5b8f', NULL,                                   'Double Cash',   39,  15, 290.00, 11.31,  3.69, 'Bad'),
  ('karinderya', true,  '5c64fac2-051f-4e96-920a-1620ee79b2a7', NULL,                                   'Double Luck',   39,  15, 290.00, 11.31,  3.69, 'Bad'),
  ('karinderya', true,  '5f317dbf-37c3-4af6-bf2f-a553da5bff3e', NULL,                                   'Ultra Lucky',   99,  39, 290.00, 28.71, 10.29, 'Okay');

-- Karinderya products the owner confirmed on 2026-09-20 are no longer in the
-- game. Section 7 retires them: is_active = false, by exact id. They are NOT
-- deleted -- the row, its UUID, its historical pricing and every order that
-- references it are preserved untouched.
CREATE TEMP TABLE migration_065_retired (
  game_key   text NOT NULL,
  product_id uuid NOT NULL,
  name       text NOT NULL
) ON COMMIT DROP;

INSERT INTO migration_065_retired VALUES
  ('karinderya', '2308127b-6243-43d3-a79e-bed0caacca47', 'Rambo Pass'),
  ('karinderya', '310fd2d8-f823-43f5-bf6b-967b76297c74', 'BlackToo Pack'),
  ('karinderya', 'b312b994-37fe-431c-8f69-0cb4114447ed', 'Baloyet Pack');

-- Ghost Driver -- new game fd196c4a-ee2e-4b49-9f2e-374cf90dd299.
INSERT INTO migration_065_product
  (game_key, expect_existing, new_id, name, robux_amount, your_price, robux_rate, your_cost, profit, status)
VALUES
  ('ghost_driver', false, '136b83d6-9041-42f5-9658-3f6e082493f0', 'Customer number plate',  149,   59, 290.00,   43.21,  15.79, 'Okay'),
  ('ghost_driver', false, 'd2c82291-348f-401e-990e-33e20c5d332b', 'Mobile Customisation',    79,   30, 290.00,   22.91,   7.09, 'Okay'),
  ('ghost_driver', false, '1be8555d-16ae-4cbc-badf-50a6fcf50287', 'Police siren pass',       99,   39, 290.00,   28.71,  10.29, 'Okay'),
  ('ghost_driver', false, 'b999f66f-8486-4a62-8849-a661fe46d8e5', 'RGB Lighting',            99,   39, 290.00,   28.71,  10.29, 'Okay'),
  ('ghost_driver', false, '4f190f71-71ac-4518-ad1d-e0435b334525', 'Global Radio Pass',      149,   59, 290.00,   43.21,  15.79, 'Okay'),
  ('ghost_driver', false, '36adf03c-482b-402c-aad9-dd9489ec4756', 'Stage 4 tuning',         399,  145, 290.00,  115.71,  29.29, 'Good'),
  ('ghost_driver', false, '65709d04-22c7-4a1e-8c76-9c884cdef294', 'Underglow pass',         199,   79, 290.00,   57.71,  21.29, 'Good'),
  ('ghost_driver', false, 'c0c5f66a-21eb-4aee-a890-a375b3265e14', '30K',                     49,   25, 290.00,   14.21,  10.79, 'Okay'),
  ('ghost_driver', false, 'ece134a8-c34c-498c-bb50-0597039fd22f', '130K',                   159,   65, 290.00,   46.11,  18.89, 'Okay'),
  ('ghost_driver', false, '5a0497bc-d64b-44ec-8fc5-3fdc004c24cf', '280K',                   319,  119, 290.00,   92.51,  26.49, 'Good'),
  ('ghost_driver', false, 'fe25642f-81e5-4304-b7e2-5c222703a18d', '580K',                   639,  229, 290.00,  185.31,  43.69, 'Good'),
  ('ghost_driver', false, 'bd1b418f-81a3-4c68-9617-e9ff37a267ca', '1.3M',                  1399,  505, 290.00,  405.71,  99.29, 'Good'),
  ('ghost_driver', false, '10a176ab-9248-4ee2-87ba-2062c68dac8c', '3.5M',                  3699, 1329, 290.00, 1072.71, 256.29, 'Good'),
  ('ghost_driver', false, '545e3744-e541-4e32-807f-5213ebad5fa6', '2x Cash Boost',           49,   25, 290.00,   14.21,  10.79, 'Okay'),
  ('ghost_driver', false, 'b2900c5f-2879-407e-8c8a-1bdad26c63a0', '2x XP + Cash Boost',      60,   28, 290.00,   17.40,  10.60, 'Okay'),
  ('ghost_driver', false, '882f30c1-4d41-492a-a222-f47d4ac6ddbc', '2x XP Boost',             29,   12, 290.00,    8.41,   3.59, 'Bad'),
  ('ghost_driver', false, 'ccf023d4-84af-4e87-b0d4-66b8d22fc619', 'Starter Pack',           199,   79, 290.00,   57.71,  21.29, 'Good');

-- Steal An Egg -- new game 8270d1ad-2f63-4a52-aa78-f4dac8cb65c2.
INSERT INTO migration_065_product
  (game_key, expect_existing, new_id, name, robux_amount, your_price, robux_rate, your_cost, profit, status)
VALUES
  ('steal_an_egg', false, '1c9ef748-0ff4-49d0-afef-381f16494dff', '1 Egg',       39,  15, 290.00,  11.31,   3.69, 'Bad'),
  ('steal_an_egg', false, 'ea0eab7f-6c7d-4522-aebd-074deb81c9d1', '3 Eggs',      99,  39, 290.00,  28.71,  10.29, 'Okay'),
  ('steal_an_egg', false, '4502c95f-b0fc-4ac1-8eed-b735aae18193', '10 Eggs',    319, 115, 290.00,  92.51,  22.49, 'Good'),
  ('steal_an_egg', false, '32b92005-9050-4211-9ae4-f39dca01da10', '50 Eggs',   1399, 525, 290.00, 405.71, 119.29, 'Good'),
  ('steal_an_egg', false, '8e2fe995-f6af-4300-b593-36284ba5ae28', '2x Growth',  145,  59, 290.00,  42.05,  16.95, 'Okay'),
  ('steal_an_egg', false, '60694c71-4a2a-44d9-90a7-9c25f9b901a6', '2x Money',   119,  49, 290.00,  34.51,  14.49, 'Okay'),
  ('steal_an_egg', false, '92da962c-9800-49b7-8145-9848350c1176', '150K SPEED',  25,  12, 290.00,   7.25,   4.75, 'Bad'),
  ('steal_an_egg', false, '98df3cf0-5fe9-44a5-85a4-2b3a80e7fb0c', '1M SPEED',    79,  30, 290.00,  22.91,   7.09, 'Okay'),
  ('steal_an_egg', false, '0dca2c50-6c18-4651-9080-d5dc0fad9a11', '10M SPEED',  210,  79, 290.00,  60.90,  18.10, 'Okay'),
  ('steal_an_egg', false, 'e1bc0085-9583-4bb7-b0ea-b5c5830af84a', '50M SPEED',  599, 215, 290.00, 173.71,  41.29, 'Good'),
  ('steal_an_egg', false, 'e63137d1-3d8d-4a8f-9c82-aeb3e3f25009', '500M SPEED', 599, 215, 290.00, 173.71,  41.29, 'Good'),
  ('steal_an_egg', false, 'd667ec65-7e15-4548-9305-d70ed20d9727', '1B SPEED',   899, 325, 290.00, 260.71,  64.29, 'Good');

-- Ihaw Ihaw -- new game ffaed1d3-3544-4340-9703-d8f014af5331.
INSERT INTO migration_065_product
  (game_key, expect_existing, new_id, name, robux_amount, your_price, robux_rate, your_cost, profit, status)
VALUES
  ('ihaw_ihaw', false, 'fc830b9e-1918-4ac8-b3b6-de2f6da6bb08', 'Chikawa Set',            350, 125, 290.00, 101.50, 23.50, 'Good'),
  ('ihaw_ihaw', false, 'b6875b36-56c0-41bb-8024-77b80e540f70', 'Usagi Set',              350, 125, 290.00, 101.50, 23.50, 'Good'),
  ('ihaw_ihaw', false, '9509c242-9967-4b39-b8ad-79be00fad195', 'Haciware Set',           350, 125, 290.00, 101.50, 23.50, 'Good'),
  ('ihaw_ihaw', false, '76ae5c5a-535c-4a8c-a89b-55d2bcb836b5', 'VIP Collection',         225,  99, 290.00,  65.25, 33.75, 'Good'),
  ('ihaw_ihaw', false, '3ba48cb3-5277-47e6-90ae-fec654ef9495', 'Orchid Countour Set',     79,  29, 290.00,  22.91,  6.09, 'Okay'),
  ('ihaw_ihaw', false, 'e44b9d2f-78c3-4fc9-afc7-38878c38417a', 'Midnight Arc Set',        79,  29, 290.00,  22.91,  6.09, 'Okay'),
  ('ihaw_ihaw', false, '68be8f0f-78c4-43d7-913d-7c65a3eea903', 'Bonbon Collection',      299, 109, 290.00,  86.71, 22.29, 'Good'),
  ('ihaw_ihaw', false, '542bb57d-36dd-43d6-930c-5588c1c0a8e7', 'Sampaguita Suite',        50,  19, 290.00,  14.50,  4.50, 'Bad'),
  ('ihaw_ihaw', false, '583be6a9-f6f4-4f2f-a0d4-d46289e2d76b', 'Amihan Suite',            50,  19, 290.00,  14.50,  4.50, 'Bad'),
  ('ihaw_ihaw', false, 'fa9fa477-c73a-4273-b4bf-592290c77b6b', 'Pink Star Love Wand',    250,  99, 290.00,  72.50, 26.50, 'Good'),
  ('ihaw_ihaw', false, 'c8e94dd1-2b1a-46f2-b87d-5b756e861e29', 'Purple Star Love Wand',  250,  99, 290.00,  72.50, 26.50, 'Good'),
  ('ihaw_ihaw', false, 'f59435f8-402f-4ad5-b03b-eb5be9b87a5f', 'Star Love Wand Bundle',  399, 145, 290.00, 115.71, 29.29, 'Good'),
  ('ihaw_ihaw', false, 'e439be5f-b54d-4172-8b4d-93e83fc81f74', 'Golden Spatula',          79,  29, 290.00,  22.91,  6.09, 'Okay'),
  ('ihaw_ihaw', false, '982f33d2-e077-4e54-9462-998465a965ff', 'Double Cash',             30,  12, 290.00,   8.70,  3.30, 'Bad'),
  ('ihaw_ihaw', false, '18549a7a-c802-4116-b41f-ffc786116e75', 'Double Luck',             30,  12, 290.00,   8.70,  3.30, 'Bad'),
  ('ihaw_ihaw', false, '5c72f73d-f969-4b7a-96df-28bd4a79a798', 'Tier 1 Pesos (500)',      19,   9, 290.00,   5.51,  3.49, 'Bad'),
  ('ihaw_ihaw', false, 'ad6d1cbd-3dbf-492b-99fe-f8d15dd38e22', 'Tier 2 Pesos (2000)',     49,  19, 290.00,  14.21,  4.79, 'Bad'),
  ('ihaw_ihaw', false, '8ab3a67b-94fe-4981-bec7-1dfe67918adc', 'Tier 3 Pesos (6000)',     99,  39, 290.00,  28.71, 10.29, 'Okay'),
  ('ihaw_ihaw', false, '7532f3d0-f671-4238-900e-2a9e6e3ac9ed', 'Tier 4 Pesos (15000)',   130,  49, 290.00,  37.70, 11.30, 'Okay'),
  ('ihaw_ihaw', false, '5c52aa8b-a153-4bf4-a413-ce6886896028', 'Tier 5 Pesos (40000)',   230,  89, 290.00,  66.70, 22.30, 'Good');

-- -----------------------------------------------------------------------------
-- 3. Self-check of the supplied figures
-- -----------------------------------------------------------------------------
-- Catches a transcription slip in this file before anything is written.

DO $$
DECLARE
  v_bad text;
BEGIN
  SELECT string_agg(format('%s/%s', game_key, name), ', ' ORDER BY game_key, name)
  INTO v_bad
  FROM migration_065_product
  WHERE round(robux_amount * robux_rate / 1000.0, 2) <> your_cost
     OR your_price - your_cost <> profit
     OR status <> CASE WHEN profit >= 20 THEN 'Good' WHEN profit >= 5 THEN 'Okay' ELSE 'Bad' END;

  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 065 internal figures are inconsistent: %', v_bad;
  END IF;

  SELECT string_agg(format('%s/%s (%s rows)', game_key, identity, n), ', ')
  INTO v_bad
  FROM (
    SELECT game_key,
           regexp_replace(lower(name), '[^a-z0-9]+', '', 'g') AS identity,
           count(*) AS n
    FROM migration_065_product
    GROUP BY 1, 2
    HAVING count(*) > 1
  ) dupes;

  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 065 desired list repeats a product identity: %', v_bad;
  END IF;

  IF (SELECT count(DISTINCT new_id) FROM migration_065_product WHERE new_id IS NOT NULL)
     <> (SELECT count(*) FROM migration_065_product WHERE new_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Migration 065 repeats a pinned product id';
  END IF;

  -- Only genuinely new games may contain genuinely new products without an
  -- expected-existing counterpart check, and only expected-existing rows may
  -- omit a pinned id. The temp-table CHECK covers the second half; this covers
  -- the first: no row under an existing game may be silently id-less.
  SELECT string_agg(format('%s/%s', game_key, name), ', ' ORDER BY game_key, name)
  INTO v_bad
  FROM migration_065_product
  WHERE expect_existing AND game_key NOT IN ('robux_plus', 'karinderya');

  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 065 marks a product of a new game as expected-existing: %', v_bad;
  END IF;

  -- Guard against a placeholder id ever being left in this file.
  SELECT string_agg(format('%s/%s', game_key, name), ', ' ORDER BY game_key, name)
  INTO v_bad
  FROM migration_065_product
  WHERE live_id = '00000000-0000-0000-0000-000000000000';

  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION
      'Migration 065 still carries a placeholder production id for: %. Paste the real 36-character id from public.gamepasses and re-run; nothing has been written.',
      v_bad;
  END IF;

  IF (SELECT count(DISTINCT live_id) FROM migration_065_product WHERE live_id IS NOT NULL)
     <> (SELECT count(*) FROM migration_065_product WHERE live_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Migration 065 repeats a live product id';
  END IF;

  -- No id may be claimed both as an existing row and as a new row.
  IF EXISTS (
    SELECT 1 FROM migration_065_product a
    JOIN migration_065_product b ON b.new_id = a.live_id
  ) THEN
    RAISE EXCEPTION 'Migration 065 reuses a live product id as a pinned new id';
  END IF;

  -- A product the desired list writes can never also be one this migration
  -- retires. Without this, a typo could deactivate a product it just priced.
  SELECT string_agg(k.name, ', ' ORDER BY k.name) INTO v_bad
  FROM migration_065_retired k
  JOIN migration_065_product p ON p.live_id = k.product_id OR p.new_id = k.product_id;

  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 065 both retires and writes these products: %', v_bad;
  END IF;

  IF (SELECT count(DISTINCT product_id) FROM migration_065_retired) <> 3 THEN
    RAISE EXCEPTION 'Migration 065 expects exactly 3 retirements, found %',
      (SELECT count(DISTINCT product_id) FROM migration_065_retired);
  END IF;

  RAISE NOTICE '[065] desired catalog: % products (% expected existing, % new)',
    (SELECT count(*) FROM migration_065_product),
    (SELECT count(*) FROM migration_065_product WHERE expect_existing),
    (SELECT count(*) FROM migration_065_product WHERE NOT expect_existing);
END $$;

-- -----------------------------------------------------------------------------
-- 4. Resolve games (existing ones by pinned id, new ones by normalized name)
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  v_user_id     uuid;
  v_owner_count integer;
  v_name        text;
  v_count       integer;
  v_id          uuid;
  g             record;
BEGIN
  -- Catalog-owner detection in two explicit steps. PostgreSQL defines no
  -- min(uuid)/max(uuid) aggregate, and reaching for a ::text cast just to make
  -- one work would make the ordering meaningless anyway. Count first, assert
  -- the count, and only then read the single value.
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

  FOR g IN SELECT * FROM migration_065_game ORDER BY game_key LOOP
    IF g.pinned_game_id IS NOT NULL THEN
      -- Existing game: the id is immutable, so look it up by id and refuse to
      -- proceed if it is gone, owned by someone else, or has been renamed to
      -- something that is no longer recognisable.
      SELECT name INTO v_name
      FROM public.games
      WHERE id = g.pinned_game_id AND user_id = v_user_id;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'Expected existing game % (%) was not found for the catalog owner',
          g.display_name, g.pinned_game_id;
      END IF;

      IF regexp_replace(lower(v_name), '[^a-z0-9]+', '', 'g') <> g.expected_identity THEN
        RAISE EXCEPTION 'Game % is named "%", which no longer matches expected identity "%"',
          g.pinned_game_id, v_name, g.expected_identity;
      END IF;

      UPDATE migration_065_game SET resolved_game_id = g.pinned_game_id WHERE game_key = g.game_key;
      RAISE NOTICE '[065] game % -> % (existing, unchanged)', g.display_name, g.pinned_game_id;

    ELSE
      -- New game: create only when the normalized name is absent. If a game
      -- with that identity already exists, adopt its id -- never a second row.
      SELECT count(*) INTO v_count
      FROM public.games
      WHERE user_id = v_user_id
        AND regexp_replace(lower(name), '[^a-z0-9]+', '', 'g') = g.expected_identity;

      IF v_count > 1 THEN
        RAISE EXCEPTION 'Ambiguous game identity "%": % rows', g.expected_identity, v_count;
      END IF;

      IF v_count = 1 THEN
        -- Exactly one row, asserted above, so this SELECT INTO is single-valued.
        SELECT id INTO v_id
        FROM public.games
        WHERE user_id = v_user_id
          AND regexp_replace(lower(name), '[^a-z0-9]+', '', 'g') = g.expected_identity;

        UPDATE migration_065_game SET resolved_game_id = v_id WHERE game_key = g.game_key;
        RAISE NOTICE '[065] game % -> % (already existed, adopted)', g.display_name, v_id;
      ELSE
        IF EXISTS (SELECT 1 FROM public.games WHERE id = g.new_game_id) THEN
          RAISE EXCEPTION 'Pinned game id % is already in use by another game', g.new_game_id;
        END IF;

        INSERT INTO public.games (id, user_id, name, category, color)
        VALUES (g.new_game_id, v_user_id, g.display_name, g.category, g.color);

        UPDATE migration_065_game SET resolved_game_id = g.new_game_id WHERE game_key = g.game_key;
        RAISE NOTICE '[065] game % -> % (CREATED)', g.display_name, g.new_game_id;
      END IF;
    END IF;
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 5. Products: update in place where a name matches, insert only what is new
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  v_user_id    uuid;
  v_game_id    uuid;
  v_dupes        text;
  v_count        integer;
  v_gamepass     uuid;
  v_live_game_id uuid;
  v_live_name    text;
  g              record;
  r              record;
BEGIN
  -- Section 4 already asserted exactly one catalog owner, so this is
  -- single-valued. GROUP BY (not DISTINCT INTO) keeps that explicit.
  SELECT user_id INTO v_user_id FROM public.games WHERE user_id IS NOT NULL GROUP BY user_id;

  FOR g IN SELECT * FROM migration_065_game ORDER BY game_key LOOP
    v_game_id := g.resolved_game_id;

    -- Existing products of this game must have unambiguous identities, or a
    -- name match could silently hit the wrong row.
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
      RAISE EXCEPTION 'Ambiguous % product identities: %', g.display_name, v_dupes;
    END IF;

    FOR r IN
      SELECT * FROM migration_065_product WHERE game_key = g.game_key ORDER BY name
    LOOP
      IF r.expect_existing THEN
        -- Identity is the audited production UUID, never the name. Lock the
        -- row, then assert ownership, game membership and the expected name
        -- before touching it. Any failure aborts the whole transaction; there
        -- is no insert path here, so a live product id can never be shadowed
        -- by a duplicate row that BudgetWise Store would then miss.
        SELECT gp.game_id, gp.name
        INTO v_live_game_id, v_live_name
        FROM public.gamepasses gp
        WHERE gp.id = r.live_id AND gp.user_id = v_user_id
        FOR UPDATE;

        IF NOT FOUND THEN
          RAISE EXCEPTION
            'Expected existing product % ("%" under %) does not exist for the catalog owner. Refusing to insert a substitute.',
            r.live_id, r.name, g.display_name;
        END IF;

        IF v_live_game_id IS DISTINCT FROM v_game_id THEN
          RAISE EXCEPTION
            'Product % ("%") belongs to game %, not % (%). Refusing to move or replace it.',
            r.live_id, r.name, v_live_game_id, g.display_name, v_game_id;
        END IF;

        IF regexp_replace(lower(v_live_name), '[^a-z0-9]+', '', 'g')
           <> regexp_replace(lower(r.name), '[^a-z0-9]+', '', 'g') THEN
          RAISE EXCEPTION
            'Product % is named "%" in production but this migration expects "%" under %. Refusing to update the wrong product.',
            r.live_id, v_live_name, r.name, g.display_name;
        END IF;

        UPDATE public.gamepasses
        SET name         = r.name,
            robux_amount = r.robux_amount,
            your_price   = r.your_price,
            robux_rate   = r.robux_rate,
            your_cost    = r.your_cost,
            profit       = r.profit,
            status       = r.status,
            is_active    = true,
            updated_at   = now()
        WHERE id = r.live_id;

        RAISE NOTICE '[065]   updated by live id % / % -> %', g.display_name, r.name, r.live_id;

      ELSE
        -- Genuinely new product: adopt an existing row if one already carries
        -- this name (re-run safety), otherwise insert under the pinned id.
        SELECT count(*) INTO v_count
        FROM public.gamepasses
        WHERE user_id = v_user_id
          AND game_id = v_game_id
          AND regexp_replace(lower(name), '[^a-z0-9]+', '', 'g')
              = regexp_replace(lower(r.name), '[^a-z0-9]+', '', 'g');

        IF v_count > 1 THEN
          RAISE EXCEPTION 'Product "%" under % matched % live rows', r.name, g.display_name, v_count;
        END IF;

        IF v_count = 1 THEN
          -- Exactly one row, asserted above, so this SELECT INTO is
          -- single-valued. Locked before the write, as in the branch above.
          SELECT id INTO v_gamepass
          FROM public.gamepasses
          WHERE user_id = v_user_id
            AND game_id = v_game_id
            AND regexp_replace(lower(name), '[^a-z0-9]+', '', 'g')
                = regexp_replace(lower(r.name), '[^a-z0-9]+', '', 'g')
          FOR UPDATE;

          UPDATE public.gamepasses
          SET name         = r.name,
              robux_amount = r.robux_amount,
              your_price   = r.your_price,
              robux_rate   = r.robux_rate,
              your_cost    = r.your_cost,
              profit       = r.profit,
              status       = r.status,
              is_active    = true,
              updated_at   = now()
          WHERE id = v_gamepass;

          RAISE NOTICE '[065]   adopted existing % / % -> %', g.display_name, r.name, v_gamepass;
        ELSE
          IF EXISTS (SELECT 1 FROM public.gamepasses WHERE id = r.new_id) THEN
            RAISE EXCEPTION 'Pinned product id % (%/%) is already in use', r.new_id, g.display_name, r.name;
          END IF;

          INSERT INTO public.gamepasses
            (id, user_id, game_id, name, robux_amount, your_price, robux_rate,
             your_cost, profit, status, is_active)
          VALUES
            (r.new_id, v_user_id, v_game_id, r.name, r.robux_amount, r.your_price, r.robux_rate,
             r.your_cost, r.profit, r.status, true);

          RAISE NOTICE '[065]   INSERTED % / % -> %', g.display_name, r.name, r.new_id;
        END IF;
      END IF;
    END LOOP;
  END LOOP;
END $$;

-- -----------------------------------------------------------------------------
-- 6. Report products that exist but are absent from the desired lists
-- -----------------------------------------------------------------------------
-- Reported only. Nothing is deleted and nothing is deactivated here.

DO $$
DECLARE
  v_user_id uuid;
  r         record;
  v_any     boolean := false;
BEGIN
  -- Section 4 already asserted exactly one catalog owner, so this is
  -- single-valued. GROUP BY (not DISTINCT INTO) keeps that explicit.
  SELECT user_id INTO v_user_id FROM public.games WHERE user_id IS NOT NULL GROUP BY user_id;

  FOR r IN
    SELECT g.display_name, gp.id, gp.name, gp.robux_amount, gp.your_price, gp.is_active
    FROM migration_065_game g
    JOIN public.gamepasses gp
      ON gp.game_id = g.resolved_game_id AND gp.user_id = v_user_id
    WHERE NOT EXISTS (
      SELECT 1
      FROM migration_065_product p
      WHERE p.game_key = g.game_key
        AND regexp_replace(lower(p.name), '[^a-z0-9]+', '', 'g')
            = regexp_replace(lower(gp.name), '[^a-z0-9]+', '', 'g')
    )
    ORDER BY g.display_name, gp.name
  LOOP
    v_any := true;
    RAISE NOTICE '[065] NOT IN DESIRED LIST: % / % (id %, R$%, PHP %, is_active=%) -- left untouched',
      r.display_name, r.name, r.id, r.robux_amount, r.your_price, r.is_active;
  END LOOP;

  IF NOT v_any THEN
    RAISE NOTICE '[065] every existing product of the touched games is in the desired lists';
  END IF;

END $$;

-- -----------------------------------------------------------------------------
-- 7. Retire the three discontinued Karinderya products
-- -----------------------------------------------------------------------------
-- Owner-confirmed on 2026-09-20: these products are no longer in the game.
-- This is a retirement, not a removal. Only is_active changes. The row, its
-- UUID, its name, its historical pricing (robux_amount, your_price,
-- robux_rate, your_cost, profit, status) and every orders/order_items row
-- that references it are left exactly as they are. Never DELETE a catalog
-- row: order history and BudgetWise Store presentation metadata are keyed on
-- gamepasses.id.
--
-- Idempotent: a row that is already inactive is skipped entirely, so a re-run
-- updates nothing and does not bump updated_at.

DO $$
DECLARE
  v_user_id        uuid;
  v_karinderya_id  uuid;
  v_deactivated    integer := 0;
  v_already        integer := 0;
  r                record;
BEGIN
  -- Section 4 already asserted exactly one catalog owner, so this is
  -- single-valued. GROUP BY (not DISTINCT INTO) keeps that explicit.
  SELECT user_id INTO v_user_id FROM public.games WHERE user_id IS NOT NULL GROUP BY user_id;
  SELECT resolved_game_id INTO v_karinderya_id FROM migration_065_game WHERE game_key = 'karinderya';

  FOR r IN
    SELECT k.name AS expected_name, k.product_id,
           gp.id AS found_id, gp.game_id, gp.name AS live_name, gp.is_active
    FROM migration_065_retired k
    LEFT JOIN public.gamepasses gp ON gp.id = k.product_id AND gp.user_id = v_user_id
    ORDER BY k.name
  LOOP
    IF r.found_id IS NULL THEN
      RAISE EXCEPTION
        'Product to retire % ("%") does not exist for the catalog owner. Refusing to continue.',
        r.product_id, r.expected_name;
    END IF;

    IF r.game_id IS DISTINCT FROM v_karinderya_id THEN
      RAISE EXCEPTION
        'Product to retire % ("%") belongs to game %, not Karinderya (%). Refusing to deactivate it.',
        r.product_id, r.expected_name, r.game_id, v_karinderya_id;
    END IF;

    IF regexp_replace(lower(r.live_name), '[^a-z0-9]+', '', 'g')
       <> regexp_replace(lower(r.expected_name), '[^a-z0-9]+', '', 'g') THEN
      RAISE EXCEPTION
        'Product % is named "%" in production but was audited as "%". Refusing to deactivate the wrong product.',
        r.product_id, r.live_name, r.expected_name;
    END IF;

    IF r.is_active IS NOT DISTINCT FROM false THEN
      v_already := v_already + 1;
      RAISE NOTICE '[065] already retired: Karinderya / % (id %)', r.live_name, r.product_id;
    ELSE
      UPDATE public.gamepasses
      SET is_active = false,
          updated_at = now()
      WHERE id = r.product_id;

      v_deactivated := v_deactivated + 1;
      RAISE NOTICE '[065] RETIRED: Karinderya / % (id %) -- is_active false, row and history preserved',
        r.live_name, r.product_id;
    END IF;
  END LOOP;

  IF v_deactivated + v_already <> 3 THEN
    RAISE EXCEPTION 'Migration 065 processed % retirements, expected 3', v_deactivated + v_already;
  END IF;

  RAISE NOTICE '[065] retirements: % newly deactivated, % already inactive', v_deactivated, v_already;
END $$;

-- -----------------------------------------------------------------------------
-- 8. Roblox identity for the three new games
-- -----------------------------------------------------------------------------
-- Written directly (a reviewed SQL migration is a privileged session); the
-- migration 063 trigger records each row with write_path = 'direct_sql'.
-- ON CONFLICT DO NOTHING plus the section 9 check means an identity decided
-- elsewhere is never overwritten -- it either already agrees, or the whole
-- migration rolls back.
--
-- Roblox snapshot read from https://games.roblox.com/v1/games and
-- https://apis.roblox.com/game-passes/v1/... on 2026-09-20.

CREATE TEMP TABLE migration_065_identity (
  game_key              text NOT NULL,
  status                text NOT NULL,
  universe_id           bigint,
  root_place_id         bigint,
  verified_roblox_name  text,
  verified_creator_type text,
  verified_creator_id   bigint,
  verification_method   text,
  verified_at           timestamptz,
  review_note           text,
  verification_evidence jsonb NOT NULL
) ON COMMIT DROP;

INSERT INTO migration_065_identity VALUES
  -- Ghost Driver: 7 of 7 live game passes match the supplied pricelist on both
  -- name and Robux price, and the creator matches the one the owner supplied.
  ('ghost_driver', 'verified',
   10173311467, 137228775845999, '[✨SALEEN] Ghost Driver [ALPHA]', 'Group', 90273342,
   'gamepass_overlap', '2026-09-20T00:00:00+08:00', NULL,
   $evidence${"operator_input":"https://www.roblox.com/games/137228775845999/Ghost-Driver","operator_stated_creator":"Tilted Vehicles","place_to_universe":{"endpoint":"https://apis.roblox.com/universes/v1/places/137228775845999/universe","universe_id":10173311467},"roblox_api_snapshot":{"endpoint":"https://games.roblox.com/v1/games","fetched_at":"2026-09-20","name":"[✨SALEEN] Ghost Driver [ALPHA]","root_place_id":137228775845999,"creator_name":"Tilted Vehicles","creator_type":"Group","creator_id":90273342,"creator_has_verified_badge":true},"creator_matches_operator_statement":true,"gamepass_overlap_endpoint":"https://apis.roblox.com/game-passes/v1/universes/10173311467/game-passes","gamepass_overlap_count":7,"gamepass_overlap":[{"catalog_name":"RGB Lighting","roblox_name":"RGB Lighting","robux":99,"price_match":true},{"catalog_name":"Global Radio Pass","roblox_name":"Global Radio","robux":149,"price_match":true},{"catalog_name":"Stage 4 tuning","roblox_name":"Stage 4 Tuning","robux":399,"price_match":true},{"catalog_name":"Customer number plate","roblox_name":"Custom License Plates","robux":149,"price_match":true},{"catalog_name":"Underglow pass","roblox_name":"Underglow Pass","robux":199,"price_match":true},{"catalog_name":"Mobile Customisation","roblox_name":"Mobile Customization","robux":79,"price_match":true},{"catalog_name":"Police siren pass","roblox_name":"Police Sirens","robux":99,"price_match":true}],"note":"Every game pass in the supplied list matched a live game pass on Robux price. The cash tiers (30K..3.5M), Starter Pack and the 2x boosts are developer products, which this endpoint does not list."}$evidence$),

  -- Ihaw Ihaw: the universe publishes no game passes at all, so overlap
  -- verification is impossible. Verified on the owner's statement, with the
  -- creator independently confirmed against the Roblox API.
  ('ihaw_ihaw', 'verified',
   10764431367, 113948911193079, '[🔥] Ihaw Ihaw!', 'Group', 5898659,
   'owner_confirmed', '2026-09-20T00:00:00+08:00', NULL,
   $evidence${"operator_input":"https://www.roblox.com/games/113948911193079/Ihaw-Ihaw","operator_stated_creator":"Globus Enterprise","place_to_universe":{"endpoint":"https://apis.roblox.com/universes/v1/places/113948911193079/universe","universe_id":10764431367},"roblox_api_snapshot":{"endpoint":"https://games.roblox.com/v1/games","fetched_at":"2026-09-20","name":"[🔥] Ihaw Ihaw!","root_place_id":113948911193079,"creator_name":"Globus Enterprise","creator_type":"Group","creator_id":5898659,"creator_has_verified_badge":false},"creator_matches_operator_statement":true,"gamepass_overlap_endpoint":"https://apis.roblox.com/game-passes/v1/universes/10764431367/game-passes","published_gamepass_count":0,"gamepass_overlap_possible":false,"basis":"Owner supplied both the place URL and the creator; the Roblox API independently returns that exact creator for the universe the place resolves to. The supplied products appear to be developer products, which are not publicly enumerable.","supporting":"Game description is a Filipino BBQ stall tycoon, consistent with the supplied product names (Sampaguita Suite, Amihan Suite, Golden Spatula, Tier N Pesos)."}$evidence$),

  -- Steal An Egg: deliberately unverified. See review_note.
  ('steal_an_egg', 'needs_review',
   NULL, NULL, NULL, NULL, NULL,
   NULL, NULL,
   'Candidate universe 10563114921 (place 107778070777162, creator group 825735094 "and Collect Rare Pets") is an exact name match and its description matches the supplied product structure (eggs, hatching, treadmill Speed tiers, 2x growth, 2x money). It was NOT verified because its only two published game passes contradict the supplied pricelist: live "X2 MONEY!" is R$299 vs the supplied 2x Money R$119, and live "X2 GROWTH SPEED!" is R$355 vs the supplied 2x Growth R$145. A scan of the other 14 Roblox experiences matching "Steal An Egg" found no universe whose game passes match R$119/R$145 either (closest, universe 10747748563 "Steal and Hatch Anime Eggs!", is R$199/R$229). Either the supplied Robux amounts are stale or the intended experience is a different one. Resolve by confirming the correct place URL and the current Robux prices, then set identity via public.set_game_roblox_identity().',
   $evidence${"operator_input":"https://www.roblox.com/games/107778070777162/Steal-An-Egg","candidate_universe_id":10563114921,"candidate_root_place_id":107778070777162,"candidate_name":"Steal An Egg","candidate_creator":{"type":"Group","id":825735094,"name":"and Collect Rare Pets","has_verified_badge":true},"blocked_by":"gamepass_price_conflict","conflicts":[{"catalog_name":"2x Money","catalog_robux":119,"roblox_name":"X2 MONEY!","roblox_robux":299},{"catalog_name":"2x Growth","catalog_robux":145,"roblox_name":"X2 GROWTH SPEED!","roblox_robux":355}],"alternates_scanned_endpoint":"https://apis.roblox.com/search-api/omni-search?searchQuery=Steal+An+Egg","alternates_scanned":14,"closest_alternate":{"universe_id":10747748563,"name":"Steal and Hatch Anime Eggs!","x2_money_robux":199,"x2_growth_robux":229},"no_alternate_matches_supplied_prices":true,"fetched_at":"2026-09-20"}$evidence$);

INSERT INTO public.game_roblox_identity (
  game_id, status, universe_id, root_place_id, verified_roblox_name,
  verified_creator_type, verified_creator_id, verification_method,
  verification_evidence, verified_at, verified_by, review_note
)
SELECT
  g.resolved_game_id, i.status, i.universe_id, i.root_place_id, i.verified_roblox_name,
  i.verified_creator_type, i.verified_creator_id, i.verification_method,
  i.verification_evidence, i.verified_at, NULL, i.review_note
FROM migration_065_identity i
JOIN migration_065_game g ON g.game_key = i.game_key
ON CONFLICT (game_id) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 9. Verify identity rows, and that nothing else was disturbed
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT g.display_name, g.resolved_game_id, i.status AS want_status,
           i.universe_id AS want_universe, i.root_place_id AS want_root,
           i.verification_method AS want_method,
           live.status AS got_status, live.universe_id AS got_universe,
           live.root_place_id AS got_root, live.verification_method AS got_method
    FROM migration_065_identity i
    JOIN migration_065_game g ON g.game_key = i.game_key
    LEFT JOIN public.game_roblox_identity live ON live.game_id = g.resolved_game_id
  LOOP
    IF r.got_status IS NULL THEN
      RAISE EXCEPTION 'Roblox identity for % (%) was not written', r.display_name, r.resolved_game_id;
    END IF;

    IF r.got_status IS DISTINCT FROM r.want_status
       OR r.got_universe IS DISTINCT FROM r.want_universe
       OR r.got_root IS DISTINCT FROM r.want_root
       OR r.got_method IS DISTINCT FROM r.want_method THEN
      RAISE EXCEPTION
        'Roblox identity for % (%) already exists and differs from this migration: live (%, universe %, root %, method %) vs seed (%, universe %, root %, method %). Resolve by hand; nothing was overwritten.',
        r.display_name, r.resolved_game_id,
        r.got_status, r.got_universe, r.got_root, r.got_method,
        r.want_status, r.want_universe, r.want_root, r.want_method;
    END IF;

    RAISE NOTICE '[065] identity % -> % (%)', r.display_name, r.got_status, r.resolved_game_id;
  END LOOP;

  -- Karinderya and ROBUX PLUS identities are out of scope for this migration.
  IF NOT EXISTS (
    SELECT 1 FROM public.game_roblox_identity
    WHERE game_id = '84372024-ee1c-43a0-bbfb-6227c43039d3' AND status = 'verified'
  ) THEN
    RAISE EXCEPTION 'Karinderya Roblox identity is no longer verified -- refusing to continue';
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 10. Post-conditions: the catalog must look exactly as the owner specified
-- -----------------------------------------------------------------------------
-- The owner stated the expected shape of the catalog after this migration.
-- Asserting it here turns that expectation into a guarantee: if production
-- holds a product these five games were not known to have, or a count is off
-- by one, the whole transaction rolls back rather than committing a catalog
-- nobody has reviewed.

DO $$
DECLARE
  v_user_id uuid;
  v_bad     text;
  v_names   text;
BEGIN
  -- Section 4 already asserted exactly one catalog owner, so this is
  -- single-valued. GROUP BY (not DISTINCT INTO) keeps that explicit.
  SELECT user_id INTO v_user_id FROM public.games WHERE user_id IS NOT NULL GROUP BY user_id;

  SELECT string_agg(
           format('%s: %s total / %s active (expected %s / %s)',
                  e.display_name, actual.total, actual.active, e.want_total, e.want_active),
           '; ' ORDER BY e.display_name)
  INTO v_bad
  FROM (VALUES
    ('robux_plus'::text,   'ROBUX PLUS'::text,   10, 10),
    ('karinderya',         'Karinderya',         10,  7),
    ('ghost_driver',       'Ghost Driver',       17, 17),
    ('steal_an_egg',       'Steal An Egg',       12, 12),
    ('ihaw_ihaw',          'Ihaw Ihaw',          20, 20)
  ) AS e(game_key, display_name, want_total, want_active)
  JOIN migration_065_game g ON g.game_key = e.game_key
  CROSS JOIN LATERAL (
    SELECT count(*) AS total, count(*) FILTER (WHERE gp.is_active) AS active
    FROM public.gamepasses gp
    WHERE gp.game_id = g.resolved_game_id AND gp.user_id = v_user_id
  ) actual
  WHERE actual.total <> e.want_total OR actual.active <> e.want_active;

  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 065 post-condition failed -- %', v_bad;
  END IF;

  -- The seven active Karinderya products must be exactly the desired seven.
  SELECT string_agg(gp.name, ', ' ORDER BY gp.name)
  INTO v_bad
  FROM public.gamepasses gp
  JOIN migration_065_game g ON g.game_key = 'karinderya' AND gp.game_id = g.resolved_game_id
  WHERE gp.user_id = v_user_id
    AND gp.is_active
    AND NOT EXISTS (
      SELECT 1 FROM migration_065_product p
      WHERE p.game_key = 'karinderya'
        AND regexp_replace(lower(p.name), '[^a-z0-9]+', '', 'g')
            = regexp_replace(lower(gp.name), '[^a-z0-9]+', '', 'g')
    );

  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Karinderya has unexpected active products after migration 065: %', v_bad;
  END IF;

  -- Every retired product must now be inactive.
  SELECT string_agg(format('%s (%s)', gp.name, gp.id), ', ' ORDER BY gp.name)
  INTO v_bad
  FROM migration_065_retired k
  JOIN public.gamepasses gp ON gp.id = k.product_id
  WHERE gp.is_active;

  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'Migration 065 left a retired product active: %', v_bad;
  END IF;

  SELECT string_agg(g.display_name || '=' || cnt, ', ' ORDER BY g.display_name)
  INTO v_names
  FROM migration_065_game g
  CROSS JOIN LATERAL (
    SELECT count(*) AS cnt FROM public.gamepasses gp
    WHERE gp.game_id = g.resolved_game_id AND gp.user_id = v_user_id AND gp.is_active
  ) a;

  RAISE NOTICE '[065] post-conditions OK -- active products: %', v_names;
END $$;

COMMIT;
