-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 011: Gamepass Catalog Update
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New Query → Run All).
-- Sections 1-5 are safe to run multiple times (idempotent — games/gamepasses
-- are only inserted if they don't already exist). Section 6 is destructive
-- and commented out by default; review section 5's output before uncommenting.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- 1-4. Add gamepasses for Hypershot, Keyboard Escape (Candy & Chocolate event),
--      and Build a ring farm. Robux rate for these entries is 230 PHP/1000 R$
--      (matches the provided cost/profit figures).
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_user_id   uuid;
  v_hypershot uuid;
  v_kbescape  uuid;
  v_ringfarm  uuid;
BEGIN
  SELECT user_id INTO v_user_id FROM public.games LIMIT 1;

  -- Resolve / create games
  SELECT id INTO v_hypershot FROM public.games WHERE user_id = v_user_id AND name = 'Hypershot';
  IF v_hypershot IS NULL THEN
    INSERT INTO public.games (user_id, name) VALUES (v_user_id, 'Hypershot') RETURNING id INTO v_hypershot;
  END IF;

  SELECT id INTO v_kbescape FROM public.games WHERE user_id = v_user_id AND name = 'Keyboard Escape';
  IF v_kbescape IS NULL THEN
    INSERT INTO public.games (user_id, name, category) VALUES (v_user_id, 'Keyboard Escape', 'Candy & Chocolate') RETURNING id INTO v_kbescape;
  END IF;

  SELECT id INTO v_ringfarm FROM public.games WHERE user_id = v_user_id AND name = 'Build a ring farm';
  IF v_ringfarm IS NULL THEN
    INSERT INTO public.games (user_id, name) VALUES (v_user_id, 'Build a ring farm') RETURNING id INTO v_ringfarm;
  END IF;

  -- Hypershot gamepasses
  INSERT INTO public.gamepasses (user_id, game_id, name, robux_amount, competitor_price, your_price, robux_rate, your_cost, profit, status, suggested_lower_price)
  SELECT v_user_id, v_hypershot, v.name, v.robux_amount, 0, v.your_price, 230, v.your_cost, v.profit, v.status, -5
  FROM (VALUES
    ('celestial',           850, 245, 195.50, 49.50, 'Good'),
    ('lovesick',            850, 245, 195.50, 49.50, 'Good'),
    ('VIP',                 399, 115,  91.77, 23.23, 'Good'),
    ('Rainbow Bullets',     199,  60,  45.77, 14.23, 'Okay'),
    ('67 bundle',            67,  25,  15.41,  9.59, 'Okay'),
    ('The Big Gun',        1299, 360, 298.77, 61.23, 'Good'),
    ('Pizza party',         399, 120,  91.77, 28.23, 'Good'),
    ('Starter Pack',         59,  20,  13.57,  6.43, 'Okay'),
    ('The Essentials',      799, 230, 183.77, 46.23, 'Good'),
    ('Lucky',               199,  70,  45.77, 24.23, 'Good')
  ) AS v(name, robux_amount, your_price, your_cost, profit, status)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.gamepasses g
    WHERE g.user_id = v_user_id AND g.game_id = v_hypershot AND g.name = v.name AND g.robux_amount = v.robux_amount
  );

  -- Keyboard Escape | Candy & Chocolate gamepasses
  INSERT INTO public.gamepasses (user_id, game_id, name, robux_amount, competitor_price, your_price, robux_rate, your_cost, profit, status, suggested_lower_price)
  SELECT v_user_id, v_kbescape, v.name, v.robux_amount, 0, v.your_price, 230, v.your_cost, v.profit, v.status, -5
  FROM (VALUES
    ('gold treadmill',       59,  30,  13.57, 16.43, 'Okay'),
    ('diamond treadmill',   259,  85,  59.57, 25.43, 'Good'),
    ('candy treadmill',     749, 210, 172.27, 37.73, 'Good'),
    ('admin treadmill',    1599, 410, 367.77, 42.23, 'Good')
  ) AS v(name, robux_amount, your_price, your_cost, profit, status)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.gamepasses g
    WHERE g.user_id = v_user_id AND g.game_id = v_kbescape AND g.name = v.name AND g.robux_amount = v.robux_amount
  );

  -- Build a ring farm gamepasses
  INSERT INTO public.gamepasses (user_id, game_id, name, robux_amount, competitor_price, your_price, robux_rate, your_cost, profit, status, suggested_lower_price)
  SELECT v_user_id, v_ringfarm, v.name, v.robux_amount, 0, v.your_price, 230, v.your_cost, v.profit, v.status, -5
  FROM (VALUES
    ('1 egg',                199,  60,  45.77, 14.23, 'Okay'),
    ('3 egg',                499, 140, 114.77, 25.23, 'Good'),
    ('10 eggs',             1499, 390, 344.77, 45.23, 'Good'),
    ('3 packs',              499, 140, 114.77, 25.23, 'Good'),
    ('1 pack',               199,  60,  45.77, 14.23, 'Okay'),
    ('10 packs',            1199, 320, 275.77, 44.23, 'Good'),
    ('1 pack',                79,  25,  18.17,  6.83, 'Okay'),
    ('3 packs',              199,  60,  45.77, 14.23, 'Okay'),
    ('10 packs',             699, 190, 160.77, 29.23, 'Good'),
    ('1 pet equip',          999, 280, 229.77, 50.23, 'Good'),
    ('disco bundle',        1999, 510, 459.77, 50.23, 'Good'),
    ('pirate bundle',        799, 240, 183.77, 56.23, 'Good'),
    ('gummy kingdom bundle', 1199, 320, 275.77, 44.23, 'Good')
  ) AS v(name, robux_amount, your_price, your_cost, profit, status)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.gamepasses g
    WHERE g.user_id = v_user_id AND g.game_id = v_ringfarm AND g.name = v.name AND g.robux_amount = v.robux_amount
  );
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. CDID — preview gamepasses with "RP" in the name (read-only, run first)
-- ─────────────────────────────────────────────────────────────────────────────

SELECT g.id, g.name, g.robux_amount, g.your_price, g.status
FROM public.gamepasses g
JOIN public.games ga ON ga.id = g.game_id
WHERE ga.name = 'CDID' AND g.name ILIKE '%rp%';

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. CDID — delete those gamepasses
-- Review the preview from section 5 above. If the list looks correct,
-- uncomment the statement below and run it on its own.
-- ─────────────────────────────────────────────────────────────────────────────

-- DELETE FROM public.gamepasses g
-- USING public.games ga
-- WHERE ga.id = g.game_id AND ga.name = 'CDID' AND g.name ILIKE '%rp%';
