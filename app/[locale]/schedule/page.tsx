import { notFound } from 'next/navigation'
import { SiteChrome } from '@/components/SiteChrome'
import { Workbench } from '@/components/score/Workbench'
import { dictionary } from '@/lib/i18n/dictionaries'
import { LOCALES, isLocale } from '@/lib/i18n/locales'
import { SCENARIOS } from '@/lib/scenarios'

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }))
}

export default function SchedulePage({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) notFound()
  const dict = dictionary(params.locale)
  const first = SCENARIOS.find((scenario) => scenario.id === 'write-skew') ?? SCENARIOS[0]

  return (
    <SiteChrome locale={params.locale} active="schedule">
      <h1 className="font-prose text-3xl">{dict.nav.schedule}</h1>
      <p className="mt-2 max-w-prose text-ink-muted">{dict.site.tagline}</p>
      <div className="mt-8">
        <Workbench dict={dict} initialScenarioId={first?.id ?? 'write-skew'} />
      </div>
    </SiteChrome>
  )
}
