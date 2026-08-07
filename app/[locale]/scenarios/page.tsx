import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SiteChrome } from '@/components/SiteChrome'
import { dictionary } from '@/lib/i18n/dictionaries'
import { metadataFor } from '@/lib/i18n/metadata'
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

/** Title and description are the page's own heading and lead — one source. */
export function generateMetadata({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) return {}
  return metadataFor(params.locale, 'scenarios')
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
      <h1 className="font-prose text-title">{dict.scenarios.heading}</h1>
      <p className="mt-3 max-w-reading text-pretty leading-relaxed text-ink-muted">{dict.scenarios.lead}</p>

      <ul className="mt-10 space-y-6">
        {SCENARIOS.map((scenario) => {
          const definition = scenario.anomaly ? ANOMALIES[scenario.anomaly] : null
          const text = scenarioText(locale, scenario)
          return (
            <li key={scenario.id} className="leaf px-5 py-5 sm:px-6 sm:py-6">
              <div className="flex flex-wrap items-baseline gap-x-3">
                <h2 className="font-prose text-section">{text.title}</h2>
                <code className="font-mono text-micro text-ink-soft">{scenario.id}</code>
              </div>

              {definition && scenario.anomaly ? (
                <p className="mt-1.5 font-control text-caption text-ink-muted">
                  {dict.scenarios.documents}:{' '}
                  {/* The anomaly this scenario exists to produce — named in
                      conductor's red, which is what red is for. */}
                  <span className="font-prose text-conductor">
                    {anomalyText(locale, scenario.anomaly).name}
                  </span>{' '}
                  <code className="font-mono text-micro">{definition.label}</code>{' '}
                  {definition.inAnsiList ? dict.anomaly.inAnsi : dict.anomaly.notInAnsi}
                </p>
              ) : (
                <p className="mt-1.5 font-control text-caption text-ink-muted">{dict.scenarios.noAnomaly}</p>
              )}

              <div className="mt-5 grid gap-6 lg:grid-cols-2">
                <div className="space-y-3">
                  <p className="text-body">
                    <span className="eyebrow">
                      {dict.scenarios.framing}:{' '}
                    </span>
                    {text.framing}
                  </p>
                  <p className="text-body">
                    <span className="eyebrow">
                      {dict.scenarios.lesson}:{' '}
                    </span>
                    {text.lesson}
                  </p>
                  <Link
                    href={`/${locale}/schedule/#s=${scenario.id}&p=${PACKS[0]?.id ?? 'postgres-16'}&l=${
                      LEVEL_ABBREVIATIONS[scenario.expectedAt[PACKS[0]?.id ?? '']?.[0] ?? 'READ COMMITTED']
                    }&i=0`}
                    className="control control-strong"
                  >
                    {dict.scenarios.open}
                  </Link>
                </div>

                <div className="space-y-3">
                  <pre className="overflow-x-auto rounded-md border border-staff-faint bg-manuscript-sunk px-3 py-2 font-mono text-micro leading-relaxed">
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

                  <div>
                    {/*
                      "Permitted at" heads the list once rather than prefixing
                      every row: an engine that permits the anomaly nowhere read
                      as "PERMITTED AT — not permitted at any level", which says
                      the opposite of itself.
                    */}
                    <h3 className="eyebrow">{dict.scenarios.permittedAt}</h3>
                    <dl className="mt-2 space-y-1 text-caption">
                      {PACKS.map((pack) => {
                        const permitted = scenario.expectedAt[pack.id]
                        if (!permitted) return null
                        return (
                          <div key={pack.id} className="flex flex-wrap items-baseline gap-x-2">
                            <dt className="font-control text-micro text-ink-muted">
                              {pack.engine} {pack.version}
                            </dt>
                            <dd>
                              {permitted.length === 0 ? (
                                <span className="text-micro text-ink-soft">{dict.scenarios.never}</span>
                              ) : (
                                // Not conductor's red: a level name is neither
                                // an anomaly nor an abort (PRD §8).
                                <span className="font-mono text-micro text-ink">
                                  {permitted.map((level) => LEVEL_ABBREVIATIONS[level]).join(', ')}
                                </span>
                              )}
                            </dd>
                          </div>
                        )
                      })}
                    </dl>
                  </div>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </SiteChrome>
  )
}
