'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
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
    background: 'rgba(15,13,42,0.025)',
    border: '1px solid rgba(15,13,42,0.08)',
    color: 'oklch(0.10 0.030 272)',
  }

  if (success) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-4 bg-ambient"
        style={{ background: 'oklch(0.974 0.007 256)' }}
      >
        <div
          className="p-8 text-center max-w-sm w-full space-y-4"
          style={{
            background: 'rgba(255,255,255,0.90)',
            border: '1px solid rgba(15,13,42,0.07)',
            borderRadius: '20px',
            boxShadow: '0 4px 24px rgba(15,13,42,0.08), 0 1px 4px rgba(15,13,42,0.05)',
          }}
        >
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto" style={{ background: 'rgba(34,211,238,0.10)' }}>
            <CheckCircle2 className="w-6 h-6" style={{ color: '#22d3ee' }} />
          </div>
          <h2 className="text-[17px] font-bold" style={{ color: 'oklch(0.10 0.030 272)' }}>Account created!</h2>
          <p className="text-[13px]" style={{ color: 'oklch(0.50 0.014 265)' }}>Check your email to confirm your account. Redirecting to login…</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 bg-ambient"
      style={{ background: 'oklch(0.974 0.007 256)' }}
    >
      {/* Ambient glows */}
      <div className="fixed top-0 left-1/4 w-[600px] h-[400px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(ellipse, rgba(167,139,250,0.06), transparent 70%)', filter: 'blur(40px)' }} />
      <div className="fixed bottom-0 right-1/4 w-[500px] h-[350px] rounded-full pointer-events-none" style={{ background: 'radial-gradient(ellipse, rgba(34,211,238,0.05), transparent 70%)', filter: 'blur(40px)' }} />

      <div className="relative w-full max-w-[380px] space-y-8 z-10">

        {/* Brand */}
        <div className="text-center space-y-3">
          <div className="flex justify-center">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #22d3ee, #a78bfa, #e879f9)',
                boxShadow: '0 0 32px rgba(167,139,250,0.25), 0 8px 24px rgba(15,13,42,0.15)',
              }}
            >
              <Box className="w-6 h-6 text-white" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight" style={{ color: 'oklch(0.10 0.030 272)' }}>XOB</h1>
            <p className="text-[13px] mt-1" style={{ color: 'oklch(0.50 0.014 265)' }}>Create your seller account</p>
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
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-[12px]" style={{ color: 'oklch(0.55 0.010 265)' }}>
            Already have an account?{' '}
            <Link href="/login" className="font-semibold" style={{ color: 'oklch(0.50 0.18 200)' }}>
              Sign in
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
