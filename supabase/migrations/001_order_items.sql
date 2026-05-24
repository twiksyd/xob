-- Migration: Multi-gamepass order items
-- Run this in Supabase SQL editor (Dashboard → SQL Editor)

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  gamepass_id uuid references public.gamepasses(id) on delete set null,
  gamepass_name text not null,
  game_name text,
  robux_amount integer not null,
  selling_price numeric(10,2) not null,
  cost numeric(10,2) not null default 0,
  profit numeric(10,2) not null default 0,
  created_at timestamptz default now()
);

alter table public.order_items enable row level security;

create policy "Users can manage own order items"
  on public.order_items
  for all
  using (
    exists (
      select 1 from public.orders
      where id = order_items.order_id
      and user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.orders
      where id = order_items.order_id
      and user_id = auth.uid()
    )
  );

create index if not exists idx_order_items_order_id on public.order_items(order_id);
