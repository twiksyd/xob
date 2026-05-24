'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useMemo } from 'react'
import TopBar from '@/components/shared/TopBar'
import GamepassModal from '@/components/inventory/GamepassModal'
import StatusBadge from '@/components/shared/StatusBadge'
import { Gamepass, Game, RobloxAccount } from '@/lib/types/database'
import { createClient } from '@/lib/supabase/client'
import { Plus, Package } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { MoreHorizontal, Edit2, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type GamepassWithGame = Gamepass & { games: Game | null }

const STATUS_FILTERS = ['all', 'Good', 'Okay', 'Bad'] as const

export default function InventoryPage() {
  const [gamepasses, setGamepasses] = useState<GamepassWithGame[]>([])
  const [games, setGames] = useState<Game[]>([])
  const [accounts, setAccounts] = useState<RobloxAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editGamepass, setEditGamepass] = useState<Gamepass | null>(null)
  const [search, setSearch] = useState('')
  const [filterGame, setFilterGame] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const supabase = createClient()

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [gpRes, gameRes, accRes] = await Promise.all([
      supabase.from('gamepasses').select('*, games(*)').order('created_at', { ascending: false }),
      supabase.from('games').select('*').order('name'),
      supabase.from('roblox_accounts').select('*').eq('status', 'active'),
    ])
    if (gpRes.data) setGamepasses(gpRes.data as GamepassWithGame[])
    if (gameRes.data) setGames(gameRes.data)
    if (accRes.data) setAccounts(accRes.data)
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleSave(data: any) {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    if (editGamepass) {
      await supabase.from('gamepasses').update({ ...data, updated_at: new Date().toISOString() }).eq('id', editGamepass.id)
    } else {
      await supabase.from('gamepasses').insert({ ...data, user_id: user.id })
    }
    setSaving(false)
    setModalOpen(false)
    setEditGamepass(null)
    fetchData()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this gamepass?')) return
    await supabase.from('gamepasses').delete().eq('id', id)
    fetchData()
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

      <div className="p-6 space-y-4">
        {/* Game filter chips */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setFilterGame('all')}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border',
              filterGame === 'all'
                ? 'bg-primary/20 text-primary border-primary/50'
                : 'bg-secondary/40 text-muted-foreground border-border/40 hover:bg-secondary/70 hover:text-foreground'
            )}
          >
            All Games
            <span className="ml-1.5 opacity-60">({gamepasses.length})</span>
          </button>
          {games.map(game => {
            const count = gamepasses.filter(gp => gp.game_id === game.id).length
            if (count === 0) return null
            const isActive = filterGame === game.id
            const color = game.color || '#6366f1'
            return (
              <button
                key={game.id}
                onClick={() => setFilterGame(isActive ? 'all' : game.id)}
                style={isActive ? {
                  backgroundColor: `${color}22`,
                  borderColor: `${color}70`,
                  color: color,
                } : {
                  borderColor: `${color}30`,
                  color: `${color}99`,
                }}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border',
                  isActive ? '' : 'hover:opacity-100 bg-secondary/30'
                )}
              >
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle"
                  style={{ backgroundColor: color }}
                />
                {game.name}
                <span className="ml-1.5 opacity-50">({count})</span>
              </button>
            )
          })}
        </div>

        {/* Status filter + count row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {STATUS_FILTERS.map(s => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={cn(
                  'px-3 py-1 rounded-md text-xs font-medium transition-all',
                  filterStatus === s
                    ? s === 'Good' ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40'
                    : s === 'Okay' ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/40'
                    : s === 'Bad' ? 'bg-red-500/20 text-red-400 ring-1 ring-red-500/40'
                    : 'bg-secondary text-foreground ring-1 ring-border'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                )}
              >
                {s === 'all' ? 'All Status' : s}
                {s !== 'all' && (
                  <span className="ml-1 opacity-60">({statusCounts[s as keyof typeof statusCounts]})</span>
                )}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{filtered.length} gamepasses</p>
        </div>

        {/* Table */}
        {loading ? (
          <div className="glass-card p-8 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <Package className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No gamepasses found.</p>
            <Button onClick={() => setModalOpen(true)} className="mt-4 gap-2 bg-primary text-primary-foreground text-xs h-8">
              <Plus className="w-3.5 h-3.5" /> Add Gamepass
            </Button>
          </div>
        ) : (
          <div className="glass-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/60 bg-secondary/30">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground tracking-wide uppercase">Game / Gamepass</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground tracking-wide uppercase">Robux</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground tracking-wide uppercase">Competitor</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground tracking-wide uppercase">Your Price</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground tracking-wide uppercase">Cost</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground tracking-wide uppercase">Profit</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground tracking-wide uppercase">Suggested</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground tracking-wide uppercase">Status</th>
                    <th className="px-4 py-3 w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {filtered.map(gp => (
                    <tr key={gp.id} className="hover:bg-accent/20 transition-colors group">
                      <td className="px-4 py-3.5">
                        <p className="text-sm font-semibold text-foreground">{gp.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{gp.games?.name ?? '—'}</p>
                      </td>
                      <td className="px-4 py-3.5 text-right text-sm text-foreground font-mono font-medium">
                        {gp.robux_amount.toLocaleString()} R$
                      </td>
                      <td className="px-4 py-3.5 text-right text-sm text-muted-foreground">
                        {gp.competitor_price ? `₱${gp.competitor_price}` : '—'}
                      </td>
                      <td className="px-4 py-3.5 text-right text-sm font-bold text-foreground">
                        ₱{gp.your_price}
                      </td>
                      <td className="px-4 py-3.5 text-right text-sm text-muted-foreground">
                        ₱{gp.your_cost.toFixed(2)}
                      </td>
                      <td className={cn(
                        'px-4 py-3.5 text-right text-sm font-bold',
                        gp.profit >= 20 ? 'text-emerald-600' : gp.profit >= 5 ? 'text-amber-600' : 'text-red-600'
                      )}>
                        ₱{gp.profit.toFixed(2)}
                      </td>
                      <td className="px-4 py-3.5 text-right text-sm text-muted-foreground">
                        {gp.suggested_lower_price ? `₱${gp.suggested_lower_price}` : '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <StatusBadge status={gp.status} />
                      </td>
                      <td className="px-4 py-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded-lg hover:bg-accent flex items-center justify-center text-muted-foreground transition-opacity">
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
          </div>
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
    </div>
  )
}
