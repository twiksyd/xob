'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/* The Orders workspace frame.
 *
 * Regions are separated by elevation rather than by boxes:
 *   queue  — sits back on --pane; a long list that must never become the page
 *   stage  — comes forward on --stage; the order being worked on, the focus
 *   dock   — sits back on --pane; fulfillment accounts, along the bottom
 *
 * The dock is horizontal and shallow by design. The previous full-height
 * vertical rail spent ~320px of width permanently to show accounts one above
 * another, which both squeezed the order being worked on and turned choosing
 * an account into scrolling. A bottom dock costs ~110px of height, spans the
 * full width so a dozen candidates are visible at once, and leaves the stage
 * the widest thing on screen.
 *
 * The frame is height-constrained at every breakpoint, so each region scrolls
 * inside itself and 320 queued tickets cannot push the work area off-screen.
 *
 * On a phone the queue and the stage occupy the same cell and swap, and the
 * dock is not rendered at all — there is no width for a candidate strip, so
 * accounts are reached through the same picker sheet the dock's "More
 * accounts" opens. Rendering both cells always (rather than branching in the
 * parent) keeps scroll position on whichever one is hidden. */
export default function WorkspaceRegions({
  header,
  queue,
  stage,
  dock,
  showStageOnMobile,
}: {
  header: ReactNode
  queue: ReactNode
  stage: ReactNode
  dock: ReactNode
  showStageOnMobile: boolean
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--bg)]">
      {header}

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(300px,340px)_minmax(0,1fr)]">
        <section
          aria-label="Order queue"
          className={cn(
            'col-start-1 row-start-1 min-h-0 min-w-0 flex-col overflow-hidden bg-[var(--pane)] lg:col-start-1 lg:row-start-1 lg:flex lg:border-r lg:border-[var(--line-strong)]',
            showStageOnMobile ? 'hidden' : 'flex',
          )}
        >
          {queue}
        </section>

        <section
          aria-label="Current order"
          className={cn(
            'col-start-1 row-start-1 min-h-0 min-w-0 flex-col overflow-hidden bg-[var(--stage)] lg:col-start-2 lg:row-start-1 lg:flex',
            showStageOnMobile ? 'flex' : 'hidden',
          )}
        >
          {stage}
        </section>
      </div>

      <aside
        aria-label="Fulfillment accounts"
        className="hidden shrink-0 border-t border-[var(--line-strong)] bg-[var(--pane)] lg:block"
      >
        {dock}
      </aside>
    </div>
  )
}
