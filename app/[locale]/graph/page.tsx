import { notFound } from 'next/navigation'
import { SiteChrome } from '@/components/SiteChrome'
import { ConflictGraphView } from '@/components/graph/ConflictGraphView'
import { dictionary } from '@/lib/i18n/dictionaries'
import { metadataFor } from '@/lib/i18n/metadata'
import { LOCALES, isLocale } from '@/lib/i18n/locales'

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }))
}

/** Title and description are the page's own heading and lead — one source. */
export function generateMetadata({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) return {}
  return metadataFor(params.locale, 'graph')
}

export default function GraphPage({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) notFound()
  const dict = dictionary(params.locale)

  return (
    <SiteChrome locale={params.locale} active="graph">
      <h1 className="font-prose text-title">{dict.graph.heading}</h1>
      <p className="mt-3 max-w-reading text-pretty leading-relaxed text-ink-muted">{dict.graph.lead}</p>
      <div className="mt-8">
        <ConflictGraphView dict={dict} locale={params.locale} />
      </div>
    </SiteChrome>
  )
}
