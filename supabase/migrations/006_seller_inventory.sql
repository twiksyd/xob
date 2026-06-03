-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 006: Seller Account Inventory
-- Run in Supabase SQL Editor. Safe to run multiple times (idempotent).
-- ─────────────────────────────────────────────────────────────────────────────

-- seller_accounts — Roblox accounts being prepared for resale
CREATE TABLE IF NOT EXISTS public.seller_accounts (
  id              uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  username        text        NOT NULL,
  display_name    text,
  has_drag_spec   boolean     NOT NULL DEFAULT false,
  estimated_price numeric(10,2),
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- seller_account_vehicles — vehicles owned by a seller account
CREATE TABLE IF NOT EXISTS public.seller_account_vehicles (
  id                  uuid        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_account_id   uuid        NOT NULL REFERENCES public.seller_accounts(id) ON DELETE CASCADE,
  name                text        NOT NULL,
  is_limited          boolean     NOT NULL DEFAULT true,
  estimated_value     numeric(10,2),
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_seller_accounts_user_created
  ON public.seller_accounts (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_seller_vehicles_account
  ON public.seller_account_vehicles (seller_account_id);

-- RLS
ALTER TABLE public.seller_accounts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_account_vehicles  ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'seller_accounts' AND policyname = 'Users manage own seller accounts') THEN
    CREATE POLICY "Users manage own seller accounts"
      ON public.seller_accounts FOR ALL
      USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'seller_account_vehicles' AND policyname = 'Users manage own seller vehicles') THEN
    CREATE POLICY "Users manage own seller vehicles"
      ON public.seller_account_vehicles FOR ALL
      USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;
