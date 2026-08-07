'use client'

import { useMemo } from 'react'
import { LEVELS, type IsolationLevel, type Schedule } from '@/lib/schedule'
import { execute } from '@/lib/engine'
import type { ExecutionTrace } from '@/lib/engine'
import { detectedIds } from '@/lib/detect'
import type { EnginePack } from '@/lib/packs/types'
import type { Dictionary } from '@/lib/i18n/dictionaries'

/**
 * The same schedule at every level of this engine, and the step where each one
 * stops agreeing with the level currently on screen.
 *
 * "The disagreement is the lesson" (PRD §2), but changing the level *replaces*
 * the run, so the comparison could only ever be held in the reader's head. The
 * matrix shows verdicts across engines and never says which step diverged, or
 * that the divergence is one read returning a different number.
 *
 * So this reports the first step at which another level parts company with this
 * one — a different value read, a different outcome — and lets the reader switch
 * to it. Manipulating the comparison rather than being told about it.
 */

type Divergence =
  | { readonly kind: 'current' }
  | { readonly kind: 'refused' }
  | { readonly kind: 'identical' }
  | {
      readonly kind: 'diverges'
      readonly step: number
      readonly here: string
      readonly there: string
    }

/** What a step did, reduced to the facts a reader would notice differing. */
function summarise(trace: ExecutionTrace, index: number): string | null {
  const step = trace.steps[index]
  if (!step) return null
  switch (step.outcome.type) {
    case 'ok': {
      const read = step.outcome.read
      if (read === null) return 'ok'
      return read.type === 'row'
        ? `→ ${read.value ?? '∅'}`
        : `→ {${read.rows.map((row) => `${row.key}=${row.value}`).join(', ')}}`
    }
    case 'error':
      return step.outcome.code
    case 'blocked':
      return 'waiting'
    case 'refused':
      return 'refused'
    default: {
      const exhaustive: never = step.outcome
      return exhaustive
    }
  }
}

export function LevelStrip({
  schedule,
  pack,
  level,
  onPick,
  dict,
}: {
  readonly schedule: Schedule
  readonly pack: EnginePack
  readonly level: IsolationLevel
  readonly onPick: (level: IsolationLevel) => void
  readonly dict: Dictionary
}) {
  const rows = useMemo(() => {
    const here = execute(schedule, pack, level)
    if (here.type !== 'trace') return []

    return LEVELS.map((candidate) => {
      if (candidate === level) {
        return { level: candidate, anomalies: detectedIds(here.trace), divergence: { kind: 'current' } as Divergence }
      }
      const there = execute(schedule, pack, candidate)
      if (there.type !== 'trace') {
        return { level: candidate, anomalies: [], divergence: { kind: 'refused' } as Divergence }
      }

      const length = Math.max(here.trace.steps.length, there.trace.steps.length)
      for (let index = 0; index < length; index += 1) {
        const a = summarise(here.trace, index)
        const b = summarise(there.trace, index)
        if (a !== b) {
          return {
            level: candidate,
            anomalies: detectedIds(there.trace),
            divergence: { kind: 'diverges', step: index, here: a ?? '—', there: b ?? '—' } as Divergence,
          }
        }
      }
      return {
        level: candidate,
        anomalies: detectedIds(there.trace),
        divergence: { kind: 'identical' } as Divergence,
      }
    })
  }, [schedule, pack, level])

  if (rows.length === 0) return null

  return (
    <section aria-labelledby="levels-heading">
      <h3 id="levels-heading" className="font-prose text-section">
        {dict.levels.heading}
      </h3>
      <p className="mt-1.5 max-w-reading text-body text-ink-muted">{dict.levels.hint}</p>

      <ul className="mt-4 space-y-1.5">
        {rows.map((row) => {
          const current = row.divergence.kind === 'current'
          return (
            <li key={row.level}>
              <button
                type="button"
                onClick={() => onPick(row.level)}
                disabled={current}
                aria-current={current ? 'true' : undefined}
                className={`flex w-full flex-wrap items-baseline gap-x-3 gap-y-1 rounded-md border px-3 py-2
                  text-left transition-colors ${
                    current
                      ? 'border-ink bg-manuscript-sunk'
                      : 'border-edge bg-manuscript-raised hover:bg-manuscript-sunk'
                  }`}
              >
                <span className="w-36 shrink-0 font-mono text-caption">{row.level}</span>

                {row.divergence.kind === 'current' ? (
                  <span className="font-control text-micro text-ink-muted">{dict.levels.current}</span>
                ) : row.divergence.kind === 'refused' ? (
                  <span className="font-control text-micro text-ink-soft">{dict.matrix.refused}</span>
                ) : row.divergence.kind === 'identical' ? (
                  <span className="font-control text-micro text-ink-muted">{dict.levels.identical}</span>
                ) : (
                  <span className="font-control text-micro">
                    {dict.levels.divergesAt} {row.divergence.step}
                    <span className="ml-2 font-mono text-ink-muted">
                      {row.divergence.here} → {row.divergence.there}
                    </span>
                  </span>
                )}

                {row.anomalies.length > 0 ? (
                  <span className="ml-auto font-mono text-micro text-conductor">
                    {row.anomalies.join(', ')}
                  </span>
                ) : row.divergence.kind !== 'refused' ? (
                  <span className="ml-auto font-control text-micro text-ink-soft">{dict.matrix.clean}</span>
                ) : null}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
