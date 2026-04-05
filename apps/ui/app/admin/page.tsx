import { serverApiFetch } from '../lib/api-fetch'

type Stats = {
  total_users: number
  users_last_7_days: number
  users_last_30_days: number
  frozen_users: number
  admin_users: number
}

export default async function AdminOverviewPage() {
  const res = await serverApiFetch('/api/admin/stats')
  if (!res.ok) throw new Error(`stats load failed: ${res.status}`)
  const s: Stats = await res.json()

  const cards: { label: string; value: number }[] = [
    { label: 'Total users', value: s.total_users },
    { label: 'New in last 7 days', value: s.users_last_7_days },
    { label: 'New in last 30 days', value: s.users_last_30_days },
    { label: 'Frozen', value: s.frozen_users },
    { label: 'Admins', value: s.admin_users },
  ]

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 24 }}>Overview</h1>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 16,
        }}
      >
        {cards.map((c) => (
          <div
            key={c.label}
            style={{
              padding: 20,
              border: '1px solid var(--border-primary)',
              borderRadius: 4,
              background: 'var(--bg-secondary)',
            }}
          >
            <div style={{ color: 'var(--text-muted)', fontSize: 12, textTransform: 'uppercase' }}>
              {c.label}
            </div>
            <div style={{ fontSize: 28, marginTop: 6 }}>{c.value.toLocaleString()}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
