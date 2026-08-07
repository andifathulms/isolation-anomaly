'use client'

import { useState } from 'react'
import Link from 'next/link'
import { LEVELS, LEVEL_ABBREVIATIONS } from '@/lib/schedule'
import type { MatrixScenario } from '@/lib/precompute/shape'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { Locale } from '@/lib/i18n/locales'

/**
 * The engine matrix — PRD §5.4. The same schedule across every engine and
 * level: committed, aborted with which error, or completed with an anomaly.
 *
 * A grid where a developer can see at a glance that their default configuration
 * permits the thing they assumed was impossible. The disagreement is the lesson.
 *
 * Every cell is worked out at build time (lib/precompute.ts) and handed here as
 * data. This used to run the executor, the detector and all five engine packs in
 * the browser in order to render a grid whose contents cannot change — nothing
 * on this page alters a schedule, so nothing on this page needs an engine.
 */

export function Matrix({
  scenarios,
  dict,
  locale,
}: {
  readonly scenarios: readonly MatrixScenario[]
  readonly dict: Dictionary
  readonly locale: Locale
}) {
  const [scenarioId, setScenarioId] = useState(
    scenarios.find((scenario) => scenario.id === 'write-skew')?.id ?? scenarios[0]?.id ?? '',
  )
  const scenario = scenarios.find((candidate) => candidate.id === scenarioId) ?? scenarios[0]
  if (!scenario) return null


  return (
    <div className="space-y-6">
      <label className="flex flex-col gap-1">
        <span className="eyebrow">
          {dict.controls.scenario}
        </span>
        <select
          value={scenarioId}
          onChange={(event) => setScenarioId(event.target.value)}
          className="control max-w-full sm:min-w-72"
        >
          {scenarios.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>
              {candidate.title}
            </option>
          ))}
        </select>
      </label>

      <p className="max-w-reading text-body">
        <span className="eyebrow">
          {dict.scenarios.documents}:{' '}
        </span>
        {scenario.anomalyName ? `${scenario.anomalyName} — ` : ''}
        {scenario.framing}
      </p>

      {/* The select rebuilds the whole grid with no other signal that it did. */}
      <p aria-live="polite" className="sr-only">
        {dict.a11y.updated}: {scenario.title}
      </p>

      <div className="leaf scroll-region" tabIndex={0} role="group" aria-label={dict.a11y.matrixRegion}>
        <table className="w-full text-caption">
          {/* Named, so the grid is not just "table" when it is reached. */}
          <caption className="sr-only">
            {scenario.title} — {dict.a11y.matrixCaption}
          </caption>
          <thead className="bg-manuscript-sunk">
            <tr className="border-b border-staff-faint">
              <th className="px-3 py-2 text-left eyebrow font-normal">
                {dict.matrix.engine}
              </th>
              {LEVELS.map((level) => (
                <th key={level} className="px-3 py-2 text-left font-mono text-micro font-normal">
                  <abbr title={level} className="no-underline">
                    {LEVEL_ABBREVIATIONS[level]}
                  </abbr>
                  <span className="ml-1 hidden eyebrow xl:inline">
                    {level}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {scenario.rows.map((row) => (
              <tr key={row.packId} className="border-b border-staff-faint/60 align-top last:border-b-0">
                {/* Two packs share the engine name and version and differ only
                    in an option, so the id is the row's real identity and the
                    summary explains the difference on hover. */}
                <th scope="row" className="px-3 py-3 text-left font-prose font-normal" title={row.summary}>
                  {row.engine} {row.version}
                  <span className="block font-mono text-micro text-ink-soft">{row.packId}</span>
                </th>
                {row.cells.map((cell, index) => {
                  const level = LEVELS[index] ?? 'READ COMMITTED'
                  if (cell.kind === 'refused') {
                    return (
                      <td key={level} className="px-3 py-3">
                        <span className="font-control text-micro text-ink-soft">{dict.matrix.refused}</span>
                      </td>
                    )
                  }
                  const anomalous = cell.anomalies.length > 0
                  return (
                    <td key={level} className="p-1">
                      <Link
                        href={`/${locale}/schedule/#s=${scenario.id}&p=${row.packId}&l=${LEVEL_ABBREVIATIONS[level]}&i=0`}
                        /*
                         * A link cannot inherit its table headers the way a data
                         * cell does, so 25 of these all announced as "anomaly,
                         * write-skew" with nothing to tell them apart. The row
                         * and column go into the name.
                         */
                        aria-label={`${row.engine} ${row.version}, ${level}: ${
                          anomalous
                            ? `${dict.matrix.anomalyAt} ${cell.anomalies.join(', ')}`
                            : cell.aborted.length > 0
                              ? `${dict.matrix.abortedAt} ${cell.aborted.join(', ')}`
                              : dict.matrix.clean
                        }`}
                        className="block rounded-md px-2 py-2 transition-colors hover:bg-manuscript-sunk"
                      >
                        {/* An anomaly or an abort is exactly what conductor's
                            red is for; a clean run must stay quiet, or the grid
                            stops being scannable. */}
                        {anomalous ? (
                          <span className="font-control text-micro font-medium text-conductor">
                            {dict.matrix.anomalyAt}
                          </span>
                        ) : cell.aborted.length > 0 ? (
                          <span className="font-control text-micro font-medium text-conductor">
                            {dict.matrix.abortedAt} {cell.aborted.join(', ')}
                          </span>
                        ) : (
                          <span className="font-control text-micro text-ink-muted">{dict.matrix.clean}</span>
                        )}
                        {anomalous ? (
                          <span className="mt-1 block font-mono text-micro">
                            {cell.anomalies.join(', ')}
                          </span>
                        ) : null}
                        {cell.errorCodes.length > 0 ? (
                          <span className="mt-1 block font-mono text-micro text-ink-soft">
                            {cell.errorCodes.join(', ')}
                          </span>
                        ) : null}
                        {cell.alias ? (
                          <span className="mt-1 block eyebrow">
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

      {/* What the words in the cells mean. The page heading already carries
          `dict.matrix.lead`, so repeating it under the grid said nothing. */}
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
        <span className="eyebrow">{dict.matrix.legend}</span>
        <span className="font-control text-micro text-ink-muted">{dict.matrix.clean}</span>
        <span className="font-control text-micro font-medium text-conductor">{dict.matrix.anomalyAt}</span>
        <span className="font-control text-micro font-medium text-conductor">{dict.matrix.abortedAt}</span>
        <span className="font-control text-micro text-ink-soft">{dict.matrix.refused}</span>
      </div>
    </div>
  )
}
