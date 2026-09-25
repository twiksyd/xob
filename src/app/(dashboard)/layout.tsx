import FloatingNav from '@/components/shared/FloatingNav'
import GlobalOrderCommand from '@/components/shared/GlobalOrderCommand'
import AmbientOrbs from '@/components/shared/AmbientOrbs'
import MotionMain from '@/components/shared/MotionMain'
import { ToastProvider } from '@/components/shared/Toast'
import { ConfirmProvider } from '@/components/shared/ConfirmDialog'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <div className="min-h-screen bg-background bg-ambient">
          <AmbientOrbs />
          <FloatingNav />
          <GlobalOrderCommand />
          <main className="pt-20 min-h-screen relative z-10">
            <MotionMain>{children}</MotionMain>
          </main>
        </div>
      </ConfirmProvider>
    </ToastProvider>
  )
}
