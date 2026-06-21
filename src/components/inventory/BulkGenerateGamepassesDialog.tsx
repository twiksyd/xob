'use client'

import { useMemo, useState } from 'react'
import { Game, Gamepass, PricingEngineTier, GamepassGenerationPreset } from '@/lib/types/database'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { formatPHP } from '@/lib/utils/pricing'
import {
  parseGenerationInput, matchTier, findExistingGamepass, TierMatchStatus,
} from '@/lib/utils/pricingEngine'
import { X } from 'lucide-react'

type GamepassWithGame = Gamepass & { games: Game | null }

interface GeneratedRow {
  key: string
  name: string
  robux_amount: number
  price: number
  profit: number
  matchStatus: TierMatchStatus | 'copied'
  closestAmount?: number
  duplicate: Gamepass | null
  action: 'create' | 'skip' | 'update' | 'replace'
}

export interface SaveRow {
  action: 'create' | 'update' | 'replace'
  existingId?: string
  name: string
  robux_amount: number
  your_price: number
  profit: number
}

interface BulkGenerateGamepassesDialogProps {
  open: boolean
  onClose: () => void
  games: Game[]
  gamepasses: GamepassWithGame[]
  tiers: PricingEngineTier[]
  presets: GamepassGenerationPreset[]
  onCreateGame: (name: string) => Promise<string | null>
  onAddMissingTier: (amount: number, price: number, profit: number) => Promise<void>
  onSavePreset: (name: string, rawInput: string) => Promise<void>
  onSaveGamepasses: (gameId: string, rows: SaveRow[]) => Promise<void>
}

const MATCH_LABEL: Record<TierMatchStatus | 'copied', string> = {
  exact: '✓ Exact Match',
  closest: '⚠ Closest Match',
  none: '❌ No Match',
  copied: '↻ Copied',
}
const MATCH_COLOR: Record<TierMatchStatus | 'copied', string> = {
  exact: '#34d399',
  closest: '#f59e0b',
  none: '#f87171',
  copied: '#22d3ee',
}

export default function BulkGenerateGamepassesDialog({
  open, onClose, games, gamepasses, tiers, presets,
  onCreateGame, onAddMissingTier, onSavePreset, onSaveGamepasses,
}: BulkGenerateGamepassesDialogProps) {
  const [wasOpen, setWasOpen] = useState(open)
  const [targetGameId, setTargetGameId] = useState('')
  const [newGameName, setNewGameName] = useState('')
  const [mode, setMode] = useState<'pricingTable' | 'existingGame'>('pricingTable')
  const [pasteText, setPasteText] = useState('')
  const [presetNameInput, setPresetNameInput] = useState('')
  const [savingPreset, setSavingPreset] = useState(false)
  const [copyFromGameId, setCopyFromGameId] = useState('')
  const [generatedRows, setGeneratedRows] = useState<GeneratedRow[]>([])
  const [parseErrors, setParseErrors] = useState<{ lineNumber: number; text: string }[]>([])
  const [duplicateNames, setDuplicateNames] = useState<string[]>([])
  const [missingTierInputs, setMissingTierInputs] = useState<Record<number, { price: string; profit: string }>>({})
  const [saving, setSaving] = useState(false)

  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setTargetGameId(''); setNewGameName(''); setMode('pricingTable'); setPasteText('')
      setPresetNameInput(''); setCopyFromGameId(''); setGeneratedRows([])
      setParseErrors([]); setDuplicateNames([]); setMissingTierInputs({})
    }
  }

  const targetGamepasses = useMemo(() => gamepasses.filter(g => g.game_id === targetGameId), [gamepasses, targetGameId])

  function runGenerateFromPricingTable() {
    const { rows, errors, duplicateNames: dupes } = parseGenerationInput(pasteText)
    setParseErrors(errors)
    setDuplicateNames(dupes)
    setGeneratedRows(rows.map((r, i) => {
      const match = matchTier(r.amount, tiers)
      const dup = findExistingGamepass({ name: r.name, robux_amount: r.amount }, targetGamepasses)
      return {
        key: `gen-${r.lineNumber}-${i}`,
        name: r.name,
        robux_amount: r.amount,
        price: match.tier?.selling_price ?? 0,
        profit: match.tier?.profit ?? 0,
        matchStatus: match.status,
        closestAmount: match.status === 'closest' ? match.tier?.robux_amount : undefined,
        duplicate: dup,
        action: dup ? 'update' : 'create',
      }
    }))
  }

  function runLoadFromExistingGame() {
    const sourceGamepasses = gamepasses.filter(g => g.game_id === copyFromGameId)
    setParseErrors([])
    setDuplicateNames([])
    setGeneratedRows(sourceGamepasses.map(g => {
      const dup = findExistingGamepass({ name: g.name, robux_amount: g.robux_amount }, targetGamepasses)
      return {
        key: `copy-${g.id}`,
        name: g.name,
        robux_amount: g.robux_amount,
        price: g.your_price,
        profit: g.profit,
        matchStatus: 'copied' as const,
        duplicate: dup,
        action: dup ? 'update' : 'create',
      }
    }))
  }

  const missingAmounts = useMemo(() => {
    if (mode !== 'pricingTable') return []
    const amounts = new Set<number>()
    for (const row of generatedRows) {
      if (row.matchStatus === 'closest' || row.matchStatus === 'none') amounts.add(row.robux_amount)
    }
    return [...amounts].sort((a, b) => a - b)
  }, [generatedRows, mode])

  async function handleAddMissingTier(amount: number) {
    const input = missingTierInputs[amount]
    const price = Number(input?.price)
    const profit = Number(input?.profit)
    if (!(price >= 0) || !Number.isFinite(profit)) return
    await onAddMissingTier(amount, price, profit)
    setGeneratedRows(prev => prev.map(r => r.robux_amount === amount
      ? { ...r, matchStatus: 'exact', price, profit, closestAmount: undefined }
      : r))
    setMissingTierInputs(prev => { const next = { ...prev }; delete next[amount]; return next })
  }

  async function handleSavePreset() {
    if (!presetNameInput.trim() || !pasteText.trim()) return
    setSavingPreset(true)
    await onSavePreset(presetNameInput.trim(), pasteText)
    setSavingPreset(false)
    setPresetNameInput('')
  }

  function updateRow(key: string, patch: Partial<GeneratedRow>) {
    setGeneratedRows(prev => prev.map(r => r.key === key ? { ...r, ...patch } : r))
  }
  function removeRow(key: string) {
    setGeneratedRows(prev => prev.filter(r => r.key !== key))
  }
  function applyBulkAction(action: 'update' | 'skip' | 'replace') {
    setGeneratedRows(prev => prev.map(r => r.duplicate ? { ...r, action } : r))
  }

  const summary = useMemo(() => {
    const active = generatedRows.filter(r => r.action !== 'skip')
    return {
      count: active.length,
      totalPrice: active.reduce((s, r) => s + r.price, 0),
      totalProfit: active.reduce((s, r) => s + r.profit, 0),
      exact: generatedRows.filter(r => r.matchStatus === 'exact' || r.matchStatus === 'copied').length,
      closest: generatedRows.filter(r => r.matchStatus === 'closest').length,
      none: generatedRows.filter(r => r.matchStatus === 'none').length,
    }
  }, [generatedRows])

  const duplicateCount = generatedRows.filter(r => r.duplicate).length

  async function handleSaveAll() {
    let gameId = targetGameId
    if (!gameId && newGameName.trim()) {
      gameId = await onCreateGame(newGameName.trim()) ?? ''
    }
    if (!gameId) return
    const rows: SaveRow[] = generatedRows
      .filter((r): r is GeneratedRow & { action: 'create' | 'update' | 'replace' } => r.action !== 'skip')
      .map(r => ({
        action: r.action,
        existingId: r.duplicate?.id,
        name: r.name,
        robux_amount: r.robux_amount,
        your_price: r.price,
        profit: r.profit,
      }))
    if (rows.length === 0) return
    setSaving(true)
    await onSaveGamepasses(gameId, rows)
    setSaving(false)
    onClose()
  }

  const canGenerate = mode === 'pricingTable' ? pasteText.trim() !== '' : copyFromGameId !== ''
  const canSave = (targetGameId || newGameName.trim()) && generatedRows.some(r => r.action !== 'skip')

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bulk Generate Gamepasses</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Create For */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Create For</Label>
              <Select value={targetGameId} onValueChange={v => setTargetGameId(v ?? '')}>
                <SelectTrigger className="bg-input"><SelectValue placeholder="Select game…" /></SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {games.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">or New Game</Label>
              <Input value={newGameName} onChange={e => { setNewGameName(e.target.value); if (e.target.value) setTargetGameId('') }} placeholder="e.g. Grow A Garden" className="bg-input" />
            </div>
          </div>

          {/* Create From */}
          <div className="space-y-1.5">
            <Label className="text-xs">Create From</Label>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 text-[12px] cursor-pointer">
                <input type="radio" checked={mode === 'pricingTable'} onChange={() => setMode('pricingTable')} className="accent-violet-500" />
                Pricing Table
              </label>
              <label className="flex items-center gap-1.5 text-[12px] cursor-pointer">
                <input type="radio" checked={mode === 'existingGame'} onChange={() => setMode('existingGame')} className="accent-violet-500" />
                Existing Game
              </label>
            </div>
          </div>

          {mode === 'pricingTable' ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Paste list (Name | Amount)</Label>
                {presets.length > 0 && (
                  <Select value="" onValueChange={v => { const p = presets.find(p => p.id === v); if (p) setPasteText(p.raw_input) }}>
                    <SelectTrigger className="bg-input h-7 w-44 text-[11px]"><SelectValue placeholder="Load preset…" /></SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      {presets.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <Textarea value={pasteText} onChange={e => setPasteText(e.target.value)} rows={6} placeholder={'VIP | 100\nPremium | 250\nLegendary | 750\nUltimate | 1000'} className="bg-input resize-none font-mono text-[12px]" />
              <div className="flex items-center gap-2">
                <Input value={presetNameInput} onChange={e => setPresetNameInput(e.target.value)} placeholder="Preset name to save this list as…" className="bg-input h-8 text-[12px]" />
                <Button type="button" variant="outline" size="sm" disabled={!presetNameInput.trim() || !pasteText.trim() || savingPreset} onClick={handleSavePreset}>
                  {savingPreset ? 'Saving…' : 'Save Preset'}
                </Button>
              </div>
              {parseErrors.length > 0 && (
                <p className="text-[11px] font-semibold" style={{ color: '#f87171' }}>
                  Could not parse line{parseErrors.length !== 1 ? 's' : ''}: {parseErrors.map(e => e.lineNumber).join(', ')} — fix before generating.
                </p>
              )}
              {duplicateNames.length > 0 && (
                <p className="text-[11px] font-semibold" style={{ color: '#f59e0b' }}>
                  Duplicate name{duplicateNames.length !== 1 ? 's' : ''} in this list: {duplicateNames.join(', ')}
                </p>
              )}
              <Button type="button" onClick={runGenerateFromPricingTable} disabled={!canGenerate} className="btn-primary">
                Generate
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Label className="text-xs">Copy From</Label>
              <div className="flex items-center gap-2">
                <Select value={copyFromGameId} onValueChange={v => setCopyFromGameId(v ?? '')}>
                  <SelectTrigger className="bg-input flex-1"><SelectValue placeholder="Select source game…" /></SelectTrigger>
                  <SelectContent className="bg-popover border-border">
                    {games.filter(g => g.id !== targetGameId).map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button type="button" onClick={runLoadFromExistingGame} disabled={!canGenerate} className="btn-primary flex-shrink-0">
                  Load Passes
                </Button>
              </div>
            </div>
          )}

          {/* Missing Pricing Tiers */}
          {missingAmounts.length > 0 && (
            <div className="rounded-xl p-3 space-y-2" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.18)' }}>
              <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: '#f59e0b' }}>Missing Pricing Tiers</p>
              {missingAmounts.map(amount => (
                <div key={amount} className="flex items-center gap-2">
                  <span className="text-[12px] font-semibold w-24 flex-shrink-0" style={{ color: 'rgba(255,255,255,0.78)' }}>{amount.toLocaleString()} R$</span>
                  <Input
                    type="number" step="0.01" placeholder="Price"
                    value={missingTierInputs[amount]?.price ?? ''}
                    onChange={e => setMissingTierInputs(prev => ({ ...prev, [amount]: { price: e.target.value, profit: prev[amount]?.profit ?? '' } }))}
                    className="bg-input h-8 w-24 text-[12px]"
                  />
                  <Input
                    type="number" step="0.01" placeholder="Profit"
                    value={missingTierInputs[amount]?.profit ?? ''}
                    onChange={e => setMissingTierInputs(prev => ({ ...prev, [amount]: { price: prev[amount]?.price ?? '', profit: e.target.value } }))}
                    className="bg-input h-8 w-24 text-[12px]"
                  />
                  <Button type="button" size="sm" variant="outline" onClick={() => handleAddMissingTier(amount)}>
                    Add to Master Table
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Review table */}
          {generatedRows.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Review ({generatedRows.length})</Label>
                {duplicateCount > 0 && (
                  <div className="flex items-center gap-1.5 text-[11px]" style={{ color: 'rgba(255,255,255,0.50)' }}>
                    Apply to all {duplicateCount} duplicate{duplicateCount !== 1 ? 's' : ''}:
                    <button type="button" onClick={() => applyBulkAction('skip')} className="underline">Skip</button>
                    <button type="button" onClick={() => applyBulkAction('update')} className="underline">Update</button>
                    <button type="button" onClick={() => applyBulkAction('replace')} className="underline">Replace</button>
                  </div>
                )}
              </div>
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.090)' }}>
                <table className="w-full text-[12px]">
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.045)' }}>
                      <th className="text-left px-2 py-2 font-semibold" style={{ color: 'rgba(255,255,255,0.50)' }}>Name</th>
                      <th className="text-right px-2 py-2 font-semibold" style={{ color: 'rgba(255,255,255,0.50)' }}>Robux</th>
                      <th className="text-right px-2 py-2 font-semibold" style={{ color: 'rgba(255,255,255,0.50)' }}>Price</th>
                      <th className="text-right px-2 py-2 font-semibold" style={{ color: 'rgba(255,255,255,0.50)' }}>Profit</th>
                      <th className="text-left px-2 py-2 font-semibold" style={{ color: 'rgba(255,255,255,0.50)' }}>Match</th>
                      <th className="text-left px-2 py-2 font-semibold" style={{ color: 'rgba(255,255,255,0.50)' }}>Duplicate</th>
                      <th className="w-6" />
                    </tr>
                  </thead>
                  <tbody>
                    {generatedRows.map(row => (
                      <tr key={row.key} style={{ borderTop: '1px solid rgba(255,255,255,0.060)', opacity: row.action === 'skip' ? 0.4 : 1 }}>
                        <td className="px-2 py-1.5">
                          <input value={row.name} onChange={e => updateRow(row.key, { name: e.target.value })} className="w-full bg-transparent font-semibold" style={{ color: 'rgba(255,255,255,0.85)' }} />
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          <input type="number" value={row.robux_amount} onChange={e => updateRow(row.key, { robux_amount: Number(e.target.value) })} className="w-16 bg-transparent text-right" />
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          <input type="number" step="0.01" value={row.price} onChange={e => updateRow(row.key, { price: Number(e.target.value) })} className="w-16 bg-transparent text-right" />
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          <input type="number" step="0.01" value={row.profit} onChange={e => updateRow(row.key, { profit: Number(e.target.value) })} className="w-16 bg-transparent text-right" style={{ color: '#34d399' }} />
                        </td>
                        <td className="px-2 py-1.5">
                          <span style={{ color: MATCH_COLOR[row.matchStatus] }}>
                            {MATCH_LABEL[row.matchStatus]}{row.closestAmount ? ` (${row.closestAmount})` : ''}
                          </span>
                        </td>
                        <td className="px-2 py-1.5">
                          {row.duplicate ? (
                            <div className="space-y-1">
                              <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.44)' }}>
                                &ldquo;{row.duplicate.name}&rdquo; · {formatPHP(row.duplicate.your_price)} / {formatPHP(row.duplicate.profit)}
                              </p>
                              <select
                                value={row.action}
                                onChange={e => updateRow(row.key, { action: e.target.value as GeneratedRow['action'] })}
                                className="bg-input rounded px-1.5 py-0.5 text-[11px]"
                              >
                                <option value="skip">Skip</option>
                                <option value="update">Update Existing</option>
                                <option value="replace">Replace</option>
                              </select>
                            </div>
                          ) : (
                            <span style={{ color: 'rgba(255,255,255,0.35)' }}>New</span>
                          )}
                        </td>
                        <td className="px-2 py-1.5">
                          <button type="button" onClick={() => removeRow(row.key)} style={{ color: 'rgba(255,255,255,0.40)' }}>
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Profit Impact Preview */}
              <div className="rounded-xl p-3 space-y-1" style={{ background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.18)' }}>
                <p className="text-[12px] font-bold" style={{ color: 'rgba(255,255,255,0.82)' }}>
                  {summary.count} Gamepass{summary.count !== 1 ? 'es' : ''} · Total Listed Value: {formatPHP(summary.totalPrice)} · Expected Profit: {formatPHP(summary.totalProfit)}
                </p>
                <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.55)' }}>
                  ✓ {summary.exact} Exact / Copied · ⚠ {summary.closest} Closest · ❌ {summary.none} Missing
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSaveAll} disabled={!canSave || saving} className="btn-primary">
            {saving ? 'Saving…' : 'Save All Gamepasses'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
