import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SiteChrome } from '@/components/SiteChrome'
import { dictionary } from '@/lib/i18n/dictionaries'
import { LOCALES, isLocale } from '@/lib/i18n/locales'
import { SCENARIOS } from '@/lib/scenarios'
import { ANOMALIES } from '@/lib/detect'
import { anomalyText, scenarioText } from '@/lib/i18n/content'
import { PACKS } from '@/lib/packs'
import { LEVEL_ABBREVIATIONS } from '@/lib/schedule'
import { notate } from '@/lib/schedule'

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }))
}

/**
 * The scenario library — PRD §5.6. Every scenario documents its anomaly, the
 * levels that permit it, and the engines that permit it; every one of those
 * claims is also recorded against the real engine under tests/oracle.
 */
export default function ScenariosPage({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) notFound()
  const locale = params.locale
  const dict = dictionary(locale)

  return (
    <SiteChrome locale={locale} active="scenarios">
      <h1 className="font-prose text-3xl">{dict.scenarios.heading}</h1>
      <p className="mt-2 max-w-prose text-ink-muted">{dict.scenarios.lead}</p>

      <ul className="mt-10 space-y-10">
        {SCENARIOS.map((scenario) => {
          const definition = ANOMALIES[scenario.anomaly]
          const text = scenarioText(locale, scenario)
          return (
            <li key={scenario.id} className="border-t border-staff-faint pt-6">
              <div className="flex flex-wrap items-baseline gap-x-3">
                <h2 className="font-prose text-2xl">{text.title}</h2>
                <code className="font-mono text-xs text-ink-muted">{scenario.id}</code>
              </div>

              <p className="mt-1 font-control text-sm text-ink-muted">
                {dict.scenarios.documents}: <span className="font-prose text-ink">{anomalyText(locale, scenario.anomaly).name}</span>{' '}
                <code className="font-mono text-xs">{definition.label}</code>{' '}
                {definition.inAnsiList ? dict.anomaly.inAnsi : dict.anomaly.notInAnsi}
              </p>

              <div className="mt-4 grid gap-6 lg:grid-cols-2">
                <div className="space-y-3">
                  <p className="text-sm">
                    <span className="font-control text-xs uppercase tracking-wide text-ink-muted">
                      {dict.scenarios.framing}:{' '}
                    </span>
                    {text.framing}
                  </p>
                  <p className="text-sm">
                    <span className="font-control text-xs uppercase tracking-wide text-ink-muted">
                      {dict.scenarios.lesson}:{' '}
                    </span>
                    {text.lesson}
                  </p>
                  <Link
                    href={`/${locale}/schedule/#s=${scenario.id}&p=${PACKS[0]?.id ?? 'postgres-16'}&l=${
                      LEVEL_ABBREVIATIONS[scenario.expectedAt[PACKS[0]?.id ?? '']?.[0] ?? 'READ COMMITTED']
                    }&i=0`}
                    className="inline-block rounded-sm border border-ink px-3 py-1.5 font-control text-sm"
                  >
                    {dict.scenarios.open}
                  </Link>
                </div>

                <div className="space-y-3">
                  <pre className="overflow-x-auto rounded-sm border border-staff-faint bg-manuscript-raised px-3 py-2 font-mono text-xs leading-relaxed">
                    {scenario.schedule.steps
                      .map(
                        (step, index) =>
                          `${String(index).padStart(2, ' ')}  ${step.txn}  ${notate(
                            step.op,
                            scenario.schedule.transactions.indexOf(step.txn),
                          )}`,
                      )
                      .join('\n')}
                  </pre>

                  <dl className="space-y-1 text-sm">
                    {PACKS.map((pack) => {
                      const permitted = scenario.expectedAt[pack.id]
                      if (!permitted) return null
                      return (
                        <div key={pack.id} className="flex flex-wrap gap-x-2">
                          <dt className="font-control text-xs uppercase tracking-wide text-ink-muted">
                            {pack.engine} {pack.version} — {dict.scenarios.permittedAt}
                          </dt>
                          <dd className="font-mono text-xs">
                            {permitted.length === 0 ? (
                              <span className="font-prose text-ink-muted">{dict.scenarios.never}</span>
                            ) : (
                              permitted.map((level) => LEVEL_ABBREVIATIONS[level]).join(', ')
                            )}
                          </dd>
                        </div>
                      )
                    })}
                  </dl>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </SiteChrome>
  )
}
