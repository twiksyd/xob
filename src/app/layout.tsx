import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { MotionConfig } from 'framer-motion'
import './globals.css'
import PwaRegister from '@/components/shared/PwaRegister'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const viewport: Viewport = {
  themeColor: '#0d0b1e',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

export const metadata: Metadata = {
  title: 'XOB — Roblox Seller Dashboard',
  description: 'Professional Roblox gamepass seller management platform',
  appleWebApp: {
    title: 'XOB',
    statusBarStyle: 'black-translucent',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} dark`}>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <PwaRegister />
        {/* Every Framer Motion animation app-wide (ambient blob drift, page
            transitions, stagger reveals) now respects the OS-level "reduce
            motion" preference automatically — previously only the CSS-based
            badge/glow animations did this via their own media queries. */}
        <MotionConfig reducedMotion="user">
          {children}
        </MotionConfig>
      </body>
    </html>
  )
}
