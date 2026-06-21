import { PricingEngineTier, Gamepass } from '@/lib/types/database'

// ── Bulk Generate paste-box parsing ─────────────────────────────────────────
// Each line is "Name | Amount" or "Name,Amount". A bare number with no
// delimiter is also accepted (supports loading a bare-amount preset like
// "100/250/500" without forcing a rename first) — its name defaults to
// "{amount} Robux", still editable in the review table afterward.

export interface ParsedGenerationRow {
  lineNumber: number
  name: string
  amount: number
}

export interface ParsedGenerationResult {
  rows: ParsedGenerationRow[]
  errors: { lineNumber: number; text: string }[]
  duplicateNames: string[]
}

export function parseGenerationInput(raw: string): ParsedGenerationResult {
  const rows: ParsedGenerationRow[] = []
  const errors: { lineNumber: number; text: string }[] = []
  const seenNames = new Map<string, number>()
  const duplicateNames = new Set<string>()

  const lines = raw.split(/\r?\n/)
  lines.forEach((line, idx) => {
    const lineNumber = idx + 1
    const text = line.trim()
    if (text === '') return

    const delimiter = text.includes('|') ? '|' : text.includes(',') ? ',' : null

    if (delimiter) {
      const parts = text.split(delimiter).map(p => p.trim()).filter(p => p !== '')
      if (parts.length !== 2) {
        errors.push({ lineNumber, text })
        return
      }
      const [name, amountStr] = parts
      const amount = Number(amountStr)
      if (!Number.isFinite(amount) || amount <= 0) {
        errors.push({ lineNumber, text })
        return
      }
      rows.push({ lineNumber, name, amount })
      const key = name.toLowerCase()
      if (seenNames.has(key)) duplicateNames.add(name)
      seenNames.set(key, lineNumber)
    } else {
      const amount = Number(text)
      if (!Number.isFinite(amount) || amount <= 0) {
        errors.push({ lineNumber, text })
        return
      }
      const name = `${amount.toLocaleString()} Robux`
      rows.push({ lineNumber, name, amount })
    }
  })

  return { rows, errors, duplicateNames: [...duplicateNames] }
}

// ── Master tier matching ────────────────────────────────────────────────────

export type TierMatchStatus = 'exact' | 'closest' | 'none'

export interface TierMatch {
  status: TierMatchStatus
  tier: PricingEngineTier | null
}

export function matchTier(amount: number, tiers: PricingEngineTier[]): TierMatch {
  const exact = tiers.find(t => t.robux_amount === amount)
  if (exact) return { status: 'exact', tier: exact }
  if (tiers.length === 0) return { status: 'none', tier: null }
  let closest = tiers[0]
  let bestDiff = Math.abs(tiers[0].robux_amount - amount)
  for (const t of tiers.slice(1)) {
    const diff = Math.abs(t.robux_amount - amount)
    if (diff < bestDiff) { closest = t; bestDiff = diff }
  }
  return { status: 'closest', tier: closest }
}

// ── Duplicate gamepass detection ────────────────────────────────────────────
// Priority 1: same robux_amount (survives renames — the amount is the stable
// anchor, not the title). Priority 2 (fallback only if no amount match):
// case-insensitive name match.

export function findExistingGamepass(
  row: { name: string; robux_amount: number },
  existing: Gamepass[]
): Gamepass | null {
  const byAmount = existing.find(g => g.robux_amount === row.robux_amount)
  if (byAmount) return byAmount
  const byName = existing.find(g => g.name.trim().toLowerCase() === row.name.trim().toLowerCase())
  return byName ?? null
}

// ── Master pricing table CSV import ─────────────────────────────────────────

export interface ParsedTierRow {
  lineNumber: number
  robux_amount: number
  selling_price: number
  profit: number
}

export interface ParsedTierResult {
  rows: ParsedTierRow[]
  errors: { lineNumber: number; text: string }[]
}

export function parsePricingTierCSV(raw: string): ParsedTierResult {
  const rows: ParsedTierRow[] = []
  const errors: { lineNumber: number; text: string }[] = []

  const lines = raw.split(/\r?\n/)
  lines.forEach((line, idx) => {
    const lineNumber = idx + 1
    const text = line.trim()
    if (text === '') return

    const delimiter = text.includes(',') ? ',' : text.includes('|') ? '|' : text.includes('\t') ? '\t' : null
    if (!delimiter) { errors.push({ lineNumber, text }); return }

    const parts = text.split(delimiter).map(p => p.trim()).filter(p => p !== '')
    if (parts.length !== 3) { errors.push({ lineNumber, text }); return }

    const [amountStr, priceStr, profitStr] = parts
    // Skip a header row (e.g. "Robux Amount,Selling Price,Profit") rather
    // than erroring on it.
    if (lineNumber === 1 && !Number.isFinite(Number(amountStr))) return

    const robux_amount = Number(amountStr)
    const selling_price = Number(priceStr)
    const profit = Number(profitStr)
    if (!Number.isFinite(robux_amount) || robux_amount <= 0 || !Number.isFinite(selling_price) || selling_price < 0 || !Number.isFinite(profit)) {
      errors.push({ lineNumber, text })
      return
    }
    rows.push({ lineNumber, robux_amount, selling_price, profit })
  })

  // Last row wins on duplicate amounts within the same import.
  const byAmount = new Map<number, ParsedTierRow>()
  for (const row of rows) byAmount.set(row.robux_amount, row)

  return { rows: [...byAmount.values()], errors }
}

export type TierDiffKind = 'new' | 'changed' | 'unchanged'

export interface TierDiffRow extends ParsedTierRow {
  kind: TierDiffKind
  oldPrice?: number
  oldProfit?: number
}

export function diffPricingTiers(parsed: ParsedTierRow[], existing: PricingEngineTier[]): TierDiffRow[] {
  const existingByAmount = new Map(existing.map(t => [t.robux_amount, t]))
  return parsed.map(row => {
    const prior = existingByAmount.get(row.robux_amount)
    if (!prior) return { ...row, kind: 'new' as const }
    const changed = prior.selling_price !== row.selling_price || prior.profit !== row.profit
    return {
      ...row,
      kind: changed ? 'changed' as const : 'unchanged' as const,
      oldPrice: prior.selling_price,
      oldProfit: prior.profit,
    }
  })
}
