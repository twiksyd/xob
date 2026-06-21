'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from 'react'
import { motion } from 'framer-motion'
import TopBar from '@/components/shared/TopBar'
import PageHero from '@/components/shared/PageHero'
import GamepassModal from '@/components/inventory/GamepassModal'
import BulkGenerateGamepassesDialog, { SaveRow } from '@/components/inventory/BulkGenerateGamepassesDialog'
import ImportCatalogDialog, { CatalogImportTierRow, CatalogImportGamepassRow } from '@/components/inventory/ImportCatalogDialog'
import StatusBadge from '@/components/shared/StatusBadge'
import CountUp from '@/components/shared/CountUp'
import { Gamepass, Game, RobloxAccount, PricingEngineTier, GamepassGenerationPreset } from '@/lib/types/database'
import { createClient } from '@/lib/supabase/client'
import { Package, SearchX, Sparkles } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Edit2, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { cardStagger, cardStaggerItem } from '@/lib/motion'
import { useToast } from '@/components/shared/Toast'
import { formatPHP, computeGamepassFieldsFromProfit } from '@/lib/utils/pricing'
import { useConfirm } from '@/components/shared/ConfirmDialog'
import { SkeletonTable } from '@/components/shared/Skeleton'
import EmptyState from '@/components/shared/EmptyState'
import { useUrlState } from '@/hooks/useUrlState'

type GamepassWithGame = Gamepass & { games: Game | null }

const STATUS_FILTERS = ['all', 'Good', 'Okay', 'Bad'] as const

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

function InventoryPageContent() {
  const [gamepasses, setGamepasses] = useState<GamepassWithGame[]>([])
  const [games, setGames] = useState<Game[]>([])
  const [accounts, setAccounts] = useState<RobloxAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editGamepass, setEditGamepass] = useState<Gamepass | null>(null)
  const [bulkGenerateOpen, setBulkGenerateOpen] = useState(false)
  const [importCatalogOpen, setImportCatalogOpen] = useState(false)
  const [pricingTiers, setPricingTiers] = useState<PricingEngineTier[]>([])
  const [generationPresets, setGenerationPresets] = useState<GamepassGenerationPreset[]>([])
  const [search, setSearch] = useState('')
  const [filterGame, setFilterGame] = useUrlState<string>('game', 'all')
  const [filterStatus, setFilterStatus] = useUrlState<typeof STATUS_FILTERS[number]>('status', 'all', STATUS_FILTERS)
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const toast = useToast()
  const confirm = useConfirm()

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [gpRes, gameRes, accRes, tiersRes, presetsRes] = await Promise.all([
      supabase.from('gamepasses').select('*, games(*)').order('created_at', { ascending: false }),
      supabase.from('games').select('*').order('name'),
      supabase.from('roblox_accounts').select('*').eq('status', 'active'),
      supabase.from('pricing_engine_tiers').select('*').order('robux_amount', { ascending: true }),
      supabase.from('gamepass_generation_presets').select('*').order('name', { ascending: true }),
    ])
    if (gpRes.data) setGamepasses(gpRes.data as GamepassWithGame[])
    if (gameRes.data) setGames(gameRes.data)
    if (accRes.data) setAccounts(accRes.data)
    if (tiersRes.data) setPricingTiers(tiersRes.data)
    if (presetsRes.data) setGenerationPresets(presetsRes.data)
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleSave(data: any) {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }
    const wasEdit = !!editGamepass
    if (editGamepass) {
      await supabase.from('gamepasses').update({ ...data, updated_at: new Date().toISOString() }).eq('id', editGamepass.id)
    } else {
      await supabase.from('gamepasses').insert({ ...data, user_id: user.id })
    }
    setSaving(false)
    setModalOpen(false)
    setEditGamepass(null)
    fetchData()
    toast.success(wasEdit ? 'Gamepass updated.' : 'Gamepass added.')
  }

  async function handleDelete(id: string) {
    const gamepass = gamepasses.find(gp => gp.id === id)
    const ok = await confirm({
      title: `Delete ${gamepass?.name ?? 'this gamepass'}?`,
      description: 'This permanently removes the gamepass from your catalog. Past orders referencing it are unaffected.',
      confirmLabel: 'Delete Gamepass',
      danger: true,
    })
    if (!ok) return
    await supabase.from('gamepasses').delete().eq('id', id)
    fetchData()
    toast.success('Gamepass deleted.')
  }

  // ── Pricing Engine / Bulk Generate Gamepasses ──────────────────────────────
  async function handleCreateGame(name: string): Promise<string | null> {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null
    const { data, error } = await supabase.from('games').insert({ user_id: user.id, name }).select('id').single()
    if (error || !data) { toast.error(error?.message || 'Could not create the game.'); return null }
    fetchData()
    return data.id
  }

  async function handleAddMissingTier(amount: number, price: number, profit: number) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from('pricing_engine_tiers').upsert(
      { user_id: user.id, robux_amount: amount, selling_price: price, profit },
      { onConflict: 'user_id,robux_amount' }
    )
    if (error) { toast.error(error.message || 'Could not add this tier.'); return }
    fetchData()
  }

  async function handleSaveGenerationPreset(name: string, rawInput: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from('gamepass_generation_presets').upsert(
      { user_id: user.id, name, raw_input: rawInput },
      { onConflict: 'user_id,name' }
    )
    if (error) { toast.error(error.message || 'Could not save the preset.'); return }
    toast.success('Preset saved.')
    fetchData()
  }

  // Update preserves everything not driven by the master tier lookup
  // (competitor price, suggested lower price, active flag); Replace resets
  // those to defaults — same distinction the design called for.
  async function handleBulkSaveGamepasses(gameId: string, rows: SaveRow[]) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    let created = 0, updated = 0, replaced = 0, failed = 0
    for (const row of rows) {
      const fields = computeGamepassFieldsFromProfit(row.robux_amount, row.your_price, row.profit, 0)
      if (row.action === 'create') {
        const { error } = await supabase.from('gamepasses').insert({
          user_id: user.id, game_id: gameId, name: row.name, robux_amount: row.robux_amount,
          your_price: row.your_price, your_cost: fields.your_cost, robux_rate: fields.robux_rate,
          profit: row.profit, status: fields.status, suggested_lower_price: fields.suggested_lower_price,
          competitor_price: 0, is_active: true,
        })
        if (error) failed++; else created++
      } else if (row.action === 'update' && row.existingId) {
        const { error } = await supabase.from('gamepasses').update({
          name: row.name, robux_amount: row.robux_amount, your_price: row.your_price, profit: row.profit,
          your_cost: fields.your_cost, robux_rate: fields.robux_rate, status: fields.status,
          updated_at: new Date().toISOString(),
        }).eq('id', row.existingId)
        if (error) failed++; else updated++
      } else if (row.action === 'replace' && row.existingId) {
        const { error } = await supabase.from('gamepasses').update({
          name: row.name, robux_amount: row.robux_amount, your_price: row.your_price, profit: row.profit,
          your_cost: fields.your_cost, robux_rate: fields.robux_rate, status: fields.status,
          competitor_price: 0, suggested_lower_price: fields.suggested_lower_price, is_active: true,
          updated_at: new Date().toISOString(),
        }).eq('id', row.existingId)
        if (error) failed++; else replaced++
      }
    }
    fetchData()
    const parts = [created && `${created} created`, updated && `${updated} updated`, replaced && `${replaced} replaced`, failed && `${failed} failed`].filter(Boolean)
    toast.success(parts.join(', ') || 'Nothing saved.')
  }

  // Catalog import — same Update/Replace semantics as Bulk Generate, but
  // spans multiple games at once: any game name in the import that doesn't
  // already exist gets created first, then every row resolves to its game.
  async function handleImportCatalog(tierRows: CatalogImportTierRow[], gamepassRows: CatalogImportGamepassRow[]) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const gameIdByName = new Map<string, string>(games.map(g => [g.name.toLowerCase(), g.id]))
    const neededNames = [...new Set(gamepassRows.map(r => r.gameName))]
    for (const name of neededNames) {
      if (gameIdByName.has(name.toLowerCase())) continue
      const { data, error } = await supabase.from('games').insert({ user_id: user.id, name }).select('id').single()
      if (!error && data) gameIdByName.set(name.toLowerCase(), data.id)
    }

    if (tierRows.length > 0) {
      await supabase.from('pricing_engine_tiers').upsert(
        tierRows.map(r => ({ user_id: user.id, robux_amount: r.robux_amount, selling_price: r.selling_price, profit: r.profit })),
        { onConflict: 'user_id,robux_amount' }
      )
    }

    let created = 0, updated = 0, replaced = 0, failed = 0
    for (const row of gamepassRows) {
      const gameId = gameIdByName.get(row.gameName.toLowerCase())
      if (!gameId) { failed++; continue }
      const fields = computeGamepassFieldsFromProfit(row.robux_amount, row.your_price, row.profit, 0)
      if (row.action === 'create') {
        const { error } = await supabase.from('gamepasses').insert({
          user_id: user.id, game_id: gameId, name: row.name, robux_amount: row.robux_amount,
          your_price: row.your_price, your_cost: fields.your_cost, robux_rate: fields.robux_rate,
          profit: row.profit, status: fields.status, suggested_lower_price: fields.suggested_lower_price,
          competitor_price: 0, is_active: true,
        })
        if (error) failed++; else created++
      } else if (row.action === 'update' && row.existingId) {
        const { error } = await supabase.from('gamepasses').update({
          name: row.name, robux_amount: row.robux_amount, your_price: row.your_price, profit: row.profit,
          your_cost: fields.your_cost, robux_rate: fields.robux_rate, status: fields.status,
          updated_at: new Date().toISOString(),
        }).eq('id', row.existingId)
        if (error) failed++; else updated++
      } else if (row.action === 'replace' && row.existingId) {
        const { error } = await supabase.from('gamepasses').update({
          name: row.name, robux_amount: row.robux_amount, your_price: row.your_price, profit: row.profit,
          your_cost: fields.your_cost, robux_rate: fields.robux_rate, status: fields.status,
          competitor_price: 0, suggested_lower_price: fields.suggested_lower_price, is_active: true,
          updated_at: new Date().toISOString(),
        }).eq('id', row.existingId)
        if (error) failed++; else replaced++
      }
    }
    fetchData()
    const parts = [created && `${created} created`, updated && `${updated} updated`, replaced && `${replaced} replaced`, failed && `${failed} failed`].filter(Boolean)
    toast.success(parts.join(', ') || 'Nothing imported.')
  }

  const filtered = useMemo(() => gamepasses.filter(gp => {
    const matchSearch = gp.name.toLowerCase().includes(search.toLowerCase()) ||
                        (gp.games?.name ?? '').toLowerCase().includes(search.toLowerCase())
    const matchGame = filterGame === 'all' || gp.game_id === filterGame
    const matchStatus = filterStatus === 'all' || gp.status === filterStatus
    return matchSearch && matchGame && matchStatus
  }), [gamepasses, search, filterGame, filterStatus])

  const statusCounts = useMemo(() => ({
    Good: filtered.filter(g => g.status === 'Good').length,
    Okay: filtered.filter(g => g.status === 'Okay').length,
    Bad: filtered.filter(g => g.status === 'Bad').length,
  }), [filtered])

  const catalogStats = useMemo(() => ({
    total: gamepasses.length,
    good: gamepasses.filter(g => g.status === 'Good').length,
    okay: gamepasses.filter(g => g.status === 'Okay').length,
    bad:  gamepasses.filter(g => g.status === 'Bad').length,
  }), [gamepasses])

  return (
    <div>
      <TopBar
        title="Gamepass Inventory"
        subtitle="Manage gamepasses and pricing"
        searchPlaceholder="Search gamepasses..."
        searchValue={search}
        onSearchChange={setSearch}
        actionLabel="+ Add Gamepass"
        onActionClick={() => { setEditGamepass(null); setModalOpen(true) }}
      />
      <PageHero
        badge="Catalog"
        title="Gamepass Catalog"
        subtitle="Configure prices, manage listings, and track your complete gamepass portfolio."
        gradient="linear-gradient(135deg, #a78bfa 0%, #22d3ee 60%, rgba(255,255,255,0.80) 100%)"
      />

      <div className="p-5 space-y-5">
        {/* ── Bulk Generate Gamepasses — fast path for new game launches ── */}
        <div
          className="rounded-2xl px-4 py-3 flex items-center justify-between gap-3"
          style={{ background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.18)' }}
        >
          <p className="text-[12px] font-semibold" style={{ color: 'rgba(255,255,255,0.72)' }}>
            New game releasing? Generate its whole gamepass list from the master pricing table or by copying another game.
          </p>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => setImportCatalogOpen(true)}
              className="px-3 py-1.5 rounded-xl text-[12px] font-bold"
              style={{ background: 'rgba(255,255,255,0.045)', color: 'rgba(255,255,255,0.60)', border: '1px solid rgba(255,255,255,0.090)' }}
            >
              Import Catalog (CSV)
            </button>
            <button
              type="button"
              onClick={() => setBulkGenerateOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-bold"
              style={{ background: 'rgba(167,139,250,0.14)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.30)' }}
            >
              <Sparkles className="w-3.5 h-3.5" /> Bulk Generate Gamepasses
            </button>
          </div>
        </div>

        {/* ── 01 · Catalog Overview ── */}
        <SectionLabel index="01" label="Catalog Overview" />
        <motion.div
          className="grid grid-cols-2 sm:grid-cols-4 gap-3.5"
          variants={cardStagger}
          initial="initial"
          whileInView="animate"
          viewport={{ once: true, amount: 0.4 }}
        >
          {([
            { label: 'Total Gamepasses', value: catalogStats.total, color: '#a78bfa', featured: true },
            { label: 'Good Margin',      value: catalogStats.good,  color: '#34d399', featured: false },
            { label: 'Okay Margin',      value: catalogStats.okay,  color: '#f59e0b', featured: false },
            { label: 'Bad Margin',       value: catalogStats.bad,   color: '#f43f5e', featured: false },
          ] as const).map(({ label, value, color, featured }) => (
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
                value={value}
                format={(v) => `${Math.round(v)}`}
                duration={1.2}
                className="stat-value block"
                style={featured ? { color, fontSize: '34px', textShadow: `0 0 24px ${color}40, 0 0 48px ${color}18` } : { color }}
              />
            </motion.div>
          ))}
        </motion.div>

        {/* ── 02 · Gamepass Catalog ── */}
        <SectionLabel index="02" label="Gamepass Catalog" />

        {/* Game filter chips */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setFilterGame('all')}
            className={cn('chip', filterGame === 'all' ? 'chip-active' : '')}
          >
            All Games
            <span className="ml-1 opacity-50">({gamepasses.length})</span>
          </button>
          {games.map(game => {
            const count = gamepasses.filter(gp => gp.game_id === game.id).length
            if (count === 0) return null
            const isActive = filterGame === game.id
            const color = game.color || '#a78bfa'
            return (
              <button
                key={game.id}
                onClick={() => setFilterGame(isActive ? 'all' : game.id)}
                className="chip"
                style={isActive ? {
                  background: `rgba(255,255,255,0.050) padding-box, linear-gradient(135deg, ${color}55, ${color}28) border-box`,
                  border: '1px solid transparent',
                  color,
                  boxShadow: `0 0 14px ${color}28`,
                  transform: 'translateY(-1px)',
                } : {
                  borderColor: `${color}22`,
                  color: `${color}BB`,
                  transition: 'all 0.18s ease',
                }}
              >
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle"
                  style={{ backgroundColor: color, boxShadow: isActive ? `0 0 5px ${color}90` : 'none' }}
                />
                {game.name}
                <span className="ml-1 opacity-50">({count})</span>
              </button>
            )
          })}
        </div>

        {/* Status filter + count row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {STATUS_FILTERS.map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={cn('chip', filterStatus === s ? 'chip-active' : '')}
              >
                {s === 'all' ? 'All Status' : s}
                {s !== 'all' && <span className="ml-1 opacity-50">({statusCounts[s as keyof typeof statusCounts]})</span>}
              </button>
            ))}
          </div>
          <p className="text-[11px]" style={{ color: 'rgba(255,255,255,0.44)' }}>{filtered.length} gamepasses</p>
        </div>

        {/* Table */}
        {loading ? (
          <SkeletonTable rows={6} cols={6} />
        ) : gamepasses.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No gamepasses yet"
            description="Add your first gamepass to start tracking margins, pricing, and catalog status."
            actionLabel="Add Gamepass"
            onAction={() => setModalOpen(true)}
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="No gamepasses match your filters"
            description="Try a different search term, or clear the active game/status filters to see your full catalog."
            actionLabel="Clear Filters"
            onAction={() => { setSearch(''); setFilterGame('all'); setFilterStatus('all') }}
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
                    <th className="text-left">Game / Gamepass</th>
                    <th className="text-right">Robux</th>
                    <th className="text-right">Competitor</th>
                    <th className="text-right">Your Price</th>
                    <th className="text-right">Cost</th>
                    <th className="text-right">Profit</th>
                    <th className="text-right">Suggested</th>
                    <th className="text-center">Status</th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(gp => (
                    <tr key={gp.id} className="group">
                      <td>
                        <p className="text-[13px] font-semibold" style={{ color: 'rgba(255,255,255,0.88)' }}>{gp.name}</p>
                        <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.44)' }}>{gp.games?.name ?? '—'}</p>
                      </td>
                      <td className="text-right">
                        <span className="text-[12px] font-mono font-semibold" style={{ color: 'rgba(255,255,255,0.76)' }}>{gp.robux_amount.toLocaleString()} R$</span>
                      </td>
                      <td className="text-right text-[12px]" style={{ color: 'rgba(255,255,255,0.44)' }}>
                        {gp.competitor_price ? formatPHP(gp.competitor_price) : '—'}
                      </td>
                      <td className="text-right">
                        <span className="text-[13px] font-bold" style={{ color: 'rgba(255,255,255,0.88)' }}>{formatPHP(gp.your_price)}</span>
                      </td>
                      <td className="text-right text-[12px]" style={{ color: 'rgba(255,255,255,0.44)' }}>
                        {formatPHP(gp.your_cost)}
                      </td>
                      <td className={cn('text-right text-[13px] font-bold',
                        gp.profit >= 20 ? 'text-emerald-600' : gp.profit >= 5 ? 'text-amber-600' : 'text-red-500'
                      )}>
                        {formatPHP(gp.profit)}
                      </td>
                      <td className="text-right text-[12px]" style={{ color: 'rgba(255,255,255,0.44)' }}>
                        {gp.suggested_lower_price ? formatPHP(gp.suggested_lower_price) : '—'}
                      </td>
                      <td className="text-center">
                        <StatusBadge status={gp.status} />
                      </td>
                      <td>
                        <DropdownMenu>
                          <DropdownMenuTrigger className="sm:opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg hover:bg-accent flex items-center justify-center text-muted-foreground transition-opacity">
                            <MoreHorizontal className="w-4 h-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-popover border-border">
                            <DropdownMenuItem
                              onClick={() => { setEditGamepass(gp); setModalOpen(true) }}
                              className="gap-2 text-xs cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(gp.id)}
                              className="gap-2 text-xs cursor-pointer text-red-400 focus:text-red-400"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </div>

      <GamepassModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditGamepass(null) }}
        onSave={handleSave}
        gamepass={editGamepass}
        games={games}
        loading={saving}
      />

      <BulkGenerateGamepassesDialog
        open={bulkGenerateOpen}
        onClose={() => setBulkGenerateOpen(false)}
        games={games}
        gamepasses={gamepasses}
        tiers={pricingTiers}
        presets={generationPresets}
        onCreateGame={handleCreateGame}
        onAddMissingTier={handleAddMissingTier}
        onSavePreset={handleSaveGenerationPreset}
        onSaveGamepasses={handleBulkSaveGamepasses}
      />

      <ImportCatalogDialog
        open={importCatalogOpen}
        onClose={() => setImportCatalogOpen(false)}
        games={games}
        gamepasses={gamepasses}
        tiers={pricingTiers}
        onImport={handleImportCatalog}
      />
    </div>
  )
}

// useUrlState() calls useSearchParams() internally — requires a Suspense
// boundary or the build's prerender pass fails even on a force-dynamic page.
export default function InventoryPage() {
  return (
    <Suspense fallback={null}>
      <InventoryPageContent />
    </Suspense>
  )
}
