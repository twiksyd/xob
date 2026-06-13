-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 013: Anime Warriors III — new gamepasses
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New Query → Run All).
-- Idempotent — safe to run multiple times (gamepasses are only inserted if a
-- row with the same name + robux_amount doesn't already exist for this game).
-- Robux rate for these entries is 230 PHP/1000 R$ (matches the provided
-- cost/profit figures).
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_user_id  uuid;
  v_warriors uuid;
BEGIN
  SELECT user_id INTO v_user_id FROM public.games LIMIT 1;

  SELECT id INTO v_warriors FROM public.games WHERE user_id = v_user_id AND name = 'Anime Warriors III';
  IF v_warriors IS NULL THEN
    INSERT INTO public.games (user_id, name, category, color) VALUES (v_user_id, 'Anime Warriors III', 'Tower Defense', '#f59e0b') RETURNING id INTO v_warriors;
  END IF;

  INSERT INTO public.gamepasses (user_id, game_id, name, robux_amount, competitor_price, your_price, robux_rate, your_cost, profit, status, suggested_lower_price)
  SELECT v_user_id, v_warriors, v.name, v.robux_amount, 0, v.your_price, 230, v.your_cost, v.profit, v.status, -5
  FROM (VALUES
    ('VIP',            499, 155, 114.77, 40.23, 'Good'),
    ('Extra Equip',    399, 115,  91.77, 23.23, 'Good'),
    ('2x Cash',        299,  90,  68.77, 21.23, 'Good'),
    ('1.5x EXP',       499, 155, 114.77, 40.23, 'Good'),
    ('Lucky',          149,  55,  34.27, 20.73, 'Good'),
    ('Super Lucky',    649, 175, 149.27, 25.73, 'Good'),
    ('Omega Lucky',   1199, 330, 275.77, 54.23, 'Good'),
    ('Small Storage',   99,  40,  22.77, 17.23, 'Okay'),
    ('Fast Open',      399, 115,  91.77, 23.23, 'Good'),
    ('Multi Open',     499, 155, 114.77, 40.23, 'Good'),
    ('Huge Storage',   199,  65,  45.77, 19.23, 'Okay'),
    ('Shiny Hunter',   699, 185, 160.77, 24.23, 'Good'),
    ('Secret Hunter', 1499, 390, 344.77, 45.23, 'Good'),
    ('Fast Travel',     49,  25,  11.27, 13.73, 'Okay'),
    ('1x Reroll',       69,  30,  15.87, 14.13, 'Okay'),
    ('10x Reroll',     699, 185, 160.77, 24.23, 'Good')
  ) AS v(name, robux_amount, your_price, your_cost, profit, status)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.gamepasses g
    WHERE g.user_id = v_user_id AND g.game_id = v_warriors AND g.name = v.name AND g.robux_amount = v.robux_amount
  );
END $$;
