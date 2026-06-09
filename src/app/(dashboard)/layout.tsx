import Sidebar from '@/components/shared/Sidebar'
import AmbientOrbs from '@/components/shared/AmbientOrbs'
import MotionMain from '@/components/shared/MotionMain'
import SplashScreen from '@/components/shared/SplashScreen'
import { MobileNavProvider } from '@/components/shared/MobileNavContext'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <MobileNavProvider>
      <div className="flex h-screen overflow-hidden bg-background bg-ambient">
        <SplashScreen />
        <AmbientOrbs />
        <Sidebar />
        <main className="flex-1 min-w-0 overflow-y-auto relative z-10">
          <MotionMain>{children}</MotionMain>
        </main>
      </div>
    </MobileNavProvider>
  )
}
