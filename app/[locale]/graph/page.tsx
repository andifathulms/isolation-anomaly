import { notFound } from 'next/navigation'
import { SiteChrome } from '@/components/SiteChrome'
import { ConflictGraphView } from '@/components/graph/ConflictGraphView'
import { dictionary } from '@/lib/i18n/dictionaries'
import { LOCALES, isLocale } from '@/lib/i18n/locales'

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }))
}

export default function GraphPage({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) notFound()
  const dict = dictionary(params.locale)

  return (
    <SiteChrome locale={params.locale} active="graph">
      <h1 className="font-prose text-3xl">{dict.graph.heading}</h1>
      <p className="mt-2 max-w-prose text-ink-muted">{dict.graph.lead}</p>
      <div className="mt-8">
        <ConflictGraphView dict={dict} locale={params.locale} />
      </div>
    </SiteChrome>
  )
}
