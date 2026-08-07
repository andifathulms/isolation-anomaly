import { LEVELS } from '@/lib/schedule'
import { PACKS } from '@/lib/packs'
import { SCENARIOS } from '@/lib/scenarios'
import { execute } from '@/lib/engine'
import { detectedIds } from '@/lib/detect'
import { buildConflictGraph, edgesOnCycle, equivalentSerialOrders, explainCycle, findCycle } from '@/lib/serial'
import type { Locale } from '@/lib/i18n/locales'
import {
  graphKey,
  type GraphData,
  type GraphRun,
  type LevelClass,
  type LevelClasses,
  type MatrixCell,
  type MatrixScenario,
} from './shape'
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

/**
 * Which of the twenty-odd level names across five engines actually behave the
 * same as each other.
 *
 * PRD §1's third gap is that the level names mean different things in different
 * engines and nobody says so. The matrix demonstrates that one schedule at a
 * time; nothing in the app has ever stated it. This is the only place it can be
 * computed rather than asserted — five cited packs behind one shared executor,
 * so "these two names are indistinguishable" is a result and not an opinion.
 *
 * The signature is the observable outcome of every library scenario: which
 * anomalies occurred, which transactions aborted, with which error codes, and
 * whether the run was refused. Two (pack, level) pairs land in the same class
 * when every one of those matches across all eleven schedules.
 *
 * What this is not: proof of equivalence. Eleven schedules agreeing is evidence
 * over eleven schedules. A twelfth could split any class here, and the page says
 * so where the classes are shown.
 */
export function levelClasses(): LevelClasses {
  const bySignature = new Map<string, LevelClass['members'][number][]>()
  const facts = new Map<string, { permits: Set<string>; aborts: number; refuses: number }>()

  for (const pack of PACKS) {
    for (const level of LEVELS) {
      const parts: string[] = []
      const permits = new Set<string>()
      let aborts = 0
      let refuses = 0

      for (const scenario of SCENARIOS) {
        const result = execute(scenario.schedule, pack, level)
        if (result.type === 'refused') {
          parts.push(`${scenario.id}:refused:${result.refusal.type}`)
          refuses += 1
          continue
        }
        const found = detectedIds(result.trace)
        found.forEach((id) => permits.add(id))
        if (result.trace.transactions.some((txn) => txn.outcome === 'aborted')) aborts += 1

        /*
         * The signature is what the application saw: the value every statement
         * returned, which transactions committed, and the table left behind.
         *
         * One thing is deliberately excluded: the error code. 40001 and
         * ORA-08177 are the same event spelled in two dialects, and grouping by
         * them means nothing ever matches — the full oracle projection produces
         * a page of singletons and says nothing at all.
         *
         * Waits are in, and getting that wrong the other way was instructive.
         * With only anomalies and outcomes, SQL Server's READ COMMITTED merged
         * with the same level under RCSI. Over this library those two return
         * identical values in every scenario and differ in exactly one wait —
         * so by values alone the claim is true and still misleading, because
         * not blocking readers is the entire point of RCSI. A difference the
         * harness recorded from a real engine does not get dropped for tidiness.
         */
        const values = result.trace.steps.map((step) =>
          step.outcome.type === 'ok' && step.outcome.read
            ? step.outcome.read.type === 'row'
              ? `${step.outcome.read.value}`
              : step.outcome.read.rows.map((row) => `${row.key}=${row.value}`).join(',')
            : step.outcome.type,
        )
        const waits = result.trace.steps.map((step) => step.blockedUntilStep ?? '-')
        const outcomes = result.trace.transactions.map((txn) => `${txn.txn}:${txn.outcome}`)
        const table = result.trace.finalState.map((row) => `${row.key}=${row.value}`).join(',')
        parts.push(
          `${scenario.id}:${found.join(',')}:${values.join('|')}:${waits.join(',')}:${outcomes.join(',')}:${table}`,
        )
      }

      const signature = parts.join('|')
      const entry = pack.levels[level]
      const member = {
        packId: pack.id,
        engine: pack.engine,
        version: pack.version,
        level,
        aliasOf: entry.kind === 'alias' ? entry.of : null,
      }
      bySignature.set(signature, [...(bySignature.get(signature) ?? []), member])
      if (!facts.has(signature)) facts.set(signature, { permits, aborts, refuses })
    }
  }

  const all = [...bySignature.entries()].map(([signature, members]) => {
    const fact = facts.get(signature)
    return {
      id: members.map((m) => `${m.packId}:${m.level}`).join('+'),
      members,
      permits: [...(fact?.permits ?? [])].sort(),
      aborts: fact?.aborts ?? 0,
      refuses: fact?.refuses ?? 0,
    }
  })

  // A level an engine does not implement refuses every schedule. Those are not
  // a shared behaviour — they are an absence, and grouping them together would
  // claim that PostgreSQL's missing SNAPSHOT and Oracle's missing REPEATABLE
  // READ are the same thing rather than both being nothing.
  const unsupported = all
    .filter((entry) => entry.refuses === SCENARIOS.length)
    .flatMap((entry) => entry.members)
    .map(({ packId, engine, version, level }) => ({ packId, engine, version, level }))

  return {
    classes: all
      .filter((entry) => entry.refuses < SCENARIOS.length)
      .sort((a, b) => b.members.length - a.members.length || a.id.localeCompare(b.id)),
    unsupported,
    scenarioCount: SCENARIOS.length,
  }
}
