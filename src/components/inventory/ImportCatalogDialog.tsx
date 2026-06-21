'use client'

import { useMemo, useRef, useState } from 'react'
import { Game, Gamepass, PricingEngineTier } from '@/lib/types/database'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatPHP } from '@/lib/utils/pricing'
import {
  parseGamepassCatalogCSV, diffPricingTiers, findExistingGamepass, TierDiffRow,
} from '@/lib/utils/pricingEngine'
import { ChevronDown, ChevronRight, X } from 'lucide-react'

type GamepassWithGame = Gamepass & { games: Game | null }

interface CatalogReviewRow {
  key: string
  gameName: string
  name: string
  robux_amount: number
  your_price: number
  profit: number
  duplicate: Gamepass | null
  action: 'create' | 'skip' | 'update' | 'replace'
}

export interface CatalogImportTierRow {
  robux_amount: number
  selling_price: number
  profit: number
}

export interface CatalogImportGamepassRow {
  gameName: string
  action: 'create' | 'skip' | 'update' | 'replace'
  existingId?: string
  name: string
  robux_amount: number
  your_price: number
  profit: number
}

interface ImportCatalogDialogProps {
  open: boolean
  onClose: () => void
  games: Game[]
  gamepasses: GamepassWithGame[]
  tiers: PricingEngineTier[]
  onImport: (tierRows: CatalogImportTierRow[], gamepassRows: CatalogImportGamepassRow[]) => Promise<void>
}

export default function ImportCatalogDialog({ open, onClose, games, gamepasses, tiers, onImport }: ImportCatalogDialogProps) {
  const [wasOpen, setWasOpen] = useState(open)
  const [defaultGameName, setDefaultGameName] = useState('')
  const [tierDiffRows, setTierDiffRows] = useState<TierDiffRow[]>([])
  const [catalogRows, setCatalogRows] = useState<CatalogReviewRow[]>([])
  const [excludedTierAmounts, setExcludedTierAmounts] = useState<Set<number>>(new Set())
  const [collapsedGames, setCollapsedGames] = useState<Set<string>>(new Set())
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setDefaultGameName(''); setTierDiffRows([]); setCatalogRows([])
      setExcludedTierAmounts(new Set()); setCollapsedGames(new Set())
    }
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result ?? '')
      const parsed = parseGamepassCatalogCSV(text, defaultGameName)
      setTierDiffRows(diffPricingTiers(parsed.tierRows, tiers))
      setExcludedTierAmounts(new Set())

      const gameByNameLower = new Map(games.map(g => [g.name.toLowerCase(), g]))
      setCatalogRows(parsed.catalogRows.map((row, i) => {
        const existingGame = gameByNameLower.get(row.gameName.toLowerCase())
        const existingGamepasses = existingGame ? gamepasses.filter(g => g.game_id === existingGame.id) : []
        const dup = findExistingGamepass({ name: row.name, robux_amount: row.robux_amount }, existingGamepasses)
        return {
          key: `cat-${i}`,
          gameName: row.gameName,
          name: row.name,
          robux_amount: row.robux_amount,
          your_price: row.your_price,
          profit: row.profit,
          duplicate: dup,
          action: dup ? 'update' as const : 'create' as const,
        }
      }))
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const groupedByGame = useMemo(() => {
    const order: string[] = []
    const map = new Map<string, CatalogReviewRow[]>()
    for (const row of catalogRows) {
      if (!map.has(row.gameName)) { map.set(row.gameName, []); order.push(row.gameName) }
      map.get(row.gameName)!.push(row)
    }
    return order.map(name => ({ name, rows: map.get(name)! }))
  }, [catalogRows])

  function updateRow(key: string, patch: Partial<CatalogReviewRow>) {
    setCatalogRows(prev => prev.map(r => r.key === key ? { ...r, ...patch } : r))
  }
  function removeRow(key: string) {
    setCatalogRows(prev => prev.filter(r => r.key !== key))
  }
  function toggleGame(name: string) {
    setCollapsedGames(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name); else next.add(name)
      return next
    })
  }

  const changedTierCount = tierDiffRows.filter(r => r.kind !== 'unchanged').length
  const activeCatalogCount = catalogRows.filter(r => r.action !== 'skip').length

  async function handleImport() {
    const tierRows: CatalogImportTierRow[] = tierDiffRows
      .filter(r => r.kind !== 'unchanged' && !excludedTierAmounts.has(r.robux_amount))
      .map(r => ({ robux_amount: r.robux_amount, selling_price: r.selling_price, profit: r.profit }))
    const gamepassRows: CatalogImportGamepassRow[] = catalogRows
      .filter(r => r.action !== 'skip')
      .map(r => ({
        gameName: r.gameName, action: r.action as 'create' | 'update' | 'replace', existingId: r.duplicate?.id,
        name: r.name, robux_amount: r.robux_amount, your_price: r.your_price, profit: r.profit,
      }))
    if (tierRows.length === 0 && gamepassRows.length === 0) return
    setImporting(true)
    await onImport(tierRows, gamepassRows)
    setImporting(false)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Existing Gamepass Catalog</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-[12px]" style={{ color: 'rgba(255,255,255,0.50)' }}>
            For a full spreadsheet export with game-name section headers and a &ldquo;ROBUX SELL&rdquo; tier list mixed in — not just a flat price table. Nothing is created until you review and click Import below.
          </p>

          <div className="space-y-1.5">
            <Label className="text-xs">Default game (for any rows before the first section header)</Label>
            <Input value={defaultGameName} onChange={e => setDefaultGameName(e.target.value)} placeholder="e.g. Slime rng" className="bg-input" />
          </div>

          <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
            Choose CSV File
          </Button>
          <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />

          {tierDiffRows.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs">Master Pricing Tiers — {changedTierCount} new/changed</Label>
              <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.090)' }}>
                <table className="w-full text-[12px]">
                  <thead>
                    <tr style={{ background: 'rgba(255,255,255,0.045)' }}>
                      <th className="w-8" />
                      <th className="text-left px-2 py-1.5">Robux</th>
                      <th className="text-right px-2 py-1.5">Price</th>
                      <th className="text-right px-2 py-1.5">Profit</th>
                      <th className="text-center px-2 py-1.5">Kind</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tierDiffRows.filter(r => r.kind !== 'unchanged').map(row => {
                      const excluded = excludedTierAmounts.has(row.robux_amount)
                      return (
                        <tr key={row.robux_amount} style={{ borderTop: '1px solid rgba(255,255,255,0.060)', opacity: excluded ? 0.35 : 1 }}>
                          <td className="px-2 py-1">
                            <input
                              type="checkbox" checked={!excluded}
                              onChange={() => setExcludedTierAmounts(prev => { const n = new Set(prev); if (n.has(row.robux_amount)) n.delete(row.robux_amount); else n.add(row.robux_amount); return n })}
                              className="w-3.5 h-3.5 accent-violet-500"
                            />
                          </td>
                          <td className="px-2 py-1 text-left font-semibold">{row.robux_amount.toLocaleString()} R$</td>
                          <td className="px-2 py-1 text-right">{formatPHP(row.selling_price)}</td>
                          <td className="px-2 py-1 text-right" style={{ color: '#34d399' }}>{formatPHP(row.profit)}</td>
                          <td className="px-2 py-1 text-center text-[10px] font-bold uppercase" style={{ color: row.kind === 'new' ? '#22d3ee' : '#f59e0b' }}>{row.kind}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {groupedByGame.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs">Gamepass Catalog — {groupedByGame.length} games, {activeCatalogCount} passes</Label>
              {groupedByGame.map(({ name, rows }) => {
                const collapsed = collapsedGames.has(name)
                const gameExists = games.some(g => g.name.toLowerCase() === name.toLowerCase())
                return (
                  <div key={name} className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.090)' }}>
                    <button
                      type="button"
                      onClick={() => toggleGame(name)}
                      className="w-full flex items-center justify-between px-3 py-2"
                      style={{ background: 'rgba(255,255,255,0.045)' }}
                    >
                      <span className="flex items-center gap-1.5 text-[12px] font-bold" style={{ color: 'rgba(255,255,255,0.85)' }}>
                        {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        {name}
                        <span className="text-[10px] font-semibold" style={{ color: gameExists ? 'rgba(255,255,255,0.40)' : '#22d3ee' }}>
                          {gameExists ? '(existing game)' : '(new game)'}
                        </span>
                      </span>
                      <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.44)' }}>{rows.length} passes</span>
                    </button>
                    {!collapsed && (
                      <table className="w-full text-[12px]">
                        <thead>
                          <tr style={{ background: 'rgba(255,255,255,0.025)' }}>
                            <th className="text-left px-2 py-1.5" style={{ color: 'rgba(255,255,255,0.50)' }}>Name</th>
                            <th className="text-right px-2 py-1.5" style={{ color: 'rgba(255,255,255,0.50)' }}>Robux</th>
                            <th className="text-right px-2 py-1.5" style={{ color: 'rgba(255,255,255,0.50)' }}>Price</th>
                            <th className="text-right px-2 py-1.5" style={{ color: 'rgba(255,255,255,0.50)' }}>Profit</th>
                            <th className="text-left px-2 py-1.5" style={{ color: 'rgba(255,255,255,0.50)' }}>Duplicate</th>
                            <th className="w-6" />
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map(row => (
                            <tr key={row.key} style={{ borderTop: '1px solid rgba(255,255,255,0.060)', opacity: row.action === 'skip' ? 0.4 : 1 }}>
                              <td className="px-2 py-1">
                                <input value={row.name} onChange={e => updateRow(row.key, { name: e.target.value })} className="w-full bg-transparent" style={{ color: 'rgba(255,255,255,0.85)' }} />
                              </td>
                              <td className="px-2 py-1 text-right">
                                <input type="number" value={row.robux_amount} onChange={e => updateRow(row.key, { robux_amount: Number(e.target.value) })} className="w-16 bg-transparent text-right" />
                              </td>
                              <td className="px-2 py-1 text-right">
                                <input type="number" step="0.01" value={row.your_price} onChange={e => updateRow(row.key, { your_price: Number(e.target.value) })} className="w-16 bg-transparent text-right" />
                              </td>
                              <td className="px-2 py-1 text-right">
                                <input type="number" step="0.01" value={row.profit} onChange={e => updateRow(row.key, { profit: Number(e.target.value) })} className="w-16 bg-transparent text-right" style={{ color: '#34d399' }} />
                              </td>
                              <td className="px-2 py-1">
                                {row.duplicate ? (
                                  <select
                                    value={row.action}
                                    onChange={e => updateRow(row.key, { action: e.target.value as CatalogReviewRow['action'] })}
                                    className="bg-input rounded px-1 py-0.5 text-[11px]"
                                  >
                                    <option value="skip">Skip</option>
                                    <option value="update">Update</option>
                                    <option value="replace">Replace</option>
                                  </select>
                                ) : (
                                  <span style={{ color: 'rgba(255,255,255,0.35)' }}>New</span>
                                )}
                              </td>
                              <td className="px-2 py-1">
                                <button type="button" onClick={() => removeRow(row.key)} style={{ color: 'rgba(255,255,255,0.40)' }}>
                                  <X className="w-3 h-3" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={importing}>Cancel</Button>
          <Button onClick={handleImport} disabled={importing || (tierDiffRows.length === 0 && catalogRows.length === 0)} className="btn-primary">
            {importing ? 'Importing…' : `Import (${activeCatalogCount} passes${changedTierCount > 0 ? ` + ${changedTierCount} tiers` : ''})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
