'use client'

import { useMemo, useState } from 'react'
import { LEVELS, type IsolationLevel } from '@/lib/schedule'
import { graphKey, type GraphData } from '@/lib/precompute/shape'
import type { Dictionary } from '@/lib/i18n/dictionaries'

/**
 * The conflict graph — PRD §5.5. No layout library: transactions sit on a
 * circle, which for two or three nodes is exactly as readable as anything a
 * force simulation would produce.
 *
 * The cycle is drawn in conductor's red, because a cycle *is* the anomaly.
 *
 * Every combination is worked out at build time (lib/precompute.ts): the three
 * selects choose among fixed lists, so there is nothing here the executor could
 * be asked at runtime that is not already known. It used to run the executor,
 * the conflict-graph builder and the brute-force serializability checker in the
 * browser, which pulled in all five engine packs and their 164 vendor citations
 * to draw a circle with arrows on it.
 */

const SIZE = 320
const RADIUS = 108

export function ConflictGraphView({
  data: precomputed,
  dict,
}: {
  readonly data: GraphData
  readonly dict: Dictionary
}) {
  const [scenarioId, setScenarioId] = useState('write-skew')
  const [packId, setPackId] = useState(precomputed.packs[0]?.id ?? 'postgres-16')
  const [level, setLevel] = useState<IsolationLevel>('REPEATABLE READ')

  const scenario = precomputed.scenarios.find((candidate) => candidate.id === scenarioId)
  const pack = precomputed.packs.find((candidate) => candidate.id === packId) ?? precomputed.packs[0]

  const run = precomputed.runs[graphKey(scenarioId, packId, level)]
  const data = run && run.kind === 'ran' ? run : null

  const positions = useMemo(() => {
    const nodes = data?.nodes ?? []
    const map = new Map<string, { x: number; y: number }>()
    nodes.forEach((node, index) => {
      const angle = (index / Math.max(nodes.length, 1)) * Math.PI * 2 - Math.PI / 2
      map.set(node, {
        x: SIZE / 2 + Math.cos(angle) * (nodes.length === 1 ? 0 : RADIUS),
        y: SIZE / 2 + Math.sin(angle) * (nodes.length === 1 ? 0 : RADIUS),
      })
    })
    return map
  }, [data])

  const kindLabel = (kind: 'ww' | 'wr' | 'rw') => dict.graph[kind]
  if (!pack) return null

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1">
          <span className="eyebrow">
            {dict.controls.scenario}
          </span>
          <select
            value={scenarioId}
            onChange={(event) => setScenarioId(event.target.value)}
            className="control max-w-full sm:min-w-64"
          >
            {precomputed.scenarios.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.title}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="eyebrow">
            {dict.controls.engine}
          </span>
          <select
            value={packId}
            onChange={(event) => setPackId(event.target.value)}
            className="control max-w-full"
          >
            {precomputed.packs.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.engine} {candidate.version}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="eyebrow">
            {dict.controls.level}
          </span>
          <select
            value={level}
            onChange={(event) => setLevel(event.target.value as IsolationLevel)}
            className="control max-w-full font-mono"
          >
            {LEVELS.map((candidate) => (
              <option key={candidate} value={candidate}>
                {candidate}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Three selects rebuild the graph with nothing else to say they did. */}
      <p aria-live="polite" className="sr-only">
        {dict.a11y.updated}: {scenario?.title ?? ''} — {pack.engine}{' '}
        {pack.version} — {level}
      </p>

      {!data ? (
        <p className="text-caption text-ink-muted">{dict.matrix.refused}</p>
      ) : (
        <div className="grid gap-8 md:grid-cols-[320px_1fr]">
          {/*
            `width={SIZE}` with no ceiling overflowed a 320px viewport by the
            width of the page gutters and took the whole document into
            horizontal scrolling. The viewBox already makes it scale.
          */}
          <svg
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            className="leaf h-auto w-full max-w-[20rem]"
            role="img"
            aria-label={`${dict.graph.heading}: ${
              data.cycle ? dict.graph.cycle : dict.graph.noCycle
            }`}
          >
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX={9} refY={5} markerWidth={6} markerHeight={6} orient="auto">
                <path d="M 0 0 L 10 5 L 0 10 z" className="fill-current" />
              </marker>
            </defs>

            {data.edges.map((edge, index) => {
              const from = positions.get(edge.from)
              const to = positions.get(edge.to)
              if (!from || !to) return null
              const onCycle = data.onCycle.includes(index)
              // Bow the edges apart so both directions of a mutual conflict show.
              const midX = (from.x + to.x) / 2 + (to.y - from.y) * 0.18
              const midY = (from.y + to.y) / 2 - (to.x - from.x) * 0.18
              return (
                <g key={`${edge.from}-${edge.to}-${edge.kind}-${index}`} className={onCycle ? 'text-conductor' : 'text-staff'}>
                  <path
                    d={`M ${from.x} ${from.y} Q ${midX} ${midY} ${to.x} ${to.y}`}
                    className="fill-none stroke-current"
                    strokeWidth={onCycle ? 2 : 1.25}
                    markerEnd="url(#arrow)"
                  />
                  <text x={midX} y={midY} textAnchor="middle" className="fill-current font-mono" fontSize={10}>
                    {edge.kind}
                  </text>
                </g>
              )
            })}

            {data.nodes.map((node) => {
              const at = positions.get(node)
              if (!at) return null
              return (
                <g key={node}>
                  <circle cx={at.x} cy={at.y} r={24} className="fill-manuscript stroke-ink" strokeWidth={1.5} />
                  <text x={at.x} y={at.y + 5} textAnchor="middle" className="fill-ink font-mono" fontSize={13}>
                    {node}
                  </text>
                </g>
              )
            })}
          </svg>

          <div className="space-y-4">
            <h2 className={`font-prose text-section ${data.cycle ? 'text-conductor' : ''}`}>
              {data.cycle ? dict.graph.cycle : dict.graph.noCycle}
            </h2>
            <p className="max-w-reading text-body">
              {data.cycle ? data.explanation : dict.graph.noCycleBody}
            </p>
            {!data.cycle && data.orders.length > 0 ? (
              <ul className="space-y-0.5 font-mono text-caption">
                {data.orders.map((order) => (
                  <li key={order.join('>')}>{order.join(' → ')}</li>
                ))}
              </ul>
            ) : null}

            <div>
              <h3 className="eyebrow">
                {dict.graph.edges}
              </h3>
              {data.edges.length === 0 ? (
                <p className="mt-1 text-caption text-ink-muted">{dict.graph.noEdges}</p>
              ) : (
                <ul className="mt-1 space-y-1 text-caption">
                  {data.edges.map((edge, index) => (
                    <li key={`${edge.from}-${edge.to}-${edge.kind}-${index}`} className="font-mono">
                      {edge.from} → {edge.to}
                      <span className="ml-2 font-prose text-ink-muted">
                        {kindLabel(edge.kind)}, key {edge.key}, steps {edge.fromStep}→{edge.toStep}
                        {edge.viaPredicate ? `, ${dict.graph.viaPredicate}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      <p className="max-w-reading text-body text-ink-muted">{dict.graph.lead}</p>
    </div>
  )
}
