'use client'

import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { ScenarioLegend } from '@/lib/scenarios/types'

/**
 * What the keys and values in this schedule stand for.
 *
 * The score says `r1[P:1..2] → {1,2}` and `w1[1=0]`, and the framing beside it
 * says two doctors went off call. Nothing joined the two — the mapping existed
 * only as a comment in the scenario's source file, so a reader was asked to
 * follow a mechanism in one vocabulary and judge the stakes in another.
 *
 * It sits directly beneath the score, where the notation is, rather than in the
 * scenario blurb at the bottom of the page.
 */
export function KeyLegend({
  legend,
  dict,
}: {
  readonly legend: ScenarioLegend
  readonly dict: Dictionary
}) {
  const keys = Object.entries(legend.keys)
  const values = Object.entries(legend.values)
  if (keys.length === 0 && values.length === 0) return null

  return (
    <dl className="flex flex-wrap items-baseline gap-x-6 gap-y-1.5">
      {keys.length > 0 ? (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <dt className="eyebrow">{dict.panels.key}</dt>
          {keys.map(([key, meaning]) => (
            <dd key={key} className="text-caption">
              <span className="font-mono">{key}</span>{' '}
              <span className="text-ink-muted">{meaning}</span>
            </dd>
          ))}
        </div>
      ) : null}

      {values.length > 0 ? (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <dt className="eyebrow">{dict.panels.value}</dt>
          {values.map(([value, meaning]) => (
            <dd key={value} className="text-caption">
              <span className="font-mono">{value}</span>{' '}
              <span className="text-ink-muted">{meaning}</span>
            </dd>
          ))}
        </div>
      ) : null}
    </dl>
  )
}
