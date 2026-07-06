-- Migration 040: Expand account_batches color palette
-- Adds the 5 new muted luxury colors (amber, rose, cyan, slate + red was already present
-- under a different spelling). Legacy keys are kept so existing rows are not invalidated.

alter table public.account_batches
  drop constraint if exists account_batches_color_check;

alter table public.account_batches
  add constraint account_batches_color_check
    check (color in (
      -- Legacy keys (preserved for backward compat)
      'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'gray', 'pink', 'brown',
      -- New muted luxury palette
      'amber', 'rose', 'cyan', 'slate'
    ));
