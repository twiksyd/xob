-- ─────────────────────────────────────────────────────────────────────────────
-- Step 2 of 2 — recreate gamepasses for these 12 games from the original
-- sheet. Run AFTER restore-subset-delete.sql.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT user_id INTO v_user_id FROM public.games LIMIT 1;
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'No existing games row found to infer user_id from'; END IF;

  INSERT INTO public.games (user_id, name)
  SELECT v_user_id, 'KICK A LUCKY BLOCK (done)'
  WHERE NOT EXISTS (SELECT 1 FROM public.games WHERE user_id = v_user_id AND name = 'KICK A LUCKY BLOCK (done)');

  INSERT INTO public.games (user_id, name)
  SELECT v_user_id, 'anime vanguards (top 1)'
  WHERE NOT EXISTS (SELECT 1 FROM public.games WHERE user_id = v_user_id AND name = 'anime vanguards (top 1)');

  INSERT INTO public.games (user_id, name)
  SELECT v_user_id, 're:rangers X'
  WHERE NOT EXISTS (SELECT 1 FROM public.games WHERE user_id = v_user_id AND name = 're:rangers X');

  INSERT INTO public.games (user_id, name)
  SELECT v_user_id, 'survive the apocalypse'
  WHERE NOT EXISTS (SELECT 1 FROM public.games WHERE user_id = v_user_id AND name = 'survive the apocalypse');

  INSERT INTO public.games (user_id, name)
  SELECT v_user_id, 'catch and tame'
  WHERE NOT EXISTS (SELECT 1 FROM public.games WHERE user_id = v_user_id AND name = 'catch and tame');

  INSERT INTO public.games (user_id, name)
  SELECT v_user_id, 'drag simulator'
  WHERE NOT EXISTS (SELECT 1 FROM public.games WHERE user_id = v_user_id AND name = 'drag simulator');

  INSERT INTO public.games (user_id, name)
  SELECT v_user_id, 'Wizard Alchemy'
  WHERE NOT EXISTS (SELECT 1 FROM public.games WHERE user_id = v_user_id AND name = 'Wizard Alchemy');

  INSERT INTO public.games (user_id, name)
  SELECT v_user_id, 'Strongest Battlegrounds'
  WHERE NOT EXISTS (SELECT 1 FROM public.games WHERE user_id = v_user_id AND name = 'Strongest Battlegrounds');

  INSERT INTO public.games (user_id, name)
  SELECT v_user_id, 'EVADE'
  WHERE NOT EXISTS (SELECT 1 FROM public.games WHERE user_id = v_user_id AND name = 'EVADE');

  INSERT INTO public.games (user_id, name)
  SELECT v_user_id, 'Anime Warriors III'
  WHERE NOT EXISTS (SELECT 1 FROM public.games WHERE user_id = v_user_id AND name = 'Anime Warriors III');

  INSERT INTO public.games (user_id, name)
  SELECT v_user_id, 'Anime Fighting Simulator Endless'
  WHERE NOT EXISTS (SELECT 1 FROM public.games WHERE user_id = v_user_id AND name = 'Anime Fighting Simulator Endless');

  INSERT INTO public.games (user_id, name)
  SELECT v_user_id, 'CDID'
  WHERE NOT EXISTS (SELECT 1 FROM public.games WHERE user_id = v_user_id AND name = 'CDID');

  INSERT INTO public.gamepasses (user_id, game_id, name, robux_amount, your_price, your_cost, robux_rate, profit, status, suggested_lower_price, competitor_price, is_active)
  VALUES
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'KICK A LUCKY BLOCK (done)'), 'VIP', 295, 95, 67.8500, 230.0000, 27.15, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'KICK A LUCKY BLOCK (done)'), 'x2 kick power', 139, 45, 31.9700, 230.0000, 13.03, 'Okay', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'KICK A LUCKY BLOCK (done)'), 'x2 cash', 159, 55, 36.5700, 230.0000, 18.43, 'Okay', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'KICK A LUCKY BLOCK (done)'), 'x2 brainrot luck', 99, 30, 22.7700, 230.0000, 7.23, 'Okay', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'KICK A LUCKY BLOCK (done)'), 'x2 mutation luck', 139, 45, 31.9700, 230.0000, 13.03, 'Okay', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'anime vanguards (top 1)'), 'shiny hunter', 1299, 390, 298.7700, 230.0000, 91.23, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'anime vanguards (top 1)'), 'vip', 299, 95, 68.7700, 230.0000, 26.23, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'anime vanguards (top 1)'), 'display all units', 599, 180, 137.7700, 230.0000, 42.23, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'anime vanguards (top 1)'), 'extra unit storage', 149, 50, 34.2700, 230.0000, 15.73, 'Okay', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'anime vanguards (top 1)'), 'premium pass', 799, 235, 183.7700, 230.0000, 51.23, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 're:rangers X'), 'vip', 199, 65, 45.7700, 230.0000, 19.23, 'Okay', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 're:rangers X'), 'fast star', 49, 20, 11.2700, 230.0000, 8.73, 'Okay', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 're:rangers X'), 'extra unit storage', 149, 45, 34.2700, 230.0000, 10.73, 'Okay', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 're:rangers X'), 'auto trait reroll', 299, 95, 68.7700, 230.0000, 26.23, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 're:rangers X'), 'shiny hunter', 499, 165, 114.7700, 230.0000, 50.23, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 're:rangers X'), '3x game speed', 799, 265, 183.7700, 230.0000, 81.23, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 're:rangers X'), 'happy anniv bundle', 99, 35, 22.7700, 230.0000, 12.23, 'Okay', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 're:rangers X'), 'universal bundle', 99, 35, 22.7700, 230.0000, 12.23, 'Okay', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 're:rangers X'), 'premium pass', 599, 180, 137.7700, 230.0000, 42.23, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 're:rangers X'), '10 battlepass', 1199, 340, 275.7700, 230.0000, 64.23, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'survive the apocalypse'), '999 Robux', 999, 429, 229.7700, 230.0000, 199.23, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'survive the apocalypse'), '349 Robux', 349, 230, 80.2700, 230.0000, 149.73, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'survive the apocalypse'), '99 Robux', 99, 50, 22.7700, 230.0000, 27.23, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'survive the apocalypse'), '49 Robux', 49, 30, 11.2700, 230.0000, 18.73, 'Okay', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'catch and tame'), 'breed luck', 119, 43, 27.3700, 230.0000, 15.63, 'Okay', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'catch and tame'), '2x food', 79, 25, 18.1700, 230.0000, 6.83, 'Okay', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'catch and tame'), 'extra speed', 19, 10, 4.3700, 230.0000, 5.63, 'Okay', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'catch and tame'), 'ultra luck', 359, 115, 82.5700, 230.0000, 32.43, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'catch and tame'), 'auto click', 39, 20, 8.9700, 230.0000, 11.03, 'Okay', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'catch and tame'), 'lucky block luck', 299, 90, 68.7700, 230.0000, 21.23, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'catch and tame'), 'weather totems', 39, 20, 8.9700, 230.0000, 11.03, 'Okay', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'catch and tame'), 'weather totems', 159, 55, 36.5700, 230.0000, 18.43, 'Okay', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'catch and tame'), 'vip', 79, 30, 18.1700, 230.0000, 11.83, 'Okay', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'catch and tame'), 'flying pet potion', 95, 40, 21.8500, 230.0000, 18.15, 'Okay', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'catch and tame'), 'flying pet potion', 175, 60, 40.2500, 230.0000, 19.75, 'Okay', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'catch and tame'), 'riding pet potion', 59, 25, 13.5700, 230.0000, 11.43, 'Okay', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'catch and tame'), 'riding pet potion', 159, 55, 36.5700, 230.0000, 18.43, 'Okay', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'catch and tame'), 'exclusive cave decoration', 59, 25, 13.5700, 230.0000, 11.43, 'Okay', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'catch and tame'), 'exclusive cave decoration', 159, 50, 36.5700, 230.0000, 13.43, 'Okay', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'catch and tame'), 'exclusive cave decoration', 399, 120, 91.7700, 230.0000, 28.23, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'catch and tame'), 'admin abuse weather totems', 39, 15, 8.9700, 230.0000, 6.03, 'Okay', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'catch and tame'), 'admin abuse weather totems', 159, 50, 36.5700, 230.0000, 13.43, 'Okay', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'catch and tame'), 'admin abuse weather totems', 239, 125, 54.9700, 230.0000, 70.03, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'drag simulator'), 'Police Pass', 149, 50, 34.2700, 230.0000, 15.73, 'Okay', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'drag simulator'), 'Luxury Pass', 119, 40, 27.3700, 230.0000, 12.63, 'Okay', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'drag simulator'), 'Dragspec Pass', 109, 35, 25.0700, 230.0000, 9.93, 'Okay', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'drag simulator'), 'Slot Limit Unlocker', 89, 30, 20.4700, 230.0000, 9.53, 'Okay', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'drag simulator'), '2X Paycheck', 499, 145, 114.7700, 230.0000, 30.23, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'drag simulator'), 'Custom Plate Pass', 79, 25, 18.1700, 230.0000, 6.83, 'Okay', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'drag simulator'), 'Exclusive Rims', 79, 25, 18.1700, 230.0000, 6.83, 'Okay', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'drag simulator'), 'Advance Paint Pass', 59, 20, 13.5700, 230.0000, 6.43, 'Okay', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'drag simulator'), 'Premium Accessories', 59, 20, 13.5700, 230.0000, 6.43, 'Okay', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'drag simulator'), 'Boombox Radio', 29, 10, 6.6700, 230.0000, 3.33, 'Bad', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'drag simulator'), 'Suspension Pro', 29, 15, 6.6700, 230.0000, 8.33, 'Okay', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'drag simulator'), 'Rp 500,000,000', 399, 135, 91.7700, 230.0000, 43.23, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'drag simulator'), 'Rp 100,000,000', 99, 35, 22.7700, 230.0000, 12.23, 'Okay', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'drag simulator'), 'Rp 50,000,000', 59, 20, 13.5700, 230.0000, 6.43, 'Okay', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'drag simulator'), 'Rp 10,000,000', 35, 10, 8.0500, 230.0000, 1.95, 'Bad', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'drag simulator'), '5,000,000', 18, 6, 4.1400, 230.0000, 1.86, 'Bad', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'drag simulator'), '1,000,000', 9, 4, 2.0700, 230.0000, 1.93, 'Bad', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'Wizard Alchemy'), 'Exclusive Pack', 129, 45, 29.6700, 230.0000, 15.33, 'Okay', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'Wizard Alchemy'), 'Skip Mixing', 299, 95, 68.7700, 230.0000, 26.23, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'Wizard Alchemy'), 'Better Alchemy', 449, 130, 103.2700, 230.0000, 26.73, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'Wizard Alchemy'), 'Double Storage', 249, 85, 57.2700, 230.0000, 27.73, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'Wizard Alchemy'), 'Sell Anywhere', 349, 105, 80.2700, 230.0000, 24.73, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'Wizard Alchemy'), 'Lunar Set', 129, 45, 29.6700, 230.0000, 15.33, 'Okay', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'Wizard Alchemy'), 'Starlight Set', 799, 265, 183.7700, 230.0000, 81.23, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'Wizard Alchemy'), 'Tiny Cash Pack', 49, 20, 11.2700, 230.0000, 8.73, 'Okay', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'Wizard Alchemy'), 'Small Cash Pack', 175, 65, 40.2500, 230.0000, 24.75, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'Wizard Alchemy'), 'Medium Cash Pack', 399, 120, 91.7700, 230.0000, 28.23, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'Wizard Alchemy'), 'Advanced Cash Pack', 699, 220, 160.7700, 230.0000, 59.23, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'Wizard Alchemy'), 'Huge Cash Pack', 1199, 340, 275.7700, 230.0000, 64.23, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'Wizard Alchemy'), '1 reroll', 59, 20, 13.5700, 230.0000, 6.43, 'Okay', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'Wizard Alchemy'), '5 reroll', 249, 85, 57.2700, 230.0000, 27.73, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'Wizard Alchemy'), '10 reroll', 459, 140, 105.5700, 230.0000, 34.43, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'Strongest Battlegrounds'), 'Advanced Luck', 299, 90, 68.7700, 230.0000, 21.23, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'Strongest Battlegrounds'), 'Extra Luck', 499, 165, 114.7700, 230.0000, 50.23, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'Strongest Battlegrounds'), 'Advanced Luck', 299, 90, 68.7700, 230.0000, 21.23, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'Strongest Battlegrounds'), 'Extra Luck', 25, 20, 5.7500, 230.0000, 14.25, 'Okay', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'Strongest Battlegrounds'), 'Advanced Luck', 99, 35, 22.7700, 230.0000, 12.23, 'Okay', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'Strongest Battlegrounds'), 'Extra Luck', 199, 65, 45.7700, 230.0000, 19.23, 'Okay', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'Strongest Battlegrounds'), 'Advanced Luck', 125, 50, 28.7500, 230.0000, 21.25, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'Strongest Battlegrounds'), 'Extra Luck', 250, 85, 57.5000, 230.0000, 27.5, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'Strongest Battlegrounds'), 'Advanced Luck', 99, 35, 22.7700, 230.0000, 12.23, 'Okay', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'Strongest Battlegrounds'), 'Extra Luck', 99, 35, 22.7700, 230.0000, 12.23, 'Okay', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'Strongest Battlegrounds'), 'Advanced Luck', 1250, 365, 287.5000, 230.0000, 77.5, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'Strongest Battlegrounds'), 'Extra Luck', 79, 35, 18.1700, 230.0000, 16.83, 'Okay', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'Strongest Battlegrounds'), 'Advanced Luck', 237, 80, 54.5100, 230.0000, 25.49, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'Strongest Battlegrounds'), 'Extra Luck', 395, 118, 90.8500, 230.0000, 27.15, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'Strongest Battlegrounds'), 'Small Luck', 399, 120, 91.7700, 230.0000, 28.23, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'Strongest Battlegrounds'), 'Double XP', 799, 235, 183.7700, 230.0000, 51.23, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'EVADE'), 'MUSIC CARRY PACK 1', 350, 110, 80.5000, 230.0000, 29.5, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'EVADE'), 'MUSIC EMOTES PACK 1', 500, 165, 115.0000, 230.0000, 50, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'EVADE'), 'BEE SET', 600, 180, 138.0000, 230.0000, 42, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'EVADE'), 'Boombox', 300, 95, 69.0000, 230.0000, 26, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'EVADE'), 'RETRO COSMETICS SET', 500, 165, 115.0000, 230.0000, 50, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'EVADE'), 'WORLDS COLLIDE', 350, 115, 80.5000, 230.0000, 34.5, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'EVADE'), '6 EMOTES SLOTS', 300, 90, 69.0000, 230.0000, 21, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'EVADE'), 'MILITARY SET', 700, 220, 161.0000, 230.0000, 59, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'EVADE'), 'FUTURE PACK', 400, 120, 92.0000, 230.0000, 28, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'EVADE'), 'CRYSTALLINE SET', 600, 180, 138.0000, 230.0000, 42, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'EVADE'), 'ANIMAL SET', 600, 180, 138.0000, 230.0000, 42, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'EVADE'), '30 Points', 90, 40, 20.7000, 230.0000, 19.3, 'Okay', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'EVADE'), 'EMOTE PACK', 350, 230, 80.5000, 230.0000, 149.5, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'EVADE'), 'CLASSIC SET', 600, 180, 138.0000, 230.0000, 42, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'EVADE'), '100 Points', 300, 95, 69.0000, 230.0000, 26, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'EVADE'), '400 Points (Best Value!)', 1100, 335, 253.0000, 230.0000, 82, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'Anime Warriors III'), 'VIP', 499, 155, 114.7700, 230.0000, 40.23, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'Anime Warriors III'), 'Extra Equip', 399, 115, 91.7700, 230.0000, 23.23, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'Anime Warriors III'), '2x Cash', 299, 90, 68.7700, 230.0000, 21.23, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'Anime Warriors III'), '1.5x EXP', 499, 155, 114.7700, 230.0000, 40.23, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'Anime Warriors III'), 'Lucky', 149, 55, 34.2700, 230.0000, 20.73, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'Anime Warriors III'), 'Super Lucky', 649, 175, 149.2700, 230.0000, 25.73, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'Anime Warriors III'), 'Omega Lucky', 1199, 330, 275.7700, 230.0000, 54.23, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'Anime Warriors III'), 'Small Storage', 99, 40, 22.7700, 230.0000, 17.23, 'Okay', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'Anime Warriors III'), 'Fast Open', 399, 115, 91.7700, 230.0000, 23.23, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'Anime Warriors III'), 'Multi Open', 499, 155, 114.7700, 230.0000, 40.23, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'Anime Warriors III'), 'Huge Storage', 199, 65, 45.7700, 230.0000, 19.23, 'Okay', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'Anime Warriors III'), 'Shiny Hunter', 699, 185, 160.7700, 230.0000, 24.23, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'Anime Warriors III'), 'Secret Hunter', 1499, 390, 344.7700, 230.0000, 45.23, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'Anime Warriors III'), 'Fast Travel', 49, 25, 11.2700, 230.0000, 13.73, 'Okay', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'Anime Warriors III'), '1x Reroll', 69, 30, 15.8700, 230.0000, 14.13, 'Okay', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'Anime Warriors III'), '10x Reroll', 699, 185, 160.7700, 230.0000, 24.23, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'Anime Fighting Simulator Endless'), 'x2 Strength', 199, 65, 45.7700, 230.0000, 19.23, 'Okay', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'Anime Fighting Simulator Endless'), 'x2 Durability', 199, 65, 45.7700, 230.0000, 19.23, 'Okay', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'Anime Fighting Simulator Endless'), 'x2 Chakra', 199, 65, 45.7700, 230.0000, 19.23, 'Okay', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'Anime Fighting Simulator Endless'), 'x2 Sword Skill', 199, 65, 45.7700, 230.0000, 19.23, 'Okay', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'Anime Fighting Simulator Endless'), 'x2 Agility', 99, 35, 22.7700, 230.0000, 12.23, 'Okay', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'Anime Fighting Simulator Endless'), 'x2 Speed', 99, 35, 22.7700, 230.0000, 12.23, 'Okay', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'Anime Fighting Simulator Endless'), 'x2 Yen', 249, 85, 57.2700, 230.0000, 27.73, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'Anime Fighting Simulator Endless'), 'Conceal Power', 199, 65, 45.7700, 230.0000, 19.23, 'Okay', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'Anime Fighting Simulator Endless'), 'VIP', 299, 90, 68.7700, 230.0000, 21.23, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'Anime Fighting Simulator Endless'), 'Half Cooldown', 249, 85, 57.2700, 230.0000, 27.73, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'Anime Fighting Simulator Endless'), 'No Limit', 749, 220, 172.2700, 230.0000, 47.73, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'Anime Fighting Simulator Endless'), 'Faster Flight', 149, 50, 34.2700, 230.0000, 15.73, 'Okay', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'Anime Fighting Simulator Endless'), 'x2 Chikara', 249, 85, 57.2700, 230.0000, 27.73, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'Anime Fighting Simulator Endless'), 'Chakra Healing', 199, 65, 45.7700, 230.0000, 19.23, 'Okay', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'Anime Fighting Simulator Endless'), 'x2 Tokens', 249, 85, 57.2700, 230.0000, 27.73, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'Anime Fighting Simulator Endless'), 'x4 Gacha Speed', 99, 35, 22.7700, 230.0000, 12.23, 'Okay', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'Anime Fighting Simulator Endless'), 'Shiny Hunter', 1299, 390, 298.7700, 230.0000, 91.23, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'Anime Fighting Simulator Endless'), 'Custom Power Level', 199, 65, 45.7700, 230.0000, 19.23, 'Okay', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'Anime Fighting Simulator Endless'), 'Instant Trait Reroll', 49, 20, 11.2700, 230.0000, 8.73, 'Okay', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'CDID'), 'Emergency Vehicles', 111, 45, 25.5300, 230.0000, 19.47, 'Okay', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'CDID'), '50% Job Earning', 319, 100, 73.3700, 230.0000, 26.63, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'CDID'), 'Advance Modification', 199, 65, 45.7700, 230.0000, 19.23, 'Okay', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'CDID'), 'Luxury Vehicles', 207, 70, 47.6100, 230.0000, 22.39, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'CDID'), 'Additional Ownable Car', 79, 25, 18.1700, 230.0000, 6.83, 'Okay', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'CDID'), 'Rare Imports', 151, 50, 34.7300, 230.0000, 15.27, 'Okay', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'CDID'), 'Luxury House', 63, 25, 14.4900, 230.0000, 10.51, 'Okay', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'CDID'), '2x Paycheck', 319, 100, 73.3700, 230.0000, 26.63, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'CDID'), 'Retro Pass', 135, 55, 31.0500, 230.0000, 23.95, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'CDID'), '2x Additional Ownable Car', 215, 75, 49.4500, 230.0000, 25.55, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'CDID'), 'Rp. 10,000,000,000', 1599, 440, 367.7700, 230.0000, 72.23, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'CDID'), 'Rp. 25,000,000', 33, 15, 7.5900, 230.0000, 7.41, 'Okay', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'CDID'), 'Rp. 25,000,000,000', 2034, 569, 467.8200, 230.0000, 101.18, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'CDID'), 'Rp. 100,000,000', 67, 27, 15.4100, 230.0000, 11.59, 'Okay', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'CDID'), 'Rp. 2,500,000,000', 799, 235, 183.7700, 230.0000, 51.23, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'CDID'), 'Rp. 750,000,000', 319, 100, 73.3700, 230.0000, 26.63, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'CDID'), 'Rp. 250,000,000', 135, 55, 31.0500, 230.0000, 23.95, 'Good', 0, 0, true),
    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = 'CDID'), 'Limited Box', 30, 13, 6.9000, 230.0000, 6.1, 'Okay', 0, 0, true);

END $$;
