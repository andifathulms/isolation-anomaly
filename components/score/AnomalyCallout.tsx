'use client'

import { ANOMALIES, type DetectedAnomaly } from '@/lib/detect'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { anomalyText } from '@/lib/i18n/content'
import type { Locale } from '@/lib/i18n/locales'

/**
 * Names the anomaly, cites its definition, and explains the mechanism in one
 * sentence generated from the trace rather than written prose — PRD §5.3.
 *
 * This is the answer to the question the reader actually came with, so it is
 * the loudest thing under the score rather than one panel among several. The
 * order inside is deliberate: the plain-language verdict, then the name of the
 * thing, then what happened in this particular run, and only then the formal
 * definition and the sources — a reader who stops after two lines has still
 * learned the right thing.
 */
export function AnomalyCallout({
  anomalies,
  dict,
  locale,
  context,
}: {
  readonly anomalies: readonly DetectedAnomaly[]
  readonly dict: Dictionary
  readonly locale: Locale
  /** Engine and level this verdict belongs to — a verdict without one is a claim about databases in general. */
  readonly context: string
}) {
  if (anomalies.length === 0) {
    return (
      <section aria-live="polite" className="leaf px-5 py-4">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <h2 className="font-prose text-title">{dict.anomaly.noneHeadline}</h2>
          <span className="font-mono text-micro text-ink-soft">{context}</span>
        </div>
        <p className="mt-2 max-w-reading text-body text-ink-muted">{dict.anomaly.noneBody}</p>
      </section>
    )
  }

  return (
    <section aria-live="polite" className="space-y-4">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h2 className="font-prose text-title text-conductor">{dict.anomaly.foundHeadline}</h2>
        <span className="font-mono text-micro text-ink-soft">{context}</span>
      </div>

      {anomalies.map((found, index) => {
        const definition = ANOMALIES[found.id]
        const text = anomalyText(locale, found.id)
        return (
          <article
            key={`${found.id}-${index}`}
            className="rounded-lg border border-conductor/30 border-l-2 border-l-conductor bg-conductor-wash/40 px-5 py-4 shadow-leaf"
          >
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h3 className="font-prose text-section text-conductor">{text.name}</h3>
              <code className="font-mono text-micro text-ink-muted">{definition.label}</code>
              <span className="eyebrow">
                {definition.inAnsiList ? dict.anomaly.inAnsi : dict.anomaly.notInAnsi}
              </span>
            </div>

            {/* What happened in this run, in this engine, at this level. */}
            <p className="mt-3 max-w-reading text-pretty leading-relaxed">{found.mechanism}</p>

            <p className="mt-3 max-w-reading text-body text-ink-muted">{text.stakes}</p>

            <details className="group mt-3">
              <summary
                className="cursor-pointer list-none font-control text-caption text-ink-muted underline
                  decoration-staff underline-offset-4 hover:text-ink [&::-webkit-details-marker]:hidden"
              >
                <span className="group-open:hidden">{dict.anomaly.definition}</span>
                <span className="hidden group-open:inline">{dict.anomaly.sources}</span>
              </summary>

              <dl className="mt-3 space-y-3 border-t border-conductor/20 pt-3 text-caption">
                <div>
                  <dt className="eyebrow">{dict.anomaly.definition}</dt>
                  <dd className="mt-1 max-w-reading leading-relaxed text-ink-muted">{text.definition}</dd>
                </div>
                <div>
                  <dt className="eyebrow">{dict.anomaly.formal}</dt>
                  <dd className="mt-1 font-mono text-micro text-ink-muted">{definition.formal}</dd>
                </div>
                <div>
                  <dt className="eyebrow">{dict.anomaly.conductorMark}</dt>
                  <dd className="mt-1 font-mono text-micro text-ink-muted">
                    {dict.controls.step} {found.causeStep}
                  </dd>
                </div>
                <div>
                  <dt className="eyebrow">{dict.anomaly.sources}</dt>
                  <dd className="mt-1">
                    <ul className="space-y-1">
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
                  </dd>
                </div>
              </dl>
            </details>
          </article>
        )
      })}
    </section>
  )
}
