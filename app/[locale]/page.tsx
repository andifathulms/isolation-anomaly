import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SiteChrome } from '@/components/SiteChrome'
import { dictionary } from '@/lib/i18n/dictionaries'
import { isLocale } from '@/lib/i18n/locales'
import { ANOMALIES, ANOMALY_IDS } from '@/lib/detect'
import { anomalyText } from '@/lib/i18n/content'

export default function HomePage({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) notFound()
  const locale = params.locale
  const dict = dictionary(locale)

  return (
    <SiteChrome locale={locale} active="home">
      <div className="max-w-3xl">
        <h1 className="font-prose text-4xl leading-tight text-balance">{dict.site.tagline}</h1>
        <p className="mt-6 text-lg text-ink-muted">{dict.home.lead}</p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href={`/${locale}/schedule/`}
            className="rounded-sm border border-ink px-4 py-2 font-control text-sm"
          >
            {dict.home.ctaSchedule}
          </Link>
          <Link
            href={`/${locale}/scenarios/`}
            className="rounded-sm border border-staff px-4 py-2 font-control text-sm"
          >
            {dict.home.ctaScenarios}
          </Link>
        </div>
      </div>

      <div className="mt-14 grid gap-10 md:grid-cols-3">
        <section>
          <h2 className="font-prose text-xl text-conductor">{dict.home.skewHeading}</h2>
          <p className="mt-2 text-sm">{dict.home.skewBody}</p>
        </section>
        <section>
          <h2 className="font-prose text-xl">{dict.home.namesHeading}</h2>
          <p className="mt-2 text-sm">{dict.home.namesBody}</p>
        </section>
        <section>
          <h2 className="font-prose text-xl">{dict.home.oracleHeading}</h2>
          <p className="mt-2 text-sm">{dict.home.oracleBody}</p>
        </section>
      </div>

      <section className="mt-14 border-t border-staff-faint pt-8">
        <h2 className="font-prose text-2xl">{dict.scenarios.documents}</h2>
        <ul className="mt-4 grid gap-x-8 gap-y-3 md:grid-cols-2">
          {ANOMALY_IDS.map((id) => {
            const definition = ANOMALIES[id]
            return (
              <li key={id} className="flex flex-wrap items-baseline gap-x-2">
                <code className="font-mono text-sm">{definition.label}</code>
                <span className="font-prose">{anomalyText(locale, id).name}</span>
                <span className="font-control text-[11px] uppercase tracking-wide text-ink-muted">
                  {definition.inAnsiList ? dict.anomaly.inAnsi : dict.anomaly.notInAnsi}
                </span>
                <span className="basis-full font-mono text-xs text-ink-muted">{definition.formal}</span>
              </li>
            )
          })}
        </ul>
      </section>
    </SiteChrome>
  )
}
