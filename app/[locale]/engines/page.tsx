import { notFound } from 'next/navigation'
import { SiteChrome } from '@/components/SiteChrome'
import { dictionary } from '@/lib/i18n/dictionaries'
import { metadataFor } from '@/lib/i18n/metadata'
import { LOCALES, isLocale } from '@/lib/i18n/locales'
import { PACKS, packCitations } from '@/lib/packs'
import type { Citation, LevelSemantics } from '@/lib/packs'
import { LEVELS } from '@/lib/schedule'

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }))
}

/** Title and description are the page's own heading and lead — one source. */
export function generateMetadata({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) return {}
  return metadataFor(params.locale, 'engines')
}

function Quote({ citation }: { readonly citation: Citation }) {
  return (
    <blockquote className="mt-1 border-l border-staff pl-3 text-body italic text-ink-muted">
      “{citation.quote}”
      <footer className="mt-1 not-italic">
        <a
          href={citation.url}
          className="text-voiceA underline decoration-staff underline-offset-2"
          target="_blank"
          rel="noreferrer"
        >
          {citation.source}
        </a>
      </footer>
    </blockquote>
  )
}

function Rules({
  semantics,
  labels,
}: {
  readonly semantics: LevelSemantics
  readonly labels: ReturnType<typeof dictionary>['engines']
}) {
  const visibility = semantics.visibility.value
  const conflicts = semantics.conflicts.value

  return (
    <div className="mt-3 space-y-4">
      <div>
        <h4 className="eyebrow">{labels.reads}</h4>
        <p className="font-mono text-caption">
          snapshot: {visibility.snapshot} · readsUncommitted: {String(visibility.readsUncommitted)} ·
          lockingReadsSeeLatestCommitted: {String(visibility.lockingReadsSeeLatestCommitted)}
        </p>
        <Quote citation={semantics.visibility.citation} />
      </div>

      <div>
        <h4 className="eyebrow">{labels.conflicts}</h4>
        <p className="font-mono text-caption">
          writeOnStaleRow: {conflicts.writeOnStaleRow} · lockingReadOnStaleRow:{' '}
          {conflicts.lockingReadOnStaleRow} · writeWriteBlocks: {String(conflicts.writeWriteBlocks)}
        </p>
        <Quote citation={semantics.conflicts.citation} />
      </div>

      <div>
        <h4 className="eyebrow">{labels.locksTaken}</h4>
        <ul className="mt-1 space-y-2">
          {Object.entries(semantics.locks).map(([name, rule]) => (
            <li key={name}>
              <p className="font-mono text-caption">
                {name}: record {rule.value.record}, gap {rule.value.gap}, held for {rule.value.duration}
              </p>
              <Quote citation={rule.citation} />
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h4 className="eyebrow">
          {labels.serializationCheck}
        </h4>
        <p className="font-mono text-caption">{semantics.serializationCheck.value}</p>
        <Quote citation={semantics.serializationCheck.citation} />
      </div>
    </div>
  )
}

/**
 * The engine packs, with every citation behind them — PRD §5.4 and the framing
 * commitment: every engine claim links to the vendor documentation it came from.
 */
export default function EnginesPage({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) notFound()
  const dict = dictionary(params.locale)

  return (
    <SiteChrome locale={params.locale} active="engines">
      <h1 className="font-prose text-title">{dict.engines.heading}</h1>
      <p className="mt-3 max-w-reading text-pretty leading-relaxed text-ink-muted">{dict.engines.lead}</p>

      <div className="mt-10 space-y-16">
        {PACKS.map((pack) => (
          <section key={pack.id}>
            <div className="flex flex-wrap items-baseline gap-x-3">
              <h2 className="font-prose text-title">
                {pack.engine} {pack.version}
              </h2>
              <code className="font-mono text-micro text-ink-muted">{pack.id}</code>
            </div>
            <p className="mt-2 max-w-reading text-body">{pack.summary}</p>
            <p className="mt-2 font-mono text-micro text-ink-muted">
              {dict.engines.verified} {pack.verifiedOn} · {dict.engines.defaultLevel} {pack.defaultLevel} ·{' '}
              <a
                href={pack.docsUrl}
                className="underline decoration-staff underline-offset-2"
                target="_blank"
                rel="noreferrer"
              >
                {dict.engines.readDocs}
              </a>
            </p>

            <div className="mt-6 space-y-8">
              {LEVELS.map((level) => {
                const entry = pack.levels[level]
                return (
                  <article key={level} className="border-t border-staff-faint pt-4">
                    <div className="flex flex-wrap items-baseline gap-x-3">
                      <h3 className="font-mono text-lg">{level}</h3>
                      <span className="eyebrow">
                        {entry.kind === 'modelled'
                          ? dict.engines.modelled
                          : entry.kind === 'alias'
                            ? `${dict.engines.aliasOf} ${entry.of}`
                            : dict.engines.unsupported}
                      </span>
                    </div>
                    <p className="mt-1 font-prose text-caption">{entry.displayName}</p>
                    <p className="mt-1 max-w-reading text-body text-ink-muted">{entry.summary}</p>

                    {entry.kind === 'modelled' ? (
                      <Rules semantics={entry.semantics} labels={dict.engines} />
                    ) : (
                      <Quote citation={entry.citation} />
                    )}
                  </article>
                )
              })}
            </div>

            <div className="mt-8 border-t border-staff-faint pt-4">
              <h3 className="font-prose text-section">{dict.engines.errors}</h3>
              <ul className="mt-2 space-y-3">
                {Object.entries(pack.errors).map(([name, shape]) =>
                  shape ? (
                    <li key={name}>
                      <p className="font-mono text-caption">
                        {name}: {shape.code} — {shape.message}
                      </p>
                      <Quote citation={shape.citation} />
                    </li>
                  ) : null,
                )}
              </ul>
            </div>

            <p className="mt-6 eyebrow">
              {dict.engines.citations}: {packCitations(pack).length}
            </p>
          </section>
        ))}
      </div>
    </SiteChrome>
  )
}
