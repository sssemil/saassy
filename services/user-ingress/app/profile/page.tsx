import { redirect } from 'next/navigation'
import { serverApiFetch } from '../lib/api-fetch'
import DeleteAccountButton from './DeleteAccountButton'

type Me = {
  id: string
  email: string
  is_admin: boolean
}

export default async function ProfilePage() {
  const res = await serverApiFetch('/api/auth/verify')
  if (res.status === 401 || res.status === 403) {
    redirect('/login?next=/profile')
  }
  if (!res.ok) {
    throw new Error(`profile load failed: ${res.status}`)
  }
  const me: Me = await res.json()

  return (
    <main style={{ maxWidth: 520, margin: '80px auto', padding: 24 }}>
      <h1 style={{ fontSize: 22, marginBottom: 24 }}>Your profile</h1>

      <div
        style={{
          padding: 20,
          border: '1px solid var(--border-primary)',
          borderRadius: 4,
          background: 'var(--bg-secondary)',
          marginBottom: 24,
        }}
      >
        <Row label="Email" value={me.email} />
        <Row
          label="Role"
          value={me.is_admin ? 'Admin' : 'User'}
        />
        <Row label="User ID" value={<code style={{ fontSize: 12 }}>{me.id}</code>} />
      </div>

      {me.is_admin && (
        <p style={{ marginBottom: 16 }}>
          <a href="/admin" style={{ color: 'var(--text-link)' }}>
            Open admin panel →
          </a>
        </p>
      )}

      <div
        style={{
          marginTop: 40,
          padding: 20,
          border: '1px solid var(--border-error)',
          borderRadius: 4,
        }}
      >
        <h2 style={{ fontSize: 15, marginBottom: 8, color: 'var(--text-error)' }}>Danger zone</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 12, fontSize: 13 }}>
          Permanently delete your account. This cannot be undone.
        </p>
        <DeleteAccountButton />
      </div>
    </main>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', padding: '6px 0', borderBottom: '1px solid var(--border-primary)' }}>
      <div style={{ width: 100, color: 'var(--text-muted)', fontSize: 13 }}>{label}</div>
      <div style={{ flex: 1, fontSize: 13 }}>{value}</div>
    </div>
  )
}
