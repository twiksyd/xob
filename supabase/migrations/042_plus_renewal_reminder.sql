-- Track when Roblox Plus was enabled so the UI can remind the user to
-- disable auto-renewal ~24 hours later, before the next billing cycle hits.
ALTER TABLE roblox_accounts
  ADD COLUMN IF NOT EXISTS plus_enabled_at timestamptz,
  ADD COLUMN IF NOT EXISTS plus_reminder_dismissed_at timestamptz;
