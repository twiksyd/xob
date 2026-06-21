// Generates a DELETE-only script and an INSERT-only script, scoped to just
// the games listed below, reusing the same validated parse of
// scripts/original-catalog.csv (same logic as restore-catalog.mjs).
//
// Run: node scripts/restore-subset.mjs

import { readFileSync, writeFileSync } from 'fs'

const TARGET_GAMES = [
  'KICK A LUCKY BLOCK (done)',
  'anime vanguards (top 1)',
  're:rangers X',
  'survive the apocalypse',
  'catch and tame',
  'drag simulator',
  'Wizard Alchemy',
  'Strongest Battlegrounds',
  'EVADE',
  'Anime Warriors III',
  'Anime Fighting Simulator Endless',
  'CDID',
]

const ROBUX_RATE = 240

function calculateCost(robuxAmount, rate = ROBUX_RATE) {
  return (robuxAmount / 1000) * rate
}
function calculateStatus(profit) {
  if (profit >= 20) return 'Good'
  if (profit >= 5) return 'Okay'
  return 'Bad'
}

function parseCSVLine(line) {
  const fields = []
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

function toNumberOrNull(s) {
  if (!s || s === '' || s.startsWith('#')) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

function parseGamepassCatalogCSV(raw, defaultGameName) {
  const lines = raw.split(/\r?\n/)
  const catalogRows = []

  let currentGame = defaultGameName.trim() || 'Uncategorized'
  let inRobuxSell = false
  let taxCovered = true
  let currentRate = ROBUX_RATE

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
      inRobuxSell = false
      currentGame = col1
      return
    }

    const col3 = toNumberOrNull(cols[2])
    const col5 = toNumberOrNull(cols[4])
    const col9 = toNumberOrNull(cols[8])
    if (col9 !== null) currentRate = col9

    if (inRobuxSell) return // not needed for this subset

    const your_price = col3 ?? 0
    const profit = col5 !== null ? col5 : your_price - calculateCost(amount1, currentRate)
    const rawName = (cols[7] ?? '').trim()
    const name = rawName !== '' ? rawName : `${amount1.toLocaleString()} Robux`
    catalogRows.push({ gameName: currentGame, name, robux_amount: amount1, your_price, profit })
  })

  return catalogRows
}

function computeGamepassFieldsFromProfit(robuxAmount, yourPrice, profit) {
  const your_cost = yourPrice - profit
  const robux_rate = robuxAmount > 0 ? (your_cost / robuxAmount) * 1000 : ROBUX_RATE
  const status = calculateStatus(profit)
  return { your_cost, robux_rate, status }
}

function sqlString(s) {
  return `'${String(s).replace(/'/g, "''")}'`
}

// ── Run ──────────────────────────────────────────────────────────────────
const raw = readFileSync(new URL('./original-catalog.csv', import.meta.url), 'utf8')
const allRows = parseGamepassCatalogCSV(raw, 'Slime rng')
const rows = allRows.filter(r => TARGET_GAMES.includes(r.gameName))

// Step 1: delete-only
let deleteSql = `-- ─────────────────────────────────────────────────────────────────────────────
-- Step 1 of 2 — delete current gamepasses for just these 12 games.
-- Run this first. Run restore-subset-insert.sql right after.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT user_id INTO v_user_id FROM public.games LIMIT 1;
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'No existing games row found to infer user_id from'; END IF;

  DELETE FROM public.gamepasses
  WHERE user_id = v_user_id
    AND game_id IN (
      SELECT id FROM public.games WHERE user_id = v_user_id AND name IN (
${TARGET_GAMES.map(n => `        ${sqlString(n)}`).join(',\n')}
      )
    );
END $$;
`
writeFileSync(new URL('./restore-subset-delete.sql', import.meta.url), deleteSql, 'utf8')

// Step 2: insert-only (ensures games exist first, since some may not yet)
let insertSql = `-- ─────────────────────────────────────────────────────────────────────────────
-- Step 2 of 2 — recreate gamepasses for these 12 games from the original
-- sheet. Run AFTER restore-subset-delete.sql.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT user_id INTO v_user_id FROM public.games LIMIT 1;
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'No existing games row found to infer user_id from'; END IF;

`
for (const name of TARGET_GAMES) {
  insertSql += `  INSERT INTO public.games (user_id, name)\n`
  insertSql += `  SELECT v_user_id, ${sqlString(name)}\n`
  insertSql += `  WHERE NOT EXISTS (SELECT 1 FROM public.games WHERE user_id = v_user_id AND name = ${sqlString(name)});\n\n`
}

insertSql += `  INSERT INTO public.gamepasses (user_id, game_id, name, robux_amount, your_price, your_cost, robux_rate, profit, status, suggested_lower_price, competitor_price, is_active)\n  VALUES\n`
const valueLines = rows.map(row => {
  const fields = computeGamepassFieldsFromProfit(row.robux_amount, row.your_price, row.profit)
  return `    (v_user_id, (SELECT id FROM public.games WHERE user_id = v_user_id AND name = ${sqlString(row.gameName)}), ${sqlString(row.name)}, ${row.robux_amount}, ${row.your_price}, ${fields.your_cost.toFixed(4)}, ${fields.robux_rate.toFixed(4)}, ${row.profit}, ${sqlString(fields.status)}, 0, 0, true)`
})
insertSql += valueLines.join(',\n')
insertSql += `;\n\nEND $$;\n`

writeFileSync(new URL('./restore-subset-insert.sql', import.meta.url), insertSql, 'utf8')

console.log(`${rows.length} rows across ${TARGET_GAMES.length} games.`)
console.log('Wrote restore-subset-delete.sql and restore-subset-insert.sql')
