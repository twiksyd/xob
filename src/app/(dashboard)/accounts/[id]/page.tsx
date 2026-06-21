'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import TopBar from '@/components/shared/TopBar'
import PageHero from '@/components/shared/PageHero'
import StatCard from '@/components/shared/StatCard'
import RobloxAvatar from '@/components/shared/RobloxAvatar'
import StatusBadge from '@/components/shared/StatusBadge'
import DiscountBadge from '@/components/shared/DiscountBadge'
import PurchaseHistoryTable from '@/components/accounts/PurchaseHistoryTable'
import AccountTimeline from '@/components/accounts/AccountTimeline'
import { createClient } from '@/lib/supabase/client'
import { SkeletonCard, SkeletonTable } from '@/components/shared/Skeleton'
import Breadcrumb from '@/components/shared/Breadcrumb'
import { formatPHP } from '@/lib/utils/pricing'
import {
  RobloxAccount, RobloxReservation, OrderReassignment, OrderWithItems, TransferLog, TransferReservation,
} from '@/lib/types/database'
import {
  ShoppingCart, Coins, Wallet, TrendingUp, Percent, Gamepad2,
} from 'lucide-react'
import { getAvailableRobux } from '@/lib/utils/accounts'

const COLOR_AVAILABLE = '#34d399'
const COLOR_RESERVED  = '#f59e0b'
const COLOR_CURRENT   = 'rgba(255,255,255,0.88)'

export default function AccountLedgerPage() {
  const params = useParams<{ id: string }>()
  const accountId = params.id

  const [account, setAccount]             = useState<RobloxAccount | null>(null)
  const [accounts, setAccounts]           = useState<RobloxAccount[]>([])
  const [orders, setOrders]               = useState<OrderWithItems[]>([])
  const [reservations, setReservations]   = useState<RobloxReservation[]>([])
  const [reassignments, setReassignments] = useState<OrderReassignment[]>([])
  const [transferLogs, setTransferLogs]   = useState<TransferLog[]>([])
  const [transferReservations, setTransferReservations] = useState<TransferReservation[]>([])
  const [loading, setLoading]             = useState(true)

  const supabaseRef = useRef(createClient())
  const supabase = supabaseRef.current

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [accRes, allAccRes, ordersRes, resRes, reassignRes, transferLogRes, transferResRes] = await Promise.all([
      supabase.from('roblox_accounts').select('*').eq('id', accountId).single(),
      supabase.from('roblox_accounts').select('*').order('username', { ascending: true }),
      supabase.from('orders').select('*, order_items(*)').eq('roblox_account_id', accountId).order('created_at', { ascending: false }),
      supabase.from('robux_reservations').select('*').eq('account_id', accountId).order('created_at', { ascending: false }),
      supabase.from('order_reassignments').select('*').or(`from_account_id.eq.${accountId},to_account_id.eq.${accountId}`).order('created_at', { ascending: false }),
      // Full history (not just today) — this page is the only place older
      // days of the Daily Transfer Tracker are visible.
      supabase.from('transfer_logs').select('*').eq('roblox_account_id', accountId).order('sent_at', { ascending: false }),
      supabase.from('transfer_reservations').select('*').eq('roblox_account_id', accountId).order('created_at', { ascending: false }),
    ])
    if (!accRes.error && accRes.data) setAccount(accRes.data)
    if (!allAccRes.error && allAccRes.data) setAccounts(allAccRes.data)
    if (!ordersRes.error && ordersRes.data) setOrders(ordersRes.data as OrderWithItems[])
    if (!resRes.error && resRes.data) setReservations(resRes.data)
    if (!reassignRes.error && reassignRes.data) setReassignments(reassignRes.data)
    if (!transferLogRes.error && transferLogRes.data) setTransferLogs(transferLogRes.data)
    if (!transferResRes.error && transferResRes.data) setTransferReservations(transferResRes.data)
    setLoading(false)
  }, [supabase, accountId])

  useEffect(() => { fetchData() }, [fetchData])

  // ── Account Statistics ───────────────────────────────────────────────────
  const stats = useMemo(() => {
    const completed = orders.filter(o => o.status === 'completed')
    const totalRobuxSold = completed.reduce((s, o) => s + (o.robux_amount ?? 0), 0)
    const totalRevenue   = completed.reduce((s, o) => s + (o.selling_price ?? 0), 0)
    const totalProfit    = completed.reduce((s, o) => s + (o.profit ?? 0), 0)
    const avgProfit      = completed.length > 0 ? totalProfit / completed.length : 0

    const gamepassMap = new Map<string, { count: number; robux: number }>()
    for (const order of completed) {
      for (const item of order.order_items ?? []) {
        const entry = gamepassMap.get(item.gamepass_name) ?? { count: 0, robux: 0 }
        entry.count += 1
        entry.robux += item.robux_amount
        gamepassMap.set(item.gamepass_name, entry)
      }
    }
    let mostPurchased = '—'
    let bestCount = -1
    let bestRobux = -1
    for (const [name, { count, robux }] of gamepassMap) {
      if (
        count > bestCount ||
        (count === bestCount && robux > bestRobux) ||
        (count === bestCount && robux === bestRobux && name < mostPurchased)
      ) {
        mostPurchased = name
        bestCount = count
        bestRobux = robux
      }
    }

    return {
      totalOrders: orders.length,
      totalRobuxSold,
      totalRevenue,
      totalProfit,
      avgProfit,
      mostPurchased,
    }
  }, [orders])

  if (loading) {
    return (
      <div>
        <TopBar title="Account Ledger" subtitle="Loading…" />
        <div className="p-5 space-y-5">
          <SkeletonCard lines={2} />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
            {[...Array(6)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
          <SkeletonTable rows={5} cols={5} />
        </div>
      </div>
    )
  }

  if (!account) {
    return (
      <div>
        <TopBar title="Account Ledger" />
        <div className="p-5">
          <div className="glass-card p-12 text-center">
            <p className="text-[14px] font-semibold mb-2" style={{ color: 'rgba(255,255,255,0.40)' }}>
              Account not found
            </p>
            <Link href="/accounts" className="text-[12px] font-semibold" style={{ color: '#22d3ee' }}>
              ← Back to Accounts
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const available = getAvailableRobux(account)

  return (
    <div>
      <TopBar title={account.username} />
      <PageHero
        badge="Account Detail"
        title={account.username}
        subtitle="Robux balance, reservations, purchase history, and full financial timeline for this account."
      />

      <div className="p-5 space-y-5">

        {/* ── Breadcrumb ── */}
        <Breadcrumb items={[{ label: 'Accounts', href: '/accounts' }, { label: account.username }]} />

        {/* ── Account header ── */}
        <div className="glass-card p-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <RobloxAvatar
                username={account.username}
                userId={account.roblox_user_id}
                size={56}
                className="text-xl"
                gradient="linear-gradient(135deg, rgba(139,92,246,0.55), rgba(34,211,238,0.45))"
                glow="0 0 14px rgba(139,92,246,0.20)"
              />
              <div className="min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <p className="text-[18px] font-bold truncate" style={{ color: 'rgba(255,255,255,0.88)' }}>
                    {account.username}
                  </p>
                  {account.has_active_discount && <DiscountBadge />}
                </div>
                <div className="mt-1">
                  <StatusBadge status={account.status} />
                </div>
              </div>
            </div>

            {/* Mini balance stats */}
            <div className="grid grid-cols-3 gap-2 sm:w-[300px] flex-shrink-0">
              <div
                className="rounded-xl p-2.5 text-center"
                style={{ background: 'rgba(255,255,255,0.055)', border: '1px solid rgba(255,255,255,0.078)' }}
              >
                <p className="label-caps mb-1">Current</p>
                <p className="tabular-nums leading-tight" style={{ fontSize: '14px', fontWeight: 800, color: COLOR_CURRENT }}>
                  {account.current_robux.toLocaleString()}
                </p>
                <p className="text-[9px] font-semibold mt-0.5" style={{ color: 'oklch(0.65 0.010 265)' }}>R$</p>
              </div>
              <div
                className="rounded-xl p-2.5 text-center"
                style={{
                  background: available > 0 ? 'rgba(52,211,153,0.07)' : 'rgba(244,63,94,0.06)',
                  border: `1px solid ${available > 0 ? 'rgba(52,211,153,0.18)' : 'rgba(244,63,94,0.18)'}`,
                }}
              >
                <p className="label-caps mb-1" style={{ color: COLOR_AVAILABLE, opacity: 0.75 }}>Available</p>
                <p className="tabular-nums leading-tight" style={{ fontSize: '14px', fontWeight: 800, color: COLOR_AVAILABLE }}>
                  {available.toLocaleString()}
                </p>
                <p className="text-[9px] font-semibold mt-0.5" style={{ color: COLOR_AVAILABLE, opacity: 0.65 }}>R$</p>
              </div>
              <div
                className="rounded-xl p-2.5 text-center"
                style={{
                  background: account.reserved_robux > 0 ? 'rgba(245,158,11,0.07)' : 'rgba(255,255,255,0.045)',
                  border: `1px solid ${account.reserved_robux > 0 ? 'rgba(245,158,11,0.18)' : 'rgba(255,255,255,0.065)'}`,
                }}
              >
                <p className="label-caps mb-1" style={{ color: account.reserved_robux > 0 ? COLOR_RESERVED : 'rgba(255,255,255,0.50)', opacity: 0.75 }}>Reserved</p>
                <p className="tabular-nums leading-tight" style={{ fontSize: '14px', fontWeight: 800, color: account.reserved_robux > 0 ? COLOR_RESERVED : 'rgba(255,255,255,0.44)' }}>
                  {account.reserved_robux.toLocaleString()}
                </p>
                <p className="text-[9px] font-semibold mt-0.5" style={{ color: account.reserved_robux > 0 ? COLOR_RESERVED : 'oklch(0.65 0.010 265)', opacity: 0.65 }}>R$</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Account Statistics ── */}
        <div className="space-y-3">
          <span className="label-caps">Account Statistics</span>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
            <StatCard
              title="Total Orders" value={`${stats.totalOrders}`} subtitle="All time"
              icon={ShoppingCart} iconColor="#a78bfa" accentColor="#a78bfa"
            />
            <StatCard
              title="Robux Sold" value={`${stats.totalRobuxSold.toLocaleString()} R$`} subtitle="Completed orders"
              icon={Coins} iconColor="#f59e0b" accentColor="#f59e0b"
            />
            <StatCard
              title="Total Revenue" value={formatPHP(stats.totalRevenue)} subtitle="Completed orders"
              icon={Wallet} iconColor="#22d3ee" accentColor="#22d3ee"
            />
            <StatCard
              title="Total Profit" value={formatPHP(stats.totalProfit)} subtitle="Completed orders"
              icon={TrendingUp} iconColor="#34d399" accentColor="#34d399"
            />
            <StatCard
              title="Avg Profit / Order" value={formatPHP(stats.avgProfit)} subtitle="Per completed order"
              icon={Percent} iconColor="#e879f9" accentColor="#e879f9"
            />
            <StatCard
              title="Top Gamepass" value={stats.mostPurchased} subtitle="Most purchased"
              icon={Gamepad2} iconColor="#22d3ee" accentColor="#a78bfa"
            />
          </div>
        </div>

        {/* ── Purchase History ── */}
        <PurchaseHistoryTable
          orders={orders}
          accounts={accounts}
          currentAccount={account}
          onReassigned={fetchData}
        />

        {/* ── Account Timeline ── */}
        <AccountTimeline
          accountId={account.id}
          orders={orders}
          reservations={reservations}
          reassignments={reassignments}
          transferLogs={transferLogs}
          transferReservations={transferReservations}
        />

      </div>
    </div>
  )
}
