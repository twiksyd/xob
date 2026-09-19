'use client'
export const dynamic = 'force-dynamic'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { addDays, format } from 'date-fns'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Coins,
  Gauge,
  PackageCheck,
  RefreshCw,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Target,
  Trophy,
  Wallet,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import CountUp from '@/components/shared/CountUp'
import StatusBadge from '@/components/shared/StatusBadge'
import { createClient } from '@/lib/supabase/client'
import { buildRecommendations } from '@/lib/recommendations'
import { FIXED_CAPITAL } from '@/lib/constants/restock'
import type { OrderWithDetails, ReservationWithDetails, RobloxAccount } from '@/lib/types/database'
import { calculateBusinessValue } from '@/lib/utils/capital'
import {
  classifyAccountHealth,
  estimateRunwayOrders,
  getAvailableRobux,
  type AccountHealthTier,
} from '@/lib/utils/accounts'
import { getGameNameStyle } from '@/lib/utils/games'
import { formatPHP, formatPHPCompact, formatRobux } from '@/lib/utils/pricing'
import { calculateAvgRobuxPerOrder, calculateWeeklyRobuxVelocity } from '@/lib/utils/velocity'

type Tone = 'good' | 'watch' | 'danger' | 'info'

const toneClass: Record<Tone, string> = {
  good: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  watch: 'border-amber-200 bg-amber-50 text-amber-800',
  danger: 'border-red-200 bg-red-50 text-red-800',
  info: 'border-blue-200 bg-blue-50 text-blue-800',
}

function sameDay(value: string | null | undefined, dayKey: string) {
  if (!value) return false
  return format(new Date(value), 'yyyy-MM-dd') === dayKey
}

function WorkCard({
  title,
  value,
  caption,
  icon: Icon,
  tone = 'info',
}: {
  title: string
  value: number | string
  caption: string
  icon: LucideIcon
  tone?: Tone
}) {
  const color = tone === 'good' ? 'text-emerald-700' : tone === 'watch' ? 'text-amber-700' : tone === 'danger' ? 'text-red-700' : 'text-blue-700'
  return (
    <div className="rounded-lg border border-[color:var(--xob-line)] bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-[13px] font-bold text-muted-foreground">{title}</p>
        <span className={`flex size-9 items-center justify-center rounded-lg ${toneClass[tone]}`}>
          <Icon className="size-4" aria-hidden="true" />
        </span>
      </div>
      {typeof value === 'number' ? (
        <CountUp value={value} format={(v) => Math.round(v).toLocaleString()} className={`block text-3xl font-black leading-none tabular-nums ${color}`} />
      ) : (
        <p className={`text-3xl font-black leading-none tabular-nums ${color}`}>{value}</p>
      )}
      <p className="mt-2 text-[12px] font-medium leading-snug text-muted-foreground">{caption}</p>
    </div>
  )
}

function ActionLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-primary px-3 text-[13px] font-black text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/35"
    >
      {label}
      <ArrowRight className="size-4" aria-hidden="true" />
    </Link>
  )
}

export default function DashboardPage() {
  const [orders, setOrders] = useState<OrderWithDetails[]>([])
  const [accounts, setAccounts] = useState<RobloxAccount[]>([])
  const [reservations, setReservations] = useState<ReservationWithDetails[]>([])
  const [walletBalance, setWalletBalance] = useState(0)
  const [loading, setLoading] = useState(true)
  const supabase = useMemo(() => createClient(), [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [ordersRes, accountsRes, resRes, walletRes] = await Promise.all([
      supabase
        .from('orders')
        .select('id, order_number, status, selling_price, cost, profit, robux_amount, created_at, completed_at, buyer_name, roblox_account_id, gamepasses(name, games(name, is_discounted)), roblox_accounts(username)')
        .order('created_at', { ascending: false }),
      supabase.from('roblox_accounts').select('*').order('created_at', { ascending: true }),
      supabase
        .from('robux_reservations')
        .select('*, roblox_accounts(username), orders(order_number, buyer_name, status)')
        .eq('status', 'active'),
      supabase.rpc('get_wallet_balance'),
    ])
    if (ordersRes.data) setOrders(ordersRes.data as unknown as OrderWithDetails[])
    if (accountsRes.data) setAccounts(accountsRes.data)
    if (resRes.data) setReservations(resRes.data as unknown as ReservationWithDetails[])
    if (walletRes.data != null) setWalletBalance(Number(walletRes.data))
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchData()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [fetchData])

  const activeAccounts = useMemo(() => accounts.filter((account) => account.status === 'active'), [accounts])
  const completedOrders = useMemo(() => orders.filter((order) => order.status === 'completed'), [orders])
  const todayKey = format(new Date(), 'yyyy-MM-dd')
  const todayCompleted = useMemo(
    () => completedOrders.filter((order) => sameDay(order.completed_at ?? order.created_at, todayKey)),
    [completedOrders, todayKey]
  )
  const waitingOrders = useMemo(
    () => orders.filter((order) => order.status === 'pending' || order.status === 'paid'),
    [orders]
  )
  const paidWaiting = waitingOrders.filter((order) => order.status === 'paid')
  const pendingPayment = waitingOrders.filter((order) => order.status === 'pending')
  const todayProfit = todayCompleted.reduce((sum, order) => sum + (order.profit ?? 0), 0)
  const todayRevenue = todayCompleted.reduce((sum, order) => sum + (order.selling_price ?? 0), 0)
  const totalRobux = accounts.reduce((sum, account) => sum + (account.current_robux ?? 0), 0)
  const reservedRobux = accounts.reduce((sum, account) => sum + (account.reserved_robux ?? 0), 0)
  const totalAvailableRobux = activeAccounts.reduce((sum, account) => sum + getAvailableRobux(account), 0)
  const avgRobuxPerOrder = useMemo(() => calculateAvgRobuxPerOrder(orders), [orders])
  const weeklyVelocity = useMemo(() => calculateWeeklyRobuxVelocity(orders), [orders])
  const runwayDays = weeklyVelocity > 0 ? totalAvailableRobux / weeklyVelocity : null
  const dailyTarget = 1500
  const targetPct = Math.min(100, Math.round((todayProfit / dailyTarget) * 100))
  const businessValue = useMemo(() => calculateBusinessValue(accounts, walletBalance), [accounts, walletBalance])
  const capitalRecoveryPct = Math.min(100, Math.round((businessValue / FIXED_CAPITAL) * 100))
  const withdrawableProfit = Math.max(0, businessValue - FIXED_CAPITAL)

  const accountHealth = useMemo(() => {
    let healthy = 0
    let low = 0
    let depleted = 0
    for (const account of activeAccounts) {
      const tier = classifyAccountHealth(account)
      if (tier === 'healthy') healthy += 1
      else if (tier === 'low') low += 1
      else depleted += 1
    }
    return { healthy, low, depleted }
  }, [activeAccounts])

  const atRiskAccounts = useMemo(
    () =>
      activeAccounts
        .map((account) => ({
          id: account.id,
          username: account.username,
          available: getAvailableRobux(account),
          reserved: account.reserved_robux ?? 0,
          tier: classifyAccountHealth(account) as AccountHealthTier,
        }))
        .filter((account) => account.tier !== 'healthy')
        .sort((a, b) => a.available - b.available)
        .slice(0, 5)
        .map((account) => ({ ...account, runway: estimateRunwayOrders(account.available, avgRobuxPerOrder) })),
    [activeAccounts, avgRobuxPerOrder]
  )

  const weekData = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => {
        const date = addDays(new Date(), index - 6)
        const key = format(date, 'yyyy-MM-dd')
        const dayOrders = completedOrders.filter((order) => sameDay(order.completed_at ?? order.created_at, key))
        return {
          label: format(date, 'EEE'),
          profit: dayOrders.reduce((sum, order) => sum + (order.profit ?? 0), 0),
          orders: dayOrders.length,
        }
      }),
    [completedOrders]
  )
  const peakProfit = Math.max(...weekData.map((day) => day.profit), 1)
  const weekOrders = weekData.reduce((sum, day) => sum + day.orders, 0)

  const topGame = useMemo(() => {
    const counts: Record<string, { count: number; discounted: boolean }> = {}
    for (const order of completedOrders) {
      const name = order.gamepasses?.games?.name
      if (!name) continue
      counts[name] = {
        count: (counts[name]?.count ?? 0) + 1,
        discounted: order.gamepasses?.games?.is_discounted ?? false,
      }
    }
    const [name, data] = Object.entries(counts).sort(([, a], [, b]) => b.count - a.count)[0] ?? []
    return name && data ? { name, ...data } : null
  }, [completedOrders])

  const recommendations = useMemo(
    () => buildRecommendations({ orders, accounts: activeAccounts, reservations }),
    [orders, activeAccounts, reservations]
  )
  const nextAction = recommendations[0]

  const readinessTone: Tone =
    paidWaiting.length > 0 || accountHealth.depleted > 0 ? 'danger' : pendingPayment.length > 0 || accountHealth.low > 0 ? 'watch' : 'good'
  const readinessText =
    paidWaiting.length > 0
      ? `${paidWaiting.length} paid order${paidWaiting.length === 1 ? '' : 's'} can be fulfilled now`
      : pendingPayment.length > 0
        ? `${pendingPayment.length} order${pendingPayment.length === 1 ? '' : 's'} waiting for payment`
        : 'No active order is blocking the desk'

  if (loading) {
    return (
      <div className="mx-auto flex min-h-[calc(100svh-4rem)] max-w-[1680px] items-center justify-center px-4">
        <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm font-bold text-muted-foreground shadow-sm">
          Loading the desk...
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex min-h-[calc(100svh-4rem)] max-w-[1680px] flex-col gap-4 px-4 py-4 sm:px-5 lg:px-6">
      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-lg border border-[color:var(--xob-line)] bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[12px] font-black text-emerald-800">
                <Sparkles className="size-3.5" aria-hidden="true" />
                Today at XOB
              </p>
              <h1 className="text-3xl font-black leading-tight tracking-tight text-foreground sm:text-4xl">
                {readinessText}
              </h1>
              <p className="mt-2 max-w-3xl text-[14px] font-medium leading-relaxed text-muted-foreground">
                {todayCompleted.length} completed today, {formatPHP(todayRevenue)} revenue logged, and {formatRobux(totalAvailableRobux)} active Robux still free to sell.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ActionLink href="/legacy/orders" label={waitingOrders.length > 0 ? 'Work Orders' : 'Open Orders'} />
              <Link
                href="/legacy/accounts"
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 text-[13px] font-black text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/35"
              >
                Check Accounts
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>

        <div className={`rounded-lg border p-5 shadow-sm ${toneClass[readinessTone]}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[12px] font-black uppercase">Next thing to do</p>
              <p className="mt-2 text-[16px] font-black leading-snug">
                {nextAction?.headline ?? 'Queue is calm. Keep selling.'}
              </p>
            </div>
            {readinessTone === 'good' ? <CheckCircle2 className="size-6" aria-hidden="true" /> : <AlertTriangle className="size-6" aria-hidden="true" />}
          </div>
          <p className="mt-3 text-[13px] font-semibold leading-relaxed opacity-80">
            {nextAction?.reasoning ?? 'No urgent holds, stale orders, or low-account warnings are currently at the top of the list.'}
          </p>
          {nextAction?.action.href && (
            <Link href={nextAction.action.href} className="mt-4 inline-flex min-h-9 items-center gap-2 rounded-lg bg-white/70 px-3 text-[12px] font-black shadow-sm">
              {nextAction.action.label}
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          )}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <WorkCard title="Waiting Orders" value={waitingOrders.length} caption={`${paidWaiting.length} paid, ${pendingPayment.length} pending payment`} icon={ShoppingCart} tone={waitingOrders.length > 0 ? 'watch' : 'good'} />
        <WorkCard title="Profit Today" value={formatPHPCompact(todayProfit)} caption={`${targetPct}% of the ${formatPHPCompact(dailyTarget)} daily target`} icon={Target} tone={todayProfit >= dailyTarget ? 'good' : 'info'} />
        <WorkCard title="Available Robux" value={formatRobux(totalAvailableRobux)} caption={`${formatRobux(reservedRobux)} reserved across active holds`} icon={Coins} tone={totalAvailableRobux > 2500 ? 'good' : 'watch'} />
        <WorkCard title="Low Accounts" value={accountHealth.low + accountHealth.depleted} caption={`${accountHealth.healthy} healthy active accounts`} icon={Gauge} tone={accountHealth.depleted > 0 ? 'danger' : accountHealth.low > 0 ? 'watch' : 'good'} />
      </section>

      <section className="grid flex-1 gap-4 xl:grid-cols-[1fr_1fr_0.8fr]">
        <div className="rounded-lg border border-[color:var(--xob-line)] bg-card p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[16px] font-black text-foreground">Order Momentum</h2>
              <p className="text-[12px] font-medium text-muted-foreground">{weekOrders} completed orders in the last 7 days</p>
            </div>
            <Trophy className="size-5 text-amber-600" aria-hidden="true" />
          </div>
          <div className="flex h-40 items-end gap-2">
            {weekData.map((day) => (
              <div key={day.label} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex h-28 w-full items-end rounded bg-muted p-1">
                  <div
                    className="w-full rounded bg-primary"
                    style={{ height: `${Math.max(8, (day.profit / peakProfit) * 100)}%` }}
                    title={`${day.label}: ${formatPHP(day.profit)} profit`}
                  />
                </div>
                <div className="text-center">
                  <p className="text-[11px] font-black text-foreground">{day.label}</p>
                  <p className="text-[10px] font-semibold text-muted-foreground">{day.orders}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-muted p-3">
              <p className="text-[11px] font-bold text-muted-foreground">Best-performing game</p>
              <p className="mt-1 truncate text-[14px] font-black" style={topGame ? getGameNameStyle(topGame.discounted) : undefined}>
                {topGame ? topGame.name : 'No completed sales yet'}
              </p>
            </div>
            <div className="rounded-lg bg-muted p-3">
              <p className="text-[11px] font-bold text-muted-foreground">Wallet balance</p>
              <p className="mt-1 text-[14px] font-black text-foreground">{formatPHP(walletBalance)}</p>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-[color:var(--xob-line)] bg-card p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[16px] font-black text-foreground">Robux Position</h2>
              <p className="text-[12px] font-medium text-muted-foreground">Current, reserved, and runway</p>
            </div>
            <PackageCheck className="size-5 text-emerald-700" aria-hidden="true" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              ['Current', formatRobux(totalRobux), 'text-foreground'],
              ['Reserved', formatRobux(reservedRobux), 'text-amber-700'],
              ['Available', formatRobux(totalAvailableRobux), 'text-emerald-700'],
            ].map(([label, value, color]) => (
              <div key={label} className="rounded-lg border border-border bg-background p-3">
                <p className="text-[11px] font-bold text-muted-foreground">{label}</p>
                <p className={`mt-1 text-[16px] font-black tabular-nums ${color}`}>{value}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[12px] font-black text-blue-900">Estimated runway</p>
              <p className="text-[18px] font-black text-blue-800">
                {runwayDays === null ? 'New' : `${Math.max(1, Math.round(runwayDays))}d`}
              </p>
            </div>
            <p className="mt-1 text-[12px] font-semibold leading-relaxed text-blue-800/80">
              Based on recent Robux velocity. Use this as a restock signal, not a financial definition.
            </p>
          </div>
          <div className="mt-4 rounded-lg bg-muted p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-[12px] font-black text-foreground">Capital recovery</p>
              <p className="text-[12px] font-black text-emerald-700">{capitalRecoveryPct}%</p>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white">
              <div className="h-full rounded-full bg-primary" style={{ width: `${capitalRecoveryPct}%` }} />
            </div>
            <p className="mt-2 text-[12px] font-semibold text-muted-foreground">
              {withdrawableProfit > 0 ? `${formatPHP(withdrawableProfit)} withdrawable after protected capital.` : 'Still protecting the original capital base.'}
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-[color:var(--xob-line)] bg-card p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[16px] font-black text-foreground">Attention List</h2>
              <p className="text-[12px] font-medium text-muted-foreground">Low balances and active work</p>
            </div>
            <ShieldCheck className="size-5 text-blue-700" aria-hidden="true" />
          </div>
          <div className="space-y-2">
            {atRiskAccounts.length === 0 ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-[14px] font-black text-emerald-800">Accounts look ready.</p>
                <p className="mt-1 text-[12px] font-semibold text-emerald-700">No active account is currently flagged as low or depleted.</p>
              </div>
            ) : (
              atRiskAccounts.map((account) => (
                <Link key={account.id} href={`/accounts/${account.id}`} className="flex items-center justify-between gap-3 rounded-lg border border-border bg-background p-3 transition-colors hover:bg-muted">
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-black text-foreground">{account.username}</span>
                    <span className="mt-1 flex items-center gap-2">
                      <StatusBadge status={account.tier === 'depleted' ? 'Bad' : 'Okay'} />
                      <span className="text-[11px] font-semibold text-muted-foreground">
                        {account.runway === null ? 'No runway yet' : `${account.runway} typical order${account.runway === 1 ? '' : 's'} left`}
                      </span>
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block text-[13px] font-black tabular-nums text-amber-700">{formatRobux(account.available)}</span>
                    <span className="block text-[10px] font-bold text-muted-foreground">available</span>
                  </span>
                </Link>
              ))
            )}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Link href="/legacy/orders" className="rounded-lg border border-border bg-background p-3 transition-colors hover:bg-muted">
              <ClipboardList className="mb-2 size-4 text-blue-700" aria-hidden="true" />
              <p className="text-[12px] font-black text-foreground">Order queue</p>
              <p className="text-[11px] font-semibold text-muted-foreground">{waitingOrders.length} waiting</p>
            </Link>
            <Link href="/legacy/wallet" className="rounded-lg border border-border bg-background p-3 transition-colors hover:bg-muted">
              <Wallet className="mb-2 size-4 text-emerald-700" aria-hidden="true" />
              <p className="text-[12px] font-black text-foreground">Wallet</p>
              <p className="text-[11px] font-semibold text-muted-foreground">Movements</p>
            </Link>
          </div>
        </div>
      </section>

      <button
        type="button"
        onClick={() => void fetchData()}
        className="fixed bottom-4 right-4 inline-flex size-11 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground shadow-lg transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/35"
        aria-label="Refresh dashboard data"
      >
        <RefreshCw className="size-4" aria-hidden="true" />
      </button>
    </div>
  )
}
