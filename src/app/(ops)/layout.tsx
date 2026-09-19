import './ops.css'
import Shell from '@/components/ops/Shell'
import { ToastProvider, ConfirmProvider } from '@/components/ops/feedback'

// The operations console. `.ops-root` carries the console's token set and is
// what globals.css never touches — legacy surfaces keep their own theme.
export default function OpsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="ops-root min-h-dvh">
      <ToastProvider>
        <ConfirmProvider>
          <Shell>{children}</Shell>
        </ConfirmProvider>
      </ToastProvider>
    </div>
  )
}
