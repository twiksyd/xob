-- Migration 039: Account batches
-- Visual organization for Roblox account cards. This does not affect
-- inventory, accounting, transfer, reservation, or pricing calculations.

create table if not exists public.account_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  color text not null default 'blue'
    check (color in ('red', 'orange', 'yellow', 'green', 'blue', 'purple', 'gray', 'pink', 'brown')),
  sort_order integer not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.roblox_accounts
  add column if not exists batch_id uuid references public.account_batches(id) on delete set null;

create index if not exists idx_account_batches_user_id_sort
  on public.account_batches(user_id, sort_order, created_at);

create index if not exists idx_roblox_accounts_batch_id
  on public.roblox_accounts(batch_id);

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'handle_account_batches_updated_at'
  ) then
    create trigger handle_account_batches_updated_at
      before update on public.account_batches
      for each row execute function handle_updated_at();
  end if;
end $$;

alter table public.account_batches enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'account_batches'
      and policyname = 'Users can CRUD own account batches'
  ) then
    create policy "Users can CRUD own account batches" on public.account_batches
      for all using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;
