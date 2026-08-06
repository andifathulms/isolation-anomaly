import { describe as suite, expect, it } from 'vitest'
import { LEVELS, type Operation, type Schedule, type TxnId } from '@/lib/schedule'
import { PACKS, requirePack } from '@/lib/packs'
import { SCENARIOS } from '@/lib/scenarios'
import { execute } from '@/lib/engine'
import { detect } from '@/lib/detect'
import {
  buildConflictGraph,
  edgesOnCycle,
  findCycle,
  isConflictSerializable,
  isSerializableByBruteForce,
} from '@/lib/serial'

/**
 * The graph against the definition — PRD §7.
 *
 * Cycle detection must agree with exhaustive search on every small schedule.
 * A graph that finds no cycle where no serial order exists is a graph that
 * tells a developer their schedule was safe when it was not.
 */

/**
 * A corpus of small schedules: every interleaving of two two-operation
 * transactions over one or two keys. Generated exhaustively rather than
 * sampled, so the corpus is the same on every machine.
 */
function corpus(): readonly Schedule[] {
  const t1Ops: readonly Operation[][] = [
    [{ type: 'read', key: 1 }, { type: 'write', key: 1, value: 11 }],
    [{ type: 'read', key: 1 }, { type: 'write', key: 2, value: 12 }],
    [{ type: 'write', key: 1, value: 13 }, { type: 'read', key: 2 }],
  ]
  const t2Ops: readonly Operation[][] = [
    [{ type: 'read', key: 1 }, { type: 'write', key: 1, value: 21 }],
    [{ type: 'read', key: 2 }, { type: 'write', key: 1, value: 22 }],
    [{ type: 'write', key: 2, value: 23 }, { type: 'read', key: 1 }],
  ]

  const schedules: Schedule[] = []

  // Every way of interleaving [a0, a1, commit] with [b0, b1, commit].
  const interleavings = (left: number, right: number): readonly ('T1' | 'T2')[][] => {
    if (left === 0) return [Array.from({ length: right }, () => 'T2' as const)]
    if (right === 0) return [Array.from({ length: left }, () => 'T1' as const)]
    return [
      ...interleavings(left - 1, right).map((rest) => ['T1' as const, ...rest]),
      ...interleavings(left, right - 1).map((rest) => ['T2' as const, ...rest]),
    ]
  }

  t1Ops.forEach((first, firstIndex) => {
    t2Ops.forEach((second, secondIndex) => {
      const t1: Operation[] = [...first, { type: 'commit' }]
      const t2: Operation[] = [...second, { type: 'commit' }]
      interleavings(t1.length, t2.length).forEach((pattern, patternIndex) => {
        const taken = new Map<TxnId, number>([
          ['T1', 0],
          ['T2', 0],
        ])
        const steps = pattern.map((txn) => {
          const ops = txn === 'T1' ? t1 : t2
          const next = taken.get(txn) ?? 0
          taken.set(txn, next + 1)
          const op = ops[next]
          if (!op) throw new Error('interleaving generator produced too many steps')
          return { txn, op }
        })
        schedules.push({
          id: `corpus-${firstIndex}-${secondIndex}-${patternIndex}`,
          title: 'Generated small schedule',
          transactions: ['T1', 'T2'],
          initial: [
            { key: 1, value: 1 },
            { key: 2, value: 2 },
          ],
          steps: [
            { txn: 'T1', op: { type: 'begin' } },
            { txn: 'T2', op: { type: 'begin' } },
            ...steps,
          ],
        })
      })
    })
  })

  return schedules
}

const SMALL_SCHEDULES = corpus()

suite('conflict graph versus brute-force serializability', () => {
  it(`agrees on all ${SMALL_SCHEDULES.length} generated small schedules, at every level`, () => {
    const disagreements: string[] = []
    for (const pack of PACKS) {
      const levels = LEVELS.filter((level) => pack.levels[level].kind !== 'unsupported')
      for (const schedule of SMALL_SCHEDULES) {
        for (const level of levels) {
          const result = execute(schedule, pack, level)
          if (result.type !== 'trace') continue
          const graph = buildConflictGraph(result.trace)
          const byGraph = isConflictSerializable(graph)
          const byDefinition = isSerializableByBruteForce(graph)
          if (byGraph !== byDefinition) {
            disagreements.push(
              `${schedule.id} @ ${level}: graph says ${byGraph}, exhaustive search says ${byDefinition}`,
            )
          }
        }
      }
    }
    expect(disagreements).toEqual([])
  })

  it('agrees on every library scenario, at every level', () => {
    const disagreements: string[] = []
    for (const pack of PACKS) {
      const levels = LEVELS.filter((level) => pack.levels[level].kind !== 'unsupported')
      for (const scenario of SCENARIOS) {
        for (const level of levels) {
          const result = execute(scenario.schedule, pack, level)
          if (result.type !== 'trace') continue
          const graph = buildConflictGraph(result.trace)
          if (isConflictSerializable(graph) !== isSerializableByBruteForce(graph)) {
            disagreements.push(`${scenario.id} @ ${level}`)
          }
        }
      }
    }
    expect(disagreements).toEqual([])
  })
})

suite('the cycle explains the anomaly', () => {
  const pack = requirePack('postgres-16')

  it('finds a cycle in write skew at REPEATABLE READ', () => {
    const scenario = SCENARIOS.find((candidate) => candidate.id === 'write-skew')
    if (!scenario) throw new Error('write-skew scenario missing')
    const result = execute(scenario.schedule, pack, 'REPEATABLE READ')
    if (result.type !== 'trace') throw new Error('expected a trace')
    const graph = buildConflictGraph(result.trace)
    const cycle = findCycle(graph)
    expect(cycle).not.toBeNull()
    if (!cycle) return
    // Two transactions, each waiting on the other: T1 → T2 → T1.
    expect(cycle[0]).toBe(cycle[cycle.length - 1])
    expect(new Set(cycle)).toEqual(new Set(['T1', 'T2']))
    const onCycle = edgesOnCycle(graph, cycle)
    expect(onCycle.every((edge) => edge.kind === 'rw')).toBe(true)
  })

  it('finds no cycle in the same schedule at SERIALIZABLE, because a transaction was aborted', () => {
    const scenario = SCENARIOS.find((candidate) => candidate.id === 'write-skew')
    if (!scenario) throw new Error('write-skew scenario missing')
    const result = execute(scenario.schedule, pack, 'SERIALIZABLE')
    if (result.type !== 'trace') throw new Error('expected a trace')
    const graph = buildConflictGraph(result.trace)
    expect(graph.nodes).toEqual(['T1'])
    expect(findCycle(graph)).toBeNull()
  })

  it('finds a cycle in every anomaly, and none where locks did the serializing', () => {
    const check = (scenarioId: string, level: 'READ COMMITTED' | 'REPEATABLE READ') => {
      const scenario = SCENARIOS.find((candidate) => candidate.id === scenarioId)
      if (!scenario) throw new Error(`${scenarioId} missing`)
      const result = execute(scenario.schedule, pack, level)
      if (result.type !== 'trace') throw new Error('expected a trace')
      return findCycle(buildConflictGraph(result.trace)) !== null
    }
    // Each of these permits its anomaly at the level given, and each is a
    // genuine serialization anomaly: no order of the two transactions one
    // after another produces what happened.
    expect(check('write-skew', 'REPEATABLE READ')).toBe(true)
    expect(check('phantom-insert-race', 'REPEATABLE READ')).toBe(true)
    expect(check('read-skew', 'READ COMMITTED')).toBe(true)
    expect(check('non-repeatable-read', 'READ COMMITTED')).toBe(true)
    // The locking-read variants are equivalent to running T1 and then T2: the
    // waiting made every conflict point the same way.
    expect(check('lost-update-locked', 'READ COMMITTED')).toBe(false)
    expect(check('write-skew-locked', 'READ COMMITTED')).toBe(false)
  })

  it('reports a cycle for every anomaly the detector finds among committed transactions', () => {
    for (const scenario of SCENARIOS) {
      for (const level of ['READ COMMITTED', 'REPEATABLE READ', 'SERIALIZABLE'] as const) {
        const result = execute(scenario.schedule, pack, level)
        if (result.type !== 'trace') continue
        const anomalies = detect(result.trace)
        if (anomalies.length === 0) continue
        const committedTxns = new Set(
          result.trace.transactions.filter((txn) => txn.outcome === 'committed').map((txn) => txn.txn),
        )
        const amongCommitted = anomalies.filter((found) =>
          found.transactions.every((txn) => committedTxns.has(txn)),
        )
        if (amongCommitted.length === 0) continue
        const cycle = findCycle(buildConflictGraph(result.trace))
        expect(cycle, `${scenario.id} @ ${level} reports ${amongCommitted[0]?.id} with no cycle`).not.toBeNull()
      }
    }
  })
})

suite('graph well-formedness', () => {
  it('only ever names committed transactions', () => {
    for (const pack of PACKS) {
      const levels = LEVELS.filter((level) => pack.levels[level].kind !== 'unsupported')
      for (const scenario of SCENARIOS) {
        for (const level of levels) {
          const result = execute(scenario.schedule, pack, level)
          if (result.type !== 'trace') continue
          const committedTxns = result.trace.transactions
            .filter((txn) => txn.outcome === 'committed')
            .map((txn) => txn.txn)
          const graph = buildConflictGraph(result.trace)
          expect(graph.nodes).toEqual(committedTxns)
          for (const edge of graph.edges) {
            expect(committedTxns).toContain(edge.from)
            expect(committedTxns).toContain(edge.to)
          }
        }
      }
    }
  })
})
