-- Renames the two Drag Simulator currency packs that were missing the "Rp"
-- prefix in the original sheet (the other 4 packs in that same ladder all
-- have it), so the Orders gamepass catalog's in-game-currency grouping
-- (GamepassCatalog.tsx, matches names starting with "Rp") picks them up.

UPDATE public.gamepasses
SET name = 'Rp 5,000,000'
WHERE name = '5,000,000'
  AND game_id = (SELECT id FROM public.games WHERE name = 'drag simulator');

UPDATE public.gamepasses
SET name = 'Rp 1,000,000'
WHERE name = '1,000,000'
  AND game_id = (SELECT id FROM public.games WHERE name = 'drag simulator');
