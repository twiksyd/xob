-- Migration 045: Full pricelist update — robux_rate = 290 across all games
-- Run in Supabase SQL Editor. Safe to run multiple times.
-- Skipped: Evomon, Keyboard Escape / Candy & Chocolate, Build a Ring Farm, EVADE (DC ACC / prompt-only).

DO $$
DECLARE
  v_user_id uuid;
  v_game_id uuid;
BEGIN
  SELECT user_id INTO v_user_id FROM public.games LIMIT 1;

  -- ─── Drag Drive Simulator ────────────────────────────────────────────────────
  SELECT id INTO v_game_id FROM public.games WHERE user_id = v_user_id AND name ILIKE 'drag%drive%simulator' LIMIT 1;
  IF v_game_id IS NULL THEN
    INSERT INTO public.games (user_id, name, category, color) VALUES (v_user_id, 'Drag Drive Simulator', 'Simulator', '#ef4444') RETURNING id INTO v_game_id;
  END IF;
  DELETE FROM public.gamepasses WHERE user_id = v_user_id AND game_id = v_game_id;
  INSERT INTO public.gamepasses (user_id, game_id, name, robux_amount, your_price, robux_rate, your_cost) VALUES
    (v_user_id, v_game_id, 'Police Pass',          149,   55, 290,  43.21),
    (v_user_id, v_game_id, 'Luxury Pass',           119,   45, 290,  34.51),
    (v_user_id, v_game_id, 'Dragspec Pass',         109,   40, 290,  31.61),
    (v_user_id, v_game_id, 'Slot Limit Unlocker',    89,   35, 290,  25.81),
    (v_user_id, v_game_id, '2X Paycheck',           499,  175, 290, 144.71),
    (v_user_id, v_game_id, 'Custom Plate Pass',      79,   30, 290,  22.91),
    (v_user_id, v_game_id, 'Exclusive Rims',         79,   30, 290,  22.91),
    (v_user_id, v_game_id, 'Advance Paint Pass',     59,   25, 290,  17.11),
    (v_user_id, v_game_id, 'Premium Accessories',    59,   25, 290,  17.11),
    (v_user_id, v_game_id, 'Boombox Radio',          29,   15, 290,   8.41),
    (v_user_id, v_game_id, 'Suspension Pro',         29,   15, 290,   8.41),
    (v_user_id, v_game_id, 'Rp 500,000,000',        399,  140, 290, 115.71),
    (v_user_id, v_game_id, 'Rp 100,000,000',         99,   40, 290,  28.71),
    (v_user_id, v_game_id, 'Rp 50,000,000',          59,   25, 290,  17.11),
    (v_user_id, v_game_id, 'Rp 10,000,000',          35,   15, 290,  10.15),
    (v_user_id, v_game_id, '5,000,000',              18,    6, 290,   5.22),
    (v_user_id, v_game_id, '1,000,000',               9,    4, 290,   2.61);

  -- ─── CDID ────────────────────────────────────────────────────────────────────
  SELECT id INTO v_game_id FROM public.games WHERE user_id = v_user_id AND name ILIKE 'cdid%' LIMIT 1;
  IF v_game_id IS NULL THEN
    INSERT INTO public.games (user_id, name, category, color) VALUES (v_user_id, 'CDID', 'Driving', '#3b82f6') RETURNING id INTO v_game_id;
  END IF;
  DELETE FROM public.gamepasses WHERE user_id = v_user_id AND game_id = v_game_id;
  INSERT INTO public.gamepasses (user_id, game_id, name, robux_amount, your_price, robux_rate, your_cost) VALUES
    (v_user_id, v_game_id, 'Emergency Vehicles',        139,   55, 290,   40.31),
    (v_user_id, v_game_id, '50% Job Earning',           399,  140, 290,  115.71),
    (v_user_id, v_game_id, 'Advance Modification',      249,   95, 290,   72.21),
    (v_user_id, v_game_id, 'Luxury Vehicles',           259,  100, 290,   75.11),
    (v_user_id, v_game_id, 'Additional Ownable Car',     99,   40, 290,   28.71),
    (v_user_id, v_game_id, 'Rare Imports',              189,   75, 290,   54.81),
    (v_user_id, v_game_id, 'Luxury House',               79,   30, 290,   22.91),
    (v_user_id, v_game_id, '2x Paycheck',               399,  140, 290,  115.71),
    (v_user_id, v_game_id, 'Retro Pass',                169,   67, 290,   49.01),
    (v_user_id, v_game_id, '2x Additional Ownable Car', 269,  102, 290,   78.01),
    (v_user_id, v_game_id, 'Rp. 10,000,000,000',       1999,  710, 290,  579.71),
    (v_user_id, v_game_id, 'Rp. 25,000,000',            39,   15, 290,   11.31),
    (v_user_id, v_game_id, 'Rp. 25,000,000,000',       3699, 1315, 290, 1072.71),
    (v_user_id, v_game_id, 'Rp. 100,000,000',           79,   31, 290,   22.91),
    (v_user_id, v_game_id, 'Rp. 2,500,000,000',        999,  355, 290,  289.71),
    (v_user_id, v_game_id, 'Rp. 750,000,000',          399,  140, 290,  115.71),
    (v_user_id, v_game_id, 'Rp. 250,000,000',          169,   67, 290,   49.01),
    (v_user_id, v_game_id, 'Limited Box',                45,   17, 290,   13.05);

  -- ─── Robux Sell — Covered Tax ────────────────────────────────────────────────
  SELECT id INTO v_game_id FROM public.games WHERE user_id = v_user_id AND name ILIKE 'robux%sell%covered%' LIMIT 1;
  IF v_game_id IS NULL THEN
    INSERT INTO public.games (user_id, name, category, color) VALUES (v_user_id, 'Robux Sell — Covered Tax', 'Service', '#8b5cf6') RETURNING id INTO v_game_id;
  END IF;
  DELETE FROM public.gamepasses WHERE user_id = v_user_id AND game_id = v_game_id;
  INSERT INTO public.gamepasses (user_id, game_id, name, robux_amount, your_price, robux_rate, your_cost) VALUES
    (v_user_id, v_game_id, 'R$100 Covered',    143,  50, 290,  41.47),
    (v_user_id, v_game_id, 'R$200 Covered',    286,  95, 290,  82.94),
    (v_user_id, v_game_id, 'R$300 Covered',    429, 140, 290, 124.41),
    (v_user_id, v_game_id, 'R$400 Covered',    572, 185, 290, 165.88),
    (v_user_id, v_game_id, 'R$500 Covered',    715, 230, 290, 207.35),
    (v_user_id, v_game_id, 'R$600 Covered',    858, 280, 290, 248.82),
    (v_user_id, v_game_id, 'R$800 Covered',   1143, 370, 290, 331.47),
    (v_user_id, v_game_id, 'R$1,000 Covered', 1429, 455, 290, 414.41);

  -- ─── Robux Sell — No Tax ─────────────────────────────────────────────────────
  SELECT id INTO v_game_id FROM public.games WHERE user_id = v_user_id AND name ILIKE 'robux%sell%no%tax%' LIMIT 1;
  IF v_game_id IS NULL THEN
    INSERT INTO public.games (user_id, name, category, color) VALUES (v_user_id, 'Robux Sell — No Tax', 'Service', '#8b5cf6') RETURNING id INTO v_game_id;
  END IF;
  DELETE FROM public.gamepasses WHERE user_id = v_user_id AND game_id = v_game_id;
  INSERT INTO public.gamepasses (user_id, game_id, name, robux_amount, your_price, robux_rate, your_cost) VALUES
    (v_user_id, v_game_id, 'R$100',    100,  35, 290,  29.00),
    (v_user_id, v_game_id, 'R$200',    200,  70, 290,  58.00),
    (v_user_id, v_game_id, 'R$300',    300, 105, 290,  87.00),
    (v_user_id, v_game_id, 'R$400',    400, 140, 290, 116.00),
    (v_user_id, v_game_id, 'R$500',    500, 170, 290, 145.00),
    (v_user_id, v_game_id, 'R$600',    600, 195, 290, 174.00),
    (v_user_id, v_game_id, 'R$800',    800, 275, 290, 232.00),
    (v_user_id, v_game_id, 'R$1,000', 1000, 350, 290, 290.00);

  -- ─── Robux Plus ──────────────────────────────────────────────────────────────
  SELECT id INTO v_game_id FROM public.games WHERE user_id = v_user_id AND name ILIKE 'robux%plus%' LIMIT 1;
  IF v_game_id IS NULL THEN
    INSERT INTO public.games (user_id, name, category, color) VALUES (v_user_id, 'Robux Plus', 'Service', '#8b5cf6') RETURNING id INTO v_game_id;
  END IF;
  DELETE FROM public.gamepasses WHERE user_id = v_user_id AND game_id = v_game_id;
  INSERT INTO public.gamepasses (user_id, game_id, name, robux_amount, your_price, robux_rate, your_cost) VALUES
    (v_user_id, v_game_id, 'R$100 Plus',   100,  50, 290,  29.00),
    (v_user_id, v_game_id, 'R$200 Plus',   200,  90, 290,  58.00),
    (v_user_id, v_game_id, 'R$300 Plus',   300, 135, 290,  87.00),
    (v_user_id, v_game_id, 'R$400 Plus',   400, 185, 290, 116.00),
    (v_user_id, v_game_id, 'R$500 Plus',   500, 230, 290, 145.00),
    (v_user_id, v_game_id, 'R$600 Plus',   600, 275, 290, 174.00),
    (v_user_id, v_game_id, 'R$700 Plus',   700, 320, 290, 203.00),
    (v_user_id, v_game_id, 'R$800 Plus',   800, 365, 290, 232.00),
    (v_user_id, v_game_id, 'R$900 Plus',   900, 410, 290, 261.00),
    (v_user_id, v_game_id, 'R$1000 Plus', 1000, 450, 290, 290.00);

  -- ─── Gakuran ─────────────────────────────────────────────────────────────────
  SELECT id INTO v_game_id FROM public.games WHERE user_id = v_user_id AND name ILIKE 'gakuran%' LIMIT 1;
  IF v_game_id IS NULL THEN
    INSERT INTO public.games (user_id, name, category, color) VALUES (v_user_id, 'Gakuran', 'RPG', '#10b981') RETURNING id INTO v_game_id;
  END IF;
  DELETE FROM public.gamepasses WHERE user_id = v_user_id AND game_id = v_game_id;
  INSERT INTO public.gamepasses (user_id, game_id, name, robux_amount, your_price, robux_rate, your_cost) VALUES
    (v_user_id, v_game_id, '150 Rerolls', 150, 60, 290, 43.50);

  -- ─── Grow A Garden 2 ─────────────────────────────────────────────────────────
  SELECT id INTO v_game_id FROM public.games WHERE user_id = v_user_id AND name ILIKE 'grow%garden%2%' LIMIT 1;
  IF v_game_id IS NULL THEN
    INSERT INTO public.games (user_id, name, category, color) VALUES (v_user_id, 'Grow A Garden 2', 'Simulator', '#22c55e') RETURNING id INTO v_game_id;
  END IF;
  DELETE FROM public.gamepasses WHERE user_id = v_user_id AND game_id = v_game_id;
  INSERT INTO public.gamepasses (user_id, game_id, name, robux_amount, your_price, robux_rate, your_cost) VALUES
    (v_user_id, v_game_id, 'Vine Wrapper',   499, 180, 290, 144.71),
    (v_user_id, v_game_id, 'Power Hose',     299, 105, 290,  86.71),
    (v_user_id, v_game_id, 'Grappling Hook', 749, 265, 290, 217.21),
    (v_user_id, v_game_id, 'Rainbow Carpet', 599, 215, 290, 173.71);

  -- ─── Anime Squadron ──────────────────────────────────────────────────────────
  SELECT id INTO v_game_id FROM public.games WHERE user_id = v_user_id AND name ILIKE 'anime%squadron%' LIMIT 1;
  IF v_game_id IS NULL THEN
    INSERT INTO public.games (user_id, name, category, color) VALUES (v_user_id, 'Anime Squadron', 'RPG', '#f59e0b') RETURNING id INTO v_game_id;
  END IF;
  DELETE FROM public.gamepasses WHERE user_id = v_user_id AND game_id = v_game_id;
  INSERT INTO public.gamepasses (user_id, game_id, name, robux_amount, your_price, robux_rate, your_cost) VALUES
    (v_user_id, v_game_id, 'Shinobi-Bundle!(+Skin)', 3999, 1420, 290, 1159.71),
    (v_user_id, v_game_id, 'Dragon Bundle (+Skin)',  3199, 1140, 290,  927.71),
    (v_user_id, v_game_id, 'Beginner Bundle',         499,  180, 290,  144.71),
    (v_user_id, v_game_id, 'Premium',                 399,  140, 290,  115.71),
    (v_user_id, v_game_id, '3x Speed',                499,  180, 290,  144.71),
    (v_user_id, v_game_id, 'Shiny Hunter',           1199,  430, 290,  347.71),
    (v_user_id, v_game_id, 'Beginner',                499,  180, 290,  144.71),
    (v_user_id, v_game_id, 'Summon',                  199,   75, 290,   57.71),
    (v_user_id, v_game_id, 'Upgrade',                  79,   33, 290,   22.91),
    (v_user_id, v_game_id, 'Battlepass',              499,  180, 290,  144.71);

  -- ─── Diesel N Steel ──────────────────────────────────────────────────────────
  SELECT id INTO v_game_id FROM public.games WHERE user_id = v_user_id AND name ILIKE 'diesel%steel%' LIMIT 1;
  IF v_game_id IS NULL THEN
    INSERT INTO public.games (user_id, name, category, color) VALUES (v_user_id, 'Diesel N Steel', 'Action', '#ef4444') RETURNING id INTO v_game_id;
  END IF;
  DELETE FROM public.gamepasses WHERE user_id = v_user_id AND game_id = v_game_id;
  INSERT INTO public.gamepasses (user_id, game_id, name, robux_amount, your_price, robux_rate, your_cost) VALUES
    (v_user_id, v_game_id, 'X2 Cash',   399, 140, 290, 115.71),
    (v_user_id, v_game_id, 'Vip',       299, 105, 290,  86.71),
    (v_user_id, v_game_id, 'X2 Exp',   399, 140, 290, 115.71),
    (v_user_id, v_game_id, '-Dmg',      199,  75, 290,  57.71),
    (v_user_id, v_game_id, 'Discount',  249,  95, 290,  72.21),
    (v_user_id, v_game_id, '1k',         19,   7, 290,   5.51),
    (v_user_id, v_game_id, '2.5k',       69,  25, 290,  20.01),
    (v_user_id, v_game_id, '10k',       149,  58, 290,  43.21),
    (v_user_id, v_game_id, '25k',       219,  85, 290,  63.51),
    (v_user_id, v_game_id, '100k',      799, 285, 290, 231.71),
    (v_user_id, v_game_id, '100xp',      49,  25, 290,  14.21),
    (v_user_id, v_game_id, '250xp',     100,  40, 290,  29.00),
    (v_user_id, v_game_id, '1kxp',      349, 125, 290, 101.21),
    (v_user_id, v_game_id, '2.5kxp',   519, 187, 290, 150.51),
    (v_user_id, v_game_id, '10kxp',    899, 320, 290, 260.71);

  -- ─── Storage Hunters ─────────────────────────────────────────────────────────
  SELECT id INTO v_game_id FROM public.games WHERE user_id = v_user_id AND name ILIKE 'storage%hunters%' LIMIT 1;
  IF v_game_id IS NULL THEN
    INSERT INTO public.games (user_id, name, category, color) VALUES (v_user_id, 'Storage Hunters', 'Simulator', '#f97316') RETURNING id INTO v_game_id;
  END IF;
  DELETE FROM public.gamepasses WHERE user_id = v_user_id AND game_id = v_game_id;
  INSERT INTO public.gamepasses (user_id, game_id, name, robux_amount, your_price, robux_rate, your_cost) VALUES
    (v_user_id, v_game_id, 'Quick Sell',                 249,  95, 290,  72.21),
    (v_user_id, v_game_id, '50% Car Weight',             379, 136, 290, 109.91),
    (v_user_id, v_game_id, '50% Inventory Storage',      399, 140, 290, 115.71),
    (v_user_id, v_game_id, 'Celebrity Customers',        479, 171, 290, 138.91),
    (v_user_id, v_game_id, 'Speedy Offers',              449, 170, 290, 130.21),
    (v_user_id, v_game_id, '50% Selling Space',          349, 125, 290, 101.21),
    (v_user_id, v_game_id, 'Lucky Grading',              399, 140, 290, 115.71),
    (v_user_id, v_game_id, 'Free Vehicle Customisation', 149,  58, 290,  43.21);

  -- ─── Bloxburg ────────────────────────────────────────────────────────────────
  SELECT id INTO v_game_id FROM public.games WHERE user_id = v_user_id AND name ILIKE '%bloxburg%' LIMIT 1;
  IF v_game_id IS NULL THEN
    INSERT INTO public.games (user_id, name, category, color) VALUES (v_user_id, 'Bloxburg', 'Roleplay', '#06b6d4') RETURNING id INTO v_game_id;
  END IF;
  DELETE FROM public.gamepasses WHERE user_id = v_user_id AND game_id = v_game_id;
  INSERT INTO public.gamepasses (user_id, game_id, name, robux_amount, your_price, robux_rate, your_cost) VALUES
    (v_user_id, v_game_id, 'Multiple Floors',    300,  105, 290,   87.00),
    (v_user_id, v_game_id, 'Advanced Placing',   200,   75, 290,   58.00),
    (v_user_id, v_game_id, 'Transform Plus',     600,  215, 290,  174.00),
    (v_user_id, v_game_id, 'Basements',          100,   38, 290,   29.00),
    (v_user_id, v_game_id, 'Premium',            400,  140, 290,  116.00),
    (v_user_id, v_game_id, 'Large Plot',         250,   95, 290,   72.50),
    (v_user_id, v_game_id, 'Excellent Employee', 300,  105, 290,   87.00),
    (v_user_id, v_game_id, 'Marvelous Mood',     180,   70, 290,   52.20),
    (v_user_id, v_game_id, '1,000 Cash',          15,    7, 290,    4.35),
    (v_user_id, v_game_id, '5,000 Cash',          70,   28, 290,   20.30),
    (v_user_id, v_game_id, '10,000 Cash',        120,   45, 290,   34.80),
    (v_user_id, v_game_id, '50,000 Cash',        525,  192, 290,  152.25),
    (v_user_id, v_game_id, '100,000 Cash',       975,  345, 290,  282.75),
    (v_user_id, v_game_id, '500,000 Cash',      4500, 1600, 290, 1305.00),
    (v_user_id, v_game_id, '50 Bucks',            15,    7, 290,    4.35),
    (v_user_id, v_game_id, '250 Bucks',           70,   28, 290,   20.30),
    (v_user_id, v_game_id, '500 Bucks',          120,   45, 290,   34.80),
    (v_user_id, v_game_id, '2,500 Bucks',        525,  192, 290,  152.25),
    (v_user_id, v_game_id, '5,000 Bucks',        975,  345, 290,  282.75),
    (v_user_id, v_game_id, '25,000 Bucks',      4500, 1600, 290, 1305.00);

  -- ─── Brookhaven ──────────────────────────────────────────────────────────────
  SELECT id INTO v_game_id FROM public.games WHERE user_id = v_user_id AND name ILIKE 'brookhaven%' LIMIT 1;
  IF v_game_id IS NULL THEN
    INSERT INTO public.games (user_id, name, category, color) VALUES (v_user_id, 'Brookhaven', 'Roleplay', '#ec4899') RETURNING id INTO v_game_id;
  END IF;
  DELETE FROM public.gamepasses WHERE user_id = v_user_id AND game_id = v_game_id;
  INSERT INTO public.gamepasses (user_id, game_id, name, robux_amount, your_price, robux_rate, your_cost) VALUES
    (v_user_id, v_game_id, 'Premium',                275, 106, 290,  79.75),
    (v_user_id, v_game_id, 'Vehicle Boost Upgrade',  199,  75, 290,  57.71),
    (v_user_id, v_game_id, 'Vehicle Upgrade',         30,  11, 290,   8.70),
    (v_user_id, v_game_id, 'Music Unlocked',         199,  75, 290,  57.71),
    (v_user_id, v_game_id, 'Vehicle Speed Unlocked', 199,  75, 290,  57.71),
    (v_user_id, v_game_id, 'Estates Unlocked',       799, 285, 290, 231.71),
    (v_user_id, v_game_id, 'VIP',                    999, 355, 290, 289.71),
    (v_user_id, v_game_id, 'Land Unlocked',          499, 180, 290, 144.71),
    (v_user_id, v_game_id, 'Penthouse',              150,  58, 290,  43.50),
    (v_user_id, v_game_id, 'Vehicle Customization',  399, 140, 290, 115.71),
    (v_user_id, v_game_id, 'Horse Upgrade',           99,  38, 290,  28.71),
    (v_user_id, v_game_id, 'On Demand Fire',          50,  21, 290,  14.50),
    (v_user_id, v_game_id, 'Vehicle Pack',           799, 285, 290, 231.71),
    (v_user_id, v_game_id, 'Boat Pack',              299, 105, 290,  86.71),
    (v_user_id, v_game_id, 'Disaster Pass',          499, 180, 290, 144.71),
    (v_user_id, v_game_id, 'Theme Pack',             299, 105, 290,  86.71);

  -- ─── Anime Expedition ────────────────────────────────────────────────────────
  SELECT id INTO v_game_id FROM public.games WHERE user_id = v_user_id AND name ILIKE 'anime%expedition%' LIMIT 1;
  IF v_game_id IS NULL THEN
    INSERT INTO public.games (user_id, name, category, color) VALUES (v_user_id, 'Anime Expedition', 'RPG', '#f59e0b') RETURNING id INTO v_game_id;
  END IF;
  DELETE FROM public.gamepasses WHERE user_id = v_user_id AND game_id = v_game_id;
  INSERT INTO public.gamepasses (user_id, game_id, name, robux_amount, your_price, robux_rate, your_cost) VALUES
    (v_user_id, v_game_id, 'Starter Bundle',      249,  135, 290,   72.21),
    (v_user_id, v_game_id, 'VIP',                 399,  135, 290,  115.71),
    (v_user_id, v_game_id, 'Display All Units',   399,  135, 290,  115.71),
    (v_user_id, v_game_id, 'Shiny Hunter',        999,  335, 290,  289.71),
    (v_user_id, v_game_id, 'Premium Bp',          999,  335, 290,  289.71),
    (v_user_id, v_game_id, 'Release Bundle 1',    999,  335, 290,  289.71),
    (v_user_id, v_game_id, 'Release Bundle 2',   3999, 1300, 290, 1159.71),
    (v_user_id, v_game_id, 'Release Bundle 3',   7999, 2600, 290, 2319.71),
    (v_user_id, v_game_id, 'Release Bundle 4',   9999, 3300, 290, 2899.71),
    (v_user_id, v_game_id, 'Villain Bundle 1',    999,  335, 290,  289.71),
    (v_user_id, v_game_id, 'Villain Bundle 2',   3999, 1300, 290, 1159.71),
    (v_user_id, v_game_id, 'Villain Bundle 3',   7999, 2600, 290, 2319.71),
    (v_user_id, v_game_id, '1 Trait Crystal',     114,   40, 290,   33.06),
    (v_user_id, v_game_id, '10 Trait Crystal',    999,  335, 290,  289.71),
    (v_user_id, v_game_id, '25 Trait Crystal',   2399,  805, 290,  695.71),
    (v_user_id, v_game_id, '50 Trait Crystal',   4299, 1440, 290, 1246.71),
    (v_user_id, v_game_id, '2500 Villain Coins',  199,   70, 290,   57.71),
    (v_user_id, v_game_id, '7500 Villain Coins', 4999, 1675, 290, 1449.71),
    (v_user_id, v_game_id, '25000 Villain Coins',1499,  505, 290,  434.71),
    (v_user_id, v_game_id, '75000 Villain Coins',3999, 1300, 290, 1159.71),
    (v_user_id, v_game_id, 'Luck Potion',         149,   70, 290,   43.21),
    (v_user_id, v_game_id, 'Super Luck Potion',   249,   90, 290,   72.21);

  -- ─── Midnight Chasers ────────────────────────────────────────────────────────
  SELECT id INTO v_game_id FROM public.games WHERE user_id = v_user_id AND name ILIKE 'midnight%chasers%' LIMIT 1;
  IF v_game_id IS NULL THEN
    INSERT INTO public.games (user_id, name, category, color) VALUES (v_user_id, 'Midnight Chasers', 'Driving', '#3b82f6') RETURNING id INTO v_game_id;
  END IF;
  DELETE FROM public.gamepasses WHERE user_id = v_user_id AND game_id = v_game_id;
  INSERT INTO public.gamepasses (user_id, game_id, name, robux_amount, your_price, robux_rate, your_cost) VALUES
    (v_user_id, v_game_id, 'Vip',                 200,   75, 290,   58.00),
    (v_user_id, v_game_id, 'Track Vehicles',       175,   65, 290,   50.75),
    (v_user_id, v_game_id, 'Mobile Customization',  75,   35, 290,   21.75),
    (v_user_id, v_game_id, 'Police',               125,   49, 290,   36.25),
    (v_user_id, v_game_id, '30,000',                50,   21, 290,   14.50),
    (v_user_id, v_game_id, '130,000',              200,   75, 290,   58.00),
    (v_user_id, v_game_id, '280,000',              400,  140, 290,  116.00),
    (v_user_id, v_game_id, '580,000',              800,  285, 290,  232.00),
    (v_user_id, v_game_id, '1,200,000',           1700,  605, 290,  493.00),
    (v_user_id, v_game_id, '3,500,000',           4500, 1600, 290, 1305.00);

  -- ─── Hypershot ───────────────────────────────────────────────────────────────
  SELECT id INTO v_game_id FROM public.games WHERE user_id = v_user_id AND name ILIKE 'hypershot%' LIMIT 1;
  IF v_game_id IS NULL THEN
    INSERT INTO public.games (user_id, name, category, color) VALUES (v_user_id, 'Hypershot', 'Shooter', '#ef4444') RETURNING id INTO v_game_id;
  END IF;
  DELETE FROM public.gamepasses WHERE user_id = v_user_id AND game_id = v_game_id;
  INSERT INTO public.gamepasses (user_id, game_id, name, robux_amount, your_price, robux_rate, your_cost) VALUES
    (v_user_id, v_game_id, 'Celestial',       850, 300, 290, 246.50),
    (v_user_id, v_game_id, 'Lovesick',        850, 300, 290, 246.50),
    (v_user_id, v_game_id, 'VIP',             399, 140, 290, 115.71),
    (v_user_id, v_game_id, 'Rainbow Bullets', 199,  75, 290,  57.71),
    (v_user_id, v_game_id, '67 Bundle',        67,  28, 290,  19.43),
    (v_user_id, v_game_id, 'The Big Gun',     1299, 460, 290, 376.71),
    (v_user_id, v_game_id, 'Pizza Party',      399, 140, 290, 115.71),
    (v_user_id, v_game_id, 'Starter Pack',    299, 105, 290,  86.71),
    (v_user_id, v_game_id, 'The Essentials',  799, 285, 290, 231.71),
    (v_user_id, v_game_id, 'Lucky',            99,  38, 290,  28.71);

  -- ─── Run A Restaurant ────────────────────────────────────────────────────────
  SELECT id INTO v_game_id FROM public.games WHERE user_id = v_user_id AND name ILIKE 'run%restaurant%' LIMIT 1;
  IF v_game_id IS NULL THEN
    INSERT INTO public.games (user_id, name, category, color) VALUES (v_user_id, 'Run A Restaurant', 'Simulator', '#f97316') RETURNING id INTO v_game_id;
  END IF;
  DELETE FROM public.gamepasses WHERE user_id = v_user_id AND game_id = v_game_id;
  INSERT INTO public.gamepasses (user_id, game_id, name, robux_amount, your_price, robux_rate, your_cost) VALUES
    (v_user_id, v_game_id, '22.5 Dias',     4999, 1775, 290, 1449.71),
    (v_user_id, v_game_id, 'VIP',            399,  140, 290,  115.71),
    (v_user_id, v_game_id, 'Cash Flow',      249,   95, 290,   72.21),
    (v_user_id, v_game_id, 'Plot Expansion', 999,  355, 290,  289.71),
    (v_user_id, v_game_id, 'Rare Customer',  629,  225, 290,  182.41);

  -- ─── Strongest Battlegrounds ─────────────────────────────────────────────────
  SELECT id INTO v_game_id FROM public.games WHERE user_id = v_user_id AND name ILIKE 'strongest%battlegrounds%' LIMIT 1;
  IF v_game_id IS NULL THEN
    INSERT INTO public.games (user_id, name, category, color) VALUES (v_user_id, 'Strongest Battlegrounds', 'Fighting', '#ef4444') RETURNING id INTO v_game_id;
  END IF;
  DELETE FROM public.gamepasses WHERE user_id = v_user_id AND game_id = v_game_id;
  INSERT INTO public.gamepasses (user_id, game_id, name, robux_amount, your_price, robux_rate, your_cost) VALUES
    (v_user_id, v_game_id, 'Early Access',     299, 105, 290,  86.71),
    (v_user_id, v_game_id, 'Private Server +', 499, 180, 290, 144.71),
    (v_user_id, v_game_id, 'VIP',              299, 105, 290,  86.71),
    (v_user_id, v_game_id, '5 Emotes',         125,  48, 290,  36.25),
    (v_user_id, v_game_id, '10 Emotes',        250,  95, 290,  72.50),
    (v_user_id, v_game_id, 'Awakening Outfit',  99,  38, 290,  28.71),
    (v_user_id, v_game_id, 'Random Emote',      25,   9, 290,   7.25),
    (v_user_id, v_game_id, 'Emote Second Page', 99,  38, 290,  28.71),
    (v_user_id, v_game_id, 'Kill Sound',        199,  75, 290,  57.71),
    (v_user_id, v_game_id, 'Extra Emote Slot',  99,  38, 290,  28.71),
    (v_user_id, v_game_id, '50 Emotes',        1250, 450, 290, 362.50),
    (v_user_id, v_game_id, '1 Spin',            79,  31, 290,  22.91),
    (v_user_id, v_game_id, '3 Cosmetics',       237,  90, 290,  68.73),
    (v_user_id, v_game_id, '5 Cosmetics',       395, 139, 290, 114.55),
    (v_user_id, v_game_id, 'Boundless Rage',    199,  75, 290,  57.71),
    (v_user_id, v_game_id, 'Wombo Combo',       299, 105, 290,  86.71);

END $$;
