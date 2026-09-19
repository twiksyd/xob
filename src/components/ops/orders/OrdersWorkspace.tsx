'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { LogicalOrder } from '@/lib/types/logical-order'
import type { LineItem } from '@/lib/types/database'
import { getAvailableRobux } from '@/lib/utils/accounts'
import {
  assignableItems,
  classifyForFinalize,
  isReadyToComplete,
  isStalled,
  isUnassigned,
  requiredRobux,
  sortQueue,
  ticketName,
  ticketRef,
  type FinalizeCandidate,
} from '@/lib/ops/queue'
import { submitManualOrder, type ManualOrderInput } from '@/lib/ops/submit-order'
import { useActiveAccount } from '@/lib/ops/active-account'
import { buildLastUsedIndex, lastUsedForOrder } from '@/lib/ops/last-used'
import { useToast, useConfirm } from '../feedback'
import { Button, Overlay } from '../ui'
import { useOrdersData } from './useOrdersData'
import { useOrderActions, type ItemAssignResult } from './useOrderActions'
import WorkspaceRegions from './WorkspaceRegions'
import WorkspaceHeader from './WorkspaceHeader'
import QueuePane, { type QueueFilter } from './QueuePane'
import OrderPane from './OrderPane'
import AccountPicker from './AccountPicker'
import AccountDock from './AccountDock'
import ItemAssignDialog from './ItemAssignDialog'
import ComposeDialog, { clearOrderDraft } from './ComposeDialog'
import { FinalizeDialog, RemoveDialog, type FinalizeProgressRow } from './dialogs'

type MobileView = 'queue' | 'order'
type Flash = 'ok' | 'bad'

export default function OrdersWorkspace() {
  const toast = useToast()
  const confirm = useConfirm()
  const supabase = useMemo(() => createClient(), [])

  const onLoadError = useCallback((message: string) => toast.error(message), [toast])
  const data = useOrdersData(onLoadError)
  const actions = useOrderActions({ refresh: data.refresh, toast })

  const [filter, setFilter] = useState<QueueFilter>('all')
  const [search, setSearch] = useState('')
  const [focusedKey, setFocusedKey] = useState<string | null>(null)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set())
  const [mobileView, setMobileView] = useState<MobileView>('queue')
  const [accountSheetOpen, setAccountSheetOpen] = useState(false)
  const [activeAccountId, setActiveAccount] = useActiveAccount()
  const [flashes, setFlashes] = useState<Record<string, Flash>>({})
  const [nowMs, setNowMs] = useState(() => Date.now())

  const [itemAssignOrder, setItemAssignOrder] = useState<LogicalOrder | null>(null)
  const [itemAssignResults, setItemAssignResults] = useState<ItemAssignResult[] | null>(null)
  const [itemAssignSaving, setItemAssignSaving] = useState(false)
  const [removeOrder, setRemoveOrder] = useState<LogicalOrder | null>(null)
  const [removeBusy, setRemoveBusy] = useState(false)
  const [composeOpen, setComposeOpen] = useState(false)
  const [composeEditId, setComposeEditId] = useState<string | null>(null)
  const [composeSaving, setComposeSaving] = useState(false)
  const [finalizeOpen, setFinalizeOpen] = useState(false)
  const [finalizePhase, setFinalizePhase] = useState<'preview' | 'processing' | 'done'>('preview')
  const [finalizeCandidates, setFinalizeCandidates] = useState<FinalizeCandidate[]>([])
  const [finalizeProgress, setFinalizeProgress] = useState<FinalizeProgressRow[]>([])
  const [finalizing, setFinalizing] = useState(false)

  const lastIndexRef = useRef<number | null>(null)
  const flashTimers = useRef<number[]>([])

  useEffect(
    () => () => {
      flashTimers.current.forEach(t => window.clearTimeout(t))
    },
    [],
  )

  // Ages are shown in minutes and hours; a one-minute tick keeps them honest
  // without re-rendering the queue on every frame.
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 60_000)
    return () => window.clearInterval(id)
  }, [])

  const chooseAccount = useCallback(
    (id: string) => {
      setActiveAccount(id)
      setAccountSheetOpen(false)
    },
    [setActiveAccount],
  )

  const flash = useCallback((next: Record<string, Flash>) => {
    setFlashes(prev => ({ ...prev, ...next }))
    const timer = window.setTimeout(() => {
      setFlashes(prev => {
        const copy = { ...prev }
        Object.keys(next).forEach(key => delete copy[key])
        return copy
      })
    }, 1100)
    flashTimers.current.push(timer)
  }, [])

  /* ── Derived queue ──────────────────────────────────────────────────── */

  const activeOrders = useMemo(
    () => sortQueue(data.logicalOrders, nowMs),
    [data.logicalOrders, nowMs],
  )

  const counts = useMemo<Record<QueueFilter, number>>(
    () => ({
      all: activeOrders.length,
      unassigned: activeOrders.filter(isUnassigned).length,
      ready: activeOrders.filter(isReadyToComplete).length,
      pending: activeOrders.filter(o => o.status === 'pending' && !o.hasMixedStatus).length,
      stalled: activeOrders.filter(o => isStalled(o, nowMs)).length,
    }),
    [activeOrders, nowMs],
  )

  const visibleOrders = useMemo(() => {
    const q = search.trim().toLowerCase()
    return activeOrders
      .filter(o => {
        switch (filter) {
          case 'unassigned':
            return isUnassigned(o)
          case 'ready':
            return isReadyToComplete(o)
          case 'pending':
            return o.status === 'pending' && !o.hasMixedStatus
          case 'stalled':
            return isStalled(o, nowMs)
          default:
            return true
        }
      })
      .filter(o => {
        if (!q) return true
        return (
          (o.buyerName ?? '').toLowerCase().includes(q) ||
          (o.buyerRobloxUsername ?? '').toLowerCase().includes(q) ||
          (o.orderNumber ?? '').toLowerCase().includes(q)
        )
      })
  }, [activeOrders, filter, search, nowMs])

  const focusedOrder = useMemo(() => {
    if (focusedKey) {
      const found = activeOrders.find(o => o.logicalKey === focusedKey)
      if (found) return found
    }
    return visibleOrders[0] ?? null
  }, [focusedKey, activeOrders, visibleOrders])

  const selectedOrders = useMemo(
    () => activeOrders.filter(o => selectedKeys.has(o.logicalKey)),
    [activeOrders, selectedKeys],
  )

  const activeAccount = data.accounts.find(a => a.id === activeAccountId) ?? null

  // What the dock measures itself against: the batch when a selection is
  // active, otherwise the order currently open.
  const selectionRequired = selectedOrders.reduce((sum, o) => sum + requiredRobux(o), 0)
  const focusedRequired = focusedOrder ? requiredRobux(focusedOrder) : 0
  const dockRequired = selectedOrders.length > 0 ? selectionRequired : focusedRequired
  const dockLabel =
    selectedOrders.length > 0 ? `${selectedOrders.length} selected order${selectedOrders.length !== 1 ? 's' : ''}` : 'This order'

  // One pass over orders already in memory — no extra query. Rebuilt only when
  // the loaded orders change, then looked up for the order in focus. A
  // multi-order selection has no single "last used" answer, so no hint then.
  const lastUsedIndex = useMemo(() => buildLastUsedIndex(data.logicalOrders), [data.logicalOrders])
  const dockLastUsed =
    selectedOrders.length === 0 && focusedOrder ? lastUsedForOrder(lastUsedIndex, focusedOrder) : null

  /* ── Selection ──────────────────────────────────────────────────────── */

  const toggleSelect = useCallback(
    (order: LogicalOrder, index: number, shiftKey: boolean) => {
      setSelectedKeys(prev => {
        const next = new Set(prev)
        if (shiftKey && lastIndexRef.current !== null) {
          const [start, end] = [lastIndexRef.current, index].sort((a, b) => a - b)
          visibleOrders.slice(start, end + 1).forEach(o => next.add(o.logicalKey))
        } else if (next.has(order.logicalKey)) {
          next.delete(order.logicalKey)
        } else {
          next.add(order.logicalKey)
        }
        return next
      })
      lastIndexRef.current = index
    },
    [visibleOrders],
  )

  const openOrder = useCallback((order: LogicalOrder) => {
    setFocusedKey(order.logicalKey)
    setMobileView('order')
  }, [])

  const advanceFocus = useCallback(
    (orders: LogicalOrder[], skipKey: string) => {
      const next = sortQueue(orders, nowMs).find(o => o.logicalKey !== skipKey)
      setFocusedKey(next?.logicalKey ?? null)
      setMobileView(next ? 'order' : 'queue')
    },
    [nowMs],
  )

  /* ── Actions ────────────────────────────────────────────────────────── */

  async function handleAssignActive(order: LogicalOrder) {
    if (!activeAccount) {
      setAccountSheetOpen(true)
      return
    }
    const need = requiredRobux(order)
    if (getAvailableRobux(activeAccount) < need) {
      toast.error(
        `${activeAccount.username} has ${getAvailableRobux(activeAccount).toLocaleString()} R$ available but this order needs ${need.toLocaleString()} R$.`,
      )
      return
    }

    const result = await actions.assignWholeOrder(order, activeAccount)
    if (result.ok) {
      flash({ [order.logicalKey]: 'ok' })
      toast.success(`Fulfilling ${ticketName(order)} from ${activeAccount.username}.`)
    } else {
      flash({ [order.logicalKey]: 'bad' })
      toast.error(result.error ?? 'Could not assign the account.')
    }
    await data.refresh()
  }

  async function handleMarkPaid(order: LogicalOrder) {
    const result = await actions.setStatus(order, 'paid', { silent: true })
    flash({ [order.logicalKey]: result.ok ? 'ok' : 'bad' })
    if (result.ok) toast.success(`${ticketName(order)} marked paid.`)
    else toast.error(result.message ?? 'Could not mark the order paid.')
  }

  async function handleComplete(order: LogicalOrder) {
    if (!isReadyToComplete(order)) {
      flash({ [order.logicalKey]: 'bad' })
      toast.error(
        order.status === 'pending'
          ? 'Mark this order paid before completing it.'
          : 'Assign every item before completing this order.',
      )
      return
    }

    const result = await actions.setStatus(order, 'completed', { silent: true, refresh: false })
    if (!result.ok) {
      flash({ [order.logicalKey]: 'bad' })
      toast.error(result.message ?? 'Could not complete the order.')
      await data.refresh()
      return
    }

    flash({ [order.logicalKey]: 'ok' })
    toast.success(`${ticketName(order)} completed.`)
    setSelectedKeys(prev => {
      if (!prev.has(order.logicalKey)) return prev
      const next = new Set(prev)
      next.delete(order.logicalKey)
      return next
    })
    // Completing an order should hand the operator the next one, not an empty
    // pane — this is the loop the whole console is built around.
    const refreshed = await data.refresh()
    advanceFocus(refreshed, order.logicalKey)
  }

  async function handleRefund(order: LogicalOrder) {
    const ok = await confirm({
      title: 'Mark this order refunded?',
      description: `${ticketName(order)} · ${ticketRef(order)}\n\nThis reverses the sale and restores any Robux it consumed.`,
      confirmLabel: 'Mark refunded',
      danger: true,
    })
    if (!ok) return
    const result = await actions.setStatus(order, 'refunded', { silent: true })
    flash({ [order.logicalKey]: result.ok ? 'ok' : 'bad' })
    if (result.ok) {
      toast.success('Order marked refunded.')
      const refreshed = await data.refresh()
      advanceFocus(refreshed, order.logicalKey)
    } else {
      toast.error(result.message ?? 'Could not refund the order.')
    }
  }

  async function handleRemoveConfirm(reason: string) {
    if (!removeOrder) return
    setRemoveBusy(true)
    const target = removeOrder
    const result = await actions.removeFromQueue(target, reason)
    setRemoveBusy(false)
    if (result.ok) {
      setRemoveOrder(null)
      flash({ [target.logicalKey]: 'ok' })
      toast.success(`${ticketName(target)} removed from the queue.`)
      const refreshed = await data.refresh()
      advanceFocus(refreshed, target.logicalKey)
    } else {
      flash({ [target.logicalKey]: 'bad' })
      toast.error(result.error ?? 'Could not remove the order.')
    }
  }

  async function handleDelete(order: LogicalOrder) {
    const ok = await confirm({
      title: 'Delete this order permanently?',
      description: `${ticketName(order)} · ${ticketRef(order)}\n${order.items.length} item${order.items.length !== 1 ? 's' : ''}\n\nThis erases the order from the database. "Remove from queue" is almost always the right choice instead — it keeps the record.`,
      confirmLabel: 'Delete permanently',
      danger: true,
    })
    if (!ok) return

    const result = await actions.deleteOrder(order)
    if (result.ok) {
      data.applyLocalDelete(new Set(order.underlyingOrderIds))
      toast.success('Order deleted.')
      const refreshed = await data.refresh()
      advanceFocus(refreshed, order.logicalKey)
    } else {
      flash({ [order.logicalKey]: 'bad' })
      toast.error(result.error ?? 'Could not delete the order.')
      await data.refresh()
    }
  }

  async function handleItemAssignSave(assignments: Record<string, string | null>) {
    if (!itemAssignOrder) return
    setItemAssignSaving(true)
    const results = await actions.saveItemAssignments(itemAssignOrder, assignments, data.accounts)
    setItemAssignSaving(false)
    setItemAssignResults(results)

    const failed = results.filter(r => !r.ok)
    flash({ [itemAssignOrder.logicalKey]: failed.length === 0 ? 'ok' : 'bad' })
    if (failed.length === 0) {
      toast.success('Assignments saved.')
      setItemAssignOrder(null)
      setItemAssignResults(null)
    } else {
      toast.error(`${failed.length} item${failed.length !== 1 ? 's' : ''} could not be saved.`)
    }
    await data.refresh()
  }

  /* Batch assign: one order at a time, never in parallel — several selected
     orders can draw on the same account, and the per-order RPC validates
     against the balance as it stands when that order is processed. */
  async function handleAssignSelected() {
    if (!activeAccount) {
      setAccountSheetOpen(true)
      return
    }
    const targets = selectedOrders.filter(o => assignableItems(o).length > 0 || isUnassigned(o))
    if (targets.length === 0) {
      toast.error('None of the selected orders need an account.')
      return
    }
    if (getAvailableRobux(activeAccount) < selectionRequired) {
      toast.error(
        `${activeAccount.username} has ${getAvailableRobux(activeAccount).toLocaleString()} R$ available but the selection needs ${selectionRequired.toLocaleString()} R$.`,
      )
      return
    }

    const next: Record<string, Flash> = {}
    let done = 0
    let failedFirst: string | null = null

    for (const order of targets) {
      const result = await actions.assignWholeOrder(order, activeAccount)
      next[order.logicalKey] = result.ok ? 'ok' : 'bad'
      if (result.ok) done += 1
      else if (!failedFirst) failedFirst = result.error
    }

    flash(next)
    if (failedFirst) toast.error(`${done} assigned, ${targets.length - done} failed. ${failedFirst}`)
    else {
      toast.success(`${done} order${done !== 1 ? 's' : ''} assigned to ${activeAccount.username}.`)
      setSelectedKeys(new Set())
    }
    await data.refresh()
  }

  function openFinalize() {
    const candidates = selectedOrders.map(classifyForFinalize)
    setFinalizeCandidates(candidates)
    setFinalizeProgress(
      candidates
        .filter(c => c.kind === 'ready')
        .map(c => ({
          logicalKey: c.lo.logicalKey,
          name: ticketName(c.lo),
          state: 'waiting' as const,
          error: null,
        })),
    )
    setFinalizePhase('preview')
    setFinalizeOpen(true)
  }

  async function runFinalize() {
    const ready = finalizeCandidates.filter(c => c.kind === 'ready')
    if (ready.length === 0) return

    setFinalizing(true)
    setFinalizePhase('processing')
    const completed: string[] = []

    for (const candidate of ready) {
      const { lo, steps } = candidate
      setFinalizeProgress(prev =>
        prev.map(p => (p.logicalKey === lo.logicalKey ? { ...p, state: 'processing' } : p)),
      )

      let failure: string | null = null
      for (const step of steps) {
        const result = await actions.setStatus(lo, step, { silent: true, refresh: false })
        if (!result.ok) {
          failure = result.message ?? `Could not mark the order ${step}.`
          break
        }
      }

      setFinalizeProgress(prev =>
        prev.map(p =>
          p.logicalKey === lo.logicalKey
            ? { ...p, state: failure ? 'failed' : 'done', error: failure }
            : p,
        ),
      )
      flash({ [lo.logicalKey]: failure ? 'bad' : 'ok' })
      if (!failure) completed.push(lo.logicalKey)
    }

    setSelectedKeys(prev => {
      const next = new Set(prev)
      completed.forEach(key => next.delete(key))
      return next
    })

    const refreshed = await data.refresh()
    if (focusedKey && completed.includes(focusedKey)) advanceFocus(refreshed, focusedKey)

    const failedCount = ready.length - completed.length
    if (failedCount > 0) toast.error(`${completed.length} completed, ${failedCount} need attention.`)
    else toast.success(`${completed.length} order${completed.length !== 1 ? 's' : ''} finalized.`)

    setFinalizing(false)
    setFinalizePhase('done')
  }

  async function handleCompose(input: ManualOrderInput, items: LineItem[]) {
    setComposeSaving(true)
    try {
      const outcome = await submitManualOrder({
        supabase,
        accounts: data.accounts,
        items,
        input,
        editOrderId: composeEditId,
      })
      outcome.warnings.forEach(warning => toast.error(warning))
      if (outcome.warnings.length === 0) {
        toast.success(outcome.created ? 'Order created.' : 'Order updated.')
      }
      if (!composeEditId) clearOrderDraft()
      setComposeOpen(false)
      setComposeEditId(null)
      const refreshed = await data.refresh()
      const landed = refreshed.find(o => o.underlyingOrderIds.includes(outcome.orderId))
      if (landed) {
        setFocusedKey(landed.logicalKey)
        setMobileView('order')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save the order.')
    } finally {
      setComposeSaving(false)
    }
  }

  function openEdit(order: LogicalOrder) {
    if (order.source === 'budgetwise') {
      setItemAssignResults(null)
      setItemAssignOrder(order)
      return
    }
    setComposeEditId(order.primaryOrderId)
    setComposeOpen(true)
  }

  /* ── Keyboard ───────────────────────────────────────────────────────────
     Shortcuts for the three moves an operator repeats all day. Suppressed
     while a field has focus or a dialog is open. */
  const dialogOpen =
    composeOpen || finalizeOpen || !!itemAssignOrder || !!removeOrder || accountSheetOpen

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if (dialogOpen) return

      const list = visibleOrders
      const index = focusedOrder ? list.findIndex(o => o.logicalKey === focusedOrder.logicalKey) : -1

      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault()
        const next = list[Math.min(list.length - 1, index + 1)]
        if (next) openOrder(next)
      } else if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault()
        const next = list[Math.max(0, index - 1)]
        if (next) openOrder(next)
      } else if (e.key === 'a' && focusedOrder && isUnassigned(focusedOrder)) {
        e.preventDefault()
        void handleAssignActive(focusedOrder)
      } else if (e.key === 'p' && focusedOrder && focusedOrder.status === 'pending') {
        e.preventDefault()
        void handleMarkPaid(focusedOrder)
      } else if (e.key === 'c' && focusedOrder && isReadyToComplete(focusedOrder)) {
        e.preventDefault()
        void handleComplete(focusedOrder)
      } else if (e.key === 'n') {
        e.preventDefault()
        setComposeEditId(null)
        setComposeOpen(true)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  })

  const editOrderRow = composeEditId ? (data.rawById.get(composeEditId) ?? null) : null

  const selectionBar = (
    <>
      <Button intent="neutral" size="sm" onClick={handleAssignSelected} disabled={!!actions.busyKey}>
        Assign
      </Button>
      <Button intent="positive" size="sm" onClick={openFinalize} disabled={!!actions.busyKey}>
        Finalize
      </Button>
    </>
  )

  const workspaceHeader = (
    <WorkspaceHeader
      waiting={counts.all}
      needsAccount={counts.unassigned}
      ready={counts.ready}
      activeAccount={activeAccount}
      onPickAccount={() => setAccountSheetOpen(true)}
      onNewOrder={() => {
        setComposeEditId(null)
        setComposeOpen(true)
      }}
    />
  )

  return (
    <>
      <WorkspaceRegions
        showStageOnMobile={mobileView === 'order'}
        header={workspaceHeader}
        queue={

          <QueuePane
            orders={visibleOrders}
            counts={counts}
            filter={filter}
            onFilterChange={setFilter}
            search={search}
            onSearchChange={setSearch}
            nowMs={nowMs}
            loading={data.loading}
            capped={data.capped}
            currentKey={focusedOrder?.logicalKey ?? null}
            selectedKeys={selectedKeys}
            busyKey={actions.busyKey}
            flashes={flashes}
            onOpen={openOrder}
            onToggleSelect={toggleSelect}
            onClearSelection={() => setSelectedKeys(new Set())}
            selectionBar={selectionBar}
          />
        }
        stage={
          <OrderPane
            order={focusedOrder}
            accounts={data.accounts}
            activeAccount={activeAccount}
            nowMs={nowMs}
            busy={actions.busyKey === focusedOrder?.logicalKey}
            waiting={counts.all}
            needsAccount={counts.unassigned}
            onBack={() => setMobileView('queue')}
            onAssignActive={() => focusedOrder && void handleAssignActive(focusedOrder)}
            onMarkPaid={() => focusedOrder && void handleMarkPaid(focusedOrder)}
            onComplete={() => focusedOrder && void handleComplete(focusedOrder)}
            onEdit={() => focusedOrder && openEdit(focusedOrder)}
            onItemAssign={() => {
              if (!focusedOrder) return
              setItemAssignResults(null)
              setItemAssignOrder(focusedOrder)
            }}
            onRemove={() => focusedOrder && setRemoveOrder(focusedOrder)}
            onRefund={() => focusedOrder && void handleRefund(focusedOrder)}
            onDelete={() => focusedOrder && void handleDelete(focusedOrder)}
            onPickAccount={() => setAccountSheetOpen(true)}
          />
        }
        dock={
          <AccountDock
            accounts={data.accounts}
            activeAccountId={activeAccountId}
            onSelect={chooseAccount}
            onBrowse={() => setAccountSheetOpen(true)}
            required={dockRequired}
            requirementLabel={dockLabel}
            lastUsed={dockLastUsed}
          />
        }
      />

      {/* ── Overlays ──────────────────────────────────────────────────── */}
      {accountSheetOpen && (
        <Overlay
          open
          onClose={() => setAccountSheetOpen(false)}
          title="Fulfillment account"
          subtitle={
            dockRequired > 0 ? (
              <span className="num">
                {dockLabel} needs {dockRequired.toLocaleString()} R$
              </span>
            ) : undefined
          }
        >
          <AccountPicker
            accounts={data.accounts}
            activeAccountId={activeAccountId}
            onSelect={chooseAccount}
            required={dockRequired}
            requirementLabel={dockLabel}
            lastUsedAccountId={dockLastUsed?.accountId ?? null}
            className="-mx-1 max-h-[64dvh]"
          />
        </Overlay>
      )}

      {itemAssignOrder && (
        <ItemAssignDialog
          key={itemAssignOrder.logicalKey}
          order={itemAssignOrder}
          accounts={data.accounts}
          activeAccountId={activeAccountId}
          saving={itemAssignSaving}
          results={itemAssignResults}
          lastUsedIndex={lastUsedIndex}
          onSave={assignments => void handleItemAssignSave(assignments)}
          onClose={() => {
            setItemAssignOrder(null)
            setItemAssignResults(null)
          }}
        />
      )}

      {removeOrder && (
        <RemoveDialog
          order={removeOrder}
          busy={removeBusy}
          onConfirm={reason => void handleRemoveConfirm(reason)}
          onClose={() => setRemoveOrder(null)}
        />
      )}

      {composeOpen && (
        <ComposeDialog
          key={composeEditId ?? 'new'}
          gamepasses={data.gamepasses}
          accounts={data.accounts}
          editOrder={editOrderRow}
          activeAccountId={activeAccountId}
          saving={composeSaving}
          onSubmit={(input, items) => void handleCompose(input, items)}
          onClose={() => {
            setComposeOpen(false)
            setComposeEditId(null)
          }}
        />
      )}

      {finalizeOpen && (
        <FinalizeDialog
          candidates={finalizeCandidates}
          phase={finalizePhase}
          progress={finalizeProgress}
          busy={finalizing}
          onConfirm={() => void runFinalize()}
          onClose={() => {
            if (finalizing) return
            setFinalizeOpen(false)
            setFinalizeCandidates([])
            setFinalizeProgress([])
            setFinalizePhase('preview')
          }}
        />
      )}
    </>
  )
}
