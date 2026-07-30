-- Migration 044: Drag Drive Simulator gamepass catalog
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New Query → Run All).
-- Safe to run multiple times — converges to the same 15 rows every time.
--
-- Searches for the game by name (case-insensitive) and creates it if missing,
-- then does a clean DELETE + re-INSERT of the full catalog.
-- robux_rate = 270 (derived from your_cost / robux_amount * 1000).
--
-- order_items snapshots name/amount/price/cost/profit at sale time, so this
-- reset does not affect any historical orders or financial figures.

DO $$
DECLARE
  v_user_id uuid;
  v_game_id uuid;
BEGIN
  SELECT user_id INTO v_user_id FROM public.games LIMIT 1;

  SELECT id INTO v_game_id
    FROM public.games
   WHERE user_id = v_user_id
     AND name ILIKE 'drag%drive%simulator'
   LIMIT 1;

  IF v_game_id IS NULL THEN
    INSERT INTO public.games (user_id, name, category, color)
    VALUES (v_user_id, 'Drag Drive Simulator', 'Simulator', '#ef4444')
    RETURNING id INTO v_game_id;
  END IF;

  DELETE FROM public.gamepasses WHERE user_id = v_user_id AND game_id = v_game_id;

  INSERT INTO public.gamepasses
    (user_id, game_id, name, robux_amount, competitor_price, your_price, robux_rate, your_cost, profit, status, suggested_lower_price)
  VALUES
    (v_user_id, v_game_id, 'Police Pass',          149,  55,  55, 270,  40.23, 14.77, 'Okay', 0),
    (v_user_id, v_game_id, 'Luxury Pass',           119,  45,  45, 270,  32.13, 12.87, 'Okay', 0),
    (v_user_id, v_game_id, 'Dragspec Pass',         109,  40,  40, 270,  29.43, 10.57, 'Okay', 0),
    (v_user_id, v_game_id, 'Slot Limit Unlocker',    89,  35,  35, 270,  24.03, 10.97, 'Okay', 0),
    (v_user_id, v_game_id, '2X Paycheck',           499, 170, 175, 270, 134.73, 40.27, 'Good', 0),
    (v_user_id, v_game_id, 'Custom Plate Pass',      79,  30,  30, 270,  21.33,  8.67, 'Okay', 0),
    (v_user_id, v_game_id, 'Exclusive Rims',         79,  30,  30, 270,  21.33,  8.67, 'Okay', 0),
    (v_user_id, v_game_id, 'Advance Paint Pass',     59,  25,  20, 270,  15.93,  4.07, 'Bad',  0),
    (v_user_id, v_game_id, 'Premium Accessories',    59,  25,  20, 270,  15.93,  4.07, 'Bad',  0),
    (v_user_id, v_game_id, 'Boombox Radio',          29,  15,  10, 270,   7.83,  2.17, 'Bad',  0),
    (v_user_id, v_game_id, 'Suspension Pro',         29,  15,  15, 270,   7.83,  7.17, 'Okay', 0),
    (v_user_id, v_game_id, 'Rp 500,000,000',        399, 140, 140, 270, 107.73, 32.27, 'Good', 0),
    (v_user_id, v_game_id, 'Rp 100,000,000',         99,  40,  40, 270,  26.73, 13.27, 'Okay', 0),
    (v_user_id, v_game_id, 'Rp 50,000,000',          59,  25,  20, 270,  15.93,  4.07, 'Bad',  0),
    (v_user_id, v_game_id, 'Rp 10,000,000',          35,  20,  15, 270,   9.45,  5.55, 'Okay', 0);
END $$;
