'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import TopBar from '@/components/shared/TopBar'
import StatCard from '@/components/shared/StatCard'
import AccountCard from '@/components/accounts/AccountCard'
import AccountModal from '@/components/accounts/AccountModal'
import { RobloxAccount, ReservationWithDetails } from '@/lib/types/database'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Plus, Coins, Wallet, Users, Lock, ChevronDown } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

export default function AccountsPage() {
  const [accounts, setAccounts]           = useState<RobloxAccount[]>([])
  const [reservations, setReservations]   = useState<ReservationWithDetails[]>([])
  const [loading, setLoading]             = useState(true)
  const [saving, setSaving]               = useState(false)
  const [modalOpen, setModalOpen]         = useState(false)
  const [editAccount, setEditAccount]     = useState<RobloxAccount | null>(null)
  const [resExpanded, setResExpanded]     = useState(true)
  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [accRes, resRes] = await Promise.all([
      supabase.from('roblox_accounts').select('*').order('created_at', { ascending: true }),
      supabase.from('robux_reservations')
        .select('*, roblox_accounts(username), orders(order_number, buyer_name, status)')
        .eq('status', 'active')
        .order('created_at', { ascending: false }),
    ])
    if (!accRes.error && accRes.data) setAccounts(accRes.data)
    if (!resRes.error && resRes.data)  setReservations(resRes.data as ReservationWithDetails[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleSave(data: {
    username: string; current_robux: number; reserved_robux: number
    status: 'active' | 'inactive' | 'banned' | 'low'; notes?: string
  }) {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const payload = {
      username:      data.username,
      current_robux: data.current_robux,
      reserved_robux: data.reserved_robux,
      status:        data.status,
      notes:         data.notes ?? null,
    }

    if (editAccount) {
      await supabase.from('roblox_accounts').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editAccount.id)
    } else {
      await supabase.from('roblox_accounts').insert({ ...payload, user_id: user.id })
    }

    setSaving(false)
    setModalOpen(false)
    setEditAccount(null)
    fetchData()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this account?')) return
    await supabase.from('roblox_accounts').delete().eq('id', id)
    fetchData()
  }

  function handleEdit(account: RobloxAccount) {
    setEditAccount(account)
    setModalOpen(true)
  }

  const sortedAccounts = useMemo(
    () => [...accounts].sort((a, b) => b.current_robux - a.current_robux),
    [accounts]
  )

  const totalRobux      = accounts.reduce((s, a) => s + a.current_robux, 0)
  const totalReserved   = accounts.reduce((s, a) => s + a.reserved_robux, 0)
  const availableRobux  = totalRobux - totalReserved
  const activeAccounts  = accounts.filter(a => a.status === 'active').length

  // Group reservations by account for display
  const reservationsByAccount = useMemo(() => {
    const map = new Map<string, { username: string; reservations: ReservationWithDetails[] }>()
    for (const res of reservations) {
      const username = res.roblox_accounts?.username ?? 'Unknown'
      if (!map.has(res.account_id)) {
        map.set(res.account_id, { username, reservations: [] })
      }
      map.get(res.account_id)!.reservations.push(res)
    }
    return Array.from(map.entries()).map(([accountId, data]) => ({
      accountId,
      username: data.username,
      reservations: data.reservations,
      total: data.reservations.reduce((s, r) => s + r.robux_amount, 0),
    }))
  }, [reservations])

  return (
    <div>
      <TopBar
        title="Roblox Accounts"
        subtitle="Manage your seller accounts and reservations"
        actionLabel="+ Add Account"
        onActionClick={() => { setEditAccount(null); setModalOpen(true) }}
      />

      <div className="p-5 space-y-5">

        {/* ── Summary stat cards ── */}
        <div className="grid grid-cols-4 gap-3.5">
          <StatCard
            title="Total Robux"
            value={`${totalRobux.toLocaleString()} R$`}
            subtitle={`Across ${accounts.length} account${accounts.length !== 1 ? 's' : ''}`}
            icon={Coins} iconColor="#a78bfa" accentColor="#a78bfa"
          />
          <StatCard
            title="Available Robux"
            value={`${availableRobux.toLocaleString()} R$`}
            subtitle="Ready to fulfill orders"
            icon={Wallet} iconColor="#34d399" accentColor="#34d399"
          />
          <StatCard
            title="Reserved Robux"
            value={`${totalReserved.toLocaleString()} R$`}
            subtitle={`${reservations.length} active reservation${reservations.length !== 1 ? 's' : ''}`}
            icon={Lock} iconColor="#f59e0b" accentColor="#f59e0b"
          />
          <StatCard
            title="Active Accounts"
            value={`${activeAccounts} / ${accounts.length}`}
            subtitle="Currently active"
            icon={Users} iconColor="#22d3ee" accentColor="#22d3ee"
          />
        </div>

        {/* ── Account grid ── */}
        <div>
          <p className="text-[12px] font-semibold mb-3" style={{ color: 'oklch(0.40 0.020 270)' }}>
            All Accounts ({accounts.length})
          </p>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="glass-card p-5 h-52 animate-pulse" />
              ))}
            </div>
          ) : accounts.length === 0 ? (
            <div className="glass-card p-12 text-center">
              <Coins className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No accounts yet. Add your first Roblox account.</p>
              <Button onClick={() => setModalOpen(true)} className="mt-4 gap-2 bg-primary text-primary-foreground text-xs h-8">
                <Plus className="w-3.5 h-3.5" /> Add Account
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {sortedAccounts.map(account => (
                <AccountCard key={account.id} account={account} onEdit={handleEdit} onDelete={handleDelete} />
              ))}
            </div>
          )}
        </div>

        {/* ── Reservations panel ── */}
        {!loading && (
          <div className="space-y-3">
            {/* Section header */}
            <button
              onClick={() => setResExpanded(p => !p)}
              className="flex items-center gap-3 w-full text-left"
            >
              <span className="label-caps">Active Reservations</span>
              {reservations.length > 0 && (
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(245,158,11,0.10)', color: '#b45309', border: '1px solid rgba(245,158,11,0.22)' }}
                >
                  {reservations.length}
                </span>
              )}
              {totalReserved > 0 && (
                <span
                  className="text-[11px] font-bold tabular-nums ml-auto"
                  style={{ color: '#b45309' }}
                >
                  {totalReserved.toLocaleString()} R$ locked
                </span>
              )}
              <ChevronDown
                className="w-3.5 h-3.5 transition-transform duration-200"
                style={{
                  color: 'oklch(0.48 0.016 265)',
                  transform: resExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  marginLeft: totalReserved > 0 ? '0' : 'auto',
                }}
              />
            </button>

            <AnimatePresence>
              {resExpanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                  style={{ overflow: 'hidden' }}
                >
                  {reservations.length === 0 ? (
                    <div
                      className="glass-secondary rounded-2xl p-10 text-center"
                      style={{ opacity: 0.75 }}
                    >
                      <Lock className="w-8 h-8 mx-auto mb-3" style={{ color: 'oklch(0.62 0.010 265)' }} />
                      <p className="text-[13px] font-semibold mb-1" style={{ color: 'oklch(0.40 0.016 265)' }}>
                        No active reservations
                      </p>
                      <p className="text-[12px]" style={{ color: 'oklch(0.62 0.010 265)' }}>
                        Robux is automatically reserved when orders are created
                      </p>
                    </div>
                  ) : (
                    <div className="glass-secondary overflow-hidden">
                      {/* Panel header */}
                      <div
                        className="px-5 py-3.5 flex items-center justify-between"
                        style={{
                          background: 'rgba(245,158,11,0.04)',
                          borderBottom: '1px solid rgba(245,158,11,0.12)',
                        }}
                      >
                        <p className="text-[11px] font-semibold" style={{ color: 'oklch(0.42 0.016 265)' }}>
                          Robux reserved for pending and paid orders
                        </p>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-[10px]" style={{ color: 'oklch(0.55 0.010 265)' }}>Total locked</p>
                            <p className="text-[13px] font-bold tabular-nums" style={{ color: '#b45309' }}>
                              {totalReserved.toLocaleString()} R$
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Reservations grouped by account */}
                      {reservationsByAccount.map(({ accountId, username, reservations: accRes, total }) => (
                        <div key={accountId} style={{ borderBottom: '1px solid rgba(15,13,42,0.048)' }}>
                          {/* Account group header */}
                          <div
                            className="flex items-center justify-between px-5 py-2.5"
                            style={{ background: 'rgba(15,13,42,0.020)' }}
                          >
                            <div className="flex items-center gap-2">
                              <div
                                className="w-6 h-6 rounded-lg flex items-center justify-center text-[11px] font-black text-white flex-shrink-0"
                                style={{ background: 'linear-gradient(135deg, rgba(139,92,246,0.55), rgba(34,211,238,0.45))' }}
                              >
                                {username.charAt(0).toUpperCase()}
                              </div>
                              <span className="text-[12px] font-bold" style={{ color: 'oklch(0.18 0.025 270)' }}>
                                {username}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px]" style={{ color: 'oklch(0.55 0.010 265)' }}>
                                {accRes.length} reservation{accRes.length !== 1 ? 's' : ''}
                              </span>
                              <span
                                className="text-[11px] font-bold tabular-nums px-2 py-0.5 rounded-full"
                                style={{ background: 'rgba(245,158,11,0.10)', color: '#b45309', border: '1px solid rgba(245,158,11,0.20)' }}
                              >
                                {total.toLocaleString()} R$
                              </span>
                            </div>
                          </div>

                          {/* Individual reservations */}
                          {accRes.map(res => (
                            <div
                              key={res.id}
                              className="flex items-center gap-4 px-5 py-3 order-row-shimmer"
                              style={{ borderTop: '1px solid rgba(15,13,42,0.032)' }}
                            >
                              {/* Amber accent dot */}
                              <div
                                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                style={{ background: '#f59e0b', boxShadow: '0 0 5px rgba(245,158,11,0.45)' }}
                              />

                              {/* Gamepass names */}
                              <div className="flex-1 min-w-0">
                                <p className="text-[12px] font-semibold truncate" style={{ color: 'oklch(0.15 0.028 270)' }}>
                                  {res.gamepass_names || 'Gamepass reservation'}
                                </p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  {res.orders?.order_number && (
                                    <span className="font-mono text-[10px] font-bold" style={{ color: '#22d3ee' }}>
                                      {res.orders.order_number}
                                    </span>
                                  )}
                                  {res.orders?.buyer_name && (
                                    <span className="text-[10px]" style={{ color: 'oklch(0.55 0.010 265)' }}>
                                      · {res.orders.buyer_name}
                                    </span>
                                  )}
                                  {res.orders?.status && (
                                    <span
                                      className="text-[9px] font-bold px-1.5 py-0.5 rounded-full capitalize"
                                      style={{
                                        background: res.orders.status === 'paid'
                                          ? 'rgba(34,211,238,0.10)'
                                          : 'rgba(245,158,11,0.10)',
                                        color: res.orders.status === 'paid' ? '#0e7490' : '#b45309',
                                        border: res.orders.status === 'paid'
                                          ? '1px solid rgba(34,211,238,0.22)'
                                          : '1px solid rgba(245,158,11,0.22)',
                                      }}
                                    >
                                      {res.orders.status}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Amount */}
                              <div className="text-right flex-shrink-0">
                                <p
                                  className="text-[13px] font-bold tabular-nums"
                                  style={{ color: '#b45309' }}
                                >
                                  {res.robux_amount.toLocaleString()} R$
                                </p>
                                <p className="text-[10px]" style={{ color: 'oklch(0.60 0.010 265)' }}>
                                  {formatDistanceToNow(new Date(res.created_at), { addSuffix: true })}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

      </div>

      <AccountModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditAccount(null) }}
        onSave={handleSave}
        account={editAccount}
        loading={saving}
      />
    </div>
  )
}
