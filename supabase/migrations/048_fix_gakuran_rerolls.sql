-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 048: Fix Gakuran reroll count — 150 → 50
-- Run in Supabase SQL Editor. Safe to run multiple times (idempotent UPDATE).
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE public.gamepasses gp
SET    name         = '50 Rerolls',
       robux_amount = 50
FROM   public.games g
WHERE  gp.game_id      = g.id
  AND  g.name  ILIKE   'gakuran%'
  AND  gp.name ILIKE   '%reroll%';
