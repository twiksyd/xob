'use client'

import { Plus, Users } from 'lucide-react'
import type { RobloxAccount } from '@/lib/types/database'
import { getAvailableRobux } from '@/lib/utils/accounts'
import { Button } from '../ui'
import { Avatar } from '../accounts/parts'

/* The standing state of the desk. One line that never moves, so the operator
   always knows the size of the backlog without reading the queue. */
export default function WorkspaceHeader({
  waiting,
  needsAccount,
  ready,
  activeAccount,
  onPickAccount,
  onNewOrder,
}: {
  waiting: number
  needsAccount: number
  ready: number
  activeAccount: RobloxAccount | null
  onPickAccount: () => void
  onNewOrder: () => void
}) {
  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-[var(--line)] bg-[var(--bg)] px-3 py-2.5 lg:px-4">
      {/* A single inline block rather than a flex row: a flex row cannot
          truncate, and on a 375px screen it pushed the actions off-screen. */}
      <p className="num min-w-0 flex-1 truncate text-[13px] text-[var(--text-3)]">
        <span className="font-semibold text-[var(--text)]">{waiting}</span> waiting
        {needsAccount > 0 && (
          <>
            <span aria-hidden className="px-1.5 text-[var(--line-strong)]">
              &middot;
            </span>
            <span className="font-semibold text-[var(--accent)]">{needsAccount}</span>
            <span className="hidden sm:inline"> need an account</span>
            <span className="sm:hidden"> unassigned</span>
          </>
        )}
        {ready > 0 && (
          <>
            <span aria-hidden className="px-1.5 text-[var(--line-strong)]">
              &middot;
            </span>
            <span className="font-semibold text-[var(--ok)]">{ready}</span> ready
          </>
        )}
      </p>

      <div className="flex shrink-0 items-center gap-2">
        {/* Below 1280px the fulfillment rail is off screen, so the active
            account and its balance ride here instead. */}
        <Button
          intent="neutral"
          size="md"
          onClick={onPickAccount}
          className="max-w-[40vw] xl:hidden"
          aria-label="Change fulfillment account"
        >
          {activeAccount ? (
            <>
              <Avatar account={activeAccount} size={18} />
              <span className="num truncate">
                {getAvailableRobux(activeAccount).toLocaleString()}
              </span>
            </>
          ) : (
            <>
              <Users className="size-4" aria-hidden />
              <span>Account</span>
            </>
          )}
        </Button>

        <Button intent="primary" size="md" onClick={onNewOrder}>
          <Plus className="size-4" aria-hidden />
          <span className="hidden sm:inline">New order</span>
        </Button>
      </div>
    </div>
  )
}
