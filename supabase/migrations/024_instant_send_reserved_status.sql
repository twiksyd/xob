-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 024: Instant Send Tracker — Reserved status
-- Run in Supabase SQL Editor. Safe to run multiple times (idempotent).
--
-- Adds a third state between "available" and "sent": reserving an account's
-- daily 500 R$ slot (e.g. while coordinating with a buyer) before the send
-- actually happens. Stays append-only/immutable like every other log in this
-- app — "Mark Sent" after a reservation inserts a new 'sent' row rather than
-- mutating the 'reserved' one, so the day's history (reserved at X, sent at Y)
-- is preserved. Existing rows default to 'sent' since they predate this
-- column and were all created by the old "Mark 500 Sent" action.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.instant_send_logs
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'sent'
  CHECK (status IN ('reserved', 'sent'));
