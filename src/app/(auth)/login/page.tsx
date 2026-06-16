'use client'
export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import nextDynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase/client'
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
    <div
      className="min-h-screen flex items-center justify-center p-4 bg-ambient"
      style={{ background: 'oklch(0.974 0.007 256)' }}
    >
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

      <div className="relative w-full max-w-[380px] space-y-8 z-10" style={{ zIndex: 10 }}>

        {/* Brand */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #22d3ee, #a78bfa, #e879f9)',
                boxShadow: '0 0 32px rgba(34,211,238,0.25), 0 8px 24px rgba(15,13,42,0.15)',
              }}
            >
              <Box className="w-6 h-6 text-white" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight" style={{ color: 'oklch(0.10 0.030 272)' }}>XOB</h1>
            <p className="text-[13px] mt-1" style={{ color: 'oklch(0.50 0.014 265)' }}>Sign in to your seller dashboard</p>
          </div>
        </div>

        {/* Card */}
        <div
          className="p-7 space-y-5"
          style={{
            background: 'rgba(255,255,255,0.90)',
            border: '1px solid rgba(15,13,42,0.07)',
            borderRadius: '20px',
            boxShadow: '0 4px 24px rgba(15,13,42,0.08), 0 1px 4px rgba(15,13,42,0.05)',
          }}
        >
          {error && (
            <div
              className="flex items-start gap-2.5 p-3.5 rounded-xl"
              style={{ background: 'rgba(244,63,94,0.06)', border: '1px solid rgba(244,63,94,0.15)' }}
            >
              <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
              <p className="text-[12px] text-rose-600">{error}</p>
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
                className="w-full px-3.5 py-[10px] text-[13px] rounded-xl outline-none transition-all"
                style={{
                  background: 'rgba(15,13,42,0.025)',
                  border: '1px solid rgba(15,13,42,0.08)',
                  color: 'oklch(0.10 0.030 272)',
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
                    background: 'rgba(15,13,42,0.025)',
                    border: '1px solid rgba(15,13,42,0.08)',
                    color: 'oklch(0.10 0.030 272)',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: 'oklch(0.55 0.010 265)' }}
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-[10px] flex items-center justify-center disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-[12px]" style={{ color: 'oklch(0.55 0.010 265)' }}>
            Don&apos;t have an account?{' '}
            <Link href="/register" className="font-semibold" style={{ color: 'oklch(0.50 0.18 200)' }}>
              Sign up
            </Link>
          </p>
        </div>

        {/* Footer */}
        <p className="text-center text-[11px]" style={{ color: 'oklch(0.60 0.010 265)' }}>
          XOB Gaming Marketplace · Secure seller platform
        </p>
      </div>
    </div>
  )
}
