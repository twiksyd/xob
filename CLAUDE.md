# XOB — Roblox Seller Dashboard

## Next.js Version Warning

This project uses **Next.js 16** with **React 19**. APIs, conventions, and file
structure differ from earlier major versions and from Claude's training data.
Before writing any Next.js–specific code, read the relevant guide in
`node_modules/next/dist/docs/`. Treat deprecation notices as blockers.

---

## Project Overview

XOB is a private, single-owner Progressive Web App for managing a Roblox
gamepass-reselling business. The seller tracks inventory (Roblox accounts and
their Robux balances), customer orders, pricing, cash flow, and capital health
from one mobile-first dashboard.

The seller runs two order channels side-by-side:
- **XOB native** — orders created directly inside this app.
- **BudgetWise Store (BW)** — orders imported from an external storefront;
  each purchased item arrives as a separate `orders` row sharing a `BW-` prefixed
  `order_number`.

The UI unifies both channels into **`LogicalOrder`** objects so every page
reasons about checkouts, not raw database rows.

---

## Technology Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 App Router |
| UI runtime | React 19 |
| Language | TypeScript 5 (strict) |
| Database / Auth | Supabase (PostgreSQL + Auth + RLS + RPCs) |
| Auth adapter | `@supabase/ssr` (cookie-based sessions) |
| Styling | Tailwind CSS v4 |
| Component primitives | shadcn/ui |
| Animation | framer-motion |
| Charts | Recharts |
| Command palette | cmdk |
| Forms | react-hook-form + Zod |
| Date handling | date-fns |

---

## Folder Structure

```
src/
  app/
    (auth)/           — login, register (public routes)
    (dashboard)/      — all authenticated pages (layout wraps them)
      page.tsx        — Dashboard (scroll-chapters, capital + inventory)
      accounts/       — Roblox account management
      orders/         — Order creation, fulfillment, status advancement
      inventory/      — Gamepass catalog + game manager
      transactions/   — Robux ledger
      wallet/         — PHP cash ledger + savings
      overall-sales/  — Aggregated sales analytics
      seller-inventory/ — Seller-facing stock view
      integrity/      — Financial reconciliation checks
    api/              — Thin Next.js Route Handlers (avatar proxy, PWA icons)
  components/
    accounts/         — Account cards, modals, transfer and restock dialogs
    dashboard/        — Capital summary, fulfillment readiness, money flow widgets
    inventory/        — Game and gamepass management dialogs
    orders/           — Order form, BW account assignment, fulfillment dialogs
    shared/           — App chrome: nav, toast notifications, stat cards
    ui/               — shadcn/ui primitive wrappers
  hooks/
    useWorkspaces.ts  — Order workspace (tabs + editor state)
    useOrderCart.ts   — Cart state during order creation
    useUrlState.ts    — URL ↔ state sync
  lib/
    supabase/
      client.ts       — Browser Supabase client (with no-store fetch override)
      server.ts       — Server Supabase client (cookie-based, for Route Handlers)
    types/
      database.ts     — Hand-maintained typed schema mirroring the live DB
      logical-order.ts — LogicalOrder / LogicalOrderItem types
    utils/
      accounts.ts     — Available Robux, health tiers, account ranking
      capital.ts      — Business value, purchase classification
      normalize-orders.ts — Raw rows → LogicalOrder[]
      orders.ts       — Order status helpers
      pricing.ts      — Cost, profit, Plus discount, formatRobux/formatPHP
      transfers.ts    — Daily/lifetime transfer caps, decomposeAmount
      velocity.ts     — Robux velocity and runway calculations
    constants/
      restock.ts      — Supplier economics constants (ACCOUNT_COST, FIXED_CAPITAL …)
      batches.ts      — Account batch colour palette
  proxy.ts            — Auth-gate middleware (redirects unauthenticated users)

supabase/
  schema.sql          — Baseline schema (run once on a new project)
  seed.sql            — Optional seed data
  migrations/         — Numbered SQL migrations (NNN_description.sql)
  tests/              — SQL test scripts (run manually in SQL Editor)
```

---

## Supabase Conventions

### Client Creation
- **Browser** (`'use client'` components): `createClient()` from `lib/supabase/client.ts`.
  This overrides `fetch` with `cache: 'no-store'` so Supabase REST requests are
  never served from a browser or CDN cache.
- **Server** (Route Handlers): `createClient()` from `lib/supabase/server.ts`.
- Never create Supabase clients ad-hoc — always go through these two factories.

### Dashboard Pages
Every page under `(dashboard)/` is a client component:
```ts
'use client'
export const dynamic = 'force-dynamic'
```
There are no Server Components or server actions in the dashboard. All data
fetching and mutations use the browser Supabase client directly.

### RPC Conventions
Every custom RPC follows this pattern without exception:

```sql
CREATE OR REPLACE FUNCTION public.my_rpc(...)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  -- Lock rows before reads: SELECT ... FOR UPDATE
  -- Raise exceptions for validation failures (not return-value errors)
  ...
  RETURN jsonb_build_object('success', true, ...);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.my_rpc(...) FROM anon;
GRANT  EXECUTE ON FUNCTION public.my_rpc(...) TO authenticated;
```

Key rules:
- `SECURITY DEFINER` + `SET search_path = public` on all RPCs.
- `auth.uid()` is always the first check; null uid → exception.
- Financial rows are locked with `SELECT ... FOR UPDATE` before any update.
- Exceptions describe what went wrong; they are never silent failures.
- Deny `anon`, grant `authenticated` explicitly. `service_role` bypasses grants automatically.

---

## Database Tables (Key Tables)

| Table | Purpose |
|---|---|
| `profiles` | Extends `auth.users`; holds `robux_rate` (PHP per 1 000 R$) |
| `roblox_accounts` | Inventory: `current_robux`, `reserved_robux`, status, Plus flags, batch, aging |
| `games` | Game catalog |
| `gamepasses` | Gamepass catalog with pricing and profitability fields |
| `orders` | One row per order (XOB) or per item (BW) |
| `order_items` | Multi-gamepass line items for XOB native multi-pass orders |
| `robux_reservations` | Reservation ledger — never deleted; status `active` / `released` |
| `transactions` | Robux ledger (sale / refund / adjustment / topup) |
| `wallet_transactions` | PHP cash ledger (income / expense) |
| `capital_events` | Robux account purchase history for capital safety tracking |
| `account_batches` | Visual grouping for account cards |
| `order_reassignments` | Append-only audit trail for account corrections |
| `savings_goals` + `savings_transactions` | Savings tracking |

The `available_robux` of an account is always computed in the app layer:
```ts
available = current_robux - reserved_robux   // never stored as a column
```

RLS is enabled on every table; all policies scope to `auth.uid() = user_id`.

---

## Order Architecture

### Two Sources, One Type
`normalizeOrders(raw: OrderWithDetails[]): LogicalOrder[]` in
`lib/utils/normalize-orders.ts` is the canonical entry point. It converts raw
database rows into logical orders for display and fulfillment:

- **BudgetWise**: Multiple `orders` rows sharing the same `BW-` prefixed
  `order_number` (or a single row with a `BW-` prefix) → one `LogicalOrder`
  whose `items` map from each underlying `orders` row.
- **XOB native**: One `orders` header row, optionally with `order_items` children
  → one `LogicalOrder` whose `items` map from `order_items`.

**Grouping key is `order_number` only.** Never group by buyer name, timestamp,
product, or status.

### LogicalOrderItem
Each item carries its own `robloxAccountId` for BW orders (per-item account),
or `null` for XOB orders (account lives on the header row).

### Order Status Flow
`pending → paid → completed` (via `transition_order` RPC).
`pending | paid → cancelled | refunded | delivering` also valid.
`completed → refunded | cancelled` also valid (restores Robux).

---

## Reservation System

`robux_reservations` holds one **active** reservation per order (enforced by
a partial unique index on `order_id WHERE status = 'active'`).

**Invariant**: `Σ active reservations.robux_amount == Σ roblox_accounts.reserved_robux`
(per user). The Integrity page reconciles this via `get_financial_integrity_checks()`.

Reservations are **never deleted**. On release, `status` is set to `'released'`
and `released_at` is stamped. The audit history is permanent.

---

## Account Assignment RPCs

When assigning a Roblox account to a BW order item, use the correct RPC for
each scenario. Using the wrong one will corrupt balances.

| Scenario | RPC | Atomicity |
|---|---|---|
| null → account | `assign_order_account(order_id, account_id)` | Atomic (migration 047) |
| A → B | `reassign_order_account(order_id, new_account_id)` | Atomic (migration 010) |
| A → null | `release_order_reservation(order_id)` + `orders.update({ roblox_account_id: null })` | Non-atomic |
| unchanged | skip — no RPC call | — |

The `assign_order_account` RPC validates status, available Robux, and account
eligibility server-side. Client-side validation does not replace this check.

The account picker has a minimum available-Robux threshold (`MIN_ASSIGN_ROBUX`
in `BWAccountAssignDialog`) — accounts below it are hidden from the picker but
can still be manually assigned.

---

## Pricing and Plus Accounts

- Default Robux rate: `ROBUX_RATE` in `lib/utils/pricing.ts` (PHP / 1 000 R$).
- Each account can override this with its own `robux_cost_rate`.
- **Roblox Plus** grants a Robux discount at fulfillment only (`PLUS_ROBUX_DISCOUNT`
  in `lib/utils/pricing.ts`). It does NOT reduce cost rate, inventory valuation,
  or capital calculations.
- `getEffectivePlusRobuxCost(robuxAmount, isPlusAccount)` is the canonical
  function for how much Robux an account actually spends. Call it everywhere
  Robux is reserved or deducted for order fulfillment — never apply the discount
  manually inline.

---

## Capital Model

Business value = `wallet_balance + inventory_value`
Inventory value = `Σ MAX(0, available_robux) × (robux_cost_rate / 1000)`

Protected capital (`FIXED_CAPITAL` in `lib/constants/restock.ts`) is the cost
of a full restock cycle. Purchases are classified:
- **profit** — cost is entirely covered by (business_value − FIXED_CAPITAL)
- **mixed** — partially covered by profit, partially by protected capital
- **capital** — cost exceeds available profit entirely

`classifyPurchase()` in `lib/utils/capital.ts` is the authoritative source.

---

## Transfer (Instant Send) Limits

Two caps are enforced server-side per account: a daily limit and a lifetime
limit (see `DAILY_TRANSFER_LIMIT` / `LIFETIME_TRANSFER_LIMIT` in
`lib/utils/transfers.ts`). The lifetime cap never resets — an account can
exhaust its total allowance while its daily counter still shows headroom.
Available = `min(daily_remaining, lifetime_remaining)`.

---

## Security Rules

These are permanent non-negotiable constraints:

- **Never expose**: account passwords, cookie values, session tokens, private
  account notes, or any credentials — not in the UI, logs, or API responses.
- **Never bypass RLS** from client code. All mutations go through RPCs or
  Supabase client calls that are governed by RLS.
- **Do not change BudgetWise Store order creation logic.**
- **Do not undo logical-order grouping** (the normalizeOrders abstraction must
  remain intact — the entire UI depends on it).

---

## Financial Integrity Rules

- Every Robux deduction on `transition_order → completed` also writes a
  `transactions` row and a `wallet_transactions` row in the same RPC call.
- Reservations must always be released before or with any Robux deduction.
- `reserved_robux` on `roblox_accounts` must stay in sync with the active
  reservations ledger. Never increment/decrement `reserved_robux` without a
  matching reservation INSERT or status update.
- Corrections that touch financial columns must go through the authoritative
  RPCs — do not issue raw UPDATE statements on `roblox_accounts.reserved_robux`,
  `current_robux`, or `wallet_transactions`.

---

## Migration Policy

- Migrations are numbered SQL files in `supabase/migrations/` (`NNN_description.sql`).
- They are applied **manually** in the Supabase SQL Editor — there is no CLI
  migration runner. `schema.sql` documents the baseline; everything after it is
  in numbered migration files.
- Migrations must be **idempotent** (`CREATE OR REPLACE`, `IF NOT EXISTS`,
  `DO $$ BEGIN IF NOT EXISTS … END $$`).
- Do not create a migration unless a schema or RPC change is genuinely required.
  Data-only corrections (values wrong in prod) belong in a numbered migration;
  one-off fixes belong in the `scripts/` folder.
- Test SQL lives in `supabase/tests/`; run manually, wrapped in `BEGIN/ROLLBACK`.

---

## Coding Standards

- TypeScript strict mode is enforced. No `any` without a comment explaining why.
- Path alias `@/*` maps to `src/*`.
- Run type checking with `node_modules/.bin/tsc --noEmit` (not `pnpm exec tsc`
  — that triggers a pnpm build-policy error in this repo).
- Run lint on changed files directly: `node node_modules/eslint/bin/eslint.js <file>`.
- No comments that repeat what the code says. Comments only for non-obvious
  invariants, workarounds, or hidden constraints.
- `mountedRef` pattern (a `useRef<boolean>(true)` set false on unmount) guards
  all `setState` calls in dialogs that have async save operations — prevents
  setting state after unmount.

---

## UI Patterns

- `ToastProvider` and `ConfirmProvider` wrap the entire dashboard layout; use
  `useToast()` and `useConfirm()` hooks — do not render Toast or Confirm inline.
- `SectionLabel` (§ index + label) is the shared heading pattern across pages.
- Animation presets are in `lib/motion.ts`. Use named exports (`staggerContainer`,
  `staggerItem`, `cardStagger`, etc.) rather than inline variants.
- The app is a PWA (manifest.ts, service worker via PwaRegister). Dark-only theme;
  background is `#0d0b1e`.
- Shadcn/ui components live in `src/components/ui/`. Do not modify them unless
  a genuine UI primitive gap requires it.
