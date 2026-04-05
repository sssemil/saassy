import Link from 'next/link'
import { serverApiFetch } from '../../lib/api-fetch'

type User = {
  id: string
  email: string
  created_at: string
  last_login_at: string | null
  is_admin: boolean
  is_frozen: boolean
}

type ListResponse = {
  users: User[]
  total: number
  limit: number
  offset: number
}

const PAGE_SIZE = 50

export default async function UsersListPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const sp = await searchParams
  const q = (sp.q || '').trim()
  const page = Math.max(1, parseInt(sp.page || '1', 10) || 1)
  const offset = (page - 1) * PAGE_SIZE

  const qs = new URLSearchParams()
  if (q) qs.set('q', q)
  qs.set('limit', String(PAGE_SIZE))
  qs.set('offset', String(offset))

  const res = await serverApiFetch(`/api/admin/users?${qs.toString()}`)
  if (!res.ok) throw new Error(`users load failed: ${res.status}`)
  const data: ListResponse = await res.json()
  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE))

  return (
    <div>
      <h1 style={{ fontSize: 22, marginBottom: 16 }}>Users</h1>

      <form method="get" style={{ marginBottom: 16 }}>
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search by email"
          style={{
            padding: '8px 12px',
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-primary)',
            borderRadius: 4,
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            minWidth: 280,
          }}
        />
        <button
          type="submit"
          style={{
            marginLeft: 8,
            padding: '8px 14px',
            background: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-primary)',
            borderRadius: 4,
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Search
        </button>
      </form>

      <div
        style={{
          border: '1px solid var(--border-primary)',
          borderRadius: 4,
          overflow: 'hidden',
          background: 'var(--bg-secondary)',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--bg-tertiary)', textAlign: 'left' }}>
              <th style={th}>Email</th>
              <th style={th}>Created</th>
              <th style={th}>Last login</th>
              <th style={th}>Flags</th>
            </tr>
          </thead>
          <tbody>
            {data.users.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>
                  No users found.
                </td>
              </tr>
            ) : (
              data.users.map((u) => (
                <tr key={u.id} style={{ borderTop: '1px solid var(--border-primary)' }}>
                  <td style={td}>
                    <Link
                      href={`/admin/users/${u.id}`}
                      style={{ color: 'var(--text-link)', textDecoration: 'none' }}
                    >
                      {u.email}
                    </Link>
                  </td>
                  <td style={td}>{new Date(u.created_at).toLocaleString()}</td>
                  <td style={td}>
                    {u.last_login_at ? new Date(u.last_login_at).toLocaleString() : '—'}
                  </td>
                  <td style={td}>
                    {u.is_admin && <Tag color="var(--accent-blue)">admin</Tag>}
                    {u.is_frozen && <Tag color="var(--accent-orange)">frozen</Tag>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: 'var(--text-muted)' }}>
        <span>
          {data.total.toLocaleString()} users · page {page} / {totalPages}
        </span>
        <span style={{ flex: 1 }} />
        {page > 1 && (
          <Link href={`?${new URLSearchParams({ ...(q ? { q } : {}), page: String(page - 1) })}`} style={pageLink}>
            ← Prev
          </Link>
        )}
        {page < totalPages && (
          <Link href={`?${new URLSearchParams({ ...(q ? { q } : {}), page: String(page + 1) })}`} style={pageLink}>
            Next →
          </Link>
        )}
      </div>
    </div>
  )
}

const th: React.CSSProperties = { padding: '10px 12px', fontWeight: 600, color: 'var(--text-secondary)' }
const td: React.CSSProperties = { padding: '10px 12px' }
const pageLink: React.CSSProperties = {
  color: 'var(--text-link)',
  textDecoration: 'none',
  padding: '4px 10px',
  border: '1px solid var(--border-primary)',
  borderRadius: 4,
}

function Tag({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 6px',
        marginRight: 4,
        fontSize: 11,
        borderRadius: 3,
        background: color,
        color: '#000',
      }}
    >
      {children}
    </span>
  )
}
