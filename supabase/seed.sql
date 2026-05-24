-- ============================================================
-- XOB Seed Data — Gamepass data from provided spreadsheet
-- Run AFTER schema.sql and AFTER creating your first user.
-- Replace 'YOUR_USER_ID_HERE' with your actual auth.users UUID.
-- ============================================================

-- NOTE: Set this to your user ID from Supabase Auth dashboard
DO $$
DECLARE
  v_user_id uuid;
  g_kick uuid; g_vanguards uuid; g_rangers uuid; g_apoc uuid; g_tame uuid;
  g_drag uuid; g_wizard uuid; g_battle uuid; g_evade uuid; g_warriors uuid;
  g_anime uuid; g_blox uuid; g_sbr uuid;
BEGIN
  -- Get first user (change if needed)
  SELECT id INTO v_user_id FROM auth.users LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No user found. Create an account first.';
  END IF;

  -- Insert games
  INSERT INTO public.games (user_id, name, category, color) VALUES
    (v_user_id, 'KICK A LUCKY BLOCK', 'Simulator', '#f59e0b') RETURNING id INTO g_kick;
  INSERT INTO public.games (user_id, name, category, color) VALUES
    (v_user_id, 'Anime Vanguards', 'Tower Defense', '#22c55e') RETURNING id INTO g_vanguards;
  INSERT INTO public.games (user_id, name, category, color) VALUES
    (v_user_id, 're:rangers X', 'Action', '#22c55e') RETURNING id INTO g_rangers;
  INSERT INTO public.games (user_id, name, category, color) VALUES
    (v_user_id, 'Survive the Apocalypse', 'Survival', '#ef4444') RETURNING id INTO g_apoc;
  INSERT INTO public.games (user_id, name, category, color) VALUES
    (v_user_id, 'Catch and Tame', 'Simulator', '#f59e0b') RETURNING id INTO g_tame;
  INSERT INTO public.games (user_id, name, category, color) VALUES
    (v_user_id, 'Drag Simulator', 'Simulator', '#22c55e') RETURNING id INTO g_drag;
  INSERT INTO public.games (user_id, name, category, color) VALUES
    (v_user_id, 'Wizard Alchemy', 'Simulator', '#22c55e') RETURNING id INTO g_wizard;
  INSERT INTO public.games (user_id, name, category, color) VALUES
    (v_user_id, 'Strongest Battlegrounds', 'Fighting', '#22c55e') RETURNING id INTO g_battle;
  INSERT INTO public.games (user_id, name, category, color) VALUES
    (v_user_id, 'EVADE', 'Horror', '#22c55e') RETURNING id INTO g_evade;
  INSERT INTO public.games (user_id, name, category, color) VALUES
    (v_user_id, 'Anime Warriors III', 'Tower Defense', '#22c55e') RETURNING id INTO g_warriors;
  INSERT INTO public.games (user_id, name, category, color) VALUES
    (v_user_id, 'Anime Fighting Simulator Endless', 'Fighting', '#22c55e') RETURNING id INTO g_anime;
  INSERT INTO public.games (user_id, name, category, color) VALUES
    (v_user_id, 'Blox Fruit', 'Adventure', '#f59e0b') RETURNING id INTO g_blox;
  INSERT INTO public.games (user_id, name, category, color) VALUES
    (v_user_id, '[SBR+AOT] Anime Apocalypse', 'Anime', '#22c55e') RETURNING id INTO g_sbr;

  -- ====== GAMEPASSES ======
  -- Robux rate: 240 PHP per 1000 Robux
  -- Cost = (robux / 1000) * 240
  -- Status: Good >= 20 profit, Okay >= 5, Bad < 5

  -- Page 1: Generic gamepasses (no specific game noted - using first game as placeholder)
  INSERT INTO public.gamepasses (user_id, game_id, name, robux_amount, competitor_price, your_price, robux_rate, your_cost, profit, status, suggested_lower_price) VALUES
    (v_user_id, g_kick, '239R$ Pass', 239, 74, 73, 240, 57.36, 15.64, 'Okay', 69),
    (v_user_id, g_kick, '119R$ Pass', 119, 37, 36, 240, 28.56, 7.44, 'Okay', 32),
    (v_user_id, g_kick, '30R$ Pass', 30, 10, 10, 240, 7.2, 2.8, 'Bad', 5),
    (v_user_id, g_kick, '159R$ Pass', 159, 49, 45, 240, 38.16, 6.84, 'Okay', 44),
    (v_user_id, g_kick, '79R$ Pass', 79, 24, 24, 240, 18.96, 5.04, 'Okay', 19),
    (v_user_id, g_kick, '55R$ Pass', 55, 17, 17, 240, 13.2, 3.8, 'Bad', 12),
    (v_user_id, g_kick, '99R$ Pass', 99, 31, 31, 240, 23.76, 7.24, 'Okay', 26),
    (v_user_id, g_kick, '729R$ Pass', 729, 100, 100, 240, 174.96, -74.96, 'Bad', 95);

  -- Anime Vanguards
  INSERT INTO public.gamepasses (user_id, game_id, name, robux_amount, competitor_price, your_price, robux_rate, your_cost, profit, status, suggested_lower_price) VALUES
    (v_user_id, g_vanguards, '1299R$ Premium', 1299, 430, 390, 240, 311.76, 78.24, 'Good', 425),
    (v_user_id, g_vanguards, '299R$ Pass', 299, 100, 95, 240, 71.76, 23.24, 'Good', 95),
    (v_user_id, g_vanguards, '599R$ Pass', 599, 200, 180, 240, 143.76, 36.24, 'Good', 195),
    (v_user_id, g_vanguards, '149R$ Pass', 149, 50, 50, 240, 35.76, 14.24, 'Okay', 45),
    (v_user_id, g_vanguards, '799R$ Pass', 799, 270, 235, 240, 191.76, 43.24, 'Good', 265),
    (v_user_id, g_vanguards, '139R$ Pass A', 139, 45, 40, 240, 33.36, 6.64, 'Okay', 40),
    (v_user_id, g_vanguards, '159R$ Premium', 159, 124, 119, 240, 38.16, 80.84, 'Good', 119),
    (v_user_id, g_vanguards, '99R$ Pass', 99, 35, 30, 240, 23.76, 6.24, 'Okay', 30),
    (v_user_id, g_vanguards, '139R$ Pass B', 139, 45, 40, 240, 33.36, 6.64, 'Okay', 40);

  -- re:rangers X
  INSERT INTO public.gamepasses (user_id, game_id, name, robux_amount, competitor_price, your_price, robux_rate, your_cost, profit, status, suggested_lower_price) VALUES
    (v_user_id, g_rangers, '199R$ Pass', 199, 70, 65, 240, 47.76, 17.24, 'Okay', 65),
    (v_user_id, g_rangers, '49R$ Pass', 49, 20, 20, 240, 11.76, 8.24, 'Okay', 15),
    (v_user_id, g_rangers, '149R$ Pass', 149, 50, 45, 240, 35.76, 9.24, 'Okay', 45),
    (v_user_id, g_rangers, '299R$ Pass', 299, 100, 95, 240, 71.76, 23.24, 'Good', 95),
    (v_user_id, g_rangers, '499R$ Pass', 499, 170, 165, 240, 119.76, 45.24, 'Good', 165),
    (v_user_id, g_rangers, '799R$ Pass', 799, 270, 265, 240, 191.76, 73.24, 'Good', 265),
    (v_user_id, g_rangers, '99R$ Pass A', 99, 40, 35, 240, 23.76, 11.24, 'Okay', 35),
    (v_user_id, g_rangers, '99R$ Pass B', 99, 40, 35, 240, 23.76, 11.24, 'Okay', 35),
    (v_user_id, g_rangers, '599R$ Pass', 599, 180, 180, 240, 143.76, 36.24, 'Good', 175),
    (v_user_id, g_rangers, '799R$ Extra', 799, 190, 265, 240, 191.76, 73.24, 'Good', 185);

  -- Survive the Apocalypse
  INSERT INTO public.gamepasses (user_id, game_id, name, robux_amount, competitor_price, your_price, robux_rate, your_cost, profit, status, suggested_lower_price) VALUES
    (v_user_id, g_apoc, '999R$ Pass', 999, 670, 429, 240, 239.76, 189.24, 'Good', 665),
    (v_user_id, g_apoc, '349R$ Pass', 349, 270, 230, 240, 83.76, 146.24, 'Good', 265),
    (v_user_id, g_apoc, '99R$ Pass', 99, 70, 50, 240, 23.76, 26.24, 'Good', 65),
    (v_user_id, g_apoc, '49R$ Pass', 49, 40, 30, 240, 11.76, 18.24, 'Okay', 35);

  -- Catch and Tame
  INSERT INTO public.gamepasses (user_id, game_id, name, robux_amount, competitor_price, your_price, robux_rate, your_cost, profit, status, suggested_lower_price) VALUES
    (v_user_id, g_tame, '119R$ Pass', 119, 45, 43, 240, 28.56, 14.44, 'Okay', 40),
    (v_user_id, g_tame, '79R$ Pass', 79, 30, 25, 240, 18.96, 6.04, 'Okay', 25),
    (v_user_id, g_tame, '19R$ Pass', 19, 10, 10, 240, 4.56, 5.44, 'Okay', 5),
    (v_user_id, g_tame, '359R$ Pass', 359, 120, 115, 240, 86.16, 28.84, 'Good', 115),
    (v_user_id, g_tame, '39R$ Pass A', 39, 20, 20, 240, 9.36, 10.64, 'Okay', 15),
    (v_user_id, g_tame, '299R$ Pass', 299, 45, 90, 240, 71.76, 18.24, 'Okay', 40),
    (v_user_id, g_tame, '39R$ Pass B', 39, 20, 20, 240, 9.36, 10.64, 'Okay', 15),
    (v_user_id, g_tame, '159R$ Pass A', 159, 60, 55, 240, 38.16, 16.84, 'Okay', 55),
    (v_user_id, g_tame, '79R$ Pass B', 79, 30, 30, 240, 18.96, 11.04, 'Okay', 25),
    (v_user_id, g_tame, '95R$ Pass', 95, 40, 40, 240, 22.8, 17.2, 'Okay', 35),
    (v_user_id, g_tame, '175R$ Pass', 175, 65, 60, 240, 42, 18, 'Okay', 60),
    (v_user_id, g_tame, '59R$ Pass A', 59, 25, 25, 240, 14.16, 10.84, 'Okay', 20),
    (v_user_id, g_tame, '159R$ Pass B', 159, 60, 55, 240, 38.16, 16.84, 'Okay', 55),
    (v_user_id, g_tame, '59R$ Pass B', 59, 25, 25, 240, 14.16, 10.84, 'Okay', 20),
    (v_user_id, g_tame, '159R$ Pass C', 159, 50, 50, 240, 38.16, 11.84, 'Okay', 45),
    (v_user_id, g_tame, '399R$ Pass', 399, 140, 120, 240, 95.76, 24.24, 'Good', 135),
    (v_user_id, g_tame, '39R$ Pass C', 39, 15, 15, 240, 9.36, 5.64, 'Okay', 10),
    (v_user_id, g_tame, '239R$ Special', 239, 55, 125, 240, 57.36, 67.64, 'Good', 50);

  -- Drag Simulator
  INSERT INTO public.gamepasses (user_id, game_id, name, robux_amount, competitor_price, your_price, robux_rate, your_cost, profit, status, suggested_lower_price) VALUES
    (v_user_id, g_drag, '149R$ Pass', 149, 55, 50, 240, 35.76, 14.24, 'Okay', 50),
    (v_user_id, g_drag, '119R$ Pass', 119, 45, 40, 240, 28.56, 11.44, 'Okay', 40),
    (v_user_id, g_drag, '109R$ Pass', 109, 40, 35, 240, 26.16, 8.84, 'Okay', 35),
    (v_user_id, g_drag, '89R$ Pass', 89, 35, 30, 240, 21.36, 8.64, 'Okay', 30),
    (v_user_id, g_drag, '499R$ Pass', 499, 170, 165, 240, 119.76, 45.24, 'Good', 165),
    (v_user_id, g_drag, '79R$ Pass A', 79, 30, 25, 240, 18.96, 6.04, 'Okay', 25),
    (v_user_id, g_drag, '79R$ Pass B', 79, 30, 25, 240, 18.96, 6.04, 'Okay', 25),
    (v_user_id, g_drag, '59R$ Pass A', 59, 25, 20, 240, 14.16, 5.84, 'Okay', 20),
    (v_user_id, g_drag, '59R$ Pass B', 59, 25, 20, 240, 14.16, 5.84, 'Okay', 20),
    (v_user_id, g_drag, '29R$ Pass A', 29, 15, 15, 240, 6.96, 8.04, 'Okay', 10),
    (v_user_id, g_drag, '29R$ Pass B', 29, 15, 15, 240, 6.96, 8.04, 'Okay', 10),
    (v_user_id, g_drag, '399R$ Pass', 399, 140, 135, 240, 95.76, 39.24, 'Good', 135),
    (v_user_id, g_drag, '99R$ Pass', 99, 40, 35, 240, 23.76, 11.24, 'Okay', 35),
    (v_user_id, g_drag, '59R$ Pass C', 59, 25, 20, 240, 14.16, 5.84, 'Okay', 20),
    (v_user_id, g_drag, '35R$ Pass', 35, 20, 10, 240, 8.4, 1.6, 'Bad', 15),
    (v_user_id, g_drag, '18R$ Pass', 18, 20, 6, 240, 4.32, 1.68, 'Bad', 15);

  -- Wizard Alchemy
  INSERT INTO public.gamepasses (user_id, game_id, name, robux_amount, competitor_price, your_price, robux_rate, your_cost, profit, status, suggested_lower_price) VALUES
    (v_user_id, g_wizard, '129R$ Pass', 129, 0, 45, 240, 30.96, 14.04, 'Okay', 0),
    (v_user_id, g_wizard, '299R$ Pass', 299, 0, 95, 240, 71.76, 23.24, 'Good', 0),
    (v_user_id, g_wizard, '449R$ Pass', 449, 0, 130, 240, 107.76, 22.24, 'Good', 0),
    (v_user_id, g_wizard, '249R$ Pass A', 249, 0, 85, 240, 59.76, 25.24, 'Good', 0),
    (v_user_id, g_wizard, '349R$ Pass', 349, 0, 105, 240, 83.76, 21.24, 'Good', 0),
    (v_user_id, g_wizard, '799R$ Pass', 799, 0, 265, 240, 191.76, 73.24, 'Good', 0),
    (v_user_id, g_wizard, '49R$ Pass', 49, 0, 20, 240, 11.76, 8.24, 'Okay', 0),
    (v_user_id, g_wizard, '175R$ Pass', 175, 0, 65, 240, 42, 23, 'Good', 0),
    (v_user_id, g_wizard, '399R$ Pass', 399, 0, 120, 240, 95.76, 24.24, 'Good', 0),
    (v_user_id, g_wizard, '699R$ Pass', 699, 0, 220, 240, 167.76, 52.24, 'Good', 0),
    (v_user_id, g_wizard, '1199R$ Pass', 1199, 0, 340, 240, 287.76, 52.24, 'Good', 0),
    (v_user_id, g_wizard, '59R$ Pass', 59, 0, 20, 240, 14.16, 5.84, 'Okay', 0),
    (v_user_id, g_wizard, '249R$ Pass B', 249, 0, 85, 240, 59.76, 25.24, 'Good', 0),
    (v_user_id, g_wizard, '459R$ Pass', 459, 0, 140, 240, 110.16, 29.84, 'Good', 0);

  -- Strongest Battlegrounds
  INSERT INTO public.gamepasses (user_id, game_id, name, robux_amount, competitor_price, your_price, robux_rate, your_cost, profit, status, suggested_lower_price) VALUES
    (v_user_id, g_battle, '299R$ Pass A', 299, 0, 90, 240, 71.76, 18.24, 'Okay', 0),
    (v_user_id, g_battle, '499R$ Pass', 499, 0, 165, 240, 119.76, 45.24, 'Good', 0),
    (v_user_id, g_battle, '299R$ Pass B', 299, 0, 90, 240, 71.76, 18.24, 'Okay', 0),
    (v_user_id, g_battle, '25R$ Pass', 25, 0, 20, 240, 6, 14, 'Okay', 0),
    (v_user_id, g_battle, '99R$ Pass A', 99, 0, 35, 240, 23.76, 11.24, 'Okay', 0),
    (v_user_id, g_battle, '199R$ Pass', 199, 0, 65, 240, 47.76, 17.24, 'Okay', 0),
    (v_user_id, g_battle, '125R$ Pass', 125, 0, 50, 240, 30, 20, 'Good', 0),
    (v_user_id, g_battle, '250R$ Pass', 250, 0, 85, 240, 60, 25, 'Good', 0),
    (v_user_id, g_battle, '99R$ Pass B', 99, 0, 35, 240, 23.76, 11.24, 'Okay', 0),
    (v_user_id, g_battle, '99R$ Pass C', 99, 0, 35, 240, 23.76, 11.24, 'Okay', 0),
    (v_user_id, g_battle, '1250R$ Pass', 1250, 0, 365, 240, 300, 65, 'Good', 0),
    (v_user_id, g_battle, '79R$ Special', 79, 0, 270, 240, 18.96, 251.04, 'Good', 0),
    (v_user_id, g_battle, '237R$ Pass', 237, 0, 80, 240, 56.88, 23.12, 'Good', 0),
    (v_user_id, g_battle, '395R$ Pass', 395, 0, 118, 240, 94.8, 23.2, 'Good', 0),
    (v_user_id, g_battle, '399R$ Pass', 399, 0, 120, 240, 95.76, 24.24, 'Good', 0),
    (v_user_id, g_battle, '799R$ Pass', 799, 0, 235, 240, 191.76, 43.24, 'Good', 0);

  -- EVADE
  INSERT INTO public.gamepasses (user_id, game_id, name, robux_amount, competitor_price, your_price, robux_rate, your_cost, profit, status, suggested_lower_price) VALUES
    (v_user_id, g_evade, '350R$ Pass A', 350, 0, 115, 240, 84, 31, 'Good', 0),
    (v_user_id, g_evade, '500R$ Pass A', 500, 0, 165, 240, 120, 45, 'Good', 0),
    (v_user_id, g_evade, '600R$ Pass A', 600, 0, 180, 240, 144, 36, 'Good', 0),
    (v_user_id, g_evade, '300R$ Pass A', 300, 0, 95, 240, 72, 23, 'Good', 0),
    (v_user_id, g_evade, '500R$ Pass B', 500, 0, 165, 240, 120, 45, 'Good', 0),
    (v_user_id, g_evade, '350R$ Pass B', 350, 0, 115, 240, 84, 31, 'Good', 0),
    (v_user_id, g_evade, '300R$ Pass B', 300, 0, 90, 240, 72, 18, 'Okay', 0),
    (v_user_id, g_evade, '700R$ Pass', 700, 0, 220, 240, 168, 52, 'Good', 0),
    (v_user_id, g_evade, '400R$ Pass', 400, 0, 120, 240, 96, 24, 'Good', 0),
    (v_user_id, g_evade, '600R$ Pass B', 600, 0, 180, 240, 144, 36, 'Good', 0),
    (v_user_id, g_evade, '600R$ Pass C', 600, 0, 180, 240, 144, 36, 'Good', 0),
    (v_user_id, g_evade, '90R$ Pass', 90, 0, 40, 240, 21.6, 18.4, 'Okay', 0),
    (v_user_id, g_evade, '350R$ Special', 350, 0, 230, 240, 84, 146, 'Good', 0),
    (v_user_id, g_evade, '600R$ Pass D', 600, 0, 180, 240, 144, 36, 'Good', 0),
    (v_user_id, g_evade, '300R$ Pass C', 300, 0, 95, 240, 72, 23, 'Good', 0),
    (v_user_id, g_evade, '1100R$ Pass', 1100, 0, 335, 240, 264, 71, 'Good', 0);

  -- Anime Warriors III
  INSERT INTO public.gamepasses (user_id, game_id, name, robux_amount, competitor_price, your_price, robux_rate, your_cost, profit, status, suggested_lower_price) VALUES
    (v_user_id, g_warriors, '129R$ Pass A', 129, 0, 45, 240, 30.96, 14.04, 'Okay', 0),
    (v_user_id, g_warriors, '129R$ Pass B', 129, 0, 45, 240, 30.96, 14.04, 'Okay', 0),
    (v_user_id, g_warriors, '129R$ Pass C', 129, 0, 45, 240, 30.96, 14.04, 'Okay', 0),
    (v_user_id, g_warriors, '249R$ Pass A', 249, 0, 85, 240, 59.76, 25.24, 'Good', 0),
    (v_user_id, g_warriors, '199R$ Pass A', 199, 0, 65, 240, 47.76, 17.24, 'Okay', 0),
    (v_user_id, g_warriors, '199R$ Pass B', 199, 0, 65, 240, 47.76, 17.24, 'Okay', 0),
    (v_user_id, g_warriors, '249R$ Pass B', 249, 0, 85, 240, 59.76, 25.24, 'Good', 0),
    (v_user_id, g_warriors, '249R$ Pass C', 249, 0, 85, 240, 59.76, 25.24, 'Good', 0),
    (v_user_id, g_warriors, '299R$ Pass', 299, 0, 90, 240, 71.76, 18.24, 'Okay', 0),
    (v_user_id, g_warriors, '249R$ Pass D', 249, 0, 85, 240, 59.76, 25.24, 'Good', 0),
    (v_user_id, g_warriors, '249R$ Pass E', 249, 0, 85, 240, 59.76, 25.24, 'Good', 0),
    (v_user_id, g_warriors, '199R$ Pass C', 199, 0, 65, 240, 47.76, 17.24, 'Okay', 0),
    (v_user_id, g_warriors, '149R$ Pass', 149, 0, 50, 240, 35.76, 14.24, 'Okay', 0),
    (v_user_id, g_warriors, '199R$ Pass D', 199, 0, 65, 240, 47.76, 17.24, 'Okay', 0),
    (v_user_id, g_warriors, '99R$ Pass', 99, 0, 35, 240, 23.76, 11.24, 'Okay', 0),
    (v_user_id, g_warriors, '899R$ Pass', 899, 0, 295, 240, 215.76, 79.24, 'Good', 0);

  -- Anime Fighting Simulator Endless
  INSERT INTO public.gamepasses (user_id, game_id, name, robux_amount, competitor_price, your_price, robux_rate, your_cost, profit, status, suggested_lower_price) VALUES
    (v_user_id, g_anime, '199R$ Pass A', 199, 0, 65, 240, 47.76, 17.24, 'Okay', 0),
    (v_user_id, g_anime, '199R$ Pass B', 199, 0, 65, 240, 47.76, 17.24, 'Okay', 0),
    (v_user_id, g_anime, '199R$ Pass C', 199, 0, 65, 240, 47.76, 17.24, 'Okay', 0),
    (v_user_id, g_anime, '99R$ Pass A', 99, 0, 35, 240, 23.76, 11.24, 'Okay', 0),
    (v_user_id, g_anime, '99R$ Pass B', 99, 0, 35, 240, 23.76, 11.24, 'Okay', 0),
    (v_user_id, g_anime, '249R$ Pass A', 249, 0, 85, 240, 59.76, 25.24, 'Good', 0),
    (v_user_id, g_anime, '199R$ Pass D', 199, 0, 65, 240, 47.76, 17.24, 'Okay', 0),
    (v_user_id, g_anime, '299R$ Pass', 299, 0, 90, 240, 71.76, 18.24, 'Okay', 0),
    (v_user_id, g_anime, '249R$ Pass B', 249, 0, 85, 240, 59.76, 25.24, 'Good', 0),
    (v_user_id, g_anime, '749R$ Pass', 749, 0, 220, 240, 179.76, 40.24, 'Good', 0),
    (v_user_id, g_anime, '149R$ Pass', 149, 0, 50, 240, 35.76, 14.24, 'Okay', 0),
    (v_user_id, g_anime, '249R$ Pass C', 249, 0, 85, 240, 59.76, 25.24, 'Good', 0),
    (v_user_id, g_anime, '199R$ Pass E', 199, 0, 65, 240, 47.76, 17.24, 'Okay', 0),
    (v_user_id, g_anime, '249R$ Pass D', 249, 0, 85, 240, 59.76, 25.24, 'Good', 0),
    (v_user_id, g_anime, '99R$ Pass C', 99, 0, 35, 240, 23.76, 11.24, 'Okay', 0),
    (v_user_id, g_anime, '1299R$ Pass', 1299, 0, 390, 240, 311.76, 78.24, 'Good', 0),
    (v_user_id, g_anime, '199R$ Pass F', 199, 0, 65, 240, 47.76, 17.24, 'Okay', 0),
    (v_user_id, g_anime, '49R$ Pass', 49, 0, 20, 240, 11.76, 8.24, 'Okay', 0);

  RAISE NOTICE 'Seed data inserted successfully for user %', v_user_id;
END $$;
