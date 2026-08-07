import { notFound } from 'next/navigation'
import { SiteChrome } from '@/components/SiteChrome'
import { Workbench } from '@/components/score/Workbench'
import { dictionary } from '@/lib/i18n/dictionaries'
import { metadataFor } from '@/lib/i18n/metadata'
import { LOCALES, isLocale } from '@/lib/i18n/locales'
import { SCENARIOS } from '@/lib/scenarios'

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }))
}

/** Title and description are the page's own heading and lead — one source. */
export function generateMetadata({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) return {}
  return metadataFor(params.locale, 'schedule')
}

export default function SchedulePage({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) notFound()
  const dict = dictionary(params.locale)
  const first = SCENARIOS.find((scenario) => scenario.id === 'write-skew') ?? SCENARIOS[0]

  return (
    <SiteChrome locale={params.locale} active="schedule">
      <h1 className="font-prose text-title">{dict.schedule.heading}</h1>
      <p className="mt-3 max-w-reading text-pretty leading-relaxed text-ink-muted">{dict.schedule.lead}</p>
      <div className="mt-8">
        <Workbench dict={dict} locale={params.locale} initialScenarioId={first?.id ?? 'write-skew'} />
      </div>
    </SiteChrome>
  )
}
