'use client'
export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import TopBar from '@/components/shared/TopBar'
import PageHero from '@/components/shared/PageHero'
import EmptyState from '@/components/shared/EmptyState'
import CountUp from '@/components/shared/CountUp'
import { SkeletonTable } from '@/components/shared/Skeleton'
import { useToast } from '@/components/shared/Toast'
import { useConfirm } from '@/components/shared/ConfirmDialog'
import { createClient } from '@/lib/supabase/client'
import { PricingEngineTier } from '@/lib/types/database'
import { formatPHP } from '@/lib/utils/pricing'
import { parsePricingTierCSV, diffPricingTiers, TierDiffRow } from '@/lib/utils/pricingEngine'
import { cardStagger, cardStaggerItem } from '@/lib/motion'
import { Plus, Trash2, Pencil, Check, X, Calculator } from 'lucide-react'

function SectionLabel({ index, label }: { index: string; label: string }) {
  return (
    <motion.div
      className="flex items-center gap-3"
      initial={{ opacity: 0, x: -16 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, amount: 0.6 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <span className="text-[10px] font-black tracking-[0.12em] uppercase" style={{ color: 'rgba(255,255,255,0.20)' }}>§ {index}</span>
      <span style={{ width: 24, height: 1, background: 'rgba(255,255,255,0.12)', display: 'inline-block', flexShrink: 0 }} />
      <span className="label-caps">{label}</span>
    </motion.div>
  )
}

export default function PricingEnginePage() {
  const [tiers, setTiers] = useState<PricingEngineTier[]>([])
  const [loading, setLoading] = useState(true)
  const [importErrors, setImportErrors] = useState<{ lineNumber: number; text: string }[]>([])
  const [diffRows, setDiffRows] = useState<TierDiffRow[] | null>(null)
  const [excludedKeys, setExcludedKeys] = useState<Set<number>>(new Set())
  const [showUnchanged, setShowUnchanged] = useState(false)
  const [applying, setApplying] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editPrice, setEditPrice] = useState('')
  const [editProfit, setEditProfit] = useState('')
  const [newAmount, setNewAmount] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [newProfit, setNewProfit] = useState('')

  const fileInputRef = useRef<HTMLInputElement>(null)
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const toast = useToast()
  const confirm = useConfirm()

  const fetchData = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('pricing_engine_tiers').select('*').order('robux_amount', { ascending: true })
    if (!error && data) setTiers(data)
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchData() }, [fetchData])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result ?? '')
      const { rows, errors } = parsePricingTierCSV(text)
      setImportErrors(errors)
      setDiffRows(diffPricingTiers(rows, tiers))
      setExcludedKeys(new Set())
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const visibleDiffRows = useMemo(() => {
    if (!diffRows) return []
    return showUnchanged ? diffRows : diffRows.filter(r => r.kind !== 'unchanged')
  }, [diffRows, showUnchanged])

  const changeCount = useMemo(() => diffRows?.filter(r => r.kind !== 'unchanged').length ?? 0, [diffRows])

  const tierStats = useMemo(() => {
    if (tiers.length === 0) return { count: 0, avgPrice: 0, avgProfit: 0, highest: 0 }
    const avgPrice = tiers.reduce((s, t) => s + t.selling_price, 0) / tiers.length
    const avgProfit = tiers.reduce((s, t) => s + t.profit, 0) / tiers.length
    const highest = Math.max(...tiers.map(t => t.robux_amount))
    return { count: tiers.length, avgPrice, avgProfit, highest }
  }, [tiers])

  async function handleApplyImport() {
    if (!diffRows) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const toApply = diffRows.filter(r => r.kind !== 'unchanged' && !excludedKeys.has(r.robux_amount))
    if (toApply.length === 0) { toast.error('Nothing selected to apply.'); return }
    setApplying(true)
    const { error } = await supabase.from('pricing_engine_tiers').upsert(
      toApply.map(r => ({ user_id: user.id, robux_amount: r.robux_amount, selling_price: r.selling_price, profit: r.profit })),
      { onConflict: 'user_id,robux_amount' }
    )
    setApplying(false)
    if (error) { toast.error(error.message || 'Could not apply changes.'); return }
    toast.success(`Applied ${toApply.length} change${toApply.length !== 1 ? 's' : ''}.`)
    setDiffRows(null)
    setImportErrors([])
    fetchData()
  }

  async function handleAddRow() {
    const amount = Number(newAmount)
    const price = Number(newPrice)
    const profit = Number(newProfit)
    if (!(amount > 0) || !(price >= 0) || !Number.isFinite(profit)) { toast.error('Enter a valid amount, price, and profit.'); return }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from('pricing_engine_tiers').upsert(
      { user_id: user.id, robux_amount: amount, selling_price: price, profit },
      { onConflict: 'user_id,robux_amount' }
    )
    if (error) { toast.error(error.message || 'Could not add this tier.'); return }
    setNewAmount(''); setNewPrice(''); setNewProfit('')
    toast.success('Tier saved.')
    fetchData()
  }

  function startEdit(tier: PricingEngineTier) {
    setEditingId(tier.id)
    setEditPrice(String(tier.selling_price))
    setEditProfit(String(tier.profit))
  }

  async function saveEdit(tier: PricingEngineTier) {
    const price = Number(editPrice)
    const profit = Number(editProfit)
    if (!(price >= 0) || !Number.isFinite(profit)) { toast.error('Enter a valid price and profit.'); return }
    const { error } = await supabase.from('pricing_engine_tiers').update({ selling_price: price, profit, updated_at: new Date().toISOString() }).eq('id', tier.id)
    if (error) { toast.error(error.message || 'Could not save changes.'); return }
    setEditingId(null)
    fetchData()
  }

  async function handleDelete(tier: PricingEngineTier) {
    const ok = await confirm({
      title: `Delete the ${tier.robux_amount.toLocaleString()} R$ tier?`,
      description: 'This removes it from the master pricing table. Gamepasses already generated from it are unaffected.',
      confirmLabel: 'Delete Tier',
      danger: true,
    })
    if (!ok) return
    const { error } = await supabase.from('pricing_engine_tiers').delete().eq('id', tier.id)
    if (error) { toast.error(error.message || 'Could not delete this tier.'); return }
    toast.success('Tier deleted.')
    fetchData()
  }

  return (
    <div>
      <TopBar
        title="Pricing Engine"
        subtitle="Master pricing table for bulk gamepass generation"
        actionLabel="Import CSV"
        onActionClick={() => fileInputRef.current?.click()}
      />
      <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileChange} />
      <PageHero
        badge="Pricing Engine"
        title="Master Pricing Table"
        subtitle="Robux Amount → Selling Price → Profit. This is what Bulk Generate Gamepasses looks up when you create a new game's price list — managed here, generated from the Inventory page."
        gradient="linear-gradient(135deg, #a78bfa 0%, #22d3ee 60%, rgba(255,255,255,0.80) 100%)"
      />

      <div className="p-5 space-y-5">
        <SectionLabel index="01" label="Pricing Overview" />
        <motion.div
          className="grid grid-cols-2 sm:grid-cols-4 gap-3.5"
          variants={cardStagger}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, amount: 0.4 }}
        >
          {([
            { label: 'Total Tiers',    value: tierStats.count,    format: (v: number) => `${Math.round(v)}`, color: '#a78bfa', featured: true },
            { label: 'Avg. Price',     value: tierStats.avgPrice, format: (v: number) => formatPHP(v), color: '#22d3ee', featured: false },
            { label: 'Avg. Profit',    value: tierStats.avgProfit,format: (v: number) => formatPHP(v), color: '#34d399', featured: false },
            { label: 'Highest Tier',  value: tierStats.highest,  format: (v: number) => `${Math.round(v).toLocaleString()} R$`, color: '#f59e0b', featured: false },
          ] as const).map(({ label, value, format, color, featured }) => (
            <motion.div
              key={label}
              variants={cardStaggerItem}
              className="summary-card"
              style={featured
                ? { background: `rgba(255,255,255,0.052) padding-box, linear-gradient(135deg, ${color}55, rgba(34,211,238,0.24) 50%, rgba(232,121,249,0.16)) border-box`, border: '1px solid transparent', boxShadow: `0 0 28px ${color}22` }
                : { background: `rgba(255,255,255,0.038) padding-box, linear-gradient(135deg, ${color}38, rgba(34,211,238,0.14)) border-box`, border: '1px solid transparent' }}
            >
              <p className="label-caps mb-1">{label}</p>
              <CountUp
                value={loading ? 0 : value}
                format={format}
                duration={1.2}
                className="stat-value block"
                style={featured ? { color, fontSize: '34px', textShadow: `0 0 24px ${color}40, 0 0 48px ${color}18` } : { color }}
              />
            </motion.div>
          ))}
        </motion.div>

        {diffRows && (
          <>
            <SectionLabel index="02" label="Review Import" />
            {importErrors.length > 0 && (
              <p className="text-[12px] font-semibold" style={{ color: '#f87171' }}>
                {importErrors.length} row{importErrors.length !== 1 ? 's' : ''} skipped (could not parse): lines {importErrors.map(e => e.lineNumber).join(', ')}
              </p>
            )}
            <motion.div
              className="glass-card overflow-hidden"
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.082)' }}>
                <p className="text-[12px] font-semibold" style={{ color: 'rgba(255,255,255,0.70)' }}>
                  {changeCount} new/changed row{changeCount !== 1 ? 's' : ''}
                </p>
                <button type="button" onClick={() => setShowUnchanged(v => !v)} className="text-[11px] font-semibold underline" style={{ color: 'rgba(255,255,255,0.50)' }}>
                  {showUnchanged ? 'Hide unchanged' : 'Show unchanged'}
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full data-table">
                  <thead>
                    <tr>
                      <th className="w-8" />
                      <th className="text-left">Robux</th>
                      <th className="text-right">Old Price</th>
                      <th className="text-right">New Price</th>
                      <th className="text-right">Old Profit</th>
                      <th className="text-right">New Profit</th>
                      <th className="text-right">Diff</th>
                      <th className="text-center">Kind</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleDiffRows.map(row => {
                      const excluded = excludedKeys.has(row.robux_amount)
                      const diff = row.kind === 'changed' ? row.selling_price - (row.oldPrice ?? 0) : null
                      return (
                        <tr key={row.robux_amount} style={{ opacity: row.kind === 'unchanged' ? 0.4 : excluded ? 0.35 : 1 }}>
                          <td>
                            {row.kind !== 'unchanged' && (
                              <input
                                type="checkbox"
                                checked={!excluded}
                                onChange={() => setExcludedKeys(prev => {
                                  const next = new Set(prev)
                                  if (next.has(row.robux_amount)) next.delete(row.robux_amount)
                                  else next.add(row.robux_amount)
                                  return next
                                })}
                                className="w-4 h-4 accent-violet-500"
                              />
                            )}
                          </td>
                          <td className="text-left font-semibold">{row.robux_amount.toLocaleString()} R$</td>
                          <td className="text-right" style={{ color: 'rgba(255,255,255,0.44)' }}>{row.oldPrice != null ? formatPHP(row.oldPrice) : '—'}</td>
                          <td className="text-right font-bold">{formatPHP(row.selling_price)}</td>
                          <td className="text-right" style={{ color: 'rgba(255,255,255,0.44)' }}>{row.oldProfit != null ? formatPHP(row.oldProfit) : '—'}</td>
                          <td className="text-right font-bold" style={{ color: '#34d399' }}>{formatPHP(row.profit)}</td>
                          <td className="text-right" style={{ color: diff == null ? 'rgba(255,255,255,0.40)' : diff >= 0 ? '#34d399' : '#f87171' }}>
                            {diff == null ? '—' : `${diff >= 0 ? '+' : ''}${formatPHP(diff)}`}
                          </td>
                          <td className="text-center">
                            <span
                              className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full"
                              style={row.kind === 'new'
                                ? { background: 'rgba(34,211,238,0.12)', color: '#22d3ee', border: '1px solid rgba(34,211,238,0.28)' }
                                : { background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.28)' }}
                            >
                              {row.kind}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-end gap-2 px-4 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.082)' }}>
                <button type="button" onClick={() => { setDiffRows(null); setImportErrors([]) }} className="px-3 py-1.5 text-[12px] font-semibold rounded-lg" style={{ color: 'rgba(255,255,255,0.55)' }}>
                  Cancel
                </button>
                <button type="button" onClick={handleApplyImport} disabled={applying} className="btn-primary px-4 py-1.5 text-[12px]">
                  {applying ? 'Applying…' : 'Apply Changes'}
                </button>
              </div>
            </motion.div>
          </>
        )}

        <SectionLabel index={diffRows ? '03' : '02'} label="Pricing Tiers" />

        {loading ? (
          <SkeletonTable rows={6} cols={4} />
        ) : tiers.length === 0 ? (
          <EmptyState
            icon={Calculator}
            title="No pricing tiers yet"
            description="Import a CSV (Robux Amount, Selling Price, Profit) or add a row manually below."
            actionLabel="Import CSV"
            onAction={() => fileInputRef.current?.click()}
          />
        ) : (
          <motion.div
            className="glass-card overflow-hidden"
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="overflow-x-auto">
              <table className="w-full data-table">
                <thead>
                  <tr>
                    <th className="text-left">Robux</th>
                    <th className="text-right">Price</th>
                    <th className="text-right">Profit</th>
                    <th className="w-16" />
                  </tr>
                </thead>
                <tbody>
                  {tiers.map(tier => (
                    <tr key={tier.id} className="group">
                      <td className="text-left font-semibold">{tier.robux_amount.toLocaleString()} R$</td>
                      {editingId === tier.id ? (
                        <>
                          <td className="text-right">
                            <input type="number" step="0.01" value={editPrice} onChange={e => setEditPrice(e.target.value)} className="w-20 text-right bg-input rounded px-2 py-1 text-[12px]" />
                          </td>
                          <td className="text-right">
                            <input type="number" step="0.01" value={editProfit} onChange={e => setEditProfit(e.target.value)} className="w-20 text-right bg-input rounded px-2 py-1 text-[12px]" />
                          </td>
                          <td className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button type="button" onClick={() => saveEdit(tier)} style={{ color: '#34d399' }}><Check className="w-3.5 h-3.5" /></button>
                              <button type="button" onClick={() => setEditingId(null)} style={{ color: 'rgba(255,255,255,0.50)' }}><X className="w-3.5 h-3.5" /></button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="text-right font-bold">{formatPHP(tier.selling_price)}</td>
                          <td className="text-right font-bold" style={{ color: '#34d399' }}>{formatPHP(tier.profit)}</td>
                          <td>
                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button type="button" onClick={() => startEdit(tier)} style={{ color: 'rgba(255,255,255,0.55)' }}><Pencil className="w-3.5 h-3.5" /></button>
                              <button type="button" onClick={() => handleDelete(tier)} style={{ color: '#f87171' }}><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center gap-2 px-4 py-3" style={{ borderTop: '1px solid rgba(255,255,255,0.082)' }}>
              <input type="number" placeholder="Robux" value={newAmount} onChange={e => setNewAmount(e.target.value)} className="w-24 bg-input rounded-lg px-2.5 py-1.5 text-[12px]" />
              <input type="number" step="0.01" placeholder="Price" value={newPrice} onChange={e => setNewPrice(e.target.value)} className="w-24 bg-input rounded-lg px-2.5 py-1.5 text-[12px]" />
              <input type="number" step="0.01" placeholder="Profit" value={newProfit} onChange={e => setNewProfit(e.target.value)} className="w-24 bg-input rounded-lg px-2.5 py-1.5 text-[12px]" />
              <button type="button" onClick={handleAddRow} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-semibold" style={{ background: 'rgba(167,139,250,0.12)', color: '#a78bfa' }}>
                <Plus className="w-3.5 h-3.5" /> Add Tier
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
