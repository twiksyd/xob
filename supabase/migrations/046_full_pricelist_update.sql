-- Migration 046: Pricelist refresh from kennmar.xlsx (2026-08-07)
-- Run in Supabase SQL Editor. Safe to run multiple times — converges.
--
-- Changes applied:
--   Brookhaven       : Premium your_price 106 → 100
--   Diesel N Steel   : rename "Vip" → "VIP"
--   Anime Expedition : all 22 products repriced; name fixes for Villain Coins
--                      ("7500VILLAIN COINS" → "7,500 Villain Coins", etc.)
--   Evomon           : NEW game (RPG, #10b981) + 9 products
--   Keyboard Escape | Candy & Chocolate (DC ACC) : NEW game (Other, #8b5cf6) + 5 products
--
-- Skipped sections (per dry-run approval):
--   Calculator rows, Anime Squadron, Build a Ring Farm, EVADE, Redliner
--   All other games: prices and products unchanged.
--
-- Red-excluded products (Grow A Garden 2: Legendary/Mythic/Super;
--   Run A Restaurant: Shiny Hunter/Beginner/Summon/Upgrade) are NOT in the DB —
--   no is_active change needed.

DO $$
DECLARE
  v_user_id uuid;
  v_game_id uuid;
BEGIN
  SELECT user_id INTO v_user_id FROM public.games LIMIT 1;

  -- ─── Brookhaven: Premium price correction ────────────────────────────────
  SELECT id INTO v_game_id
    FROM public.games
   WHERE user_id = v_user_id AND name ILIKE 'brookhaven%'
   LIMIT 1;
  IF v_game_id IS NOT NULL THEN
    UPDATE public.gamepasses
       SET your_price = 100
     WHERE user_id = v_user_id AND game_id = v_game_id AND name = 'Premium';
  END IF;

  -- ─── Diesel N Steel: rename Vip → VIP ────────────────────────────────────
  SELECT id INTO v_game_id
    FROM public.games
   WHERE user_id = v_user_id AND name ILIKE 'diesel%steel%'
   LIMIT 1;
  IF v_game_id IS NOT NULL THEN
    UPDATE public.gamepasses
       SET name = 'VIP'
     WHERE user_id = v_user_id AND game_id = v_game_id AND name = 'Vip';
  END IF;

  -- ─── Anime Expedition: full price refresh + name cleanup ─────────────────
  SELECT id INTO v_game_id
    FROM public.games
   WHERE user_id = v_user_id AND name ILIKE 'anime%expedition%'
   LIMIT 1;
  IF v_game_id IS NULL THEN
    INSERT INTO public.games (user_id, name, category, color)
    VALUES (v_user_id, 'Anime Expedition', 'RPG', '#f59e0b')
    RETURNING id INTO v_game_id;
  END IF;
  DELETE FROM public.gamepasses WHERE user_id = v_user_id AND game_id = v_game_id;
  INSERT INTO public.gamepasses (user_id, game_id, name, robux_amount, your_price, robux_rate, your_cost) VALUES
    (v_user_id, v_game_id, 'Starter Bundle',        249,   95, 290,   72.21),
    (v_user_id, v_game_id, 'VIP',                   399,  140, 290,  115.71),
    (v_user_id, v_game_id, 'Display All Units',      399,  140, 290,  115.71),
    (v_user_id, v_game_id, 'Shiny Hunter',           999,  355, 290,  289.71),
    (v_user_id, v_game_id, 'Premium BP',             999,  355, 290,  289.71),
    (v_user_id, v_game_id, 'Release Bundle 1',       999,  355, 290,  289.71),
    (v_user_id, v_game_id, 'Release Bundle 2',      3999, 1420, 290, 1159.71),
    (v_user_id, v_game_id, 'Release Bundle 3',      7999, 2840, 290, 2319.71),
    (v_user_id, v_game_id, 'Release Bundle 4',      9999, 3550, 290, 2899.71),
    (v_user_id, v_game_id, 'Villain Bundle 1',       999,  355, 290,  289.71),
    (v_user_id, v_game_id, 'Villain Bundle 2',      3999, 1420, 290, 1159.71),
    (v_user_id, v_game_id, 'Villain Bundle 3',      7999, 2840, 290, 2319.71),
    (v_user_id, v_game_id, '1 Trait Crystal',        114,   44, 290,   33.06),
    (v_user_id, v_game_id, '10 Trait Crystal',       999,  355, 290,  289.71),
    (v_user_id, v_game_id, '25 Trait Crystal',      2399,  850, 290,  695.71),
    (v_user_id, v_game_id, '50 Trait Crystal',      4299, 1525, 290, 1246.71),
    (v_user_id, v_game_id, '2,500 Villain Coins',    199,   75, 290,   57.71),
    (v_user_id, v_game_id, '7,500 Villain Coins',   4999, 1775, 290, 1449.71),
    (v_user_id, v_game_id, '25,000 Villain Coins',  1499,  535, 290,  434.71),
    (v_user_id, v_game_id, '75,000 Villain Coins',  3999, 1420, 290, 1159.71),
    (v_user_id, v_game_id, 'Luck Potion',            149,   58, 290,   43.21),
    (v_user_id, v_game_id, 'Super Luck Potion',      249,   95, 290,   72.21);

  -- ─── Evomon: new game ────────────────────────────────────────────────────
  SELECT id INTO v_game_id
    FROM public.games
   WHERE user_id = v_user_id AND name ILIKE 'evomon%'
   LIMIT 1;
  IF v_game_id IS NULL THEN
    INSERT INTO public.games (user_id, name, category, color)
    VALUES (v_user_id, 'Evomon', 'RPG', '#10b981')
    RETURNING id INTO v_game_id;
  END IF;
  DELETE FROM public.gamepasses WHERE user_id = v_user_id AND game_id = v_game_id;
  INSERT INTO public.gamepasses (user_id, game_id, name, robux_amount, your_price, robux_rate, your_cost) VALUES
    (v_user_id, v_game_id, 'VIP',               139,   55, 290,  40.31),
    (v_user_id, v_game_id, '2x Faster',          69,   26, 290,  20.01),
    (v_user_id, v_game_id, '50 Storage',          35,   15, 290,  10.15),
    (v_user_id, v_game_id, 'King Ball',           69,   26, 290,  20.01),
    (v_user_id, v_game_id, 'Prismatic Ball',     275,  100, 290,  79.75),
    (v_user_id, v_game_id, '10x King Ball',      605,  215, 290, 175.45),
    (v_user_id, v_game_id, '10x Prismatic Ball',2415,  855, 290, 700.35),
    (v_user_id, v_game_id, 'Premium Pass',       309,  110, 290,  89.61),
    (v_user_id, v_game_id, 'Premium',            169,   65, 290,  49.01);

  -- ─── Keyboard Escape | Candy & Chocolate (DC ACC): new game ──────────────
  SELECT id INTO v_game_id
    FROM public.games
   WHERE user_id = v_user_id AND name ILIKE 'keyboard%escape%'
   LIMIT 1;
  IF v_game_id IS NULL THEN
    INSERT INTO public.games (user_id, name, category, color)
    VALUES (v_user_id, 'Keyboard Escape | Candy & Chocolate (DC ACC)', 'Other', '#8b5cf6')
    RETURNING id INTO v_game_id;
  END IF;
  DELETE FROM public.gamepasses WHERE user_id = v_user_id AND game_id = v_game_id;
  INSERT INTO public.gamepasses (user_id, game_id, name, robux_amount, your_price, robux_rate, your_cost) VALUES
    (v_user_id, v_game_id, 'Gold Treadmill',      29,   11, 290,   8.41),
    (v_user_id, v_game_id, 'Diamond Treadmill',  119,   50, 290,  34.51),
    (v_user_id, v_game_id, 'Candy Treadmill',    299,  105, 290,  86.71),
    (v_user_id, v_game_id, 'Admin Treadmill',    639,  229, 290, 185.31),
    (v_user_id, v_game_id, 'Infinity Trail',    1199,  430, 290, 347.71);

END $$;
