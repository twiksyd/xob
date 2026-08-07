'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { LogicalOrder } from '@/lib/types/logical-order'
import { getGameAccentColor } from '@/lib/utils/games'
import { formatPHP } from '@/lib/utils/pricing'
import { Check, X, ZoomIn, Trash2, Download, Archive, ChevronDown, Clock, Camera, RotateCcw, CloudCheck, AlertTriangle } from 'lucide-react'
import RobloxAvatar from '@/components/shared/RobloxAvatar'
import { getAvailableRobux } from '@/lib/utils/accounts'
import { formatRobux } from '@/lib/utils/pricing'

// Minimal item shape FulfillmentMode needs — mapped from LogicalOrderItem.
interface FulfillmentItem {
  id: string
  gamepass_name: string
  game_name: string | null
  robux_amount: number
  selling_price: number
  profit: number
  account_username: string | null
  account_roblox_user_id: string | null
  account_available_robux: number | null
}

// ── Utilities ─────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  if (words.length === 1) return name.slice(0, 2).toUpperCase()
  return (words[0][0] + words[1][0]).toUpperCase()
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

function u16(n: number): number[] { return [n & 0xFF, (n >> 8) & 0xFF] }
function u32(n: number): number[] { return [n & 0xFF, (n >> 8) & 0xFF, (n >> 16) & 0xFF, (n >> 24) & 0xFF] }

function makeCRC32(): (buf: Uint8Array) => number {
  const t = new Int32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
    t[i] = c
  }
  return (buf) => {
    let c = -1
    for (const b of buf) c = t[(c ^ b) & 0xFF] ^ (c >>> 8)
    return (c ^ -1) >>> 0
  }
}
const crc32 = makeCRC32()

// ── Progress persistence ──────────────────────────────────────────────────────

interface PersistedFulfillmentState {
  currentIdx: number
  sentIds: string[]
  sentAtEntries: [string, string][]  // [itemId, ISO date string]
  savedAt: string
}

const storageKey = (orderId: string) => `xob-fulfillment-${orderId}`

function saveProgress(orderId: string, currentIdx: number, sentSet: Set<string>, sentAt: Map<string, Date>) {
  try {
    const state: PersistedFulfillmentState = {
      currentIdx,
      sentIds: Array.from(sentSet),
      sentAtEntries: Array.from(sentAt.entries()).map(([id, d]) => [id, d.toISOString()]),
      savedAt: new Date().toISOString(),
    }
    localStorage.setItem(storageKey(orderId), JSON.stringify(state))
  } catch {}
}

function loadProgress(orderId: string): PersistedFulfillmentState | null {
  try {
    const raw = localStorage.getItem(storageKey(orderId))
    return raw ? (JSON.parse(raw) as PersistedFulfillmentState) : null
  } catch { return null }
}

function clearProgress(orderId: string) {
  try { localStorage.removeItem(storageKey(orderId)) } catch {}
}

async function buildStoredZip(files: Array<{ name: string; data: ArrayBuffer }>): Promise<Blob> {
  const enc = new TextEncoder()
  const now = new Date()
  const dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1))
  const dosDate = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate())
  const concat = (arrays: (Uint8Array | number[])[]): Uint8Array<ArrayBuffer> => {
    const totalLen = arrays.reduce((s, a) => s + a.length, 0)
    const buf = new ArrayBuffer(totalLen)
    const out = new Uint8Array(buf)
    let pos = 0
    for (const a of arrays) { out.set(a instanceof Uint8Array ? a : new Uint8Array(a), pos); pos += a.length }
    return out
  }
  const localParts: Uint8Array<ArrayBuffer>[] = []
  const centralParts: Uint8Array<ArrayBuffer>[] = []
  const localOffsets: number[] = []
  let offset = 0
  for (const file of files) {
    const nameBytes = enc.encode(file.name)
    const fileData = new Uint8Array(file.data as ArrayBuffer)
    const crc = crc32(fileData)
    const size = fileData.length
    const local = concat([[0x50, 0x4B, 0x03, 0x04], u16(20), u16(0), u16(0), u16(dosTime), u16(dosDate), u32(crc), u32(size), u32(size), u16(nameBytes.length), u16(0), nameBytes])
    localOffsets.push(offset)
    localParts.push(local, fileData)
    offset += local.length + size
    const central = concat([[0x50, 0x4B, 0x01, 0x02], u16(20), u16(20), u16(0), u16(0), u16(dosTime), u16(dosDate), u32(crc), u32(size), u32(size), u16(nameBytes.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(localOffsets[localOffsets.length - 1]), nameBytes])
    centralParts.push(central)
  }
  const centralStart = offset
  const centralSize = centralParts.reduce((s, p) => s + p.length, 0)
  const eocd = concat([[0x50, 0x4B, 0x05, 0x06], u16(0), u16(0), u16(files.length), u16(files.length), u32(centralSize), u32(centralStart), u16(0)])
  return new Blob([...localParts, ...centralParts, eocd], { type: 'application/zip' })
}

// ── Screenshot thumbnail ──────────────────────────────────────────────────────

function ScreenshotThumb({ blob, onDelete, onZoom }: { blob: Blob; onDelete: () => void; onZoom: () => void }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  if (!url) return null
  return (
    <div className="relative group rounded-xl overflow-hidden flex-shrink-0" style={{ width: 88, height: 60 }}>
      <img src={url} alt="Screenshot" className="w-full h-full object-cover" />
      <div className="absolute inset-0 transition-colors bg-black/0 group-hover:bg-black/50 flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100">
        <button type="button" onClick={onZoom}
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,0.18)' }}>
          <ZoomIn className="w-3.5 h-3.5 text-white" />
        </button>
        <button type="button" onClick={onDelete}
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: 'rgba(244,63,94,0.45)' }}>
          <Trash2 className="w-3.5 h-3.5 text-white" />
        </button>
      </div>
    </div>
  )
}

// ── Zoom overlay ──────────────────────────────────────────────────────────────

function ZoomOverlay({ blob, onClose }: { blob: Blob; onClose: () => void }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return (
    <motion.div
      className="fixed inset-0 z-[80] flex items-center justify-center p-8"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
      onClick={onClose}
      style={{ background: 'rgba(0,0,0,0.86)', backdropFilter: 'blur(16px)' }}
    >
      <motion.img
        src={url} alt="Screenshot"
        initial={{ scale: 0.88, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-full max-h-full rounded-2xl object-contain"
        style={{ boxShadow: '0 32px 80px rgba(0,0,0,0.6)' }}
        onClick={e => e.stopPropagation()}
      />
      <button type="button" onClick={onClose}
        className="absolute top-6 right-6 w-10 h-10 rounded-full flex items-center justify-center"
        style={{ background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.16)', color: 'rgba(255,255,255,0.70)' }}>
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface FulfillmentModeProps {
  order: LogicalOrder
  onClose: () => void
  onComplete: () => Promise<void>
}

export default function FulfillmentMode({ order, onClose, onComplete }: FulfillmentModeProps) {
  const items = useMemo((): FulfillmentItem[] =>
    order.items.map(i => ({
      id:                      i.id,
      gamepass_name:           i.gamepassName,
      game_name:               i.gameName,
      robux_amount:            i.robuxAmount,
      selling_price:           i.sellingPrice,
      profit:                  i.profit,
      account_username:        i.account?.username ?? null,
      account_roblox_user_id:  i.account?.roblox_user_id ?? null,
      account_available_robux: i.account ? getAvailableRobux(i.account) : null,
    })),
  [order.items])

  const [currentIdx, setCurrentIdx] = useState(0)
  const [sentSet, setSentSet]       = useState<Set<string>>(new Set())
  const [sentAt, setSentAt]         = useState<Map<string, Date>>(new Map())
  const [screenshots, setScreenshots] = useState<Map<string, Blob[]>>(new Map())
  const [zoomBlob, setZoomBlob]     = useState<Blob | null>(null)
  const [allDone, setAllDone]       = useState(false)
  const [completing, setCompleting] = useState(false)
  const [completedExpanded, setCompletedExpanded] = useState(true)
  const [startTime]                 = useState(Date.now())
  const [resumed, setResumed]       = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)
  const currentIdRef                = useRef<string>('')

  useEffect(() => {
    currentIdRef.current = items[currentIdx]?.id ?? ''
  }, [currentIdx, items])

  // Restore saved progress on mount
  useEffect(() => {
    const saved = loadProgress(order.logicalKey)
    if (!saved || saved.sentIds.length === 0) return
    setCurrentIdx(saved.currentIdx)
    setSentSet(new Set(saved.sentIds))
    setSentAt(new Map(saved.sentAtEntries.map(([id, iso]) => [id, new Date(iso)])))
    setLastSavedAt(new Date(saved.savedAt))
    if (saved.sentIds.length >= items.length) setAllDone(true)
    setResumed(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Clipboard paste → screenshot for current item
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const img = Array.from(e.clipboardData?.items ?? []).find(i => i.type.startsWith('image/'))
      if (!img) return
      const blob = img.getAsFile()
      if (!blob) return
      const id = currentIdRef.current
      setScreenshots(prev => {
        const next = new Map(prev)
        next.set(id, [...(next.get(id) ?? []), blob])
        return next
      })
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [])

  // Escape key — zoom first, then close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { if (zoomBlob) setZoomBlob(null); else onClose() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [zoomBlob, onClose])

  // Scroll lock
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  function markSent() {
    const item = items[currentIdx]
    if (!item) return
    const newSentSet = new Set(sentSet); newSentSet.add(item.id)
    const newSentAt  = new Map(sentAt);  newSentAt.set(item.id, new Date())
    const nextIdx    = currentIdx < items.length - 1 ? currentIdx + 1 : currentIdx
    setSentSet(newSentSet)
    setSentAt(newSentAt)
    if (currentIdx < items.length - 1) {
      setCurrentIdx(nextIdx)
    } else {
      setAllDone(true)
    }
    saveProgress(order.logicalKey, nextIdx, newSentSet, newSentAt)
    setLastSavedAt(new Date())
  }

  function startOver() {
    clearProgress(order.logicalKey)
    setCurrentIdx(0)
    setSentSet(new Set())
    setSentAt(new Map())
    setScreenshots(new Map())
    setAllDone(false)
    setResumed(false)
    setLastSavedAt(null)
  }

  function deleteScreenshot(itemId: string, idx: number) {
    setScreenshots(prev => {
      const next = new Map(prev)
      const blobs = [...(next.get(itemId) ?? [])]
      blobs.splice(idx, 1)
      if (blobs.length === 0) next.delete(itemId); else next.set(itemId, blobs)
      return next
    })
  }

  async function finish() {
    setCompleting(true)
    try { await onComplete(); clearProgress(order.logicalKey); onClose() } catch { setCompleting(false) }
  }

  async function exportZip() {
    const files: Array<{ name: string; data: ArrayBuffer }> = []
    for (const [itemId, blobs] of screenshots) {
      const item = items.find(i => i.id === itemId)
      const base = (item?.gamepass_name ?? 'item').replace(/[^a-zA-Z0-9_-]/g, '_')
      for (let i = 0; i < blobs.length; i++) {
        files.push({ name: `${base}_${i + 1}.png`, data: await blobs[i].arrayBuffer() })
      }
    }
    if (files.length === 0) return
    const zip = await buildStoredZip(files)
    downloadBlob(zip, `order-${order.orderNumber ?? order.logicalKey}-proof.zip`)
  }

  function downloadAll() {
    for (const [itemId, blobs] of screenshots) {
      const item = items.find(i => i.id === itemId)
      const base = (item?.gamepass_name ?? 'item').replace(/[^a-zA-Z0-9_-]/g, '_')
      blobs.forEach((blob, i) => downloadBlob(blob, `${base}_${i + 1}.png`))
    }
  }

  const currentItem   = items[currentIdx]
  const upNextItems   = items.slice(currentIdx + 1)
  const completedItems = items.filter(it => sentSet.has(it.id))
  const totalShots    = Array.from(screenshots.values()).reduce((s, b) => s + b.length, 0)
  const elapsedSec    = Math.round((Date.now() - startTime) / 1000)
  const elapsedStr    = elapsedSec < 60 ? `${elapsedSec}s` : `${Math.floor(elapsedSec / 60)}m ${elapsedSec % 60}s`
  const progress      = items.length > 0 ? (sentSet.size / items.length) * 100 : 0

  const gameColor = currentItem ? getGameAccentColor(currentItem.game_name ?? '') : '#8b5cf6'

  return (
    <>
      {/* Backdrop */}
      <motion.div
        className="fixed inset-0 z-[60]"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: 0.28 }}
        style={{ background: 'rgba(4,4,12,0.88)', backdropFilter: 'blur(28px) saturate(0.6)' }}
        onClick={onClose}
      />

      {/* Panel */}
      <motion.div
        className="fixed inset-0 z-[61] flex flex-col items-center overflow-y-auto py-8 px-4"
        initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}
        transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
        onClick={e => e.stopPropagation()}
      >
        <div className="w-full max-w-[640px] flex flex-col gap-5">

          {/* ── Header ─────────────────────────────────────────────── */}
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] mb-0.5" style={{ color: 'rgba(255,255,255,0.28)' }}>
                Fulfillment Mode
              </p>
              <div className="flex items-baseline gap-2.5">
                <span className="font-black text-[18px]" style={{ color: 'rgba(255,255,255,0.90)' }}>
                  {order.buyerName ?? 'Order'}
                </span>
                {order.orderNumber && (
                  <span className="font-mono text-[11px]" style={{ color: 'rgba(255,255,255,0.28)' }}>
                    {order.orderNumber}
                  </span>
                )}
              </div>
              {/* Progress */}
              <div className="mt-3 space-y-1.5">
                <div className="h-[3px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: 'rgba(52,211,153,0.80)' }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  />
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-[10px] font-semibold" style={{ color: 'rgba(255,255,255,0.34)' }}>
                    {sentSet.size} / {items.length} Item{items.length !== 1 ? 's' : ''} Completed
                  </p>
                  {lastSavedAt && (
                    <span className="flex items-center gap-1 text-[10px]" style={{ color: 'rgba(255,255,255,0.20)' }}>
                      <CloudCheck className="w-2.5 h-2.5" />
                      Saved {lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                  {(sentSet.size > 0) && (
                    <button
                      type="button"
                      onClick={startOver}
                      className="flex items-center gap-1 text-[10px] font-semibold ml-auto transition-opacity opacity-40 hover:opacity-70"
                      style={{ color: 'rgba(255,255,255,0.65)' }}
                    >
                      <RotateCcw className="w-2.5 h-2.5" /> Start over
                    </button>
                  )}
                </div>
                {resumed && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="text-[10px] font-semibold"
                    style={{ color: 'rgba(167,139,250,0.65)' }}
                  >
                    ↩ Resumed from previous session
                  </motion.p>
                )}
              </div>
            </div>
            <button type="button" onClick={onClose}
              className="ml-4 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-bold flex-shrink-0 transition-all hover:opacity-90"
              style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.22)', color: 'rgba(255,255,255,0.80)' }}>
              <X className="w-3.5 h-3.5" />
              Back to orders
            </button>
          </div>

          {/* ── All done: completion screen ─────────────────────────── */}
          {allDone ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="rounded-3xl p-8 text-center space-y-6"
              style={{ background: 'rgba(52,211,153,0.04)', border: '1px solid rgba(52,211,153,0.18)', boxShadow: '0 0 0 1px rgba(52,211,153,0.06), 0 12px 48px rgba(0,0,0,0.40)' }}
            >
              <div>
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5" style={{ background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.28)' }}>
                  <Check className="w-8 h-8" style={{ color: '#34d399' }} />
                </div>
                <p className="font-black text-[26px] mb-1" style={{ color: '#34d399' }}>Order Completed</p>
                <p className="text-[13px]" style={{ color: 'rgba(255,255,255,0.42)' }}>All items have been sent to the customer.</p>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Total Time',          value: elapsedStr,             icon: Clock },
                  { label: 'Items Completed',     value: `${items.length}`,      icon: Check },
                  { label: 'Screenshots Attached', value: `${totalShots}`,       icon: Camera },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.036)', border: '1px solid rgba(255,255,255,0.065)' }}>
                    <Icon className="w-4 h-4 mx-auto mb-2" style={{ color: 'rgba(255,255,255,0.35)' }} />
                    <p className="font-black text-[18px] mb-0.5" style={{ color: 'rgba(255,255,255,0.88)' }}>{value}</p>
                    <p className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.28)' }}>{label}</p>
                  </div>
                ))}
              </div>
              {totalShots > 0 && (
                <div className="flex items-center justify-center gap-3">
                  <button type="button" onClick={downloadAll}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-bold transition-colors"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.65)' }}>
                    <Download className="w-3.5 h-3.5" /> Download All
                  </button>
                  <button type="button" onClick={exportZip}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-[12px] font-bold transition-colors"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.65)' }}>
                    <Archive className="w-3.5 h-3.5" /> Export ZIP
                  </button>
                </div>
              )}
              <button type="button" onClick={finish} disabled={completing}
                className="w-full py-4 rounded-2xl text-[15px] font-black transition-all disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #34d399, #22d3ee)', color: '#040c0c', boxShadow: '0 4px 24px rgba(52,211,153,0.28)' }}>
                {completing ? 'Finishing…' : 'Finish'}
              </button>
            </motion.div>
          ) : currentItem && (
            <>
              {/* ── Current item card ──────────────────────────────────── */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentItem.id}
                  initial={{ opacity: 0, y: 44, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -56, scale: 0.92 }}
                  transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
                  className="relative overflow-hidden rounded-3xl"
                  style={{
                    background: 'rgba(255,255,255,0.030)',
                    border: `1px solid ${gameColor}24`,
                    boxShadow: `0 0 0 1px rgba(255,255,255,0.04), 0 16px 56px rgba(0,0,0,0.48)`,
                  }}
                >
                  {/* Left accent bar */}
                  <div className="absolute left-0 top-6 bottom-6 w-[3px] rounded-full" style={{ background: gameColor, opacity: 0.72 }} />

                  {/* Watermark initials */}
                  <div aria-hidden className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden">
                    <span style={{ fontSize: 'clamp(5rem, 14vw, 10rem)', fontWeight: 900, color: gameColor, opacity: 0.08, letterSpacing: '-0.04em', lineHeight: 1 }}>
                      {getInitials(currentItem.gamepass_name)}
                    </span>
                  </div>

                  <div className="relative z-10 p-8 text-center flex flex-col gap-5">
                    {/* Name + underline + game */}
                    <div>
                      <p className="font-black leading-tight" style={{ fontSize: 'clamp(1.25rem, 4vw, 1.75rem)', color: gameColor, letterSpacing: '-0.01em' }}>
                        {currentItem.gamepass_name}
                      </p>
                      <div className="mx-auto mt-2 rounded-full" style={{ width: 40, height: 2, background: gameColor, opacity: 0.55 }} />
                      <p className="mt-2.5 text-[13px]" style={{ color: 'rgba(255,255,255,0.42)' }}>
                        {currentItem.game_name ?? 'Unknown Game'}
                      </p>
                    </div>

                    {/* Account assignment (BW orders) */}
                    {order.source === 'budgetwise' && (
                      currentItem.account_username ? (
                        <div
                          className="flex items-center justify-center gap-3 px-4 py-2.5 rounded-2xl"
                          style={{ background: 'rgba(34,211,238,0.05)', border: '1px solid rgba(34,211,238,0.14)' }}
                        >
                          <RobloxAvatar
                            username={currentItem.account_username}
                            userId={currentItem.account_roblox_user_id}
                            size={28}
                            glow="none"
                          />
                          <div className="text-left">
                            <p className="text-[10px] font-bold" style={{ color: 'rgba(255,255,255,0.42)' }}>
                              Send via
                            </p>
                            <p className="text-[13px] font-black leading-tight" style={{ color: '#22d3ee' }}>
                              {currentItem.account_username}
                            </p>
                          </div>
                          {currentItem.account_available_robux !== null && (
                            <div className="ml-auto text-right">
                              <p className="text-[9px] font-bold uppercase tracking-wide" style={{ color: 'rgba(255,255,255,0.28)' }}>
                                Available
                              </p>
                              <p className="text-[12px] font-black tabular-nums" style={{ color: '#34d399' }}>
                                {formatRobux(currentItem.account_available_robux)} R$
                              </p>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div
                          className="flex items-center justify-center gap-2 px-4 py-2 rounded-2xl"
                          style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.22)' }}
                        >
                          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#f59e0b' }} />
                          <p className="text-[12px] font-bold" style={{ color: '#f59e0b' }}>
                            No account assigned — go back and assign one first
                          </p>
                        </div>
                      )
                    )}

                    {/* Numbers */}
                    <div className="flex items-center justify-center gap-5">
                      <div className="text-center">
                        <p className="text-[9px] font-bold uppercase tracking-[0.10em] mb-1" style={{ color: 'rgba(255,255,255,0.30)' }}>Robux</p>
                        <p className="font-black tabular-nums text-[17px]" style={{ color: 'rgba(255,255,255,0.75)' }}>{currentItem.robux_amount.toLocaleString()}</p>
                      </div>
                      <div className="w-px h-10 flex-shrink-0" style={{ background: 'rgba(255,255,255,0.09)' }} />
                      <div className="text-center">
                        <p className="text-[9px] font-bold uppercase tracking-[0.10em] mb-1" style={{ color: 'rgba(255,255,255,0.30)' }}>Selling Price</p>
                        <p className="font-black tabular-nums text-[22px]" style={{ color: 'rgba(255,255,255,0.92)' }}>{formatPHP(currentItem.selling_price)}</p>
                      </div>
                      <div className="w-px h-10 flex-shrink-0" style={{ background: 'rgba(255,255,255,0.09)' }} />
                      <div className="text-center">
                        <p className="text-[9px] font-bold uppercase tracking-[0.10em] mb-1" style={{ color: 'rgba(255,255,255,0.30)' }}>Profit</p>
                        <p className="font-black tabular-nums text-[17px]" style={{ color: '#34d399' }}>+{formatPHP(currentItem.profit)}</p>
                      </div>
                    </div>

                    {/* Screenshot area */}
                    <ScreenshotArea
                      itemId={currentItem.id}
                      blobs={screenshots.get(currentItem.id) ?? []}
                      onDelete={(idx) => deleteScreenshot(currentItem.id, idx)}
                      onZoom={setZoomBlob}
                    />

                    {/* Mark as Sent */}
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.975 }}
                      onClick={markSent}
                      className="w-full py-4 rounded-2xl text-[15px] font-black flex items-center justify-center gap-2.5 transition-all"
                      style={{
                        background: `linear-gradient(135deg, ${gameColor}22, ${gameColor}0f)`,
                        border: `1px solid ${gameColor}3a`,
                        color: gameColor,
                        boxShadow: `0 4px 20px ${gameColor}18`,
                      }}
                    >
                      <Check className="w-5 h-5" />
                      Mark as Sent
                    </motion.button>
                  </div>
                </motion.div>
              </AnimatePresence>

              {/* ── Up Next ────────────────────────────────────────────── */}
              {upNextItems.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.10em] mb-2.5" style={{ color: 'rgba(255,255,255,0.24)' }}>
                    Next
                  </p>
                  <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                    {upNextItems.slice(0, 5).map((item, i) => {
                      const c = getGameAccentColor(item.game_name ?? '')
                      return (
                        <div key={item.id}
                          className="flex-shrink-0 rounded-2xl px-4 py-3 text-center"
                          style={{
                            minWidth: 110,
                            background: 'rgba(255,255,255,0.022)',
                            border: '1px solid rgba(255,255,255,0.055)',
                            opacity: Math.max(0.45, 1 - i * 0.15),
                          }}
                        >
                          <p className="text-[11px] font-bold truncate" style={{ color: c }}>{item.gamepass_name}</p>
                          <p className="text-[9px] mt-0.5 truncate" style={{ color: 'rgba(255,255,255,0.30)' }}>{item.game_name ?? '—'}</p>
                        </div>
                      )
                    })}
                    {upNextItems.length > 5 && (
                      <div className="flex-shrink-0 rounded-2xl px-4 py-3 flex items-center" style={{ background: 'rgba(255,255,255,0.018)', border: '1px solid rgba(255,255,255,0.045)' }}>
                        <p className="text-[11px] font-semibold" style={{ color: 'rgba(255,255,255,0.24)' }}>+{upNextItems.length - 5} more</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── Completed items ─────────────────────────────────────── */}
              {completedItems.length > 0 && (
                <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.020)', border: '1px solid rgba(255,255,255,0.052)' }}>
                  <button
                    type="button"
                    onClick={() => setCompletedExpanded(v => !v)}
                    className="w-full flex items-center justify-between gap-2 px-4 py-3"
                  >
                    <div className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5" style={{ color: '#34d399' }} />
                      <span className="text-[11px] font-bold" style={{ color: 'rgba(255,255,255,0.55)' }}>Completed ({completedItems.length})</span>
                    </div>
                    <ChevronDown
                      className="w-3.5 h-3.5 flex-shrink-0 transition-transform duration-150"
                      style={{ color: 'rgba(255,255,255,0.28)', transform: completedExpanded ? 'rotate(180deg)' : 'none' }}
                    />
                  </button>
                  {completedExpanded && (
                    <div className="px-4 pb-3 space-y-1.5" style={{ borderTop: '1px solid rgba(255,255,255,0.045)' }}>
                      {completedItems.map(item => {
                        const shots = (screenshots.get(item.id) ?? []).length
                        const at = sentAt.get(item.id)
                        const c = getGameAccentColor(item.game_name ?? '')
                        return (
                          <div key={item.id} className="flex items-center gap-3 pt-1.5">
                            <Check className="w-3 h-3 flex-shrink-0" style={{ color: '#34d399' }} />
                            <span className="flex-1 text-[12px] font-semibold truncate" style={{ color: c }}>{item.gamepass_name}</span>
                            <span className="text-[10px] tabular-nums flex-shrink-0" style={{ color: 'rgba(255,255,255,0.26)' }}>
                              {at ? at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'}
                            </span>
                            {shots > 0 && (
                              <span className="flex items-center gap-0.5 text-[10px] flex-shrink-0" style={{ color: 'rgba(255,255,255,0.32)' }}>
                                <Camera className="w-2.5 h-2.5" /> {shots}
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>

      {/* Zoom overlay */}
      <AnimatePresence>
        {zoomBlob && <ZoomOverlay key="zoom" blob={zoomBlob} onClose={() => setZoomBlob(null)} />}
      </AnimatePresence>
    </>
  )
}

// ── Screenshot area ───────────────────────────────────────────────────────────

function ScreenshotArea({
  itemId, blobs, onDelete, onZoom,
}: {
  itemId: string
  blobs: Blob[]
  onDelete: (idx: number) => void
  onZoom: (blob: Blob) => void
}) {
  return (
    <div className="rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.026)', border: '1px solid rgba(255,255,255,0.055)' }}>
      {blobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-3">
          <Camera className="w-5 h-5" style={{ color: 'rgba(255,255,255,0.20)' }} />
          <p className="text-[11px] font-semibold text-center" style={{ color: 'rgba(255,255,255,0.28)' }}>
            Press <kbd className="px-1.5 py-0.5 rounded text-[10px]" style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>Ctrl+V</kbd> to paste a screenshot
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2 justify-center">
          {blobs.map((blob, i) => (
            <ScreenshotThumb
              key={i}
              blob={blob}
              onDelete={() => onDelete(i)}
              onZoom={() => onZoom(blob)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
