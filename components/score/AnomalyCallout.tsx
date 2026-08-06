'use client'

import { ANOMALIES, type DetectedAnomaly } from '@/lib/detect'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { anomalyText } from '@/lib/i18n/content'
import type { Locale } from '@/lib/i18n/locales'

/**
 * Names the anomaly, cites its definition, and explains the mechanism in one
 * sentence generated from the trace rather than written prose — PRD §5.3.
 */
export function AnomalyCallout({
  anomalies,
  dict,
  locale,
}: {
  readonly anomalies: readonly DetectedAnomaly[]
  readonly dict: Dictionary
  readonly locale: Locale
}) {
  if (anomalies.length === 0) {
    return (
      <section className="rounded-sm border border-staff-faint bg-manuscript-raised px-4 py-3">
        <h3 className="font-prose text-lg">{dict.anomaly.none}</h3>
        <p className="mt-1 text-sm text-ink-muted">{dict.anomaly.noneBody}</p>
      </section>
    )
  }

  return (
    <div className="space-y-4">
      {anomalies.map((found, index) => {
        const definition = ANOMALIES[found.id]
        const text = anomalyText(locale, found.id)
        return (
          <section
            key={`${found.id}-${index}`}
            className="rounded-sm border-l-2 border-conductor bg-conductor-wash/40 px-4 py-3"
          >
            <div className="flex flex-wrap items-baseline gap-x-3">
              <h3 className="font-prose text-lg text-conductor">{text.name}</h3>
              <code className="font-mono text-xs text-ink-muted">{definition.label}</code>
              <span className="font-control text-[11px] uppercase tracking-wide text-ink-muted">
                {definition.inAnsiList ? dict.anomaly.inAnsi : dict.anomaly.notInAnsi}
              </span>
            </div>

            <p className="mt-2 font-mono text-xs text-ink-muted">{definition.formal}</p>

            <dl className="mt-3 space-y-2 text-sm">
              <div>
                <dt className="font-control text-[11px] uppercase tracking-wide text-ink-muted">
                  {dict.anomaly.mechanism}
                </dt>
                <dd className="mt-0.5">{found.mechanism}</dd>
              </div>
              <div>
                <dt className="font-control text-[11px] uppercase tracking-wide text-ink-muted">
                  {dict.anomaly.definition}
                </dt>
                <dd className="mt-0.5 text-ink-muted">{text.definition}</dd>
              </div>
              <div>
                <dt className="font-control text-[11px] uppercase tracking-wide text-ink-muted">
                  {dict.anomaly.stakes}
                </dt>
                <dd className="mt-0.5 text-ink-muted">{text.stakes}</dd>
              </div>
            </dl>

            <p className="mt-3 text-xs text-ink-muted">
              {dict.anomaly.conductorMark} <span className="font-mono">step {found.causeStep}</span>
            </p>

            <ul className="mt-2 space-y-0.5 text-xs">
              {definition.sources.map((source) => (
                <li key={source.url}>
                  <a
                    href={source.url}
                    className="text-voiceA underline decoration-staff underline-offset-2"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {source.title}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
