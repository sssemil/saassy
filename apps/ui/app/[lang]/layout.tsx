import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'common-saas-template',
  description: 'SaaS template',
}

export async function generateStaticParams() {
  return [{ lang: 'en' }, { lang: 'de' }]
}

export default async function LangLayout(props: LayoutProps<'/[lang]'>) {
  const { children } = props
  return <>{children}</>
}
