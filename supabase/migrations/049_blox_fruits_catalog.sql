-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 049: Blox Fruits catalog + Store section-grouping schema
-- Run in Supabase SQL Editor. Safe to run multiple times (idempotent).
--
-- Schema additions (both nullable — every pre-existing gamepass row is
-- unaffected, defaults to NULL/0):
--   gamepasses.icon_url      — per-product artwork, mirrors games.icon_url
--                               (migration 038). No management UI yet — set
--                               directly via SQL, same as the game-level field.
--   gamepasses.product_type  — 'gamepass' | 'exp_boost' | 'permanent_fruit'.
--                               Presentation/grouping tag for storefronts that
--                               want to bucket a game's catalog instead of
--                               showing one flat list. Not read by any XOB UI
--                               yet — pure schema prep, same spirit as
--                               games.sort_order in migration 038.
--   gamepasses.section_order — numeric bucket order (0/1/2) so a consumer can
--                               `ORDER BY section_order, robux_amount desc`
--                               without hardcoding a string→order lookup.
--
-- Data: creates "Blox Fruits" (or reuses it if it already exists) and does a
-- clean DELETE + re-INSERT of its 55-product catalog (10 Gamepasses, 5 EXP
-- Boosts, 40 Permanent Fruits). robux_rate is 290.00 for every row — verified
-- constant (cost ÷ robux_amount × 1000) across the entire supplied price
-- list. Rating column maps 1:1 onto the existing status check constraint
-- ('Good'/'Okay'/'Bad'); no new rating field needed.
--
-- Game artwork: resolved via Roblox's public universe APIs against the
-- official "⚔️ Blox Fruits" experience (universeId 994732206, rootPlaceId
-- 2753915549, creator "Gamer Robot Inc").
--
-- Product artwork: NOT set. Roblox's universe-scoped gamepass listing API
-- (games.roblox.com/v1/games/{universeId}/game-passes) is unreachable from
-- this environment (404), and general catalog keyword search returns
-- unrelated third-party/UGC items from other creators, not Gamer Robot Inc's
-- official passes. Per the no-cross-creator-fuzzy-match rule, all 55 products
-- are left with icon_url = NULL and fall back to the existing color-dot
-- placeholder. Flagged for manual review — see chat report.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.gamepasses
  ADD COLUMN IF NOT EXISTS icon_url text,
  ADD COLUMN IF NOT EXISTS product_type text,
  ADD COLUMN IF NOT EXISTS section_order integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_schema = 'public' AND table_name = 'gamepasses'
      AND constraint_name = 'gamepasses_product_type_check'
  ) THEN
    ALTER TABLE public.gamepasses
      ADD CONSTRAINT gamepasses_product_type_check
      CHECK (product_type IS NULL OR product_type IN ('gamepass', 'exp_boost', 'permanent_fruit'));
  END IF;
END $$;

DO $$
DECLARE
  v_user_id uuid;
  v_game_id uuid;
BEGIN
  SELECT user_id INTO v_user_id FROM public.games LIMIT 1;

  SELECT id INTO v_game_id
    FROM public.games
   WHERE user_id = v_user_id
     AND name ILIKE 'blox%fruits'
   LIMIT 1;

  IF v_game_id IS NULL THEN
    INSERT INTO public.games (user_id, name, category, color, icon_url)
    VALUES (
      v_user_id,
      'Blox Fruits',
      'Adventure',
      '#0ea5e9',
      'https://tr.rbxcdn.com/180DAY-a64f70da20fc1e80ee76fe5d49c1be0a/512/512/Image/Png/noFilter'
    )
    RETURNING id INTO v_game_id;
  ELSE
    UPDATE public.games
       SET icon_url = COALESCE(icon_url, 'https://tr.rbxcdn.com/180DAY-a64f70da20fc1e80ee76fe5d49c1be0a/512/512/Image/Png/noFilter')
     WHERE id = v_game_id;
  END IF;

  DELETE FROM public.gamepasses WHERE user_id = v_user_id AND game_id = v_game_id;

  INSERT INTO public.gamepasses
    (user_id, game_id, name, robux_amount, competitor_price, your_price, robux_rate, your_cost, profit, status, suggested_lower_price, product_type, section_order)
  VALUES
    -- ── Gamepasses (section_order 0) ──────────────────────────────────────
    (v_user_id, v_game_id, 'Dark Blade',        1200, 0,  410, 290,  348,    62,   'Good', 0, 'gamepass', 0),
    (v_user_id, v_game_id, 'Fruit Notifier',     2700, 0,  920, 290,  783,    137,  'Good', 0, 'gamepass', 0),
    (v_user_id, v_game_id, '2x Mastery',          450, 0,  160, 290,  130.5,  29.5, 'Good', 0, 'gamepass', 0),
    (v_user_id, v_game_id, '2x Money',            450, 0,  160, 290,  130.5,  29.5, 'Good', 0, 'gamepass', 0),
    (v_user_id, v_game_id, 'Fast Boats',          350, 0,  125, 290,  101.5,  23.5, 'Good', 0, 'gamepass', 0),
    (v_user_id, v_game_id, '2x Drop Chance',      350, 0,  125, 290,  101.5,  23.5, 'Good', 0, 'gamepass', 0),
    (v_user_id, v_game_id, '1 Fruit Storage',     400, 0,  140, 290,  116,    24,   'Good', 0, 'gamepass', 0),
    (v_user_id, v_game_id, 'Change Race',          90, 0,   30, 290,  26.1,   3.9,  'Bad',  0, 'gamepass', 0),
    (v_user_id, v_game_id, 'Refund Stats',         75, 0,   25, 290,  21.75,  3.25, 'Bad',  0, 'gamepass', 0),
    (v_user_id, v_game_id, 'Respawn Bosses',       50, 0,   20, 290,  14.5,   5.5,  'Okay', 0, 'gamepass', 0),

    -- ── EXP Boosts (section_order 1) ──────────────────────────────────────
    (v_user_id, v_game_id, '24 Hours EXP',       1499, 0,  515, 290,  434.71, 80.29, 'Good', 0, 'exp_boost', 1),
    (v_user_id, v_game_id, '12 Hours EXP',        850, 0,  290, 290,  246.5,  43.5,  'Good', 0, 'exp_boost', 1),
    (v_user_id, v_game_id, '6 Hours EXP',         450, 0,  160, 290,  130.5,  29.5,  'Good', 0, 'exp_boost', 1),
    (v_user_id, v_game_id, '1 Hour EXP',           99, 0,   38, 290,  28.71,  9.29,  'Okay', 0, 'exp_boost', 1),
    (v_user_id, v_game_id, '15 Mins EXP',          25, 0,   10, 290,  7.25,   2.75,  'Bad',  0, 'exp_boost', 1),

    -- ── Permanent Fruits (section_order 2) ──────────────────────────────────
    (v_user_id, v_game_id, 'Dragon',    5000, 0, 1730, 290, 1450,    280,    'Good', 0, 'permanent_fruit', 2),
    (v_user_id, v_game_id, 'Control',   4000, 0, 1390, 290, 1160,    230,    'Good', 0, 'permanent_fruit', 2),
    (v_user_id, v_game_id, 'Kitsune',   4000, 0, 1390, 290, 1160,    230,    'Good', 0, 'permanent_fruit', 2),
    (v_user_id, v_game_id, 'Tiger',     3000, 0, 1015, 290, 870,     145,    'Good', 0, 'permanent_fruit', 2),
    (v_user_id, v_game_id, 'Yeti',      3000, 0, 1015, 290, 870,     145,    'Good', 0, 'permanent_fruit', 2),
    (v_user_id, v_game_id, 'Spirit',    2550, 0, 865,  290, 739.5,   125.5,  'Good', 0, 'permanent_fruit', 2),
    (v_user_id, v_game_id, 'Gas',       2500, 0, 865,  290, 725,     140,    'Good', 0, 'permanent_fruit', 2),
    (v_user_id, v_game_id, 'Venom',     2450, 0, 840,  290, 710.5,   129.5,  'Good', 0, 'permanent_fruit', 2),
    (v_user_id, v_game_id, 'Shadow',    2425, 0, 830,  290, 703.25,  126.75, 'Good', 0, 'permanent_fruit', 2),
    (v_user_id, v_game_id, 'Dough',     2400, 0, 830,  290, 696,     134,    'Good', 0, 'permanent_fruit', 2),
    (v_user_id, v_game_id, 'Mammoth',   2350, 0, 815,  290, 681.5,   133.5,  'Good', 0, 'permanent_fruit', 2),
    (v_user_id, v_game_id, 'T-Rex',     2350, 0, 815,  290, 681.5,   133.5,  'Good', 0, 'permanent_fruit', 2),
    (v_user_id, v_game_id, 'Gravity',   2300, 0, 790,  290, 667,     123,    'Good', 0, 'permanent_fruit', 2),
    (v_user_id, v_game_id, 'Blizzard',  2250, 0, 780,  290, 652.5,   127.5,  'Good', 0, 'permanent_fruit', 2),
    (v_user_id, v_game_id, 'Pain',      2200, 0, 780,  290, 638,     142,    'Good', 0, 'permanent_fruit', 2),
    (v_user_id, v_game_id, 'Lightning', 2100, 0, 725,  290, 609,     116,    'Good', 0, 'permanent_fruit', 2),
    (v_user_id, v_game_id, 'Phoenix',   2000, 0, 680,  290, 580,     100,    'Good', 0, 'permanent_fruit', 2),
    (v_user_id, v_game_id, 'Portal',    2000, 0, 680,  290, 580,     100,    'Good', 0, 'permanent_fruit', 2),
    (v_user_id, v_game_id, 'Sound',     1900, 0, 655,  290, 551,     104,    'Good', 0, 'permanent_fruit', 2),
    (v_user_id, v_game_id, 'Spider',    1800, 0, 620,  290, 522,     98,     'Good', 0, 'permanent_fruit', 2),
    (v_user_id, v_game_id, 'Creation',  1750, 0, 605,  290, 507.5,   97.5,   'Good', 0, 'permanent_fruit', 2),
    (v_user_id, v_game_id, 'Love',      1700, 0, 585,  290, 493,     92,     'Good', 0, 'permanent_fruit', 2),
    (v_user_id, v_game_id, 'Buddha',    1650, 0, 570,  290, 478.5,   91.5,   'Good', 0, 'permanent_fruit', 2),
    (v_user_id, v_game_id, 'Quake',     1500, 0, 515,  290, 435,     80,     'Good', 0, 'permanent_fruit', 2),
    (v_user_id, v_game_id, 'Magma',     1300, 0, 445,  290, 377,     68,     'Good', 0, 'permanent_fruit', 2),
    (v_user_id, v_game_id, 'Ghost',     1275, 0, 430,  290, 369.75,  60.25,  'Good', 0, 'permanent_fruit', 2),
    (v_user_id, v_game_id, 'Rubber',    1200, 0, 420,  290, 348,     72,     'Good', 0, 'permanent_fruit', 2),
    (v_user_id, v_game_id, 'Light',     1100, 0, 385,  290, 319,     66,     'Good', 0, 'permanent_fruit', 2),
    (v_user_id, v_game_id, 'Diamond',   1000, 0, 350,  290, 290,     60,     'Good', 0, 'permanent_fruit', 2),
    (v_user_id, v_game_id, 'Eagle',      975, 0, 340,  290, 282.75,  57.25,  'Good', 0, 'permanent_fruit', 2),
    (v_user_id, v_game_id, 'Dark',       950, 0, 335,  290, 275.5,   59.5,   'Good', 0, 'permanent_fruit', 2),
    (v_user_id, v_game_id, 'Sand',       850, 0, 300,  290, 246.5,   53.5,   'Good', 0, 'permanent_fruit', 2),
    (v_user_id, v_game_id, 'Ice',        750, 0, 265,  290, 217.5,   47.5,   'Good', 0, 'permanent_fruit', 2),
    (v_user_id, v_game_id, 'Flame',      550, 0, 195,  290, 159.5,   35.5,   'Good', 0, 'permanent_fruit', 2),
    (v_user_id, v_game_id, 'Spike',      380, 0, 135,  290, 110.2,   24.8,   'Good', 0, 'permanent_fruit', 2),
    (v_user_id, v_game_id, 'Smoke',      250, 0, 90,   290, 72.5,    17.5,   'Okay', 0, 'permanent_fruit', 2),
    (v_user_id, v_game_id, 'Bomb',       220, 0, 80,   290, 63.8,    16.2,   'Okay', 0, 'permanent_fruit', 2),
    (v_user_id, v_game_id, 'Spring',     180, 0, 65,   290, 52.2,    12.8,   'Okay', 0, 'permanent_fruit', 2),
    (v_user_id, v_game_id, 'Blade',      100, 0, 35,   290, 29,      6,      'Okay', 0, 'permanent_fruit', 2),
    (v_user_id, v_game_id, 'Spin',        75, 0, 25,   290, 21.75,   3.25,   'Bad',  0, 'permanent_fruit', 2);
END $$;
