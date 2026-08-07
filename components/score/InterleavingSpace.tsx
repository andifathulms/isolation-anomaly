'use client'

import { useMemo } from 'react'
import { LEVELS, interleavings, type IsolationLevel, type Schedule } from '@/lib/schedule'
import { execute } from '@/lib/engine'
import { detectedIds } from '@/lib/detect'
import type { EnginePack } from '@/lib/packs/types'
import type { Dictionary } from '@/lib/i18n/dictionaries'

/**
 * Every legal ordering of this schedule, at every level of this engine.
 *
 * Dragging a mark answers "what if these two statements had swapped". It cannot
 * answer "was that lucky" — a reader who drags twice has a sample of two, and no
 * way to tell a knife-edge from the common case. Every schedule here is small
 * enough to settle that completely: the library runs from 20 to 252 orderings,
 * and a real database could only ever sample this space under load.
 *
 * The zero is the valuable half. "0 of 70 at SERIALIZABLE" is the difference
 * between an anomaly that did not happen and one that cannot.
 *
 * These are counts over orderings, never rates. Real interleavings are not
 * uniformly distributed and this says nothing about how likely anything is in
 * production — only about what is possible at all. PRD §3: not a performance
 * model.
 */

export function InterleavingSpace({
  schedule,
  pack,
  level,
  dict,
}: {
  readonly schedule: Schedule
  readonly pack: EnginePack
  readonly level: IsolationLevel
  readonly dict: Dictionary
}) {
  const space = useMemo(() => {
    const all = interleavings(schedule)
    if (all.kind === 'tooMany') return all

    const rows = LEVELS.map((candidate) => {
      let anomalous = 0
      let aborted = 0
      let clean = 0
      let refused = 0
      const names = new Set<string>()

      for (const ordering of all.schedules) {
        const result = execute(ordering, pack, candidate)
        if (result.type === 'refused') {
          refused += 1
          continue
        }
        const found = detectedIds(result.trace)
        if (found.length > 0) {
          anomalous += 1
          found.forEach((id) => names.add(id))
        } else if (result.trace.transactions.some((txn) => txn.outcome === 'aborted')) {
          aborted += 1
        } else {
          clean += 1
        }
      }
      return { level: candidate, anomalous, aborted, clean, refused, names: [...names] }
    })

    return { kind: 'enumerated' as const, total: all.total, rows }
  // Not `level`: every level is enumerated, so changing which one is current
  // only changes which row is highlighted.
  }, [schedule, pack])

  return (
    <section aria-labelledby="space-heading">
      <h3 id="space-heading" className="font-prose text-section">
        {dict.space.heading}
      </h3>

      {space.kind === 'tooMany' ? (
        <p className="mt-1.5 max-w-reading text-body text-ink-muted">
          {dict.space.tooMany.replace('{total}', space.total.toLocaleString())}
        </p>
      ) : (
        <>
          <p className="mt-1.5 max-w-reading text-body text-ink-muted">
            {dict.space.hint.replace('{total}', String(space.total))}
          </p>

          <ul className="mt-4 space-y-1.5">
            {space.rows.map((row) => {
              const current = row.level === level
              const share = space.total === 0 ? 0 : row.anomalous / space.total
              return (
                <li
                  key={row.level}
                  className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-md border px-3 py-2 ${
                    current ? 'border-ink bg-manuscript-sunk' : 'border-staff-faint'
                  }`}
                >
                  <span className="w-36 shrink-0 font-mono text-caption">{row.level}</span>

                  {row.refused === space.total ? (
                    <span className="font-control text-micro text-ink-soft">{dict.matrix.refused}</span>
                  ) : (
                    <>
                      {/* A bar, so the shape of the answer reads before the number. */}
                      <span
                        aria-hidden="true"
                        className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-manuscript-sunk"
                      >
                        <span
                          className={`block h-full ${row.anomalous > 0 ? 'bg-conductor' : 'bg-staff-faint'}`}
                          style={{ width: `${Math.round(share * 100)}%` }}
                        />
                      </span>

                      <span
                        className={`font-mono text-caption ${
                          row.anomalous > 0 ? 'text-conductor' : 'text-ink-muted'
                        }`}
                      >
                        {row.anomalous} / {space.total}
                      </span>
                      <span className="font-control text-micro text-ink-muted">
                        {row.names.length > 0 ? row.names.join(', ') : dict.space.none}
                      </span>
                      {row.aborted > 0 ? (
                        <span className="ml-auto font-control text-micro text-ink-muted">
                          {row.aborted} {dict.space.abortedInstead}
                        </span>
                      ) : null}
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}

      <p className="mt-3 max-w-reading text-caption text-ink-soft">{dict.space.notProbability}</p>
    </section>
  )
}
