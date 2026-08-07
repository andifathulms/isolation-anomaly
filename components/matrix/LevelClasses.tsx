import type { LevelClasses as Data } from '@/lib/precompute/shape'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { anomalyText } from '@/lib/i18n/content'
import type { AnomalyId } from '@/lib/detect'
import type { Locale } from '@/lib/i18n/locales'

/**
 * Which level names, across all five engines, behave the same as each other.
 *
 * PRD §1's third gap is that the names mean different things per engine and
 * nobody says so. The matrix demonstrates that one schedule at a time and the
 * app has never stated it. This is the only place it can be computed rather than
 * asserted — five cited packs behind one shared executor.
 *
 * Everything about the presentation is bent towards not overclaiming. The
 * heading says "cannot be told apart", the caveat is above the result rather
 * than under it, and the number of schedules the evidence rests on is printed
 * in the same sentence as the grouping.
 *
 * A server component: nothing here is computed in the browser.
 */
export function LevelClasses({
  data,
  dict,
  locale,
}: {
  readonly data: Data
  readonly dict: Dictionary
  readonly locale: Locale
}) {
  return (
    <section aria-labelledby="classes-heading" className="border-t border-staff-faint pt-8">
      <h2 id="classes-heading" className="font-prose text-title">
        {dict.classes.heading}
      </h2>
      <p className="mt-3 max-w-reading text-pretty leading-relaxed text-ink-muted">
        {dict.classes.lead.replace('{count}', String(data.scenarioCount))}
      </p>

      {/* The caveat sits above the answer, not beneath it. */}
      <p className="mt-3 max-w-reading border-l-2 border-voiceB bg-voiceB-wash/40 px-4 py-3 text-body">
        {dict.classes.caveat.replace('{count}', String(data.scenarioCount))}
      </p>

      <ol className="mt-6 space-y-3">
        {data.classes.map((group) => (
          <li key={group.id} className="leaf px-4 py-4">
            <ul className="flex flex-wrap gap-x-5 gap-y-1.5">
              {group.members.map((member) => (
                <li key={`${member.packId}-${member.level}`} className="min-w-0">
                  <span className="font-prose">
                    {member.engine} {member.version}
                  </span>{' '}
                  <span className="font-mono text-caption">{member.level}</span>
                  {member.aliasOf ? (
                    <span className="ml-1 font-control text-micro text-ink-muted">
                      {dict.controls.alias} → {member.aliasOf}
                    </span>
                  ) : null}
                  <span className="block font-mono text-micro text-ink-soft">{member.packId}</span>
                </li>
              ))}
            </ul>

            <p className="mt-3 border-t border-staff-faint pt-2 text-caption">
              <span className="eyebrow">{dict.classes.permits} </span>
              {group.permits.length === 0 ? (
                <span className="text-ink-muted">{dict.classes.permitsNothing}</span>
              ) : (
                <span className="text-conductor">
                  {group.permits.map((id) => anomalyText(locale, id as AnomalyId).name).join(', ')}
                </span>
              )}
              {group.aborts > 0 ? (
                <span className="ml-3 text-ink-muted">
                  {dict.classes.abortsIn.replace('{n}', String(group.aborts))}
                </span>
              ) : null}
            </p>
          </li>
        ))}
      </ol>

      {data.unsupported.length > 0 ? (
        <div className="mt-6">
          <h3 className="eyebrow">{dict.classes.unsupported}</h3>
          <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-caption text-ink-muted">
            {data.unsupported.map((entry) => (
              <li key={`${entry.packId}-${entry.level}`}>
                <span className="font-prose">
                  {entry.engine} {entry.version}
                </span>{' '}
                <span className="font-mono">{entry.level}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
