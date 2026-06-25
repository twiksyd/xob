'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Eye, EyeOff, AlertCircle, Box, CheckCircle2 } from 'lucide-react'

export default function RegisterPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } }
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSuccess(true)
      setTimeout(() => router.push('/login'), 3000)
    }
  }

  const inputStyle = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.09)',
    color: 'oklch(0.88 0.006 265)',
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-ambient">
        <div className="glass-elevated p-8 text-center max-w-sm w-full space-y-4">
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto"
            style={{ background: 'rgba(34,211,238,0.12)', border: '1px solid rgba(34,211,238,0.20)' }}
          >
            <CheckCircle2 className="w-6 h-6" style={{ color: '#22d3ee' }} />
          </div>
          <h2 className="text-[17px] font-bold text-foreground">Account created!</h2>
          <p className="text-[13px] text-muted-foreground">Check your email to confirm your account. Redirecting to login…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-ambient">
      <div className="relative w-full max-w-[380px] space-y-8" style={{ zIndex: 10 }}>

        {/* Brand */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #a78bfa, #22d3ee)',
                boxShadow: '0 0 32px rgba(167,139,250,0.30), 0 8px 24px rgba(0,0,0,0.40)',
              }}
            >
              <Box className="w-6 h-6 text-white" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-foreground">XOB</h1>
            <p className="text-[13px] mt-1 text-muted-foreground">Create your seller account</p>
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

          <form onSubmit={handleRegister} className="space-y-4">
            {/* Full Name */}
            <div className="space-y-1.5">
              <label className="label-caps block">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Your name"
                required
                className="w-full px-3.5 py-[10px] text-[13px] rounded-xl outline-none transition-all"
                style={inputStyle}
              />
            </div>

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
                style={inputStyle}
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
                  placeholder="Min 6 characters"
                  required
                  minLength={6}
                  className="w-full px-3.5 py-[10px] pr-10 text-[13px] rounded-xl outline-none transition-all"
                  style={inputStyle}
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
              {loading ? 'Creating account…' : 'Create Account'}
            </Button>
          </form>

          <p className="text-center text-[12px] text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className="font-semibold" style={{ color: '#22d3ee' }}>
              Sign in
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
