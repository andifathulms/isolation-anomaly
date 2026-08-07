import { LEVELS } from '@/lib/schedule'
import { PACKS } from '@/lib/packs'
import { SCENARIOS } from '@/lib/scenarios'
import { execute } from '@/lib/engine'
import { detectedIds } from '@/lib/detect'
import { buildConflictGraph, edgesOnCycle, equivalentSerialOrders, explainCycle, findCycle } from '@/lib/serial'
import type { Locale } from '@/lib/i18n/locales'
import { graphKey, type GraphData, type GraphRun, type MatrixCell, type MatrixScenario } from './shape'
import { anomalyText, scenarioText } from '@/lib/i18n/content'

export * from './shape'

/**
 * The matrix and the graph, worked out at build time.
 *
 * Both pages were client components that ran the executor, the detector and the
 * serializability checker in the browser — which meant every visitor downloaded
 * the engine, all five packs, the anomaly catalogue and both locales' teaching
 * prose in order to render a grid of words and a circle with arrows on it. The
 * pack data alone carries 164 vendor citations totalling 31 kB of quoted
 * documentation, none of which either page displays.
 *
 * Neither page lets the reader change anything the executor depends on: the
 * scenarios, packs and levels are all fixed lists. So every cell either page can
 * ever show is knowable before the site is deployed, and the only interaction is
 * choosing which precomputed cell to look at.
 *
 * The schedule page is the exception and keeps the engine on the client, because
 * there the reader edits the schedule and drags marks to re-interleave it. That
 * is a real reason to ship an executor; rendering a fixed grid is not.
 *
 * Everything here runs in a server component, so it costs the browser nothing
 * but the JSON it produces — measured at about 1.4 kB gzipped for the matrix and
 * 1.7 kB for the graph, against the 31 kB chunk it replaces.
 */

export function matrixData(locale: Locale): readonly MatrixScenario[] {
  return SCENARIOS.map((scenario) => {
    const text = scenarioText(locale, scenario)
    return {
      id: scenario.id,
      title: text.title,
      framing: text.framing,
      anomalyName: scenario.anomaly ? anomalyText(locale, scenario.anomaly).name : null,
      rows: PACKS.map((pack) => ({
        packId: pack.id,
        engine: pack.engine,
        version: pack.version,
        summary: pack.summary,
        cells: LEVELS.map((level): MatrixCell => {
          const result = execute(scenario.schedule, pack, level)
          if (result.type === 'refused') return { kind: 'refused' }
          const entry = pack.levels[level]
          return {
            kind: 'ran',
            anomalies: detectedIds(result.trace),
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
      })),
    }
  })
}

export function graphData(locale: Locale): GraphData {
  const runs: Record<string, GraphRun> = {}

  for (const scenario of SCENARIOS) {
    for (const pack of PACKS) {
      for (const level of LEVELS) {
        const key = graphKey(scenario.id, pack.id, level)
        const result = execute(scenario.schedule, pack, level)
        if (result.type !== 'trace') {
          runs[key] = { kind: 'refused' }
          continue
        }
        const graph = buildConflictGraph(result.trace)
        const cycle = findCycle(graph)
        const onCycle = cycle ? edgesOnCycle(graph, cycle) : []
        runs[key] = {
          kind: 'ran',
          nodes: graph.nodes,
          edges: graph.edges,
          onCycle: onCycle.map((edge) => graph.edges.indexOf(edge)),
          cycle: cycle ?? null,
          explanation: cycle ? explainCycle(cycle) : null,
          orders: equivalentSerialOrders(graph).slice(0, 4),
        }
      }
    }
  }

  return {
    scenarios: SCENARIOS.map((scenario) => ({
      id: scenario.id,
      title: scenarioText(locale, scenario).title,
    })),
    packs: PACKS.map((pack) => ({ id: pack.id, engine: pack.engine, version: pack.version })),
    runs,
  }
}
