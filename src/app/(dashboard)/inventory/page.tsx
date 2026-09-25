'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useMemo, useRef, Suspense, type CSSProperties } from 'react'
import { motion } from 'framer-motion'
import TopBar from '@/components/shared/TopBar'
import PageHero from '@/components/shared/PageHero'
import GamepassModal from '@/components/inventory/GamepassModal'
import GameManagerDialog from '@/components/inventory/GameManagerDialog'
import GameSelector from '@/components/shared/GameSelector'
import GameIcon from '@/components/shared/GameIcon'
import StatusBadge from '@/components/shared/StatusBadge'
import CountUp from '@/components/shared/CountUp'
import { Gamepass, Game, RobloxAccount } from '@/lib/types/database'
import { createClient } from '@/lib/supabase/client'
import { Package, SearchX, Tag } from 'lucide-react'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Edit2, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { cardStagger, cardStaggerItem } from '@/lib/motion'
import { useToast } from '@/components/shared/Toast'
import { formatPHP } from '@/lib/utils/pricing'
import { getGameNameStyle } from '@/lib/utils/games'
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
  const [gameManagerOpen, setGameManagerOpen] = useState(false)
  const [gameActivity, setGameActivity] = useState<Map<string, Date>>(new Map())
  const [search, setSearch] = useState('')
  const [filterGame, setFilterGame] = useUrlState<string>('game', 'all')
  const [filterStatus, setFilterStatus] = useUrlState<typeof STATUS_FILTERS[number]>('status', 'all', STATUS_FILTERS)
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current
  const toast = useToast()
  const confirm = useConfirm()

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [gpRes, gameRes, accRes, activityRes] = await Promise.all([
      supabase.from('gamepasses').select('*, games(*)').order('created_at', { ascending: false }),
      supabase.from('games').select('*').order('name'),
      supabase.from('roblox_accounts').select('*').eq('status', 'active'),
      // Game Selector activity column — bounded sample of recent completed
      // sales, resolved to game_id via the gamepasses list below. Inventory
      // doesn't otherwise load order history, so this is the one new query
      // this redesign needs (Orders already had everything in memory).
      supabase.from('order_items')
        .select('gamepass_id, created_at, orders!inner(status)')
        .eq('orders.status', 'completed')
        .order('created_at', { ascending: false })
        .limit(500),
    ])
    if (gpRes.data) setGamepasses(gpRes.data as GamepassWithGame[])
    if (gameRes.data) setGames(gameRes.data)
    if (accRes.data) setAccounts(accRes.data)
    if (activityRes.data && gpRes.data) {
      const gamepassToGame = new Map((gpRes.data as GamepassWithGame[]).map(gp => [gp.id, gp.game_id]))
      const map = new Map<string, Date>()
      ;(activityRes.data as any[]).forEach(item => {
        const gameId = item.gamepass_id ? gamepassToGame.get(item.gamepass_id) : null
        if (!gameId) return
        const at = new Date(item.created_at)
        const existing = map.get(gameId)
        if (!existing || at > existing) map.set(gameId, at)
      })
      setGameActivity(map)
    }
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

  async function handleToggleDiscounted(gameId: string, next: boolean) {
    const { error } = await supabase.from('games').update({ is_discounted: next }).eq('id', gameId)
    if (error) {
      toast.error(`Could not update discount status: ${error.message}`)
      return
    }
    setGames(prev => prev.map(g => g.id === gameId ? { ...g, is_discounted: next } : g))
    setGamepasses(prev => prev.map(gp =>
      gp.game_id === gameId && gp.games ? { ...gp, games: { ...gp.games, is_discounted: next } } : gp
    ))
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

  // Sorted by game, then ascending Robux amount — like an actual price
  // list — rather than creation order, which shuffles every time a bulk
  // tool (re-import, regenerate, duplicate cleanup) touches a game, since
  // newly-written rows always sort as "most recent" otherwise.
  const filtered = useMemo(() => gamepasses
    .filter(gp => {
      const matchSearch = gp.name.toLowerCase().includes(search.toLowerCase()) ||
                          (gp.games?.name ?? '').toLowerCase().includes(search.toLowerCase())
      const matchGame = filterGame === 'all' || gp.game_id === filterGame
      const matchStatus = filterStatus === 'all' || gp.status === filterStatus
      return matchSearch && matchGame && matchStatus
    })
    .sort((a, b) => (a.games?.name ?? '').localeCompare(b.games?.name ?? '') || a.robux_amount - b.robux_amount),
  [gamepasses, search, filterGame, filterStatus])

  const statusCounts = useMemo(() => ({
    Good: filtered.filter(g => g.status === 'Good').length,
    Okay: filtered.filter(g => g.status === 'Okay').length,
    Bad: filtered.filter(g => g.status === 'Bad').length,
  }), [filtered])

  const gamepassCounts = useMemo(() => {
    const map = new Map<string, number>()
    gamepasses.forEach(gp => {
      if (gp.game_id) map.set(gp.game_id, (map.get(gp.game_id) ?? 0) + 1)
    })
    return map
  }, [gamepasses])

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
              className={cn('summary-card', featured && 'featured-card')}
              style={featured
                ? ({ '--featured-color': color } as CSSProperties)
                : { background: `rgba(255,255,255,0.038) padding-box, linear-gradient(135deg, ${color}38, rgba(34,211,238,0.14)) border-box`, border: '1px solid transparent' }}
            >
              <p className="label-caps mb-1">{label}</p>
              <CountUp
                value={value}
                format={(v) => `${Math.round(v)}`}
                duration={1.2}
                className={cn('stat-value block', featured && 'featured-value')}
                style={featured ? { fontSize: '34px' } : { color }}
              />
            </motion.div>
          ))}
        </motion.div>

        {/* ── 02 · Gamepass Catalog ── */}
        <div className="flex items-center justify-between">
          <SectionLabel index="02" label="Gamepass Catalog" />
          <button
            type="button"
            onClick={() => setGameManagerOpen(true)}
            className="flex items-center gap-1.5 text-[11px] font-semibold transition-colors"
            style={{ color: 'rgba(255,255,255,0.47)' }}
          >
            <Tag className="w-3.5 h-3.5" /> Manage Games
          </button>
        </div>

        {/* Game selector — compact popover, page stays fully visible; Ctrl+K opens the full palette */}
        <GameSelector
          games={games}
          value={filterGame === 'all' ? null : filterGame}
          onChange={(id) => setFilterGame(id ?? 'all')}
          allowClear
          gameActivity={gameActivity}
        />

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
                        <p className="flex items-center gap-1.5 text-[11px] mt-0.5">
                          {gp.games && <GameIcon iconUrl={gp.games.icon_url} color={gp.games.color} size={14} />}
                          <span style={getGameNameStyle(gp.games?.is_discounted)}>{gp.games?.name ?? '—'}</span>
                        </p>
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

      <GameManagerDialog
        open={gameManagerOpen}
        onClose={() => setGameManagerOpen(false)}
        games={games}
        gamepassCounts={gamepassCounts}
        onToggleDiscounted={handleToggleDiscounted}
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
