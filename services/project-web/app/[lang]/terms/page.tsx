import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms of service',
}

/**
 * REPLACE THIS PAGE before deploying to real users.
 *
 * Document what the service does, acceptable use, liability limits,
 * account termination, governing law, and dispute resolution. These
 * details are jurisdiction-specific — get legal review if you are
 * unsure.
 */
export default async function TermsPage() {
  return (
    <main style={{ maxWidth: 720, margin: '60px auto', padding: 24, lineHeight: 1.7 }}>
      <h1 style={{ fontSize: 24, marginBottom: 16 }}>Terms of service</h1>
      <p style={{ color: 'var(--text-muted)' }}>
        Placeholder — replace with your actual terms of service before
        deploying to real users. See{' '}
        <code>services/project-web/app/[lang]/terms/page.tsx</code> in the{' '}
        <a href="https://github.com/sssemil/saassy">saassy repo</a>.
      </p>
    </main>
  )
}
