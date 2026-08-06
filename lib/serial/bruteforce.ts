import type { TxnId } from '@/lib/schedule'
import type { ConflictGraph } from './graph'

/**
 * The definition, checked exhaustively.
 *
 * A schedule is conflict-serializable when some serial order of its
 * transactions puts every pair of conflicting operations in the same relative
 * order the schedule did. So: try every order.
 *
 * Cycle detection is an optimisation of this definition, and the definition is
 * testable — for small schedules, both must always agree (PRD §7). This is
 * deliberately written the slow, obvious way, sharing no code with the graph
 * search it is used to check.
 */

function permutations<T>(items: readonly T[]): readonly (readonly T[])[] {
  if (items.length <= 1) return [items]
  const result: T[][] = []
  items.forEach((item, index) => {
    const rest = [...items.slice(0, index), ...items.slice(index + 1)]
    for (const tail of permutations(rest)) result.push([item, ...tail])
  })
  return result
}

/** Every serial order of the transactions that respects all conflict edges. */
export function equivalentSerialOrders(graph: ConflictGraph): readonly (readonly TxnId[])[] {
  const valid: (readonly TxnId[])[] = []
  for (const order of permutations(graph.nodes)) {
    const position = new Map<TxnId, number>()
    order.forEach((txn, index) => position.set(txn, index))
    const respectsEveryEdge = graph.edges.every((edge) => {
      if (edge.from === edge.to) return true
      const from = position.get(edge.from)
      const to = position.get(edge.to)
      if (from === undefined || to === undefined) return true
      return from < to
    })
    if (respectsEveryEdge) valid.push(order)
  }
  return valid
}

export function isSerializableByBruteForce(graph: ConflictGraph): boolean {
  return equivalentSerialOrders(graph).length > 0
}

/** Plain-language statement of what no serial order could produce — PRD §5.5. */
export function explainCycle(cycle: readonly TxnId[]): string {
  const pairs: string[] = []
  for (let index = 0; index < cycle.length - 1; index += 1) {
    pairs.push(`${cycle[index]} must run before ${cycle[index + 1]}`)
  }
  return `${pairs.join(', and ')} — which is impossible, so no order of these transactions one after another produces this outcome.`
}
