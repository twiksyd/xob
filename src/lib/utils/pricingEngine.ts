import { PricingEngineTier, Gamepass } from '@/lib/types/database'
import { ROBUX_RATE, calculateCost } from '@/lib/utils/pricing'

// ── Bulk Generate paste-box parsing ─────────────────────────────────────────
// Each line is "Name | Amount", "Name,Amount", or just "Name Amount" (space-
// separated — the last whitespace-token is taken as the amount, everything
// before it as the name, since that's what people type without thinking
// about it). A bare number with no name at all is also accepted (supports
// loading a bare-amount preset like "100/250/500" without forcing a rename
// first) — its name defaults to "{amount} Robux", still editable in the
// review table afterward.

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
      const bareAmount = Number(text)
      if (Number.isFinite(bareAmount) && bareAmount > 0) {
        rows.push({ lineNumber, name: `${bareAmount.toLocaleString()} Robux`, amount: bareAmount })
        return
      }

      // No |/, delimiter and not a bare number — try "Name Amount" with the
      // last whitespace-separated token as the amount.
      const lastSpace = text.lastIndexOf(' ')
      if (lastSpace > 0) {
        const name = text.slice(0, lastSpace).trim()
        const amount = Number(text.slice(lastSpace + 1).trim())
        if (name !== '' && Number.isFinite(amount) && amount > 0) {
          rows.push({ lineNumber, name, amount })
          const key = name.toLowerCase()
          if (seenNames.has(key)) duplicateNames.add(name)
          seenNames.set(key, lineNumber)
          return
        }
      }

      errors.push({ lineNumber, text })
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
// Priority 1: same robux_amount, but ONLY when it's unambiguous (exactly one
// existing gamepass at that amount) — this is what lets a rename survive
// ("VIP" -> "Premium VIP" at the same price still matches). If a game has
// MULTIPLE different gamepasses at the same price (e.g. "2x Luck" and
// "2x Speed" both at 100 R$, which is common), amount alone can't tell them
// apart — picking the first one found previously caused real data loss
// (silently overwriting an unrelated gamepass instead of creating the
// missing one). In that case, only an exact name match among the
// same-amount candidates counts; otherwise treat it as no match at all
// rather than guessing. Priority 2 (no amount match whatsoever): fall back
// to a name-only match.
export function findExistingGamepass(
  row: { name: string; robux_amount: number },
  existing: Gamepass[]
): Gamepass | null {
  const amountMatches = existing.filter(g => g.robux_amount === row.robux_amount)
  if (amountMatches.length === 1) return amountMatches[0]
  if (amountMatches.length > 1) {
    const byName = amountMatches.find(g => g.name.trim().toLowerCase() === row.name.trim().toLowerCase())
    return byName ?? null
  }
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

// ── Existing gamepass catalog import ────────────────────────────────────────
// Parses a real-world export that's richer than a flat price list: game-name
// rows act as section headers, a "ROBUX SELL" section (with "Covered tax" /
// "Not covered tax" sub-headers) holds generic Robux->Price tiers rather than
// named gamepasses, and individual cells can be Excel error strings
// (#VALUE!) or quoted text containing commas — proper CSV tokenizing is
// needed here (the flatter parsers above can get away with naive splitting,
// this one can't).

function parseCSVLine(line: string): string[] {
  const fields: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++ } else { inQuotes = false }
      } else {
        cur += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      fields.push(cur); cur = ''
    } else {
      cur += ch
    }
  }
  fields.push(cur)
  return fields.map(f => f.trim())
}

function toNumberOrNull(s: string | undefined): number | null {
  if (!s || s === '' || s.startsWith('#')) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

export interface ParsedCatalogGamepassRow {
  gameName: string
  name: string
  robux_amount: number
  your_price: number
  profit: number
}

export interface ParsedCatalogResult {
  tierRows: ParsedTierRow[]
  catalogRows: ParsedCatalogGamepassRow[]
}

export function parseGamepassCatalogCSV(raw: string, defaultGameName: string): ParsedCatalogResult {
  const lines = raw.split(/\r?\n/)
  const tierRows: ParsedTierRow[] = []
  const catalogRows: ParsedCatalogGamepassRow[] = []

  let currentGame = defaultGameName.trim() || 'Uncategorized'
  let inRobuxSell = false
  let taxCovered = true
  let currentRate = ROBUX_RATE
  let tierLineNumber = 0

  lines.forEach((line, idx) => {
    const lineNumber = idx + 1
    if (line.trim() === '') return
    if (lineNumber === 1 && line.toLowerCase().startsWith('robux amount,')) return

    const cols = parseCSVLine(line)
    const col1 = cols[0] ?? ''
    if (col1 === '') return

    const amount1 = toNumberOrNull(col1)

    if (amount1 === null) {
      const lower = col1.toLowerCase()
      if (lower === 'robux sell') { inRobuxSell = true; return }
      if (inRobuxSell && lower === 'covered tax') {
        taxCovered = true
        const rate = toNumberOrNull(cols[8])
        if (rate) currentRate = rate
        return
      }
      if (inRobuxSell && lower === 'not covered tax') { taxCovered = false; return }
      // Any other non-numeric first column is a new game section header.
      inRobuxSell = false
      currentGame = col1
      return
    }

    const col2 = toNumberOrNull(cols[1])
    const col3 = toNumberOrNull(cols[2])
    const col4 = toNumberOrNull(cols[3])
    const col5 = toNumberOrNull(cols[4])
    const col9 = toNumberOrNull(cols[8])
    if (col9 !== null) currentRate = col9

    if (inRobuxSell) {
      const robuxAmount = taxCovered ? (col2 ?? amount1) : amount1
      const price = col3 ?? 0
      const profit = col5 ?? (col4 !== null ? price - col4 : price - calculateCost(robuxAmount, currentRate))
      if (robuxAmount > 0) {
        tierLineNumber++
        tierRows.push({ lineNumber: tierLineNumber, robux_amount: robuxAmount, selling_price: price, profit })
      }
      return
    }

    const your_price = col3 ?? 0
    // Profit is taken as-is when the sheet has a valid number (it's the
    // operator's own trusted figure); only falls back to computing it from
    // cost-at-rate when the cell is blank or an Excel error string.
    const profit = col5 !== null ? col5 : your_price - calculateCost(amount1, currentRate)
    const rawName = (cols[7] ?? '').trim()
    const name = rawName !== '' ? rawName : `${amount1.toLocaleString()} Robux`
    catalogRows.push({ gameName: currentGame, name, robux_amount: amount1, your_price, profit })
  })

  // Last row wins on duplicate tier amounts within the same import.
  const tiersByAmount = new Map<number, ParsedTierRow>()
  for (const row of tierRows) tiersByAmount.set(row.robux_amount, row)

  return { tierRows: [...tiersByAmount.values()], catalogRows }
}
