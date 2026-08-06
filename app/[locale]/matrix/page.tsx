import { notFound } from 'next/navigation'
import { SiteChrome } from '@/components/SiteChrome'
import { Matrix } from '@/components/matrix/Matrix'
import { dictionary } from '@/lib/i18n/dictionaries'
import { LOCALES, isLocale } from '@/lib/i18n/locales'

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }))
}

export default function MatrixPage({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) notFound()
  const dict = dictionary(params.locale)

  return (
    <SiteChrome locale={params.locale} active="matrix">
      <h1 className="font-prose text-3xl">{dict.matrix.heading}</h1>
      <p className="mt-2 max-w-prose text-ink-muted">{dict.matrix.lead}</p>
      <div className="mt-8">
        <Matrix dict={dict} locale={params.locale} />
      </div>
    </SiteChrome>
  )
}
