import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SiteChrome } from '@/components/SiteChrome'
import { HeroFigure } from '@/components/score/HeroFigure'
import { dictionary } from '@/lib/i18n/dictionaries'
import { isLocale } from '@/lib/i18n/locales'
import { ANOMALIES, ANOMALY_IDS } from '@/lib/detect'
import { anomalyText } from '@/lib/i18n/content'

/**
 * The overview. A reader arriving here has usually never heard the phrase
 * "write skew" and may not know what an isolation level is, so the page earns
 * the vocabulary in this order: what goes wrong, one failure told as a story
 * with no jargon in it at all, what to do on the site, and only then the
 * three claims that make this project worth trusting.
 */
export default function HomePage({ params }: { params: { locale: string } }) {
  if (!isLocale(params.locale)) notFound()
  const locale = params.locale
  const dict = dictionary(locale)

  /**
   * The doctors, as a two-lane schedule. Each beat is tagged with the voice
   * that acted, by marker shape as well as by hue — the same rule the score
   * follows, so the device is already familiar when the reader reaches it.
   */
  const story = [
    { voice: 'A', text: dict.home.storyStep1 },
    { voice: 'B', text: dict.home.storyStep2 },
    { voice: 'A', text: dict.home.storyStep3 },
    { voice: 'B', text: dict.home.storyStep4 },
  ] as const

  return (
    <SiteChrome locale={locale} active="home">
      <section className="max-w-3xl">
        <p className="eyebrow">{dict.home.eyebrow}</p>
        <h1 className="mt-3 font-prose text-display text-balance">{dict.site.tagline}</h1>
        <p className="mt-5 max-w-reading text-lead text-pretty text-ink-muted">{dict.site.standfirst}</p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href={`/${locale}/schedule/`} className="control control-strong">
            {dict.home.ctaSchedule}
          </Link>
          <Link href={`/${locale}/scenarios/`} className="control">
            {dict.home.ctaScenarios}
          </Link>
        </div>
        <p className="mt-3 text-caption text-ink-soft">{dict.home.ctaCaption}</p>
      </section>

      {/*
        The thing itself, before any more prose about it. A still of the score
        at the run the primary action opens — same notation, same voices, same
        reserved red — so the notation is already familiar on arrival.
      */}
      <figure className="mt-10">
        <HeroFigure
          labels={{
            alt: dict.home.figureAlt,
            conductorMark: dict.anomaly.found.toLowerCase(),
            committed: dict.outcome.committed,
          }}
        />
        <figcaption className="mt-3 max-w-reading text-caption text-ink-muted">
          {dict.home.figureCaption}
        </figcaption>
      </figure>

      <section className="mt-16 max-w-reading">
        <h2 className="font-prose text-title">{dict.home.plainHeading}</h2>
        <p className="mt-4 text-pretty leading-relaxed text-ink-muted">{dict.home.plainBody}</p>
      </section>

      <section className="mt-16">
        <h2 className="font-prose text-title">{dict.home.storyHeading}</h2>
        <p className="mt-4 max-w-reading text-pretty leading-relaxed text-ink-muted">
          {dict.home.storyIntro}
        </p>

        <ol className="mt-6 max-w-3xl space-y-2">
          {story.map((beat, index) => {
            const isA = beat.voice === 'A'
            return (
              <li
                key={index}
                className={`leaf flex items-start gap-3 px-4 py-3 sm:w-[85%] ${isA ? '' : 'sm:ml-auto'}`}
              >
                <span
                  aria-hidden="true"
                  className={`mt-1 shrink-0 text-micro leading-none ${isA ? 'text-voiceA' : 'text-voiceB'}`}
                >
                  {isA ? '●' : '■'}
                </span>
                <span className="min-w-0">
                  <span
                    className={`font-mono text-micro ${isA ? 'text-voiceA' : 'text-voiceB'}`}
                  >
                    {isA ? 'Dr A' : 'Dr B'}
                  </span>
                  <span className="mt-0.5 block text-pretty leading-relaxed">{beat.text}</span>
                </span>
              </li>
            )
          })}
        </ol>

        {/* The outcome is an anomaly, which is what conductor's red is for. */}
        <p className="mt-6 max-w-reading border-l-2 border-conductor bg-conductor-wash/40 px-4 py-3 text-pretty leading-relaxed">
          {dict.home.storyPunchline}
        </p>
      </section>

      <section className="mt-16">
        <h2 className="font-prose text-title">{dict.home.howHeading}</h2>
        <ol className="mt-6 grid gap-6 md:grid-cols-3">
          {[
            { heading: dict.home.how1Heading, body: dict.home.how1Body },
            { heading: dict.home.how2Heading, body: dict.home.how2Body },
            { heading: dict.home.how3Heading, body: dict.home.how3Body },
          ].map((item, index) => (
            <li key={item.heading}>
              <span className="font-mono text-caption text-ink-soft">{index + 1}</span>
              <h3 className="mt-1 font-prose text-section">{item.heading}</h3>
              <p className="mt-2 text-body text-ink-muted">{item.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-16 border-t border-staff-faint pt-10">
        <div className="grid gap-10 md:grid-cols-3">
          <div>
            <h2 className="font-prose text-section text-conductor">{dict.home.skewHeading}</h2>
            <p className="mt-2 text-body text-ink-muted">{dict.home.skewBody}</p>
          </div>
          <div>
            <h2 className="font-prose text-section">{dict.home.namesHeading}</h2>
            <p className="mt-2 text-body text-ink-muted">{dict.home.namesBody}</p>
          </div>
          <div>
            <h2 className="font-prose text-section">{dict.home.oracleHeading}</h2>
            <p className="mt-2 text-body text-ink-muted">{dict.home.oracleBody}</p>
          </div>
        </div>
      </section>

      <section className="mt-16 border-t border-staff-faint pt-10">
        <h2 className="font-prose text-title">{dict.home.anomalyListHeading}</h2>
        <p className="mt-3 max-w-reading text-body text-ink-muted">{dict.home.notationHint}</p>

        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {ANOMALY_IDS.map((id) => {
            const definition = ANOMALIES[id]
            return (
              <li key={id} className="leaf px-4 py-3">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-prose text-section">{anomalyText(locale, id).name}</span>
                  <code className="font-mono text-micro text-ink-soft">{definition.label}</code>
                </div>
                <p className="mt-1.5 font-mono text-micro text-ink-muted">{definition.formal}</p>
                <p className="mt-1.5 eyebrow">
                  {definition.inAnsiList ? dict.anomaly.inAnsi : dict.anomaly.notInAnsi}
                </p>
              </li>
            )
          })}
        </ul>
      </section>
    </SiteChrome>
  )
}
