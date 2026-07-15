'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { LineItem, OrderWithDetails } from '@/lib/types/database'
import { OrderFormData } from '@/components/orders/OrderForm'

const LS_KEY = 'xob-order-workspaces-v2'

export type WsStatus = 'draft' | 'ready' | 'submitting' | 'submitted'

export interface WorkspaceDraft {
  id: string
  // Persisted form field values (synced on every change)
  formValues: Partial<OrderFormData>
  // Persisted cart
  items: LineItem[]
  // Edit mode — non-null means this workspace is editing an existing order
  editOrderId: string | null
  // Tab display metadata (derived from items/form, updated via onUpdate)
  primaryGameName: string | null
  // Workspace lifecycle
  wsStatus: WsStatus
  isDirty: boolean
  createdAt: number
}

export function makeWorkspace(editOrder?: OrderWithDetails | null): WorkspaceDraft {
  const id = `ws_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

  if (editOrder) {
    const items: LineItem[] =
      editOrder.order_items && editOrder.order_items.length > 0
        ? editOrder.order_items.map(item => ({
            _key: item.id,
            gamepass_id: item.gamepass_id ?? '',
            gamepass_name: item.gamepass_name,
            game_name: item.game_name,
            robux_amount: item.robux_amount,
            selling_price: item.selling_price,
            cost: item.cost,
            profit: item.profit,
          }))
        : [
            {
              _key: 'legacy',
              gamepass_id: editOrder.gamepass_id ?? '',
              gamepass_name: '',
              game_name: editOrder.gamepasses?.games?.name ?? null,
              robux_amount: editOrder.robux_amount ?? 0,
              selling_price: editOrder.selling_price ?? 0,
              cost: editOrder.cost ?? 0,
              profit: editOrder.profit ?? 0,
            },
          ]

    const primaryGameName =
      items.find(i => i.game_name)?.game_name ??
      editOrder.gamepasses?.games?.name ??
      null

    return {
      id,
      formValues: {
        buyer_name: editOrder.buyer_name ?? '',
        buyer_roblox_username: editOrder.buyer_roblox_username ?? '',
        roblox_account_id: editOrder.roblox_account_id ?? '',
        payment_method: editOrder.payment_method,
        status:
          editOrder.status === 'delivering'
            ? 'paid'
            : (editOrder.status as OrderFormData['status']),
        notes: editOrder.notes ?? '',
      },
      items,
      editOrderId: editOrder.id,
      primaryGameName,
      wsStatus: 'draft',
      isDirty: false,
      createdAt: Date.now(),
    }
  }

  return {
    id,
    formValues: {
      buyer_name: '',
      buyer_roblox_username: '',
      roblox_account_id: '',
      payment_method: 'GCash',
      status: 'pending',
      notes: '',
    },
    items: [],
    editOrderId: null,
    primaryGameName: null,
    wsStatus: 'draft',
    isDirty: false,
    createdAt: Date.now(),
  }
}

export function useWorkspaces() {
  const [workspaces, setWorkspaces] = useState<WorkspaceDraft[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  // Restore from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY)
      if (raw) {
        const saved = JSON.parse(raw) as {
          workspaces: WorkspaceDraft[]
          activeId: string | null
        }
        const live = (saved.workspaces ?? []).filter(
          ws => ws.wsStatus !== 'submitted'
        )
        if (live.length > 0) {
          setWorkspaces(live)
          const restoredId =
            live.find(ws => ws.id === saved.activeId)?.id ?? live[0].id
          setActiveId(restoredId)
        }
      }
    } catch {}
    setHydrated(true)
  }, [])

  // Persist to localStorage whenever state changes
  const persistRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (!hydrated) return
    if (persistRef.current) clearTimeout(persistRef.current)
    persistRef.current = setTimeout(() => {
      try {
        const toSave = workspaces.filter(ws => ws.wsStatus !== 'submitted')
        localStorage.setItem(LS_KEY, JSON.stringify({ workspaces: toSave, activeId }))
      } catch {}
    }, 300)
  }, [workspaces, activeId, hydrated])

  const openOverlay = useCallback(() => {
    setOpen(true)
  }, [])

  const openOrCreate = useCallback((editOrder?: OrderWithDetails | null) => {
    if (editOrder) {
      // Open an edit workspace — check if one already exists for this order
      setWorkspaces(prev => {
        const existing = prev.find(ws => ws.editOrderId === editOrder.id)
        if (existing) {
          setActiveId(existing.id)
          setOpen(true)
          return prev
        }
        const ws = makeWorkspace(editOrder)
        setActiveId(ws.id)
        setOpen(true)
        return [...prev, ws]
      })
    } else {
      // Create/open blank workspace
      setWorkspaces(prev => {
        if (prev.length === 0) {
          const ws = makeWorkspace()
          setActiveId(ws.id)
          setOpen(true)
          return [ws]
        }
        // Workspaces already exist — just open the overlay
        setOpen(true)
        return prev
      })
    }
  }, [])

  const addWorkspace = useCallback(() => {
    const ws = makeWorkspace()
    setWorkspaces(prev => [...prev, ws])
    setActiveId(ws.id)
    setOpen(true)
    return ws
  }, [])

  const updateWorkspace = useCallback((id: string, updates: Partial<WorkspaceDraft>) => {
    setWorkspaces(prev => prev.map(ws => ws.id === id ? { ...ws, ...updates } : ws))
  }, [])

  const closeWorkspace = useCallback((id: string) => {
    setWorkspaces(prev => {
      const next = prev.filter(ws => ws.id !== id)
      if (next.length === 0) {
        setOpen(false)
        setActiveId(null)
      } else {
        setActiveId(current => {
          if (current !== id) return current
          const idx = prev.findIndex(ws => ws.id === id)
          return next[Math.min(idx, next.length - 1)].id
        })
      }
      return next
    })
  }, [])

  const closeOverlay = useCallback(() => setOpen(false), [])

  const activeWorkspace = workspaces.find(ws => ws.id === activeId) ?? null

  return {
    workspaces,
    activeId,
    activeWorkspace,
    open,
    hydrated,
    setActiveId,
    openOverlay,
    openOrCreate,
    addWorkspace,
    updateWorkspace,
    closeWorkspace,
    closeOverlay,
  }
}
