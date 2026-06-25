'use client'
export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import nextDynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Eye, EyeOff, AlertCircle, Box } from 'lucide-react'

const LiquidEther = nextDynamic(() => import('@/components/shared/LiquidEther'), { ssr: false })

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false) }
    else { router.push('/'); router.refresh() }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-ambient">
      {/* Fluid background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <LiquidEther
          colors={['#22d3ee', '#a78bfa', '#e879f9']}
          mouseForce={20}
          cursorSize={100}
          resolution={0.5}
          autoDemo={true}
          autoSpeed={0.5}
          autoIntensity={2.2}
          autoResumeDelay={3000}
          autoRampDuration={0.6}
        />
      </div>

      <div className="relative w-full max-w-[380px] space-y-8" style={{ zIndex: 10 }}>

        {/* Brand */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #22d3ee, #a78bfa)',
                boxShadow: '0 0 32px rgba(34,211,238,0.30), 0 8px 24px rgba(0,0,0,0.40)',
              }}
            >
              <Box className="w-6 h-6 text-white" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-foreground">XOB</h1>
            <p className="text-[13px] mt-1 text-muted-foreground">Sign in to your seller dashboard</p>
          </div>
        </div>

        {/* Card */}
        <div className="glass-elevated p-7 space-y-5">
          {error && (
            <div
              className="flex items-start gap-2.5 p-3.5 rounded-xl"
              style={{ background: 'rgba(244,63,94,0.10)', border: '1px solid rgba(244,63,94,0.22)' }}
            >
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <p className="text-[12px] text-rose-400">{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email */}
            <div className="space-y-1.5">
              <label className="label-caps block">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full px-3.5 py-[10px] text-[13px] rounded-xl outline-none"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.09)',
                  color: 'oklch(0.88 0.006 265)',
                }}
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="label-caps block">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-3.5 py-[10px] pr-10 text-[13px] rounded-xl outline-none transition-all"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.09)',
                    color: 'oklch(0.88 0.006 265)',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors text-muted-foreground hover:text-foreground"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              disabled={loading}
              className="w-full py-[10px] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </Button>
          </form>

          <p className="text-center text-[12px] text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link href="/register" className="font-semibold" style={{ color: '#22d3ee' }}>
              Sign up
            </Link>
          </p>
        </div>

        {/* Footer */}
        <p className="text-center text-[11px] text-muted-foreground opacity-60">
          XOB Gaming Marketplace · Secure seller platform
        </p>
      </div>
    </div>
  )
}
