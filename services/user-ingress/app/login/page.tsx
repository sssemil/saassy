'use client'

import { useEffect, useState } from 'react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)

  // Preserve ?next= across the magic-link round-trip via localStorage.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    const next = url.searchParams.get('next')
    if (next) localStorage.setItem('post_login_next', next)
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')
    setError(null)
    try {
      const res = await fetch('/api/auth/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
        credentials: 'include',
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.code || `HTTP ${res.status}`)
      }
      setStatus('sent')
    } catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Unknown error')
    }
  }

  return (
    <main style={{ maxWidth: 420, margin: '80px auto', padding: 24 }}>
      <h1 style={{ fontSize: 22, marginBottom: 6 }}>Sign in</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
        Enter your email to receive a magic sign-in link.
      </p>

      {status === 'sent' ? (
        <div
          style={{
            padding: 16,
            border: '1px solid var(--border-primary)',
            borderRadius: 4,
            background: 'var(--bg-secondary)',
          }}
        >
          <strong>Check your inbox.</strong>
          <p style={{ marginTop: 8, color: 'var(--text-secondary)' }}>
            We sent a sign-in link to <strong>{email}</strong>. It expires in 15 minutes.
          </p>
        </div>
      ) : (
        <form onSubmit={submit}>
          <label
            htmlFor="email"
            style={{ display: 'block', marginBottom: 6, color: 'var(--text-secondary)' }}
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={{
              width: '100%',
              padding: '10px 12px',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-primary)',
              borderRadius: 4,
              fontFamily: 'var(--font-mono)',
              fontSize: 14,
            }}
          />
          <button
            type="submit"
            disabled={status === 'sending'}
            style={{
              marginTop: 16,
              width: '100%',
              padding: '10px 14px',
              background: 'var(--accent-blue)',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              fontFamily: 'var(--font-mono)',
              fontSize: 14,
              cursor: status === 'sending' ? 'wait' : 'pointer',
            }}
          >
            {status === 'sending' ? 'Sending…' : 'Send magic link'}
          </button>
          {error && (
            <p style={{ marginTop: 12, color: 'var(--text-error)' }}>
              Error: {error}
            </p>
          )}
        </form>
      )}
    </main>
  )
}
