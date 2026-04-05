import { notFound } from 'next/navigation'
import { serverApiFetch } from '../../../lib/api-fetch'
import UserActions from './UserActions'

type User = {
  id: string
  email: string
  language: string
  created_at: string
  updated_at: string
  last_login_at: string | null
  is_admin: boolean
  is_frozen: boolean
}

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const res = await serverApiFetch(`/api/admin/users/${id}`)
  if (res.status === 404) notFound()
  if (!res.ok) throw new Error(`user load failed: ${res.status}`)
  const user: User = await res.json()

  return (
    <div>
      <a href="/admin/users" style={{ color: 'var(--text-link)', textDecoration: 'none', fontSize: 13 }}>
        ← Back to users
      </a>
      <h1 style={{ fontSize: 22, margin: '12px 0 24px' }}>{user.email}</h1>

      <div
        style={{
          padding: 20,
          border: '1px solid var(--border-primary)',
          borderRadius: 4,
          background: 'var(--bg-secondary)',
          marginBottom: 20,
        }}
      >
        <Row label="ID" value={<code>{user.id}</code>} />
        <Row label="Email" value={user.email} />
        <Row label="Language" value={user.language} />
        <Row label="Created" value={new Date(user.created_at).toLocaleString()} />
        <Row label="Updated" value={new Date(user.updated_at).toLocaleString()} />
        <Row
          label="Last login"
          value={user.last_login_at ? new Date(user.last_login_at).toLocaleString() : '—'}
        />
        <Row label="Admin" value={user.is_admin ? 'yes' : 'no'} />
        <Row label="Frozen" value={user.is_frozen ? 'yes' : 'no'} />
      </div>

      <UserActions
        userId={user.id}
        userEmail={user.email}
        isAdmin={user.is_admin}
        isFrozen={user.is_frozen}
      />
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', padding: '6px 0', borderBottom: '1px solid var(--border-primary)' }}>
      <div style={{ width: 140, color: 'var(--text-muted)', fontSize: 13 }}>{label}</div>
      <div style={{ flex: 1, fontSize: 13 }}>{value}</div>
    </div>
  )
}
