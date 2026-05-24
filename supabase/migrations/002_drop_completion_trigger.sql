-- Migration: Remove DB-level balance trigger
-- Balance deduction is now handled at the application layer for reliability.
-- Run this in Supabase SQL editor after 001_order_items.sql

drop trigger if exists on_order_status_change on public.orders;
drop function if exists handle_order_completion;
