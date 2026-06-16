-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 022: Reset Anime Warriors III gamepass catalog
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New Query → Run All).
-- Safe to run multiple times — converges to the same 16 rows every time.
--
-- DELETEs every existing gamepass under "Anime Warriors III" (clears out the
-- stray/duplicate rows that have accumulated), then re-inserts the canonical
-- 16-item catalog from migration 013.
--
-- order_items.gamepass_id is ON DELETE SET NULL, and order_items snapshots
-- gamepass_name / robux_amount / selling_price / cost / profit at sale time —
-- so this cleanup does not affect historical orders, transactions, or any
-- financial-integrity figures.
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

  DELETE FROM public.gamepasses WHERE user_id = v_user_id AND game_id = v_warriors;

  INSERT INTO public.gamepasses (user_id, game_id, name, robux_amount, competitor_price, your_price, robux_rate, your_cost, profit, status, suggested_lower_price)
  VALUES
    (v_user_id, v_warriors, 'VIP',            499, 0, 155, 230, 114.77, 40.23, 'Good', -5),
    (v_user_id, v_warriors, 'Extra Equip',    399, 0, 115, 230,  91.77, 23.23, 'Good', -5),
    (v_user_id, v_warriors, '2x Cash',        299, 0,  90, 230,  68.77, 21.23, 'Good', -5),
    (v_user_id, v_warriors, '1.5x EXP',       499, 0, 155, 230, 114.77, 40.23, 'Good', -5),
    (v_user_id, v_warriors, 'Lucky',          149, 0,  55, 230,  34.27, 20.73, 'Good', -5),
    (v_user_id, v_warriors, 'Super Lucky',    649, 0, 175, 230, 149.27, 25.73, 'Good', -5),
    (v_user_id, v_warriors, 'Omega Lucky',   1199, 0, 330, 230, 275.77, 54.23, 'Good', -5),
    (v_user_id, v_warriors, 'Small Storage',   99, 0,  40, 230,  22.77, 17.23, 'Okay', -5),
    (v_user_id, v_warriors, 'Fast Open',      399, 0, 115, 230,  91.77, 23.23, 'Good', -5),
    (v_user_id, v_warriors, 'Multi Open',     499, 0, 155, 230, 114.77, 40.23, 'Good', -5),
    (v_user_id, v_warriors, 'Huge Storage',   199, 0,  65, 230,  45.77, 19.23, 'Okay', -5),
    (v_user_id, v_warriors, 'Shiny Hunter',   699, 0, 185, 230, 160.77, 24.23, 'Good', -5),
    (v_user_id, v_warriors, 'Secret Hunter', 1499, 0, 390, 230, 344.77, 45.23, 'Good', -5),
    (v_user_id, v_warriors, 'Fast Travel',     49, 0,  25, 230,  11.27, 13.73, 'Okay', -5),
    (v_user_id, v_warriors, '1x Reroll',       69, 0,  30, 230,  15.87, 14.13, 'Okay', -5),
    (v_user_id, v_warriors, '10x Reroll',     699, 0, 185, 230, 160.77, 24.23, 'Good', -5);
END $$;
