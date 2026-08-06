'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { LEVELS, LEVEL_ABBREVIATIONS } from '@/lib/schedule'
import { PACKS } from '@/lib/packs'
import { SCENARIOS } from '@/lib/scenarios'
import { execute } from '@/lib/engine'
import { detect } from '@/lib/detect'
import { ANOMALIES } from '@/lib/detect'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/lib/i18n/locales'

/**
 * The engine matrix — PRD §5.4. The same schedule across every engine and
 * level: committed, aborted with which error, or completed with an anomaly.
 *
 * A grid where a developer can see at a glance that their default configuration
 * permits the thing they assumed was impossible. The disagreement is the lesson.
 */

type Cell =
  | { readonly kind: 'refused'; readonly why: string }
  | {
      readonly kind: 'ran'
      readonly anomalies: readonly string[]
      readonly aborted: readonly string[]
      readonly errorCodes: readonly string[]
      readonly alias: string | null
    }

export function Matrix({ dict, locale }: { readonly dict: Dictionary; readonly locale: Locale }) {
  const [scenarioId, setScenarioId] = useState(
    SCENARIOS.find((scenario) => scenario.id === 'write-skew')?.id ?? SCENARIOS[0]?.id ?? '',
  )
  const scenario = SCENARIOS.find((candidate) => candidate.id === scenarioId) ?? SCENARIOS[0]

  const rows = useMemo(() => {
    if (!scenario) return []
    return PACKS.map((pack) => ({
      pack,
      cells: LEVELS.map((level): Cell => {
        const result = execute(scenario.schedule, pack, level)
        if (result.type === 'refused') {
          return { kind: 'refused', why: result.refusal.gap }
        }
        const entry = pack.levels[level]
        return {
          kind: 'ran',
          anomalies: [...new Set(detect(result.trace).map((found) => found.id))],
          aborted: result.trace.transactions
            .filter((txn) => txn.outcome === 'aborted')
            .map((txn) => txn.txn),
          errorCodes: [
            ...new Set(
              result.trace.transactions
                .map((txn) => txn.error?.code)
                .filter((code): code is string => typeof code === 'string'),
            ),
          ],
          alias: entry.kind === 'alias' ? entry.of : null,
        }
      }),
    }))
  }, [scenario])

  if (!scenario) return null

  return (
    <div className="space-y-6">
      <label className="flex flex-col gap-1">
        <span className="font-control text-xs uppercase tracking-wide text-ink-muted">
          {dict.controls.scenario}
        </span>
        <select
          value={scenarioId}
          onChange={(event) => setScenarioId(event.target.value)}
          className="min-w-72 rounded-sm border border-staff bg-manuscript-raised px-2 py-1.5 font-control text-sm"
        >
          {SCENARIOS.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.title}
            </option>
          ))}
        </select>
      </label>

      <p className="max-w-prose text-sm">
        <span className="font-control text-xs uppercase tracking-wide text-ink-muted">
          {dict.scenarios.documents}:{' '}
        </span>
        {ANOMALIES[scenario.anomaly].name} — {scenario.framing}
      </p>

      <div className="overflow-x-auto rounded-sm border border-staff-faint bg-manuscript-raised">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-staff-faint">
              <th className="px-3 py-2 text-left font-control text-[11px] font-normal uppercase tracking-wide text-ink-muted">
                {dict.matrix.engine}
              </th>
              {LEVELS.map((level) => (
                <th key={level} className="px-3 py-2 text-left font-mono text-xs font-normal">
                  <abbr title={level} className="no-underline">
                    {LEVEL_ABBREVIATIONS[level]}
                  </abbr>
                  <span className="ml-1 hidden font-control text-[10px] uppercase tracking-wide text-ink-muted xl:inline">
                    {level}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ pack, cells }) => (
              <tr key={pack.id} className="border-b border-staff-faint/60 align-top">
                <th scope="row" className="px-3 py-3 text-left font-prose font-normal">
                  {pack.engine} {pack.version}
                  <span className="block font-mono text-xs text-ink-muted">{pack.id}</span>
                </th>
                {cells.map((cell, index) => {
                  const level = LEVELS[index] ?? 'READ COMMITTED'
                  if (cell.kind === 'refused') {
                    return (
                      <td key={level} className="px-3 py-3">
                        <span className="font-control text-xs text-ink-muted">{dict.matrix.refused}</span>
                      </td>
                    )
                  }
                  const anomalous = cell.anomalies.length > 0
                  return (
                    <td key={level} className="px-3 py-3">
                      <Link
                        href={`/${locale}/schedule/#s=${scenario.id}&p=${pack.id}&l=${LEVEL_ABBREVIATIONS[level]}&i=0`}
                        className="block"
                      >
                        {anomalous ? (
                          <span className="font-control text-xs text-conductor">
                            {dict.matrix.anomalyAt}
                          </span>
                        ) : cell.aborted.length > 0 ? (
                          <span className="font-control text-xs text-conductor">
                            {dict.matrix.abortedAt} {cell.aborted.join(', ')}
                          </span>
                        ) : (
                          <span className="font-control text-xs text-ink-muted">{dict.matrix.clean}</span>
                        )}
                        {anomalous ? (
                          <span className="mt-1 block font-mono text-[11px]">
                            {cell.anomalies.join(', ')}
                          </span>
                        ) : null}
                        {cell.errorCodes.length > 0 ? (
                          <span className="mt-1 block font-mono text-[11px] text-ink-muted">
                            {cell.errorCodes.join(', ')}
                          </span>
                        ) : null}
                        {cell.alias ? (
                          <span className="mt-1 block font-control text-[10px] uppercase tracking-wide text-ink-muted">
                            {dict.controls.alias} → {LEVEL_ABBREVIATIONS[cell.alias as never]}
                          </span>
                        ) : null}
                      </Link>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="max-w-prose text-sm text-ink-muted">{dict.matrix.lead}</p>
    </div>
  )
}
