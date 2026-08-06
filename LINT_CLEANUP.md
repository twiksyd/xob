# Lint Cleanup — Pre-existing Issues

These errors existed before the BudgetWise order-grouping work and are unrelated to it.
They were not introduced by the normalization layer. Fix separately.

## 7 Errors

### `src/app/(dashboard)/orders/page.tsx`

| Line | Rule | Issue |
|------|------|-------|
| 205 | `react-hooks/set-state-in-effect` | `useEffect(() => { fetchData() }, [fetchData])` — fetchData calls setState internally, flagged as cascading render risk. Fix: call fetchData outside the effect body or wrap in a scheduler. |
| 675 | `react-hooks/purity` | `Date.now()` called directly inside the render map for `ageHours` calculation. Fix: lift to a `const now = Date.now()` outside the map, or use a `useNow()` hook that updates on a timer. |

### `src/components/orders/FulfillmentMode.tsx`

| Line | Rule | Issue |
|------|------|-------|
| 129 | `react-hooks/set-state-in-effect` | `setUrl(u)` called synchronously inside a `useEffect` that creates an object URL. Fix: effect is correct here (it also returns cleanup) — consider an `eslint-disable-next-line` with a comment, or restructure as a derived value. |
| 214 | `react-hooks/purity` | `useState(Date.now())` — initializer uses an impure function. Fix: use a `useRef` for the start time instead, or wrap with `useState(() => Date.now())` (lazy init). |
| 227 | `react-hooks/set-state-in-effect` | Multiple `setState` calls in the progress-restore effect. Fix: batch into a single `setState` or wrap in `startTransition`. |
| 339 | `react-hooks/purity` | `Date.now()` called during render for elapsed time display. Fix: derive from the `startTime` ref outside the render path, or use a `useInterval`-driven state. |
| ~n/a | *(truncated in output — one additional error hidden by character limit)* | Run `node node_modules/eslint/bin/eslint.js src/components/orders/FulfillmentMode.tsx` directly to see the full list. |

## 2 Warnings

### `src/components/orders/FulfillmentMode.tsx`

| Line | Rule | Issue |
|------|------|-------|
| 135 | `@next/next/no-img-element` | `<img>` used for screenshot thumbnails. Fix: switch to Next.js `<Image>` with `unoptimized` prop for blob URLs, or add a targeted `eslint-disable`. |
| 656 | `@typescript-eslint/no-unused-vars` | `itemId` defined but never used. Fix: delete it. |

## Notes

- `pnpm lint` (which runs `next lint`) fails to find the project directory on Windows when called as a subprocess — use `node node_modules/eslint/bin/eslint.js <files>` directly.
- TypeScript (`node node_modules/typescript/bin/tsc --noEmit`) passes clean.
- None of these errors affect runtime behavior of the normalization layer or BW order grouping.
