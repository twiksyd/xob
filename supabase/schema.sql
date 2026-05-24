-- ============================================================
-- XOB - Roblox Seller Management Platform
-- Supabase Database Schema
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================================
-- PROFILES (extends Supabase auth.users)
-- ============================================================
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text,
  full_name text,
  avatar_url text,
  robux_rate numeric(10,2) default 240.00, -- PHP per 1000 Robux
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- ROBLOX ACCOUNTS
-- ============================================================
create table if not exists public.roblox_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  username text not null,
  current_robux integer default 0,
  reserved_robux integer default 0,
  notes text,
  status text default 'active' check (status in ('active', 'inactive', 'banned', 'low')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Computed: available_robux = current_robux - reserved_robux (handled in app layer)

-- ============================================================
-- GAMES
-- ============================================================
create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  category text,
  color text default '#22c55e', -- for UI display
  created_at timestamptz default now()
);

-- ============================================================
-- GAMEPASSES
-- ============================================================
create table if not exists public.gamepasses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  game_id uuid references public.games(id) on delete set null,
  name text not null,
  robux_amount integer not null,
  competitor_price numeric(10,2) default 0,
  your_price numeric(10,2) default 0,
  robux_rate numeric(10,2) default 240.00,
  -- Computed fields (updated by trigger or app)
  your_cost numeric(10,2) default 0,
  profit numeric(10,2) default 0,
  status text default 'Okay' check (status in ('Good', 'Okay', 'Bad')),
  suggested_lower_price numeric(10,2) default 0,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- ORDERS
-- ============================================================
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  order_number text unique, -- e.g. ORD-0001
  gamepass_id uuid references public.gamepasses(id) on delete set null,
  roblox_account_id uuid references public.roblox_accounts(id) on delete set null,
  buyer_name text,
  buyer_roblox_username text,
  robux_amount integer,
  selling_price numeric(10,2),
  cost numeric(10,2),
  profit numeric(10,2),
  payment_method text default 'GCash' check (payment_method in ('GCash', 'Maya', 'Bank', 'Cash', 'Other')),
  status text default 'pending' check (status in ('pending', 'paid', 'delivering', 'completed', 'refunded', 'cancelled')),
  notes text,
  paid_at timestamptz,
  delivered_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Auto-generate order number
create or replace function generate_order_number()
returns trigger as $$
declare
  count integer;
begin
  select count(*) + 1 into count from public.orders where user_id = new.user_id;
  new.order_number := 'ORD-' || lpad(count::text, 4, '0');
  return new;
end;
$$ language plpgsql;

create trigger set_order_number
  before insert on public.orders
  for each row execute function generate_order_number();

-- ============================================================
-- TRANSACTIONS
-- ============================================================
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  order_id uuid references public.orders(id) on delete set null,
  roblox_account_id uuid references public.roblox_accounts(id) on delete set null,
  roblox_account_username text, -- snapshot at time of transaction
  type text default 'sale' check (type in ('sale', 'refund', 'adjustment', 'topup')),
  robux_change integer not null, -- negative = deduction, positive = addition
  balance_before integer,
  balance_after integer,
  selling_price numeric(10,2),
  profit numeric(10,2),
  description text,
  created_at timestamptz default now()
);

-- ============================================================
-- TRIGGERS: updated_at
-- ============================================================
create or replace function handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger handle_roblox_accounts_updated_at
  before update on public.roblox_accounts
  for each row execute function handle_updated_at();

create trigger handle_gamepasses_updated_at
  before update on public.gamepasses
  for each row execute function handle_updated_at();

create trigger handle_orders_updated_at
  before update on public.orders
  for each row execute function handle_updated_at();

-- ============================================================
-- TRIGGER: Auto-create profile on signup
-- ============================================================
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============================================================
-- TRIGGER: Deduct robux when order is completed
-- ============================================================
create or replace function handle_order_completion()
returns trigger as $$
declare
  acc_balance integer;
begin
  -- Only act when status changes to 'completed'
  if new.status = 'completed' and old.status != 'completed' then
    -- Get current balance
    select current_robux into acc_balance
    from public.roblox_accounts
    where id = new.roblox_account_id;

    -- Insert transaction record
    insert into public.transactions (
      user_id, order_id, roblox_account_id, roblox_account_username,
      type, robux_change, balance_before, balance_after,
      selling_price, profit, description
    )
    select
      new.user_id, new.id, new.roblox_account_id, ra.username,
      'sale', -new.robux_amount, acc_balance, acc_balance - new.robux_amount,
      new.selling_price, new.profit,
      'Sale: ' || coalesce(gp.name, 'Unknown gamepass')
    from public.roblox_accounts ra
    left join public.gamepasses gp on gp.id = new.gamepass_id
    where ra.id = new.roblox_account_id;

    -- Deduct from account
    update public.roblox_accounts
    set current_robux = current_robux - new.robux_amount,
        updated_at = now()
    where id = new.roblox_account_id;

    -- Mark timestamps
    new.completed_at = now();
  end if;

  -- Mark paid_at
  if new.status = 'paid' and old.status = 'pending' then
    new.paid_at = now();
  end if;

  return new;
end;
$$ language plpgsql security definer;

create trigger on_order_status_change
  before update on public.orders
  for each row execute function handle_order_completion();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles enable row level security;
alter table public.roblox_accounts enable row level security;
alter table public.games enable row level security;
alter table public.gamepasses enable row level security;
alter table public.orders enable row level security;
alter table public.transactions enable row level security;

-- Profiles
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- Roblox accounts
create policy "Users can CRUD own accounts" on public.roblox_accounts
  for all using (auth.uid() = user_id);

-- Games
create policy "Users can CRUD own games" on public.games
  for all using (auth.uid() = user_id);

-- Gamepasses
create policy "Users can CRUD own gamepasses" on public.gamepasses
  for all using (auth.uid() = user_id);

-- Orders
create policy "Users can CRUD own orders" on public.orders
  for all using (auth.uid() = user_id);

-- Transactions
create policy "Users can view own transactions" on public.transactions
  for select using (auth.uid() = user_id);
create policy "Users can insert own transactions" on public.transactions
  for insert with check (auth.uid() = user_id);

-- ============================================================
-- INDEXES
-- ============================================================
create index if not exists idx_roblox_accounts_user_id on public.roblox_accounts(user_id);
create index if not exists idx_gamepasses_user_id on public.gamepasses(user_id);
create index if not exists idx_gamepasses_game_id on public.gamepasses(game_id);
create index if not exists idx_orders_user_id on public.orders(user_id);
create index if not exists idx_orders_status on public.orders(status);
create index if not exists idx_transactions_user_id on public.transactions(user_id);
create index if not exists idx_transactions_created_at on public.transactions(created_at desc);
