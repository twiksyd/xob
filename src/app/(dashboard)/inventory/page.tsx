'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useMemo } from 'react'
import TopBar from '@/components/shared/TopBar'
import GamepassModal from '@/components/inventory/GamepassModal'
import StatusBadge from '@/components/shared/StatusBadge'
import { Gamepass, Game, RobloxAccount } from '@/lib/types/database'
import { createClient } from '@/lib/supabase/client'
import { computeGamepassFields } from '@/lib/utils/pricing'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Plus, Search, Package, MoreHorizontal, Edit2, Trash2, ShoppingCart } from 'lucide-react'

type GamepassWithGame = Gamepass & { games: Game | null }

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

  return (
    <div>
      <TopBar title="Gamepass Inventory" subtitle="Manage gamepasses and pricing" />

      <div className="p-6 space-y-5">
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search gamepasses or games..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 bg-input text-sm h-9"
            />
          </div>
          <Select value={filterGame} onValueChange={(v) => setFilterGame(v ?? 'all')}>
            <SelectTrigger className="w-40 h-9 bg-input text-sm">
              <SelectValue placeholder="All games" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              <SelectItem value="all">All Games</SelectItem>
              {games.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v ?? 'all')}>
            <SelectTrigger className="w-32 h-9 bg-input text-sm">
              <SelectValue placeholder="All status" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="Good">Good</SelectItem>
              <SelectItem value="Okay">Okay</SelectItem>
              <SelectItem value="Bad">Bad</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={() => { setEditGamepass(null); setModalOpen(true) }}
            className="gap-2 bg-primary text-primary-foreground h-9 text-xs"
          >
            <Plus className="w-3.5 h-3.5" /> Add Gamepass
          </Button>
        </div>

        {/* Summary stats */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>{filtered.length} gamepasses</span>
          <span className="text-emerald-400">
            {filtered.filter(g => g.status === 'Good').length} Good
          </span>
          <span className="text-amber-400">
            {filtered.filter(g => g.status === 'Okay').length} Okay
          </span>
          <span className="text-red-400">
            {filtered.filter(g => g.status === 'Bad').length} Bad
          </span>
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
                  <tr className="border-b border-border/50 bg-secondary/30">
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground">Game / Gamepass</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Robux</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Competitor</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Your Price</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Cost</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Profit</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground">Suggested</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {filtered.map(gp => (
                    <tr key={gp.id} className="hover:bg-accent/20 transition-colors group">
                      <td className="px-4 py-3">
                        <p className="text-xs font-medium text-foreground">{gp.name}</p>
                        <p className="text-[10px] text-muted-foreground">{gp.games?.name ?? '—'}</p>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-foreground font-mono">
                        {gp.robux_amount.toLocaleString()} R$
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                        ₱{gp.competitor_price ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-right text-xs font-semibold text-foreground">
                        ₱{gp.your_price}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                        ₱{gp.your_cost.toFixed(2)}
                      </td>
                      <td className={`px-4 py-3 text-right text-xs font-semibold ${gp.profit >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        ₱{gp.profit.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                        ₱{gp.suggested_lower_price}
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
