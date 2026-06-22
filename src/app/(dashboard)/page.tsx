'use client'
export const dynamic = 'force-dynamic'

import { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo, memo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { format, addDays } from 'date-fns'
import { RevenueChart } from '@/components/dashboard/DashboardCharts'
import NextBestAction from '@/components/dashboard/NextBestAction'
import { buildRecommendations } from '@/lib/recommendations'
import { motion, useScroll, useTransform, useMotionValueEvent, type Variants, type MotionValue } from 'framer-motion'
import { ambientFloat, ambientDrift } from '@/lib/motion'
import {
  ShoppingCart, ArrowUpRight, Coins, TrendingUp, Wallet,
  PiggyBank, Trophy, ShieldCheck, ChevronDown, CheckCircle2,
} from 'lucide-react'
import CountUp from '@/components/shared/CountUp'
import { formatRobux, formatPHP } from '@/lib/utils/pricing'
import {
  getAvailableRobux, classifyAccountHealth, estimateRunwayOrders, type AccountHealthTier,
} from '@/lib/utils/accounts'
import { calculateAvgRobuxPerOrder, calculateWeeklyRobuxVelocity } from '@/lib/utils/velocity'
import { getOperationalStatus, getSupplierDecision, type StatusLevel } from '@/lib/utils/operationalStatus'
import { calculateBusinessValue } from '@/lib/utils/capital'
import { FIXED_CAPITAL } from '@/lib/constants/restock'
import type { CSSProperties } from 'react'
import {
  OrderWithDetails, RobloxAccount, ReservationWithDetails, SavingsGoal,
} from '@/lib/types/database'

const CHAPTER_COUNT = 5

// "Focus pull" reveal — blur + scale settle, slower and more cinematic than a plain fade-up
const EASE = [0.16, 1, 0.3, 1] as const

// Shared input/output curves for the per-chapter scroll-progress dominance effect:
// fades in over the first 15% of the chapter's transit through the viewport,
// holds full dominance through the middle, fades out over the last 15% as
// the next chapter starts arriving underneath it — a continuous cross-dissolve,
// driven entirely by scroll position (no snapping, no scroll interception).
// Opacity-only (no scale): animating scale forces the browser to manage the
// whole section as a continuously-resizing layer every scroll frame, which is
// dramatically more expensive than an opacity blend across 5 concurrent
// instances — this was the largest remaining scroll-jank contributor.
const DOMINANCE_INPUT: number[] = [0, 0.15, 0.85, 1]
const OPACITY_OUTPUT: number[] = [0, 1, 1, 0]

// Piecewise-linear interpolation, clamped at the ends — replicates exactly what
// Framer Motion's array-based useTransform(value, inputRange, outputRange)
// does internally. Used because the consolidated single-scroll-source approach
// derives each chapter's curve via a custom function rather than a direct
// array-based useTransform, but must produce identical visual output.
function piecewiseLerp(t: number, input: number[], output: number[]): number {
  if (t <= input[0]) return output[0]
  const last = input.length - 1
  if (t >= input[last]) return output[last]
  for (let i = 0; i < last; i++) {
    if (t >= input[i] && t <= input[i + 1]) {
      const localT = (t - input[i]) / (input[i + 1] - input[i])
      return output[i] + localT * (output[i + 1] - output[i])
    }
  }
  return output[last]
}

const chapterStagger: Variants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.11, delayChildren: 0.15 } },
}

const chapterItem: Variants = {
  initial: { opacity: 0, y: 20, scale: 0.92 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.7, ease: EASE } },
}

// ── Ambient blob (decorative, looping — never affects layout) ────────────────
// Outer div carries the scroll-driven parallax offset (a plain reactive MotionValue,
// no animation loop); inner div carries the existing infinite float/drift loop.
// Kept on separate elements so the two motion systems never fight over the same
// transform channel.
//
// `opacity` is the chapter's own dominance motion value, already 0 whenever
// that chapter is outside its active transit window (clamped by the dominance
// curve) — i.e. it's already a free, zero-extra-cost signal for "this chapter
// is the active one, or an immediate neighbor mid cross-fade." We piggyback on
// it (via a local boolean, not a prop the parent re-renders for) to stop the
// infinite float/drift loop for every blob that isn't currently relevant,
// instead of all 6 blobs animating continuously regardless of scroll position.

function Blob({ color, width, height, style, drift, parallax, opacity }: {
  color: string; width: number; height: number; style?: CSSProperties; drift?: boolean
  parallax?: MotionValue<number>
  opacity: MotionValue<number>
}) {
  const [isNearActive, setIsNearActive] = useState(true)
  useMotionValueEvent(opacity, 'change', (latest) => {
    const next = latest > 0
    if (next !== isNearActive) setIsNearActive(next)
  })

  return (
    <motion.div
      aria-hidden
      style={{
        position: 'absolute', width, height, pointerEvents: 'none',
        y: parallax, willChange: 'transform',
        ...style,
      }}
    >
      <motion.div
        variants={drift ? ambientDrift : ambientFloat}
        animate={isNearActive ? 'animate' : false}
        style={{
          width: '100%', height: '100%', background: color, borderRadius: '50%',
          filter: `blur(${Math.round(Math.max(width, height) * 0.18)}px)`,
        }}
      />
    </motion.div>
  )
}

// ── Chapter chrome ─────────────────────────────────────────────────────────

function ChapterEyebrow({ index, label }: { index: number; label: string }) {
  return (
    <motion.div
      className="flex items-center justify-center gap-3 mb-5"
      initial={{ opacity: 0, scale: 0.85, letterSpacing: '0.3em' }}
      whileInView={{ opacity: 1, scale: 1, letterSpacing: '0em' }}
      viewport={{ once: false, amount: 0.5 }}
      transition={{ duration: 0.75, ease: EASE }}
    >
      <span className="text-[10px] font-black tracking-[0.12em] uppercase" style={{ color: 'rgba(255,255,255,0.20)' }}>
        Chapter {String(index).padStart(2, '0')} / {String(CHAPTER_COUNT).padStart(2, '0')}
      </span>
      <span style={{ width: 24, height: 1, background: 'rgba(255,255,255,0.14)', display: 'inline-block', flexShrink: 0 }} />
      <span className="label-caps">{label}</span>
    </motion.div>
  )
}

function ChapterDots({ active, onJump }: { active: number; onJump: (i: number) => void }) {
  return (
    <div className="hidden lg:flex fixed right-6 top-1/2 -translate-y-1/2 z-30 flex-col items-center gap-4">
      {Array.from({ length: CHAPTER_COUNT }).map((_, i) => (
        <button
          key={i}
          type="button"
          onClick={() => onJump(i)}
          aria-label={`Go to chapter ${i + 1}`}
          className="rounded-full transition-all duration-300"
          style={{
            width: active === i ? 9 : 6,
            height: active === i ? 9 : 6,
            background: active === i ? '#22d3ee' : 'rgba(255,255,255,0.22)',
            boxShadow: active === i ? '0 0 10px rgba(34,211,238,0.75)' : 'none',
          }}
        />
      ))}
    </div>
  )
}

function FooterLink({ href, label }: { href: string; label: string }) {
  return (
    <motion.a
      href={href}
      className="inline-flex items-center gap-1.5 text-[12px] font-bold mt-6"
      style={{ color: '#22d3ee' }}
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: false, amount: 0.5 }}
      transition={{ duration: 0.6, delay: 0.4, ease: EASE }}
    >
      {label} <ArrowUpRight className="w-3.5 h-3.5" />
    </motion.a>
  )
}

// Bottom-center "scroll to next chapter" affordance — purely additive, doesn't
// touch the scroll-snap mechanics. Gives people an obvious, clickable way to
// advance instead of having to discover that a scroll/swipe gesture does it.
function NextChapterButton({ onClick }: { onClick: () => void }) {
  return (
    <motion.div
      className="absolute z-20 flex items-center justify-center"
      style={{ bottom: 28, left: '50%', x: '-50%' }}
      animate={{ y: [0, 7, 0] }}
      transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
    >
      <motion.button
        type="button"
        onClick={onClick}
        aria-label="Scroll to next chapter"
        whileHover={{ scale: 1.12, borderColor: 'rgba(34,211,238,0.45)' }}
        whileTap={{ scale: 0.9 }}
        className="flex items-center justify-center rounded-full"
        style={{
          width: 42, height: 42,
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.16)',
          backdropFilter: 'blur(20px) saturate(160%)',
          WebkitBackdropFilter: 'blur(20px) saturate(160%)',
        }}
      >
        <ChevronDown style={{ width: 18, height: 18, color: 'rgba(255,255,255,0.70)' }} />
      </motion.button>
    </motion.div>
  )
}

// ── Status / decision cards (Command Center) ────────────────────────────────

const STATUS_COLORS: Record<StatusLevel, { bg: string; border: string; icon: string }> = {
  green:  { bg: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.24)', icon: '🟢' },
  yellow: { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.24)', icon: '🟡' },
  red:    { bg: 'rgba(244,63,94,0.08)',  border: 'rgba(244,63,94,0.24)',  icon: '🔴' },
}

function StatusCard({ level, message }: { level: StatusLevel; message: string }) {
  const c = STATUS_COLORS[level]
  return (
    <motion.div
      variants={chapterItem}
      className="rounded-xl px-4 py-3.5 flex items-center gap-3 text-left"
      style={{ background: c.bg, border: `1px solid ${c.border}` }}
    >
      <span style={{ fontSize: 17, flexShrink: 0 }}>{c.icon}</span>
      <div>
        <p className="label-caps mb-0.5">Operational Status</p>
        <p className="text-[12.5px] font-semibold leading-snug" style={{ color: 'rgba(255,255,255,0.85)' }}>{message}</p>
      </div>
    </motion.div>
  )
}

function SupplierDecisionCard({ verdict, message }: { verdict: string; message: string }) {
  return (
    <motion.div
      variants={chapterItem}
      className="rounded-xl px-4 py-3.5 text-left"
      style={{ background: 'rgba(167,139,250,0.07)', border: '1px solid rgba(167,139,250,0.22)' }}
    >
      <p className="label-caps mb-1" style={{ color: '#a78bfa' }}>Supplier Decision</p>
      <p className="text-[14px] font-extrabold mb-1" style={{ color: 'rgba(255,255,255,0.92)' }}>{verdict}</p>
      <p className="text-[12px] leading-snug" style={{ color: 'rgba(255,255,255,0.55)' }}>{message}</p>
    </motion.div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────
// Data-fetching shell only. The chapters (and everything ref/scroll-driven —
// useScroll needs its target ref to be attached to a real, mounted DOM node
// from the moment it's set up, or it throws "ref is defined but not hydrated").
// While loading=true this returns a totally different tree (just a spinner),
// so the chapter sections — and their refs — don't exist yet. Mounting the
// scroll-driven chapters in their own child component means their refs and
// useScroll() always initialize together with the real DOM nodes, never before.

export default function DashboardPage() {
  const [orders, setOrders] = useState<OrderWithDetails[]>([])
  const [accounts, setAccounts] = useState<RobloxAccount[]>([])
  const [reservations, setReservations] = useState<ReservationWithDetails[]>([])
  const [, setSavingsGoals] = useState<SavingsGoal[]>([])
  const [walletBalance, setWalletBalance] = useState(0)
  const [, setGamepassCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const supabase = useMemo(() => createClient(), [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [ordersRes, accountsRes, gpRes, resRes, goalsRes, walletRes] = await Promise.all([
      supabase
        .from('orders')
        .select('id, order_number, status, selling_price, cost, profit, robux_amount, created_at, completed_at, buyer_name, roblox_account_id, gamepasses(name, games(name)), roblox_accounts(username)')
        .order('created_at', { ascending: false }),
      supabase.from('roblox_accounts').select('*').order('created_at', { ascending: true }),
      supabase.from('gamepasses').select('id'),
      supabase.from('robux_reservations')
        .select('*, roblox_accounts(username), orders(order_number, buyer_name, status)')
        .eq('status', 'active'),
      supabase.from('savings_goals').select('*').order('priority'),
      supabase.rpc('get_wallet_balance'),
    ])
    if (ordersRes.data) setOrders(ordersRes.data as unknown as OrderWithDetails[])
    if (accountsRes.data) setAccounts(accountsRes.data)
    if (gpRes.data) setGamepassCount(gpRes.data.length)
    if (resRes.data) setReservations(resRes.data as unknown as ReservationWithDetails[])
    if (goalsRes.data) setSavingsGoals(goalsRes.data)
    if (walletRes.data != null) setWalletBalance(Number(walletRes.data))
    setLoading(false)
  }, [supabase])

  useEffect(() => { fetchData() }, [fetchData])

  const completedOrders = useMemo(() => orders.filter(o => o.status === 'completed'), [orders])
  const totalRobux = accounts.reduce((s, a) => s + (a.current_robux ?? 0), 0)
  const totalProfit = completedOrders.reduce((s, o) => s + (o.profit ?? 0), 0)
  const activeAccounts = useMemo(() => accounts.filter(a => a.status === 'active'), [accounts])

  const advanceOrder = useCallback(async (order: OrderWithDetails, nextStatus: 'paid' | 'completed') => {
    await supabase.rpc('transition_order', { p_order_id: order.id, p_new_status: nextStatus })
    await fetchData()
  }, [supabase, fetchData])

  const recommendations = useMemo(() => buildRecommendations({
    orders, accounts: activeAccounts, reservations, onAdvanceOrder: advanceOrder,
  }), [orders, activeAccounts, reservations, advanceOrder])

  const outstandingCount = useMemo(() =>
    orders.filter(o => o.status === 'pending' || o.status === 'paid').length,
    [orders])
  const completedCount = completedOrders.length

  // ── Inventory Health — single source of truth for account tiering, shared
  //    by the Inventory Health chapter and the Supplier Decision card ────────
  const accountHealth = useMemo(() => {
    let healthy = 0, low = 0, depleted = 0
    for (const a of activeAccounts) {
      const tier = classifyAccountHealth(a)
      if (tier === 'healthy') healthy++
      else if (tier === 'low') low++
      else depleted++
    }
    return { healthy, low, depleted }
  }, [activeAccounts])

  const criticalAccounts = accountHealth.low + accountHealth.depleted

  const avgRobuxPerOrder = useMemo(() => calculateAvgRobuxPerOrder(orders), [orders])

  const atRiskAccounts = useMemo(() =>
    activeAccounts
      .map(a => ({
        id: a.id,
        username: a.username,
        available: getAvailableRobux(a),
        tier: classifyAccountHealth(a) as AccountHealthTier,
      }))
      .filter(a => a.tier !== 'healthy')
      .sort((a, b) => a.available - b.available)
      .slice(0, 5)
      .map(a => ({ ...a, runway: estimateRunwayOrders(a.available, avgRobuxPerOrder) })),
    [activeAccounts, avgRobuxPerOrder])

  // ── Operational Status + Supplier Decision — "am I safe today" and "what do
  //    I tell my supplier," both driven by available Robux vs. recent burn
  //    rate, never by wallet balance ───────────────────────────────────────
  const totalAvailableRobux = useMemo(() => activeAccounts.reduce((s, a) => s + getAvailableRobux(a), 0), [activeAccounts])
  const weeklyVelocity = useMemo(() => calculateWeeklyRobuxVelocity(orders), [orders])
  const runwayDays = weeklyVelocity > 0 ? totalAvailableRobux / weeklyVelocity : null

  const operationalStatus = useMemo(
    () => getOperationalStatus(totalAvailableRobux, weeklyVelocity),
    [totalAvailableRobux, weeklyVelocity])

  const supplierDecision = useMemo(
    () => getSupplierDecision(criticalAccounts, runwayDays),
    [criticalAccounts, runwayDays])

  const revenueData = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const date = addDays(new Date(), i - 6)
    const dateStr = format(date, 'yyyy-MM-dd')
    const dayOrders = completedOrders.filter(o => format(new Date(o.created_at), 'yyyy-MM-dd') === dateStr)
    return {
      day: format(date, 'EEE'),
      revenue: dayOrders.reduce((s, o) => s + (o.selling_price ?? 0), 0),
      profit: dayOrders.reduce((s, o) => s + (o.profit ?? 0), 0),
      orders: dayOrders.length,
    }
  }), [completedOrders])

  const topGame = useMemo(() => {
    const counts: Record<string, number> = {}
    completedOrders.forEach(o => {
      const name = o.gamepasses?.games?.name
      if (name) counts[name] = (counts[name] ?? 0) + 1
    })
    const sorted = Object.entries(counts).sort(([, a], [, b]) => b - a)
    return sorted.length > 0 ? { name: sorted[0][0], count: sorted[0][1] } : null
  }, [completedOrders])

  const todayStr = format(new Date(), 'yyyy-MM-dd')
  const todayProfit = useMemo(() =>
    completedOrders
      .filter(o => format(new Date(o.created_at), 'yyyy-MM-dd') === todayStr)
      .reduce((s, o) => s + (o.profit ?? 0), 0),
    [completedOrders, todayStr])

  const weekRevenue = useMemo(() => revenueData.reduce((s, d) => s + d.revenue, 0), [revenueData])
  const ordersThisWeek = useMemo(() => revenueData.reduce((s, d) => s + d.orders, 0), [revenueData])
  const avgOrderValue = ordersThisWeek > 0 ? weekRevenue / ordersThisWeek : 0

  // Capital position — same formulas as the Capital Position card, reused as-is
  const businessValue = useMemo(() => calculateBusinessValue(accounts, walletBalance), [accounts, walletBalance])
  const isCapitalRecovered = businessValue >= FIXED_CAPITAL
  const capitalRecoveryPct = (businessValue / FIXED_CAPITAL) * 100
  const withdrawableProfit = Math.max(0, businessValue - FIXED_CAPITAL)

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: 'calc(100svh - 5rem)' }}>
        <div className="spinner" />
      </div>
    )
  }

  return (
    // DashboardChapters calls useSearchParams() (for the ?chapter=N deep link)
    // — Next.js requires a Suspense boundary around that, or the build's
    // prerender pass fails even on a force-dynamic page.
    <Suspense fallback={null}>
      <DashboardChapters
        totalRobux={totalRobux}
        walletBalance={walletBalance}
        todayProfit={todayProfit}
        totalProfit={totalProfit}
        operationalStatus={operationalStatus}
        supplierDecision={supplierDecision}
        recommendations={recommendations}
        outstandingCount={outstandingCount}
        completedCount={completedCount}
        weekRevenue={weekRevenue}
        revenueData={revenueData}
        ordersThisWeek={ordersThisWeek}
        avgOrderValue={avgOrderValue}
        topGame={topGame}
        totalActiveAccounts={activeAccounts.length}
        criticalAccounts={criticalAccounts}
        accountHealth={accountHealth}
        atRiskAccounts={atRiskAccounts}
        businessValue={businessValue}
        isCapitalRecovered={isCapitalRecovered}
        capitalRecoveryPct={capitalRecoveryPct}
        withdrawableProfit={withdrawableProfit}
      />
    </Suspense>
  )
}

// ── Chapters — mounts only once data has loaded, so every chapterNRef below is
//    guaranteed to attach to a real DOM node in the same pass useScroll() is
//    set up in. ─────────────────────────────────────────────────────────────

interface AtRiskAccount {
  id: string
  username: string
  available: number
  tier: AccountHealthTier
  runway: number | null
}

interface DashboardChaptersProps {
  totalRobux: number
  walletBalance: number
  todayProfit: number
  totalProfit: number
  operationalStatus: { level: StatusLevel; message: string }
  supplierDecision: { verdict: string; message: string }
  recommendations: ReturnType<typeof buildRecommendations>
  outstandingCount: number
  completedCount: number
  weekRevenue: number
  revenueData: { day: string; revenue: number; profit: number }[]
  ordersThisWeek: number
  avgOrderValue: number
  topGame: { name: string; count: number } | null
  totalActiveAccounts: number
  criticalAccounts: number
  accountHealth: { healthy: number; low: number; depleted: number }
  atRiskAccounts: AtRiskAccount[]
  businessValue: number
  isCapitalRecovered: boolean
  capitalRecoveryPct: number
  withdrawableProfit: number
}

function DashboardChapters(props: DashboardChaptersProps) {
  const [activeChapter, setActiveChapter] = useState(0)
  const router = useRouter()
  const searchParams = useSearchParams()

  // jumpToChapter calls router.replace() to set ?chapter=N, which changes
  // searchParams' identity on every single jump — so depending on searchParams
  // directly would still recreate jumpToChapter (and bust ChapterSections'
  // memo) on every click, just no longer on every scroll-driven activeChapter
  // change. Capturing the latest value in a ref (kept in sync below) lets
  // jumpToChapter read current params without ever needing to change identity.
  const searchParamsRef = useRef(searchParams)
  useEffect(() => { searchParamsRef.current = searchParams }, [searchParams])

  // ── Slideshow scroll-snap — scoped to this route only ───────────────────
  // Toggles scroll-snap-type on the real <html> scroll root (no nested
  // wrapper) for as long as the Dashboard is mounted, so every other route
  // keeps its normal, unsnapped scrolling untouched.
  useEffect(() => {
    document.documentElement.classList.add('dashboard-snap-scroll')
    return () => { document.documentElement.classList.remove('dashboard-snap-scroll') }
  }, [])

  // One ref per chapter (fixed count, not a dynamically-sized array) — needed so
  // each chapter can scope its own useScroll() to its own viewport transit instead
  // of tracking whole-page scroll progress. This component only ever mounts with
  // its full JSX tree present, so these attach immediately — no hydration gap.
  const chapter0Ref = useRef<HTMLElement>(null)
  const chapter1Ref = useRef<HTMLElement>(null)
  const chapter2Ref = useRef<HTMLElement>(null)
  const chapter3Ref = useRef<HTMLElement>(null)
  const chapter4Ref = useRef<HTMLElement>(null)
  // Memoized so its identity stays stable across re-renders — refs themselves
  // never change identity, so this array can safely be a dependency without
  // ever forcing jumpToChapter (below) to be recreated.
  const sectionRefs = useMemo(
    () => [chapter0Ref, chapter1Ref, chapter2Ref, chapter3Ref, chapter4Ref],
    [],
  )

  // ── Single page-level scroll source ───────────────────────────────────────
  // Previously each chapter ran its own useScroll({ target }) — 5 independent
  // scroll subscriptions, each tracking its own element's bounding-rect
  // position on every scroll frame. Consolidated into one: a single window
  // scroll-position motion value, with each chapter's local dominance progress
  // derived from it via useTransform. Chapter positions/heights are measured
  // once (mount + resize + a ResizeObserver per section, since Inventory
  // Health's height varies with the at-risk-accounts list) rather than read
  // from the DOM on every scroll frame — the expensive part moved out of the
  // scroll hot path entirely. Still tracks native window/document scroll;
  // nothing here intercepts or alters scrolling.
  const { scrollY } = useScroll()

  const [layout, setLayout] = useState<{ tops: number[]; heights: number[]; viewportHeight: number }>({
    tops: [0, 0, 0, 0, 0], heights: [0, 0, 0, 0, 0], viewportHeight: 0,
  })

  useLayoutEffect(() => {
    function measure() {
      setLayout({
        tops: sectionRefs.map((r) => {
          const el = r.current
          return el ? el.getBoundingClientRect().top + window.scrollY : 0
        }),
        heights: sectionRefs.map((r) => r.current?.getBoundingClientRect().height ?? 0),
        viewportHeight: window.innerHeight,
      })
    }
    measure()
    window.addEventListener('resize', measure)
    const ro = new ResizeObserver(measure)
    sectionRefs.forEach((r) => { if (r.current) ro.observe(r.current) })
    return () => {
      window.removeEventListener('resize', measure)
      ro.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // A chapter's local progress: 0 when its top reaches the bottom of the
  // viewport, 1 when its bottom reaches the top — identical semantics to the
  // old per-target useScroll offset of ['start end', 'end start'].
  function localProgress(i: number, y: number): number {
    const top = layout.tops[i]
    const vh = layout.viewportHeight
    const range = layout.heights[i] + vh
    if (range <= 0) return 0
    return Math.min(1, Math.max(0, (y - (top - vh)) / range))
  }

  const chapter0Opacity = useTransform(scrollY, (y) => piecewiseLerp(localProgress(0, y), DOMINANCE_INPUT, OPACITY_OUTPUT))
  const chapter0ParallaxA = useTransform(scrollY, (y) => piecewiseLerp(localProgress(0, y), [0, 1], [-30, 30]))
  const chapter0ParallaxB = useTransform(scrollY, (y) => piecewiseLerp(localProgress(0, y), [0, 1], [-55, 55]))

  const chapter1Opacity = useTransform(scrollY, (y) => piecewiseLerp(localProgress(1, y), DOMINANCE_INPUT, OPACITY_OUTPUT))
  const chapter1Parallax = useTransform(scrollY, (y) => piecewiseLerp(localProgress(1, y), [0, 1], [-35, 35]))

  const chapter2Opacity = useTransform(scrollY, (y) => piecewiseLerp(localProgress(2, y), DOMINANCE_INPUT, OPACITY_OUTPUT))
  const chapter2Parallax = useTransform(scrollY, (y) => piecewiseLerp(localProgress(2, y), [0, 1], [-35, 35]))

  const chapter3Opacity = useTransform(scrollY, (y) => piecewiseLerp(localProgress(3, y), DOMINANCE_INPUT, OPACITY_OUTPUT))
  const chapter3Parallax = useTransform(scrollY, (y) => piecewiseLerp(localProgress(3, y), [0, 1], [-35, 35]))

  const chapter4Opacity = useTransform(scrollY, (y) => piecewiseLerp(localProgress(4, y), DOMINANCE_INPUT, OPACITY_OUTPUT))
  const chapter4Parallax = useTransform(scrollY, (y) => piecewiseLerp(localProgress(4, y), [0, 1], [-35, 35]))

  // ── Chapter visibility tracking — tracks against the window, since the
  //    page scrolls naturally instead of through a custom container ──────────
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            const idx = Number(entry.target.getAttribute('data-chapter'))
            if (!Number.isNaN(idx)) setActiveChapter(idx)
          }
        })
      },
      { root: null, threshold: [0.5, 0.6, 0.75] }
    )
    sectionRefs.forEach((r) => { if (r.current) observer.observe(r.current) })
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Truly stable identity (useCallback, never recreated) — passed down to the
  // memoized ChapterSections (for the per-chapter "next" button) and to
  // ChapterDots. Reads searchParamsRef.current instead of searchParams
  // directly so calling it doesn't recreate it.
  const jumpToChapter = useCallback((i: number, behavior: ScrollBehavior = 'smooth') => {
    sectionRefs[i]?.current?.scrollIntoView({ behavior, block: 'start' })
    const params = new URLSearchParams(searchParamsRef.current.toString())
    const humanIndex = String(i + 1)
    if (i === 0) params.delete('chapter')
    else params.set('chapter', humanIndex)
    const qs = params.toString()
    router.replace(qs ? `/?${qs}` : '/', { scroll: false })
  }, [sectionRefs, router])

  // ── Deep link: ?chapter=3 lands directly on that chapter, no animated scroll ──
  useEffect(() => {
    const raw = Number(searchParams.get('chapter'))
    if (Number.isInteger(raw) && raw >= 1 && raw <= CHAPTER_COUNT) {
      jumpToChapter(raw - 1, 'auto')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="relative overflow-x-hidden">
      <ChapterDots active={activeChapter} onJump={jumpToChapter} />
      <ChapterSections
        {...props}
        onJump={jumpToChapter}
        chapter0Ref={chapter0Ref} chapter1Ref={chapter1Ref} chapter2Ref={chapter2Ref}
        chapter3Ref={chapter3Ref} chapter4Ref={chapter4Ref}
        chapter0Opacity={chapter0Opacity}
        chapter0ParallaxA={chapter0ParallaxA} chapter0ParallaxB={chapter0ParallaxB}
        chapter1Opacity={chapter1Opacity} chapter1Parallax={chapter1Parallax}
        chapter2Opacity={chapter2Opacity} chapter2Parallax={chapter2Parallax}
        chapter3Opacity={chapter3Opacity} chapter3Parallax={chapter3Parallax}
        chapter4Opacity={chapter4Opacity} chapter4Parallax={chapter4Parallax}
      />
    </div>
  )
}

// ── ChapterSections — the actual chapter content. Memoized so that activeChapter
//    updates (which fire on every chapter-boundary crossing while scrolling) only
//    re-render DashboardChapters + ChapterDots, not this entire heavy tree (the
//    Recharts chart, every CountUp counter, NextBestAction). None of this
//    component's props change on a chapter-boundary crossing — the business-data
//    props are memoized in DashboardPage (untouched by activeChapter, which lives
//    one level below it), the refs are stable by definition, and the motion
//    values returned by useTransform keep a stable identity across re-renders —
//    so memo correctly skips re-rendering this on every scroll-driven activeChapter
//    change, which is what was causing the scroll-stutter at chapter boundaries. ──

interface ChapterSectionsProps extends DashboardChaptersProps {
  onJump: (i: number, behavior?: ScrollBehavior) => void
  chapter0Ref: React.RefObject<HTMLElement | null>
  chapter1Ref: React.RefObject<HTMLElement | null>
  chapter2Ref: React.RefObject<HTMLElement | null>
  chapter3Ref: React.RefObject<HTMLElement | null>
  chapter4Ref: React.RefObject<HTMLElement | null>
  chapter0Opacity: MotionValue<number>
  chapter0ParallaxA: MotionValue<number>
  chapter0ParallaxB: MotionValue<number>
  chapter1Opacity: MotionValue<number>
  chapter1Parallax: MotionValue<number>
  chapter2Opacity: MotionValue<number>
  chapter2Parallax: MotionValue<number>
  chapter3Opacity: MotionValue<number>
  chapter3Parallax: MotionValue<number>
  chapter4Opacity: MotionValue<number>
  chapter4Parallax: MotionValue<number>
}

const ChapterSections = memo(function ChapterSections({
  totalRobux, walletBalance, todayProfit, totalProfit,
  operationalStatus, supplierDecision, recommendations, outstandingCount, completedCount,
  weekRevenue, revenueData, ordersThisWeek, avgOrderValue, topGame,
  totalActiveAccounts, criticalAccounts, accountHealth, atRiskAccounts,
  businessValue, isCapitalRecovered, capitalRecoveryPct, withdrawableProfit,
  onJump,
  chapter0Ref, chapter1Ref, chapter2Ref, chapter3Ref, chapter4Ref,
  chapter0Opacity, chapter0ParallaxA, chapter0ParallaxB,
  chapter1Opacity, chapter1Parallax,
  chapter2Opacity, chapter2Parallax,
  chapter3Opacity, chapter3Parallax,
  chapter4Opacity, chapter4Parallax,
}: ChapterSectionsProps) {
  return (
    <>
      {/* ══════════════════════════════════════════════════════════════
          CHAPTER 01 · OVERVIEW — Is the business healthy?
      ══════════════════════════════════════════════════════════════ */}
      <motion.section
        ref={chapter0Ref}
        data-chapter={0}
        className="chapter-section relative flex items-center justify-center px-6 sm:px-10"
        style={{ opacity: chapter0Opacity, willChange: 'opacity' }}
      >
        <Blob color="rgba(139,92,246,0.16)" width={760} height={760} style={{ top: '-22%', left: '50%', x: '-50%' }} parallax={chapter0ParallaxA} opacity={chapter0Opacity} />
        <Blob color="rgba(34,211,238,0.09)" width={420} height={420} style={{ bottom: '-12%', right: '4%' }} drift parallax={chapter0ParallaxB} opacity={chapter0Opacity} />
        <NextChapterButton onClick={() => onJump(1)} />

        <div className="relative z-10 w-full max-w-[980px] mx-auto text-center">
          <ChapterEyebrow index={1} label="Overview" />

          <motion.h1
            className="font-black tracking-tight leading-[1.02] mb-4"
            style={{ fontSize: 'clamp(2rem, 4.8vw, 3.8rem)' }}
            initial={{ opacity: 0, y: 34, scale: 0.95 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: false, amount: 0.5 }}
            transition={{ duration: 0.95, ease: EASE }}
          >
            Your Robux Business{' '}
            <span style={{ background: 'linear-gradient(135deg, #22d3ee 0%, #a78bfa 60%, rgba(255,255,255,0.88) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              At a Glance
            </span>
          </motion.h1>

          <motion.p
            className="text-[14px] mb-9"
            style={{ color: 'rgba(255,255,255,0.40)' }}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: false, amount: 0.5 }}
            transition={{ duration: 0.7, delay: 0.25, ease: EASE }}
          >
            Scroll for what needs you, how sales are going, and where your capital stands.
          </motion.p>

          <motion.div
            className="grid grid-cols-2 sm:grid-cols-4 gap-3"
            variants={chapterStagger}
            initial="initial"
            whileInView="animate"
            viewport={{ once: false, amount: 0.5 }}
          >
            {([
              { label: 'Robux Inventory', value: totalRobux,    fmt: (v: number) => formatRobux(v), color: '#22d3ee', icon: Coins },
              { label: 'Wallet Balance',  value: walletBalance, fmt: (v: number) => formatPHP(v),   color: '#34d399', icon: Wallet },
              { label: "Today's Profit",  value: todayProfit,   fmt: (v: number) => formatPHP(v),   color: '#a78bfa', icon: TrendingUp },
              { label: 'Lifetime Profit', value: totalProfit,   fmt: (v: number) => formatPHP(v),   color: '#f59e0b', icon: ShoppingCart },
            ] as const).map(({ label, value, fmt, color, icon: Icon }) => (
              <motion.div
                key={label}
                variants={chapterItem}
                className="rounded-2xl p-4 text-left"
                style={{ background: 'rgba(255,255,255,0.032)', border: `1px solid ${color}20` }}
              >
                <div className="flex items-center gap-1.5 mb-2">
                  <Icon style={{ width: 12, height: 12, color }} />
                  <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.30)' }}>{label}</span>
                </div>
                <CountUp value={value} format={fmt} duration={2.0} className="text-[20px] font-black tabular-nums block leading-none" style={{ color }} />
              </motion.div>
            ))}
          </motion.div>

          {/* ── New Order — the primary action of the business, composed into the hero ── */}
          <motion.div
            className="flex justify-center mt-8"
            initial={{ opacity: 0, y: 24, scale: 0.95 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: false, amount: 0.5 }}
            transition={{ duration: 0.7, delay: 0.45, ease: EASE }}
          >
            <Link href="/orders?create=1" className="w-full" style={{ maxWidth: 400 }} aria-label="Create a new order">
              <motion.div
                whileHover={{ y: -3, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="realism-btn"
              >
                <div className="realism-btn-blob1" />
                <div className="realism-btn-blob2" />
                <div className="realism-btn-inner">New Order</div>
              </motion.div>
            </Link>
          </motion.div>
        </div>
      </motion.section>

      {/* ══════════════════════════════════════════════════════════════
          CHAPTER 02 · COMMAND CENTER — What should I do next?
      ══════════════════════════════════════════════════════════════ */}
      <motion.section
        ref={chapter1Ref}
        data-chapter={1}
        className="chapter-section relative flex items-center justify-center px-6 sm:px-10"
        style={{ opacity: chapter1Opacity, willChange: 'opacity' }}
      >
        <Blob color="rgba(34,211,238,0.10)" width={600} height={600} style={{ bottom: '-18%', left: '50%', x: '-50%' }} drift parallax={chapter1Parallax} opacity={chapter1Opacity} />
        <NextChapterButton onClick={() => onJump(2)} />

        <div className="relative z-10 w-full max-w-[820px] mx-auto text-center">
          <ChapterEyebrow index={2} label="Command Center" />

          <motion.h2
            className="font-black leading-tight mb-6"
            style={{ fontSize: 'clamp(1.8rem, 4.2vw, 3.2rem)' }}
            initial={{ opacity: 0, y: 32, scale: 0.95 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: false, amount: 0.5 }}
            transition={{ duration: 0.9, ease: EASE }}
          >
            {outstandingCount > 0 ? (
              <>
                <span style={{ color: '#f59e0b' }}>{outstandingCount}</span>
                <span style={{ color: 'rgba(255,255,255,0.88)' }}> order{outstandingCount !== 1 ? 's' : ''} waiting on you</span>
              </>
            ) : (
              <>
                <span style={{ color: '#34d399' }}>All clear</span>
                <span style={{ color: 'rgba(255,255,255,0.88)' }}> — nothing needs action</span>
              </>
            )}
          </motion.h2>

          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6"
            variants={chapterStagger}
            initial="initial"
            whileInView="animate"
            viewport={{ once: false, amount: 0.5 }}
          >
            <StatusCard level={operationalStatus.level} message={operationalStatus.message} />
            <SupplierDecisionCard verdict={supplierDecision.verdict} message={supplierDecision.message} />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 26, scale: 0.97 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: false, amount: 0.4 }}
            transition={{ duration: 0.8, delay: 0.2, ease: EASE }}
            className="text-left"
          >
            <NextBestAction recommendations={recommendations} />
          </motion.div>

          <div className="flex items-center justify-center gap-4 mt-3">
            <span className="flex items-center gap-1.5">
              <ShoppingCart style={{ width: 11, height: 11, color: 'rgba(255,255,255,0.30)' }} />
              <span className="label-caps">{outstandingCount} outstanding</span>
            </span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 style={{ width: 11, height: 11, color: 'rgba(255,255,255,0.30)' }} />
              <span className="label-caps">{completedCount} completed</span>
            </span>
          </div>

          <div><FooterLink href="/orders" label="Go to Orders" /></div>
        </div>
      </motion.section>

      {/* ══════════════════════════════════════════════════════════════
          CHAPTER 03 · SALES PERFORMANCE — How are sales performing?
      ══════════════════════════════════════════════════════════════ */}
      <motion.section
        ref={chapter2Ref}
        data-chapter={2}
        className="chapter-section relative flex items-center justify-center px-6 sm:px-10"
        style={{ opacity: chapter2Opacity, willChange: 'opacity' }}
      >
        <Blob color="rgba(52,211,153,0.09)" width={520} height={520} style={{ top: '-10%', right: '-8%' }} drift parallax={chapter2Parallax} opacity={chapter2Opacity} />
        <NextChapterButton onClick={() => onJump(3)} />

        <div className="relative z-10 w-full max-w-[760px] mx-auto text-center">
          <ChapterEyebrow index={3} label="Sales Performance" />

          <motion.h2
            className="font-black leading-tight mb-6"
            style={{ fontSize: 'clamp(1.8rem, 4.2vw, 3.2rem)' }}
            initial={{ opacity: 0, y: 32, scale: 0.95 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: false, amount: 0.5 }}
            transition={{ duration: 0.9, ease: EASE }}
          >
            <CountUp value={weekRevenue} format={formatPHP} duration={2.0} style={{ color: '#34d399' }} />
            <span style={{ color: 'rgba(255,255,255,0.88)' }}> earned this week</span>
          </motion.h2>

          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: false, amount: 0.5 }}
            transition={{ duration: 0.8, delay: 0.2, ease: EASE }}
          >
            <RevenueChart data={revenueData} />
          </motion.div>

          <motion.div
            className="grid grid-cols-3 gap-3 mt-5"
            variants={chapterStagger}
            initial="initial"
            whileInView="animate"
            viewport={{ once: false, amount: 0.5 }}
          >
            <motion.div variants={chapterItem} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.032)', border: '1px solid rgba(255,255,255,0.065)' }}>
              <p className="label-caps mb-1">Orders This Week</p>
              <p className="text-[16px] font-black tabular-nums" style={{ color: 'rgba(255,255,255,0.88)' }}>{ordersThisWeek}</p>
            </motion.div>
            <motion.div variants={chapterItem} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.032)', border: '1px solid rgba(255,255,255,0.065)' }}>
              <p className="label-caps mb-1">Avg Order Value</p>
              <p className="text-[16px] font-black tabular-nums" style={{ color: 'rgba(255,255,255,0.88)' }}>{formatPHP(avgOrderValue)}</p>
            </motion.div>
            <motion.div variants={chapterItem} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.032)', border: '1px solid rgba(255,255,255,0.065)' }}>
              <p className="label-caps mb-1 flex items-center justify-center gap-1"><Trophy className="w-2.5 h-2.5" style={{ color: '#fbbf24' }} /> Best Seller</p>
              <p className="text-[13px] font-bold truncate" style={{ color: 'rgba(255,255,255,0.88)' }}>{topGame ? topGame.name : '—'}</p>
            </motion.div>
          </motion.div>

          <div><FooterLink href="/overall-sales" label="View Full Sales Report" /></div>
        </div>
      </motion.section>

      {/* ══════════════════════════════════════════════════════════════
          CHAPTER 04 · INVENTORY HEALTH — Is inventory becoming a problem?
      ══════════════════════════════════════════════════════════════ */}
      <motion.section
        ref={chapter3Ref}
        data-chapter={3}
        className="chapter-section relative flex items-center justify-center px-6 sm:px-10"
        style={{ opacity: chapter3Opacity, willChange: 'opacity' }}
      >
        <Blob color="rgba(34,211,238,0.10)" width={560} height={560} style={{ top: '-15%', left: '-10%' }} parallax={chapter3Parallax} opacity={chapter3Opacity} />
        <NextChapterButton onClick={() => onJump(4)} />

        <div className="relative z-10 w-full max-w-[860px] mx-auto text-center">
          <ChapterEyebrow index={4} label="Inventory Health" />

          <motion.h2
            className="font-black leading-tight mb-6"
            style={{ fontSize: 'clamp(1.8rem, 4.2vw, 3.2rem)' }}
            initial={{ opacity: 0, y: 32, scale: 0.95 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: false, amount: 0.5 }}
            transition={{ duration: 0.9, ease: EASE }}
          >
            {criticalAccounts > 0 ? (
              <>
                <span style={{ color: '#f59e0b' }}>{criticalAccounts}</span>
                <span style={{ color: 'rgba(255,255,255,0.88)' }}> of {totalActiveAccounts} account{totalActiveAccounts !== 1 ? 's' : ''} need attention</span>
              </>
            ) : (
              <span style={{ color: '#34d399' }}>All accounts healthy</span>
            )}
          </motion.h2>

          <motion.div
            className="grid grid-cols-3 gap-3 mb-6"
            variants={chapterStagger}
            initial="initial"
            whileInView="animate"
            viewport={{ once: false, amount: 0.5 }}
          >
            {([
              { label: 'Healthy',  value: accountHealth.healthy,  color: '#34d399' },
              { label: 'Low',      value: accountHealth.low,      color: '#f59e0b' },
              { label: 'Depleted', value: accountHealth.depleted, color: '#f87171' },
            ] as const).map(({ label, value, color }) => (
              <motion.div key={label} variants={chapterItem} className="rounded-xl p-3" style={{ background: `${color}0a`, border: `1px solid ${color}22` }}>
                <p className="label-caps mb-1" style={{ color, opacity: 0.85 }}>{label}</p>
                <p className="text-[18px] font-black tabular-nums" style={{ color }}>{value}</p>
              </motion.div>
            ))}
          </motion.div>

          {atRiskAccounts.length > 0 ? (
            <motion.div
              className="space-y-2"
              variants={chapterStagger}
              initial="initial"
              whileInView="animate"
              viewport={{ once: false, amount: 0.3 }}
            >
              <p className="label-caps mb-1 text-left">Accounts Needing Attention</p>
              {atRiskAccounts.map((a) => (
                <motion.div
                  key={a.id}
                  variants={chapterItem}
                  className="flex items-center justify-between gap-3 rounded-xl px-4 py-2.5 text-left"
                  style={{ background: 'rgba(255,255,255,0.032)', border: '1px solid rgba(255,255,255,0.065)' }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                      style={a.tier === 'depleted'
                        ? { background: 'rgba(244,63,94,0.12)', color: '#f87171' }
                        : { background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}
                    >
                      {a.tier === 'depleted' ? 'Depleted' : 'Low'}
                    </span>
                    <span className="text-[12px] font-bold truncate" style={{ color: 'rgba(255,255,255,0.80)' }}>{a.username}</span>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[12px] font-black tabular-nums" style={{ color: 'rgba(255,255,255,0.85)' }}>{formatRobux(a.available)}</p>
                    <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.44)' }}>
                      {a.runway !== null ? `~${a.runway} order${a.runway === 1 ? '' : 's'} left` : 'no runway data'}
                    </p>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <motion.p
              className="text-[12px] font-semibold"
              style={{ color: '#34d399' }}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.5 }}
              transition={{ duration: 0.6, delay: 0.3, ease: EASE }}
            >
              No accounts running low — inventory is fully covered.
            </motion.p>
          )}

          <div><FooterLink href="/accounts" label="View Full Inventory" /></div>
        </div>
      </motion.section>

      {/* ══════════════════════════════════════════════════════════════
          CHAPTER 05 · CAPITAL POSITION — Is my capital protected?
      ══════════════════════════════════════════════════════════════ */}
      <motion.section
        ref={chapter4Ref}
        data-chapter={4}
        className="chapter-section relative flex items-center justify-center px-6 sm:px-10"
        style={{ opacity: chapter4Opacity, willChange: 'opacity' }}
      >
        <Blob color="rgba(167,139,250,0.10)" width={540} height={540} style={{ top: '-12%', left: '-8%' }} parallax={chapter4Parallax} opacity={chapter4Opacity} />

        <div className="relative z-10 w-full max-w-[760px] mx-auto text-center">
          <ChapterEyebrow index={5} label="Capital Position" />

          <motion.div
            initial={{ opacity: 0, y: 32, scale: 0.95 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: false, amount: 0.5 }}
            transition={{ duration: 0.9, ease: EASE }}
            className="mb-6"
          >
            <h2 className="font-black leading-tight mb-3" style={{ fontSize: 'clamp(1.8rem, 4.2vw, 3.2rem)' }}>
              <CountUp value={businessValue} format={(v) => formatPHP(v)} duration={2.0} style={{ color: '#a78bfa' }} />
              <span style={{ color: 'rgba(255,255,255,0.88)' }}> business value</span>
            </h2>
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold"
              style={isCapitalRecovered
                ? { background: 'rgba(52,211,153,0.10)', color: '#34d399', border: '1px solid rgba(52,211,153,0.26)' }
                : { background: 'rgba(244,63,94,0.08)', color: '#f87171', border: '1px solid rgba(244,63,94,0.22)' }}
            >
              {isCapitalRecovered ? '🟢 Capital Fully Recovered' : `🔴 ${capitalRecoveryPct.toFixed(0)}% of Capital Recovered`}
            </span>
          </motion.div>

          <motion.div
            className="grid grid-cols-2 gap-3 mb-5"
            variants={chapterStagger}
            initial="initial"
            whileInView="animate"
            viewport={{ once: false, amount: 0.5 }}
          >
            <motion.div variants={chapterItem} className="rounded-xl p-3.5" style={{ background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.22)' }}>
              <div className="flex items-center justify-center gap-1.5 mb-1.5">
                <PiggyBank style={{ width: 12, height: 12, color: '#a78bfa' }} />
                <span className="label-caps" style={{ color: '#a78bfa', opacity: 0.85 }}>Withdrawable Profit</span>
              </div>
              <CountUp value={withdrawableProfit} format={(v) => formatPHP(v)} duration={2.0} className="text-[15px] font-black tabular-nums block" style={{ color: 'rgba(255,255,255,0.88)' }} />
            </motion.div>
            <motion.div variants={chapterItem} className="rounded-xl p-3.5" style={{ background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.22)' }}>
              <div className="flex items-center justify-center gap-1.5 mb-1.5">
                <ShieldCheck style={{ width: 12, height: 12, color: '#34d399' }} />
                <span className="label-caps" style={{ color: '#34d399', opacity: 0.85 }}>Protected Capital</span>
              </div>
              <p className="text-[15px] font-black tabular-nums" style={{ color: 'rgba(255,255,255,0.88)' }}>{formatPHP(FIXED_CAPITAL)}</p>
              <p className="text-[10px] mt-0.5" style={{ color: isCapitalRecovered ? '#34d399' : '#f59e0b' }}>
                {isCapitalRecovered ? 'Fully covered' : `${capitalRecoveryPct.toFixed(0)}% covered`}
              </p>
            </motion.div>
          </motion.div>

          <motion.div
            className="h-2 rounded-full overflow-hidden max-w-[420px] mx-auto"
            style={{ background: 'rgba(255,255,255,0.092)' }}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: false, amount: 0.5 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <motion.div
              className="h-full rounded-full"
              style={{ background: isCapitalRecovered ? '#34d399' : '#a78bfa' }}
              initial={{ width: 0 }}
              whileInView={{ width: `${Math.min(100, capitalRecoveryPct)}%` }}
              viewport={{ once: false, amount: 0.5 }}
              transition={{ duration: 1.2, delay: 0.45, ease: EASE }}
            />
          </motion.div>

          <div><FooterLink href="/accounts" label="View Full Capital Breakdown" /></div>
        </div>
      </motion.section>
    </>
  )
})
