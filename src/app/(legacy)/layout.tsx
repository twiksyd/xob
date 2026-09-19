import Link from 'next/link'
import { ToastProvider } from '@/components/shared/Toast'
import { ConfirmProvider } from '@/components/shared/ConfirmDialog'

// Legacy shell. These routes are intentionally absent from the product
// navigation — they stay reachable by direct URL so historical tooling
// (inventory, integrity, analytics, seller access) and their database
// behaviour remain available. Nothing here is linked from the new app.
export default function LegacyLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <div className="min-h-screen bg-background">
          <div className="sticky top-0 z-50 flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border bg-card px-4 py-2 text-[11px] font-semibold">
            <span className="rounded bg-muted px-1.5 py-0.5 text-muted-foreground">Legacy</span>
            <span className="text-muted-foreground">
              Archived XOB surface — not part of the current product.
            </span>
            <Link href="/" className="ml-auto underline underline-offset-2">
              Back to XOB
            </Link>
          </div>
          <main className="min-h-screen">{children}</main>
        </div>
      </ConfirmProvider>
    </ToastProvider>
  )
}
