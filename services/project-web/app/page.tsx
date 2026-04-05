export default function LandingPage() {
  return (
    <main
      style={{
        maxWidth: 640,
        margin: '80px auto',
        padding: 24,
        fontFamily: 'var(--font-mono)',
      }}
    >
      <h1 style={{ fontSize: 28, marginBottom: 16 }}>saassy</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>
        This is the <code>project-web</code> service — the project-specific frontend in the
        <a href="https://github.com/sssemil/saassy" style={{ color: 'var(--text-link)', marginLeft: 4 }}>
          saassy
        </a>{' '}
        template. Replace this with your own landing page.
      </p>

      <div
        style={{
          padding: 20,
          border: '1px solid var(--border-primary)',
          borderRadius: 4,
          background: 'var(--bg-secondary)',
          marginBottom: 16,
        }}
      >
        <h2 style={{ fontSize: 16, marginBottom: 12 }}>Try it out</h2>
        <ul style={{ listStyle: 'none', padding: 0, lineHeight: 1.9 }}>
          <li>
            <a href="/login" style={{ color: 'var(--text-link)' }}>
              /login
            </a>{' '}
            — user-ingress service (magic link sign in)
          </li>
          <li>
            <a href="/dashboard" style={{ color: 'var(--text-link)' }}>
              /dashboard
            </a>{' '}
            — auth-gated example page in project-web
          </li>
          <li>
            <a href="/profile" style={{ color: 'var(--text-link)' }}>
              /profile
            </a>{' '}
            — user-ingress service (profile + delete account)
          </li>
          <li>
            <a href="/admin" style={{ color: 'var(--text-link)' }}>
              /admin
            </a>{' '}
            — admin-ui service (admin only)
          </li>
        </ul>
      </div>

      <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>
        Caddy routes each of the paths above to a different container. See
        <code> infra/caddy/Caddyfile</code>.
      </p>
    </main>
  )
}
