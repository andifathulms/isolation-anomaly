'use client'

import { useMemo, useState } from 'react'
import { LEVELS, type IsolationLevel } from '@/lib/schedule'
import { PACKS, requirePack } from '@/lib/packs'
import { SCENARIOS } from '@/lib/scenarios'
import { execute } from '@/lib/engine'
import { buildConflictGraph, edgesOnCycle, explainCycle, findCycle } from '@/lib/serial'
import { equivalentSerialOrders } from '@/lib/serial'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { scenarioText } from '@/lib/i18n/content'
import type { Locale } from '@/lib/i18n/locales'

/**
 * The conflict graph — PRD §5.5. No layout library: transactions sit on a
 * circle, which for two or three nodes is exactly as readable as anything a
 * force simulation would produce.
 *
 * The cycle is drawn in conductor's red, because a cycle *is* the anomaly.
 */

const SIZE = 320
const RADIUS = 108

export function ConflictGraphView({
  dict,
  locale,
}: {
  readonly dict: Dictionary
  readonly locale: Locale
}) {
  const [scenarioId, setScenarioId] = useState('write-skew')
  const [packId, setPackId] = useState(PACKS[0]?.id ?? 'postgres-16')
  const [level, setLevel] = useState<IsolationLevel>('REPEATABLE READ')

  const scenario = SCENARIOS.find((candidate) => candidate.id === scenarioId) ?? SCENARIOS[0]
  const pack = requirePack(packId)

  const data = useMemo(() => {
    if (!scenario) return null
    const result = execute(scenario.schedule, pack, level)
    if (result.type !== 'trace') return null
    const graph = buildConflictGraph(result.trace)
    const cycle = findCycle(graph)
    return {
      graph,
      cycle,
      onCycle: cycle ? edgesOnCycle(graph, cycle) : [],
      orders: equivalentSerialOrders(graph),
    }
  }, [scenario, pack, level])

  const positions = useMemo(() => {
    const nodes = data?.graph.nodes ?? []
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
            {SCENARIOS.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {scenarioText(locale, candidate).title}
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
            {PACKS.map((candidate) => (
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

      {!data ? (
        <p className="text-caption text-ink-muted">{dict.matrix.refused}</p>
      ) : (
        <div className="grid gap-8 md:grid-cols-[320px_1fr]">
          <svg
            width={SIZE}
            height={SIZE}
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            className="leaf"
            role="img"
            aria-label="Conflict graph"
          >
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX={9} refY={5} markerWidth={6} markerHeight={6} orient="auto">
                <path d="M 0 0 L 10 5 L 0 10 z" className="fill-current" />
              </marker>
            </defs>

            {data.graph.edges.map((edge, index) => {
              const from = positions.get(edge.from)
              const to = positions.get(edge.to)
              if (!from || !to) return null
              const onCycle = data.onCycle.includes(edge)
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

            {data.graph.nodes.map((node) => {
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
              {data.cycle ? explainCycle(data.cycle) : dict.graph.noCycleBody}
            </p>
            {!data.cycle && data.orders.length > 0 ? (
              <ul className="space-y-0.5 font-mono text-caption">
                {data.orders.slice(0, 4).map((order) => (
                  <li key={order.join('>')}>{order.join(' → ')}</li>
                ))}
              </ul>
            ) : null}

            <div>
              <h3 className="eyebrow">
                {dict.graph.edges}
              </h3>
              {data.graph.edges.length === 0 ? (
                <p className="mt-1 text-caption text-ink-muted">{dict.graph.noEdges}</p>
              ) : (
                <ul className="mt-1 space-y-1 text-caption">
                  {data.graph.edges.map((edge, index) => (
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
