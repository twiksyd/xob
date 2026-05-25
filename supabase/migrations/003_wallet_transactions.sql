-- Migration: Wallet / Cash Balance System
-- Creates wallet_transactions table for PHP cash flow tracking.
-- Run this in the Supabase SQL editor.

create table if not exists public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  type text not null check (type in ('income', 'expense', 'adjustment')),
  -- Signed amount: positive = inflow, negative = outflow
  amount numeric(10,2) not null,
  category text not null default 'Other',
  description text,
  reference_order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz default now()
);

alter table public.wallet_transactions enable row level security;

create policy "Users can CRUD own wallet_transactions" on public.wallet_transactions
  for all using (auth.uid() = user_id);

create index if not exists idx_wallet_transactions_user_id
  on public.wallet_transactions(user_id);

create index if not exists idx_wallet_transactions_created_at
  on public.wallet_transactions(created_at desc);
