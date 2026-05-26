import Sidebar from '@/components/shared/Sidebar'
import AmbientOrbs from '@/components/shared/AmbientOrbs'
import MotionMain from '@/components/shared/MotionMain'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-background bg-ambient">
      <AmbientOrbs />
      <Sidebar />
      <main className="flex-1 overflow-y-auto relative z-10">
        <MotionMain>{children}</MotionMain>
      </main>
    </div>
  )
}
