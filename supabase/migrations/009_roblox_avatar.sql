-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 009: Roblox Avatar
-- Run in Supabase SQL Editor. Safe to run multiple times (idempotent).
-- ─────────────────────────────────────────────────────────────────────────────

-- Numeric Roblox user ID, parsed from the profile link the seller pastes in.
-- Used to fetch the account's real Roblox avatar via the thumbnails API.
ALTER TABLE public.roblox_accounts
  ADD COLUMN IF NOT EXISTS roblox_user_id text;
