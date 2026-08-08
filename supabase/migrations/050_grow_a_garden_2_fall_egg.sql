-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 050: Grow A Garden 2 — Fall Egg roll tiers
-- Run in Supabase SQL Editor. Safe to run multiple times (idempotent — only
-- inserts rows that don't already exist, by name + robux_amount, same guard
-- pattern as migration 011).
--
-- Adds 4 products to the existing Grow A Garden 2 game. Does not touch its
-- current products (Vine Wrapper, Power Hose, Grappling Hook, Rainbow
-- Carpet) or any other game.
--
-- robux_rate = 290.00 — verified exact (your_cost = robux_amount x 0.29 for
-- all 4 rows), matching the store-wide rate established in migration 045.
-- Rating maps directly onto the existing status check constraint.
-- product_type / section_order left NULL / 0, consistent with this game's
-- existing 4 products (no Store section-grouping in use here).
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_user_id uuid;
  v_game_id uuid;
BEGIN
  SELECT user_id INTO v_user_id FROM public.games LIMIT 1;

  SELECT id INTO v_game_id
    FROM public.games
   WHERE user_id = v_user_id
     AND name ILIKE 'grow%garden%2%'
   LIMIT 1;

  IF v_game_id IS NULL THEN
    RAISE EXCEPTION 'Grow A Garden 2 not found — expected it to already exist (migration 045/046)';
  END IF;

  INSERT INTO public.gamepasses
    (user_id, game_id, name, robux_amount, competitor_price, your_price, robux_rate, your_cost, profit, status, suggested_lower_price)
  SELECT v_user_id, v_game_id, v.name, v.robux_amount, 0, v.your_price, 290, v.your_cost, v.profit, v.status, 0
  FROM (VALUES
    ('1 roll FALL EGG',   99,  40,   28.71,   11.29, 'Okay'),
    ('3 roll FALL EGG',   249, 95,   72.21,   22.79, 'Good'),
    ('10 roll FALL EGG',  799, 285,  231.71,  53.29, 'Good'),
    ('50 roll FALL EGG', 3499, 1245, 1014.71, 230.29, 'Good')
  ) AS v(name, robux_amount, your_price, your_cost, profit, status)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.gamepasses g
    WHERE g.user_id = v_user_id AND g.game_id = v_game_id
      AND g.name = v.name AND g.robux_amount = v.robux_amount
  );
END $$;
