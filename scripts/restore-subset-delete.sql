-- ─────────────────────────────────────────────────────────────────────────────
-- Step 1 of 2 — delete current gamepasses for just these 12 games.
-- Run this first. Run restore-subset-insert.sql right after.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT user_id INTO v_user_id FROM public.games LIMIT 1;
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'No existing games row found to infer user_id from'; END IF;

  DELETE FROM public.gamepasses
  WHERE user_id = v_user_id
    AND game_id IN (
      SELECT id FROM public.games WHERE user_id = v_user_id AND name IN (
        'KICK A LUCKY BLOCK (done)',
        'anime vanguards (top 1)',
        're:rangers X',
        'survive the apocalypse',
        'catch and tame',
        'drag simulator',
        'Wizard Alchemy',
        'Strongest Battlegrounds',
        'EVADE',
        'Anime Warriors III',
        'Anime Fighting Simulator Endless',
        'CDID'
      )
    );
END $$;
