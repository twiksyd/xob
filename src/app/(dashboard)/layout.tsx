import FloatingNav from '@/components/shared/FloatingNav'
import AmbientOrbs from '@/components/shared/AmbientOrbs'
import MotionMain from '@/components/shared/MotionMain'
import SplashScreen from '@/components/shared/SplashScreen'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background bg-ambient">
      <SplashScreen />
      <AmbientOrbs />
      <FloatingNav />
      <main className="pt-20 min-h-screen relative z-10">
        <MotionMain>{children}</MotionMain>
      </main>
    </div>
  )
}
