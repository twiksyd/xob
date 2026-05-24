-- ============================================================
-- XOB Seed Data — Gamepass data from provided spreadsheet
-- Run AFTER schema.sql and AFTER creating your first user.
-- ============================================================

DO $$
DECLARE
  v_user_id uuid;
  g_kick uuid; g_vanguards uuid; g_rangers uuid; g_apoc uuid; g_tame uuid;
  g_drag uuid; g_wizard uuid; g_battle uuid; g_evade uuid; g_warriors uuid;
  g_anime uuid; g_blox uuid; g_sbr uuid;
BEGIN
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
    (v_user_id, 're:rangers X', 'Action', '#3b82f6') RETURNING id INTO g_rangers;
  INSERT INTO public.games (user_id, name, category, color) VALUES
    (v_user_id, 'Survive the Apocalypse', 'Survival', '#ef4444') RETURNING id INTO g_apoc;
  INSERT INTO public.games (user_id, name, category, color) VALUES
    (v_user_id, 'Catch and Tame', 'Simulator', '#f59e0b') RETURNING id INTO g_tame;
  INSERT INTO public.games (user_id, name, category, color) VALUES
    (v_user_id, 'Drag Simulator', 'Simulator', '#22c55e') RETURNING id INTO g_drag;
  INSERT INTO public.games (user_id, name, category, color) VALUES
    (v_user_id, 'Wizard Alchemy', 'Simulator', '#a855f7') RETURNING id INTO g_wizard;
  INSERT INTO public.games (user_id, name, category, color) VALUES
    (v_user_id, 'Strongest Battlegrounds', 'Fighting', '#ef4444') RETURNING id INTO g_battle;
  INSERT INTO public.games (user_id, name, category, color) VALUES
    (v_user_id, 'EVADE', 'Horror', '#6366f1') RETURNING id INTO g_evade;
  INSERT INTO public.games (user_id, name, category, color) VALUES
    (v_user_id, 'Anime Warriors III', 'Tower Defense', '#f59e0b') RETURNING id INTO g_warriors;
  INSERT INTO public.games (user_id, name, category, color) VALUES
    (v_user_id, 'Anime Fighting Simulator Endless', 'Fighting', '#22c55e') RETURNING id INTO g_anime;
  INSERT INTO public.games (user_id, name, category, color) VALUES
    (v_user_id, 'Blox Fruit', 'Adventure', '#f59e0b') RETURNING id INTO g_blox;
  INSERT INTO public.games (user_id, name, category, color) VALUES
    (v_user_id, '[SBR+AOT] Anime Apocalypse', 'Anime', '#ec4899') RETURNING id INTO g_sbr;

  -- ====== KICK A LUCKY BLOCK ======
  INSERT INTO public.gamepasses (user_id, game_id, name, robux_amount, competitor_price, your_price, robux_rate, your_cost, profit, status, suggested_lower_price) VALUES
    (v_user_id, g_kick, 'Pass 239R$',        239, 74,  73,  240, 57.36,  15.64, 'Okay', 69),
    (v_user_id, g_kick, 'Pass 119R$',        119, 37,  36,  240, 28.56,   7.44, 'Okay', 32),
    (v_user_id, g_kick, 'Pass 30R$',          30, 10,  10,  240,  7.20,   2.80, 'Bad',   5),
    (v_user_id, g_kick, 'Pass 159R$',        159, 49,  45,  240, 38.16,   6.84, 'Okay', 44),
    (v_user_id, g_kick, 'Pass 79R$',          79, 24,  24,  240, 18.96,   5.04, 'Okay', 19),
    (v_user_id, g_kick, 'Pass 55R$',          55, 17,  17,  240, 13.20,   3.80, 'Bad',  12),
    (v_user_id, g_kick, 'Pass 99R$',          99, 31,  31,  240, 23.76,   7.24, 'Okay', 26),
    (v_user_id, g_kick, 'VIP',               729, 100, 100, 240, 174.96, -74.96, 'Bad', 95),
    (v_user_id, g_kick, 'x2 Kick Power',     139, 45,  40,  240, 33.36,   6.64, 'Okay', 40),
    (v_user_id, g_kick, 'x2 Cash',           159, 124, 119, 240, 38.16,  80.84, 'Good', 119),
    (v_user_id, g_kick, 'x2 Brainrot Luck',   99, 35,  30,  240, 23.76,   6.24, 'Okay', 30),
    (v_user_id, g_kick, 'x2 Mutation Luck',  139, 45,  40,  240, 33.36,   6.64, 'Okay', 40);

  -- ====== ANIME VANGUARDS ======
  INSERT INTO public.gamepasses (user_id, game_id, name, robux_amount, competitor_price, your_price, robux_rate, your_cost, profit, status, suggested_lower_price) VALUES
    (v_user_id, g_vanguards, 'Shiny Hunter',       1299, 430, 390, 240, 311.76,  78.24, 'Good', 425),
    (v_user_id, g_vanguards, 'VIP',                 299, 100,  95, 240,  71.76,  23.24, 'Good',  95),
    (v_user_id, g_vanguards, 'Display All Units',   599, 200, 180, 240, 143.76,  36.24, 'Good', 195),
    (v_user_id, g_vanguards, 'Extra Unit Storage',  149,  50,  50, 240,  35.76,  14.24, 'Okay',  45),
    (v_user_id, g_vanguards, 'Premium Pass',        799, 270, 235, 240, 191.76,  43.24, 'Good', 265);

  -- ====== RE:RANGERS X ======
  INSERT INTO public.gamepasses (user_id, game_id, name, robux_amount, competitor_price, your_price, robux_rate, your_cost, profit, status, suggested_lower_price) VALUES
    (v_user_id, g_rangers, 'VIP',               199,  70,  65, 240,  47.76, 17.24, 'Okay',  65),
    (v_user_id, g_rangers, 'Fast Star',          49,  20,  20, 240,  11.76,  8.24, 'Okay',  15),
    (v_user_id, g_rangers, 'Extra Unit Storage', 149,  50,  45, 240,  35.76,  9.24, 'Okay',  45),
    (v_user_id, g_rangers, 'Auto Trait Reroll',  299, 100,  95, 240,  71.76, 23.24, 'Good',  95),
    (v_user_id, g_rangers, 'Shiny Hunter',       499, 170, 165, 240, 119.76, 45.24, 'Good', 165),
    (v_user_id, g_rangers, '3x Game Speed',      799, 270, 265, 240, 191.76, 73.24, 'Good', 265),
    (v_user_id, g_rangers, 'Happy Anniv Bundle',  99,  40,  35, 240,  23.76, 11.24, 'Okay',  35),
    (v_user_id, g_rangers, 'Universal Bundle',    99,  40,  35, 240,  23.76, 11.24, 'Okay',  35),
    (v_user_id, g_rangers, 'Premium Pass',       599, 180, 180, 240, 143.76, 36.24, 'Good', 175),
    (v_user_id, g_rangers, '10 Battlepass',      799, 190, 265, 240, 191.76, 73.24, 'Good', 185);

  -- ====== SURVIVE THE APOCALYPSE ======
  INSERT INTO public.gamepasses (user_id, game_id, name, robux_amount, competitor_price, your_price, robux_rate, your_cost, profit, status, suggested_lower_price) VALUES
    (v_user_id, g_apoc, 'Gamepass 999R$', 999, 670, 429, 240, 239.76, 189.24, 'Good', 665),
    (v_user_id, g_apoc, 'Gamepass 349R$', 349, 270, 230, 240,  83.76, 146.24, 'Good', 265),
    (v_user_id, g_apoc, 'Gamepass 99R$',   99,  70,  50, 240,  23.76,  26.24, 'Good',  65),
    (v_user_id, g_apoc, 'Gamepass 49R$',   49,  40,  30, 240,  11.76,  18.24, 'Okay',  35);

  -- ====== CATCH AND TAME ======
  INSERT INTO public.gamepasses (user_id, game_id, name, robux_amount, competitor_price, your_price, robux_rate, your_cost, profit, status, suggested_lower_price) VALUES
    (v_user_id, g_tame, 'Breed Luck',                    119, 45,  43, 240, 28.56, 14.44, 'Okay', 40),
    (v_user_id, g_tame, '2x Food',                        79, 30,  25, 240, 18.96,  6.04, 'Okay', 25),
    (v_user_id, g_tame, 'Extra Speed',                    19, 10,  10, 240,  4.56,  5.44, 'Okay',  5),
    (v_user_id, g_tame, 'Ultra Luck',                    359, 120, 115, 240, 86.16, 28.84, 'Good', 115),
    (v_user_id, g_tame, 'Auto Click',                     39, 20,  20, 240,  9.36, 10.64, 'Okay', 15),
    (v_user_id, g_tame, 'Lucky Block Luck',              299, 45,  90, 240, 71.76, 18.24, 'Okay', 40),
    (v_user_id, g_tame, 'Weather Totems (Small)',         39, 20,  20, 240,  9.36, 10.64, 'Okay', 15),
    (v_user_id, g_tame, 'Weather Totems (Large)',        159, 60,  55, 240, 38.16, 16.84, 'Okay', 55),
    (v_user_id, g_tame, 'VIP',                            79, 30,  30, 240, 18.96, 11.04, 'Okay', 25),
    (v_user_id, g_tame, 'Flying Pet Potion (Small)',      95, 40,  40, 240, 22.80, 17.20, 'Okay', 35),
    (v_user_id, g_tame, 'Flying Pet Potion (Large)',     175, 65,  60, 240, 42.00, 18.00, 'Okay', 60),
    (v_user_id, g_tame, 'Riding Pet Potion (Small)',      59, 25,  25, 240, 14.16, 10.84, 'Okay', 20),
    (v_user_id, g_tame, 'Riding Pet Potion (Large)',     159, 60,  55, 240, 38.16, 16.84, 'Okay', 55),
    (v_user_id, g_tame, 'Cave Decoration (Tiny)',         59, 25,  25, 240, 14.16, 10.84, 'Okay', 20),
    (v_user_id, g_tame, 'Cave Decoration (Small)',       159, 50,  50, 240, 38.16, 11.84, 'Okay', 45),
    (v_user_id, g_tame, 'Cave Decoration (Large)',       399, 140, 120, 240, 95.76, 24.24, 'Good', 135),
    (v_user_id, g_tame, 'Admin Abuse Totems (Small)',     39, 15,  15, 240,  9.36,  5.64, 'Okay', 10),
    (v_user_id, g_tame, 'Admin Abuse Totems (Medium)',   159, 38,  50, 240, 38.16, 11.84, 'Okay', 33),
    (v_user_id, g_tame, 'Admin Abuse Totems (Large)',    239, 55, 125, 240, 57.36, 67.64, 'Good', 50);

  -- ====== DRAG SIMULATOR ======
  INSERT INTO public.gamepasses (user_id, game_id, name, robux_amount, competitor_price, your_price, robux_rate, your_cost, profit, status, suggested_lower_price) VALUES
    (v_user_id, g_drag, 'Police Pass',       149, 55,  50, 240,  35.76, 14.24, 'Okay',  50),
    (v_user_id, g_drag, 'Luxury Pass',       119, 45,  40, 240,  28.56, 11.44, 'Okay',  40),
    (v_user_id, g_drag, 'Dragspec Pass',     109, 40,  35, 240,  26.16,  8.84, 'Okay',  35),
    (v_user_id, g_drag, 'Slot Limit Unlocker', 89, 35, 30, 240,  21.36,  8.64, 'Okay',  30),
    (v_user_id, g_drag, '2X Paycheck',       499, 170, 165, 240, 119.76, 45.24, 'Good', 165),
    (v_user_id, g_drag, 'Custom Plate Pass',  79, 30,  25, 240,  18.96,  6.04, 'Okay',  25),
    (v_user_id, g_drag, 'Exclusive Rims',     79, 30,  25, 240,  18.96,  6.04, 'Okay',  25),
    (v_user_id, g_drag, 'Advance Paint Pass', 59, 25,  20, 240,  14.16,  5.84, 'Okay',  20),
    (v_user_id, g_drag, 'Premium Accessories',59, 25,  20, 240,  14.16,  5.84, 'Okay',  20),
    (v_user_id, g_drag, 'Boombox Radio',      29, 15,  15, 240,   6.96,  8.04, 'Okay',  10),
    (v_user_id, g_drag, 'Suspension Pro',     29, 15,  15, 240,   6.96,  8.04, 'Okay',  10),
    (v_user_id, g_drag, 'Rp 500,000,000',   399, 140, 135, 240,  95.76, 39.24, 'Good', 135),
    (v_user_id, g_drag, 'Rp 100,000,000',    99, 40,  35, 240,  23.76, 11.24, 'Okay',  35),
    (v_user_id, g_drag, 'Rp 50,000,000',     59, 25,  20, 240,  14.16,  5.84, 'Okay',  20),
    (v_user_id, g_drag, 'Rp 10,000,000',     35, 20,  10, 240,   8.40,  1.60, 'Bad',   15),
    (v_user_id, g_drag, 'Rp 5,000,000',      18, 20,   6, 240,   4.32,  1.68, 'Bad',   15),
    (v_user_id, g_drag, 'Rp 1,000,000',       9,  0,   4, 240,   2.16,  1.84, 'Bad',    0);

  -- ====== WIZARD ALCHEMY ======
  INSERT INTO public.gamepasses (user_id, game_id, name, robux_amount, competitor_price, your_price, robux_rate, your_cost, profit, status, suggested_lower_price) VALUES
    (v_user_id, g_wizard, 'Exclusive Pack',    129, 0,  45, 240,  30.96, 14.04, 'Okay', 0),
    (v_user_id, g_wizard, 'Skip Mixing',       299, 0,  95, 240,  71.76, 23.24, 'Good', 0),
    (v_user_id, g_wizard, 'Better Alchemy',    449, 0, 130, 240, 107.76, 22.24, 'Good', 0),
    (v_user_id, g_wizard, 'Double Storage',    249, 0,  85, 240,  59.76, 25.24, 'Good', 0),
    (v_user_id, g_wizard, 'Sell Anywhere',     349, 0, 105, 240,  83.76, 21.24, 'Good', 0),
    (v_user_id, g_wizard, 'Lunar Set',         129, 0,  45, 240,  30.96, 14.04, 'Okay', 0),
    (v_user_id, g_wizard, 'Starlight Set',     799, 0, 265, 240, 191.76, 73.24, 'Good', 0),
    (v_user_id, g_wizard, 'Tiny Cash Pack',     49, 0,  20, 240,  11.76,  8.24, 'Okay', 0),
    (v_user_id, g_wizard, 'Small Cash Pack',   175, 0,  65, 240,  42.00, 23.00, 'Good', 0),
    (v_user_id, g_wizard, 'Medium Cash Pack',  399, 0, 120, 240,  95.76, 24.24, 'Good', 0),
    (v_user_id, g_wizard, 'Advanced Cash Pack',699, 0, 220, 240, 167.76, 52.24, 'Good', 0),
    (v_user_id, g_wizard, 'Huge Cash Pack',   1199, 0, 340, 240, 287.76, 52.24, 'Good', 0),
    (v_user_id, g_wizard, '1 Reroll',           59, 0,  20, 240,  14.16,  5.84, 'Okay', 0),
    (v_user_id, g_wizard, '5 Reroll',          249, 0,  85, 240,  59.76, 25.24, 'Good', 0),
    (v_user_id, g_wizard, '10 Reroll',         459, 0, 140, 240, 110.16, 29.84, 'Good', 0);

  -- ====== STRONGEST BATTLEGROUNDS ======
  INSERT INTO public.gamepasses (user_id, game_id, name, robux_amount, competitor_price, your_price, robux_rate, your_cost, profit, status, suggested_lower_price) VALUES
    (v_user_id, g_battle, 'Advanced Luck I',    299, 0,  90, 240,  71.76, 18.24, 'Okay', 0),
    (v_user_id, g_battle, 'Extra Luck I',       499, 0, 165, 240, 119.76, 45.24, 'Good', 0),
    (v_user_id, g_battle, 'Advanced Luck II',   299, 0,  90, 240,  71.76, 18.24, 'Okay', 0),
    (v_user_id, g_battle, 'Extra Luck II',       25, 0,  20, 240,   6.00, 14.00, 'Okay', 0),
    (v_user_id, g_battle, 'Advanced Luck III',   99, 0,  35, 240,  23.76, 11.24, 'Okay', 0),
    (v_user_id, g_battle, 'Extra Luck III',     199, 0,  65, 240,  47.76, 17.24, 'Okay', 0),
    (v_user_id, g_battle, 'Advanced Luck IV',   125, 0,  50, 240,  30.00, 20.00, 'Good', 0),
    (v_user_id, g_battle, 'Extra Luck IV',      250, 0,  85, 240,  60.00, 25.00, 'Good', 0),
    (v_user_id, g_battle, 'Advanced Luck V',     99, 0,  35, 240,  23.76, 11.24, 'Okay', 0),
    (v_user_id, g_battle, 'Extra Luck V',        99, 0,  35, 240,  23.76, 11.24, 'Okay', 0),
    (v_user_id, g_battle, 'Advanced Luck VI',  1250, 0, 365, 240, 300.00, 65.00, 'Good', 0),
    (v_user_id, g_battle, 'Extra Luck VI',       79, 0, 270, 240,  18.96, 251.04,'Good', 0),
    (v_user_id, g_battle, 'Advanced Luck VII',  237, 0,  80, 240,  56.88, 23.12, 'Good', 0),
    (v_user_id, g_battle, 'Extra Luck VII',     395, 0, 118, 240,  94.80, 23.20, 'Good', 0),
    (v_user_id, g_battle, 'Small Luck',         399, 0, 120, 240,  95.76, 24.24, 'Good', 0),
    (v_user_id, g_battle, 'Double XP',          799, 0, 235, 240, 191.76, 43.24, 'Good', 0);

  -- ====== EVADE ======
  INSERT INTO public.gamepasses (user_id, game_id, name, robux_amount, competitor_price, your_price, robux_rate, your_cost, profit, status, suggested_lower_price) VALUES
    (v_user_id, g_evade, 'Music Carry Pack 1',      350, 0, 115, 240,  84.00,  31.00, 'Good', 0),
    (v_user_id, g_evade, 'Music Emotes Pack 1',     500, 0, 165, 240, 120.00,  45.00, 'Good', 0),
    (v_user_id, g_evade, 'Bee Set',                 600, 0, 180, 240, 144.00,  36.00, 'Good', 0),
    (v_user_id, g_evade, 'Boombox',                 300, 0,  95, 240,  72.00,  23.00, 'Good', 0),
    (v_user_id, g_evade, 'Retro Cosmetics Set',     500, 0, 165, 240, 120.00,  45.00, 'Good', 0),
    (v_user_id, g_evade, 'Worlds Collide',          350, 0, 115, 240,  84.00,  31.00, 'Good', 0),
    (v_user_id, g_evade, '6 Emote Slots',           300, 0,  90, 240,  72.00,  18.00, 'Okay', 0),
    (v_user_id, g_evade, 'Military Set',            700, 0, 220, 240, 168.00,  52.00, 'Good', 0),
    (v_user_id, g_evade, 'Future Pack',             400, 0, 120, 240,  96.00,  24.00, 'Good', 0),
    (v_user_id, g_evade, 'Crystalline Set',         600, 0, 180, 240, 144.00,  36.00, 'Good', 0),
    (v_user_id, g_evade, 'Animal Set',              600, 0, 180, 240, 144.00,  36.00, 'Good', 0),
    (v_user_id, g_evade, '30 Points',                90, 0,  40, 240,  21.60,  18.40, 'Okay', 0),
    (v_user_id, g_evade, 'Emote Pack',              350, 0, 230, 240,  84.00, 146.00, 'Good', 0),
    (v_user_id, g_evade, 'Classic Set',             600, 0, 180, 240, 144.00,  36.00, 'Good', 0),
    (v_user_id, g_evade, '100 Points',              300, 0,  95, 240,  72.00,  23.00, 'Good', 0),
    (v_user_id, g_evade, '400 Points (Best Value!)',1100, 0, 335, 240, 264.00,  71.00, 'Good', 0);

  -- ====== ANIME WARRIORS III ======
  INSERT INTO public.gamepasses (user_id, game_id, name, robux_amount, competitor_price, your_price, robux_rate, your_cost, profit, status, suggested_lower_price) VALUES
    (v_user_id, g_warriors, 'Elderwood Bundle I',    129, 0,  45, 240,  30.96, 14.04, 'Okay', 0),
    (v_user_id, g_warriors, 'Elderwood Bundle II',   129, 0,  45, 240,  30.96, 14.04, 'Okay', 0),
    (v_user_id, g_warriors, 'Elderwood Bundle III',  129, 0,  45, 240,  30.96, 14.04, 'Okay', 0),
    (v_user_id, g_warriors, 'Spin Wheel 5 Spins I',  249, 0,  85, 240,  59.76, 25.24, 'Good', 0),
    (v_user_id, g_warriors, 'Spin Wheel 10 Spins I', 199, 0,  65, 240,  47.76, 17.24, 'Okay', 0),
    (v_user_id, g_warriors, 'Elderwood Bundle IV',   199, 0,  65, 240,  47.76, 17.24, 'Okay', 0),
    (v_user_id, g_warriors, 'Elderwood Bundle V',    249, 0,  85, 240,  59.76, 25.24, 'Good', 0),
    (v_user_id, g_warriors, 'Elderwood Bundle VI',   249, 0,  85, 240,  59.76, 25.24, 'Good', 0),
    (v_user_id, g_warriors, 'Spin Wheel 5 Spins II', 299, 0,  90, 240,  71.76, 18.24, 'Okay', 0),
    (v_user_id, g_warriors, 'Spin Wheel 10 Spins II',249, 0,  85, 240,  59.76, 25.24, 'Good', 0),
    (v_user_id, g_warriors, 'Elderwood Bundle VII',  249, 0,  85, 240,  59.76, 25.24, 'Good', 0),
    (v_user_id, g_warriors, 'Elderwood Bundle VIII', 199, 0,  65, 240,  47.76, 17.24, 'Okay', 0),
    (v_user_id, g_warriors, 'Elderwood Bundle IX',   149, 0,  50, 240,  35.76, 14.24, 'Okay', 0),
    (v_user_id, g_warriors, 'Spin Wheel 5 Spins III',199, 0,  65, 240,  47.76, 17.24, 'Okay', 0),
    (v_user_id, g_warriors, 'Spin Wheel 10 Spins III',99, 0,  35, 240,  23.76, 11.24, 'Okay', 0),
    (v_user_id, g_warriors, 'Premium Bundle',        899, 0, 295, 240, 215.76, 79.24, 'Good', 0);

  -- ====== ANIME FIGHTING SIMULATOR ENDLESS ======
  INSERT INTO public.gamepasses (user_id, game_id, name, robux_amount, competitor_price, your_price, robux_rate, your_cost, profit, status, suggested_lower_price) VALUES
    (v_user_id, g_anime, 'x2 Durability',       199, 0,  65, 240,  47.76, 17.24, 'Okay', 0),
    (v_user_id, g_anime, 'x2 Chakra',           199, 0,  65, 240,  47.76, 17.24, 'Okay', 0),
    (v_user_id, g_anime, 'x2 Sword Skill',      199, 0,  65, 240,  47.76, 17.24, 'Okay', 0),
    (v_user_id, g_anime, 'x2 Agility',           99, 0,  35, 240,  23.76, 11.24, 'Okay', 0),
    (v_user_id, g_anime, 'x2 Speed',             99, 0,  35, 240,  23.76, 11.24, 'Okay', 0),
    (v_user_id, g_anime, 'x2 Yen',              249, 0,  85, 240,  59.76, 25.24, 'Good', 0),
    (v_user_id, g_anime, 'Conceal Power',        199, 0,  65, 240,  47.76, 17.24, 'Okay', 0),
    (v_user_id, g_anime, 'VIP',                  299, 0,  90, 240,  71.76, 18.24, 'Okay', 0),
    (v_user_id, g_anime, 'Half Cooldown',        249, 0,  85, 240,  59.76, 25.24, 'Good', 0),
    (v_user_id, g_anime, 'No Limit',             749, 0, 220, 240, 179.76, 40.24, 'Good', 0),
    (v_user_id, g_anime, 'Faster Flight',        149, 0,  50, 240,  35.76, 14.24, 'Okay', 0),
    (v_user_id, g_anime, 'x2 Chikara',          249, 0,  85, 240,  59.76, 25.24, 'Good', 0),
    (v_user_id, g_anime, 'Chakra Healing',       199, 0,  65, 240,  47.76, 17.24, 'Okay', 0),
    (v_user_id, g_anime, 'x2 Tokens',           249, 0,  85, 240,  59.76, 25.24, 'Good', 0),
    (v_user_id, g_anime, 'x4 Gacha Speed',       99, 0,  35, 240,  23.76, 11.24, 'Okay', 0),
    (v_user_id, g_anime, 'Shiny Hunter',        1299, 0, 390, 240, 311.76, 78.24, 'Good', 0),
    (v_user_id, g_anime, 'Custom Power Level',   199, 0,  65, 240,  47.76, 17.24, 'Okay', 0),
    (v_user_id, g_anime, 'Instant Trait Reroll',  49, 0,  20, 240,  11.76,  8.24, 'Okay', 0);

  RAISE NOTICE 'Seed data inserted successfully for user %', v_user_id;
END $$;
