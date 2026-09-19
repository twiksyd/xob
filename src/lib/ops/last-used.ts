import type { LogicalOrder, LogicalOrderItem } from '@/lib/types/logical-order'

/* "Last used" — which account most recently fulfilled the same gamepass (or,
 * failing that, the same game). Operators reuse an account per game because
 * its Roblox session is already open on that game, so this is a useful hint.
 *
 * It is a SECONDARY signal only: it never reorders the covers-first /
 * tightest-fit ranking, it only labels an account and breaks exact ties.
 *
 * Built entirely from orders the workspace has already loaded (the most recent
 * RAW_FETCH_CAP rows, every status) — no extra query. The trade-off is reach:
 * history older than that window is not consulted. Same rule as the legacy
 * picker: only COMPLETED orders count, because an account assigned to a
 * pending or paid order has not actually been used yet. */

interface Hit {
  accountId: string
  at: number
}

export interface LastUsedIndex {
  byGamepass: Map<string, Hit>
  byGame: Map<string, Hit>
}

export interface LastUsed {
  accountId: string
  /** What matched — shown to the operator so the hint explains itself. */
  basis: 'gamepass' | 'game'
  label: string
}

function remember(map: Map<string, Hit>, key: string | null, hit: Hit) {
  if (!key) return
  const prev = map.get(key)
  if (!prev || hit.at > prev.at) map.set(key, hit)
}

export function buildLastUsedIndex(orders: LogicalOrder[]): LastUsedIndex {
  const byGamepass = new Map<string, Hit>()
  const byGame = new Map<string, Hit>()

  for (const lo of orders) {
    if (lo.status !== 'completed' || lo.hasMixedStatus) continue
    const at = new Date(lo.createdAt).getTime()
    for (const item of lo.items) {
      // BudgetWise items carry their own account; XOB items inherit the
      // header row's.
      const accountId = item.robloxAccountId ?? lo.robloxAccountId
      if (!accountId) continue
      const hit = { accountId, at }
      remember(byGamepass, item.gamepassId, hit)
      remember(byGame, item.gameName, hit)
    }
  }

  return { byGamepass, byGame }
}

export function lastUsedForItem(index: LastUsedIndex, item: LogicalOrderItem): LastUsed | null {
  // An exact gamepass match is the stronger signal, so it wins even when a
  // game-level match is more recent.
  const exact = item.gamepassId ? index.byGamepass.get(item.gamepassId) : undefined
  if (exact) return { accountId: exact.accountId, basis: 'gamepass', label: item.gamepassName }
  const game = item.gameName ? index.byGame.get(item.gameName) : undefined
  if (game) return { accountId: game.accountId, basis: 'game', label: item.gameName ?? '' }
  return null
}

/** The single account to hint for a whole order: the most recent exact match
 *  across the items still needing an account, else the most recent game match. */
export function lastUsedForOrder(index: LastUsedIndex, lo: LogicalOrder): LastUsed | null {
  const pending = lo.items.filter(i => (lo.source === 'budgetwise' ? !i.robloxAccountId : true))
  let best: (LastUsed & { at: number }) | null = null

  for (const item of pending.length > 0 ? pending : lo.items) {
    const found = lastUsedForItem(index, item)
    if (!found) continue
    const hit =
      found.basis === 'gamepass'
        ? index.byGamepass.get(item.gamepassId as string)
        : index.byGame.get(item.gameName as string)
    const at = hit?.at ?? 0
    const better =
      !best ||
      (found.basis === 'gamepass' && best.basis === 'game') ||
      (found.basis === best.basis && at > best.at)
    if (better) best = { ...found, at }
  }

  return best ? { accountId: best.accountId, basis: best.basis, label: best.label } : null
}
