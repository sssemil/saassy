type SupportedLang = 'en' | 'de'

function isSupportedLang(lang: string): lang is SupportedLang {
  return lang === 'en' || lang === 'de'
}

export default async function Page({
  params,
}: {
  params: Promise<{ lang: string }>
}) {
  const { lang } = await params
  const safeLang: SupportedLang = isSupportedLang(lang) ? lang : 'en'

  return (
    <main style={{ maxWidth: 640, margin: '48px auto', padding: 24 }}>
      <h1>common-saas-template</h1>
      <p>
        {safeLang === 'de'
          ? 'Willkommen. Ersetze diese Seite durch deine eigene Landing-Page.'
          : 'Welcome. Replace this page with your own landing page.'}
      </p>
    </main>
  )
}
