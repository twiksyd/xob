-- Tracks when each account was first added to inventory so the 9-day
-- Robux-spend deadline can be surfaced automatically.
-- spent_acknowledged_at is set by the user once they've spent the Robux,
-- dismissing the expired warning without removing the account.
ALTER TABLE roblox_accounts
  ADD COLUMN IF NOT EXISTS added_to_inventory_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS spent_acknowledged_at  TIMESTAMPTZ;
