'use client'

import { useState } from 'react'

export default function DeleteAccountButton() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function del() {
    if (
      !confirm(
        'Permanently delete your account?\n\nYour user record, session, and audit history will be removed. This cannot be undone.'
      )
    )
      return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/user/delete', { method: 'DELETE', credentials: 'include' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.code || `HTTP ${res.status}`)
      }
      window.location.href = '/login'
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
      setBusy(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={del}
        disabled={busy}
        style={{
          padding: '8px 14px',
          background: 'var(--accent-red)',
          color: '#000',
          border: 'none',
          borderRadius: 4,
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          cursor: busy ? 'wait' : 'pointer',
          opacity: busy ? 0.6 : 1,
        }}
      >
        {busy ? 'Deleting…' : 'Delete my account'}
      </button>
      {error && (
        <p style={{ marginTop: 12, color: 'var(--text-error)', fontSize: 13 }}>
          Error: {error}
        </p>
      )}
    </>
  )
}
