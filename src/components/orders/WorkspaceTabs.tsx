'use client'

import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, X } from 'lucide-react'
import { WorkspaceDraft } from '@/hooks/useWorkspaces'
import { getGameAccentColor } from '@/lib/utils/games'
import { formatPHP } from '@/lib/utils/pricing'
import { RobloxAccount } from '@/lib/types/database'

// Returns a hex color with a 2-char hex alpha suffix.
// e.g. hexAlpha('#10b981', 0.18) → '#10b98130'
function hexAlpha(hex: string, alpha: number): string {
  const a = Math.round(alpha * 255).toString(16).padStart(2, '0')
  return `${hex}${a}`
}

interface WorkspaceTabsProps {
  workspaces: WorkspaceDraft[]
  activeId: string | null
  accounts: RobloxAccount[]
  onSelect: (id: string) => void
  onClose: (id: string) => void
  onNew: () => void
}

export default function WorkspaceTabs({
  workspaces,
  activeId,
  accounts,
  onSelect,
  onClose,
  onNew,
}: WorkspaceTabsProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function schedulePreview(id: string) {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
    hoverTimerRef.current = setTimeout(() => setHoveredId(id), 280)
  }

  function clearPreview() {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
    setHoveredId(null)
  }

  return (
    <div
      className="flex items-stretch overflow-x-auto"
      style={{
        background: 'rgba(0,0,0,0.30)',
        borderBottom: '1px solid rgba(255,255,255,0.072)',
        scrollbarWidth: 'none',
        minHeight: 56,
        flexShrink: 0,
      }}
    >
      {workspaces.map(ws => {
        const isActive = ws.id === activeId
        // getGameAccentColor always returns a 7-char hex — safe for hexAlpha
        const color = ws.primaryGameName
          ? getGameAccentColor(ws.primaryGameName)
          : '#8b5cf6'
        const gpCount   = ws.items.filter(i => i.gamepass_id).length
        const account   = accounts.find(a => a.id === ws.formValues.roblox_account_id)
        const buyerName = ws.formValues.buyer_name?.trim() || null
        const showPreview = hoveredId === ws.id && !isActive

        return (
          <div
            key={ws.id}
            className="relative group flex items-stretch overflow-hidden"
            style={{
              flex: '1 1 0',
              minWidth: 96,
              maxWidth: 240,
              borderRight: '1px solid rgba(255,255,255,0.060)',
              background: isActive ? hexAlpha(color, 0.16) : hexAlpha(color, 0.055),
              transition: 'background 0.15s',
            }}
            onMouseEnter={() => schedulePreview(ws.id)}
            onMouseLeave={clearPreview}
          >
            {/* 3-px left color stripe */}
            <div
              className="absolute left-0 top-0 bottom-0 transition-all duration-150"
              style={{
                width: isActive ? 3 : 2,
                background: color,
                opacity: isActive ? 1 : 0.38,
              }}
            />

            {/* Select button */}
            <button
              type="button"
              onClick={() => onSelect(ws.id)}
              className="flex-1 min-w-0 flex items-center gap-3 pl-4 pr-9 py-3 text-left overflow-hidden"
            >
              {/* Dirty / status dot */}
              <span
                className="w-2 h-2 rounded-full flex-shrink-0 transition-colors duration-150"
                style={{
                  background: ws.wsStatus === 'submitted'
                    ? '#34d399'
                    : ws.isDirty
                    ? color
                    : hexAlpha(color, 0.40),
                  boxShadow: ws.isDirty ? `0 0 6px ${color}80` : 'none',
                }}
              />

              <div className="min-w-0 flex-1">
                <p
                  className="text-[12.5px] font-bold leading-tight truncate transition-colors duration-100"
                  style={{
                    color: isActive ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.62)',
                  }}
                >
                  {buyerName ?? (ws.editOrderId ? 'Edit Order' : 'New Order')}
                </p>
                <p
                  className="text-[10px] leading-tight mt-0.5 truncate font-medium"
                  style={{ color: isActive ? hexAlpha(color, 0.88) : hexAlpha(color, 0.55) }}
                >
                  {ws.primaryGameName
                    ? `${ws.primaryGameName}${gpCount > 0 ? ` · ${gpCount} GP` : ''}`
                    : gpCount > 0
                    ? `${gpCount} gamepass${gpCount > 1 ? 'es' : ''}`
                    : 'Empty draft'}
                </p>
              </div>
            </button>

            {/* Active underline */}
            {isActive && (
              <motion.div
                layoutId="ws-tab-underline"
                className="absolute bottom-0 left-0 right-0 h-0.5"
                style={{ background: color, boxShadow: `0 0 8px ${color}` }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              />
            )}

            {/* Close button */}
            <button
              type="button"
              title="Close workspace"
              onClick={e => { e.stopPropagation(); onClose(ws.id) }}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 rounded-md flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-100"
              style={{ color: 'rgba(255,255,255,0.55)', background: 'rgba(0,0,0,0.28)' }}
            >
              <X className="w-3 h-3" />
            </button>

            {/* Hover preview */}
            <AnimatePresence>
              {showPreview && (
                <motion.div
                  initial={{ opacity: 0, y: 5, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 5, scale: 0.97 }}
                  transition={{ duration: 0.13, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute top-full left-0 z-50 mt-1.5 w-56 rounded-xl p-3 space-y-2 pointer-events-none"
                  style={{
                    background: 'rgba(8,6,22,0.97)',
                    border: `1px solid ${hexAlpha(color, 0.28)}`,
                    boxShadow: `0 10px 32px rgba(0,0,0,0.55), 0 0 0 1px ${hexAlpha(color, 0.08)}`,
                    backdropFilter: 'blur(16px)',
                  }}
                >
                  <div>
                    <p className="text-[12px] font-bold" style={{ color: 'rgba(255,255,255,0.88)' }}>
                      {buyerName ?? (ws.editOrderId ? 'Edit Order' : 'New Order')}
                    </p>
                    {ws.primaryGameName && (
                      <p className="text-[10px] mt-0.5 font-semibold" style={{ color }}>
                        {ws.primaryGameName}
                      </p>
                    )}
                  </div>

                  {ws.items.filter(i => i.gamepass_id).length > 0 ? (
                    <div className="space-y-1">
                      {ws.items.filter(i => i.gamepass_id).slice(0, 5).map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between gap-2 text-[10px]">
                          <span className="truncate" style={{ color: 'rgba(255,255,255,0.56)' }}>
                            {item.gamepass_name || '—'}
                          </span>
                          <span className="tabular-nums flex-shrink-0" style={{ color: 'rgba(255,255,255,0.36)' }}>
                            {formatPHP(item.selling_price)}
                          </span>
                        </div>
                      ))}
                      {ws.items.filter(i => i.gamepass_id).length > 5 && (
                        <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.26)' }}>
                          +{ws.items.filter(i => i.gamepass_id).length - 5} more
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.28)' }}>Empty cart</p>
                  )}

                  {account && (
                    <p
                      className="text-[10px] pt-1.5"
                      style={{ color: 'rgba(255,255,255,0.34)', borderTop: `1px solid ${hexAlpha(color, 0.15)}` }}
                    >
                      Account: {account.username}
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}

      {/* New workspace button */}
      <button
        type="button"
        title="New workspace (Ctrl+N)"
        onClick={onNew}
        className="flex-shrink-0 w-12 flex items-center justify-center self-stretch transition-colors hover:bg-white/5"
        style={{ color: 'rgba(255,255,255,0.38)' }}
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  )
}
