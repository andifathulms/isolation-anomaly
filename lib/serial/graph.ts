import { predicateContains, type Key, type TxnId } from '@/lib/schedule'
import type { ExecutionTrace } from '@/lib/engine/trace'
import { committed, observe, type Observations } from '@/lib/detect/observations'

/**
 * The conflict graph — PRD §5.5.
 *
 * Nodes are transactions, edges are conflicting operation pairs in the order
 * they happened. Two operations conflict when they touch the same row and at
 * least one writes it, because those are the pairs whose order changes the
 * outcome. An edge from A to B says: in any equivalent serial schedule, A must
 * run before B.
 *
 * A cycle therefore means no serial order exists, and the cycle *is* the
 * explanation for the anomaly — it turns "the database allowed something bad"
 * into "here is precisely why no ordering of these transactions produces this."
 */

export type ConflictKind =
  /** write then write: the later write hides the earlier one. */
  | 'ww'
  /** write then read: the reader depends on the writer. */
  | 'wr'
  /** read then write: the reader would have to run first — an antidependency. */
  | 'rw'

export type ConflictEdge = {
  readonly from: TxnId
  readonly to: TxnId
  readonly kind: ConflictKind
  readonly key: Key
  readonly fromStep: number
  readonly toStep: number
  /** True when the earlier operation was a predicate read rather than a row read. */
  readonly viaPredicate: boolean
}

export type ConflictGraph = {
  readonly nodes: readonly TxnId[]
  readonly edges: readonly ConflictEdge[]
}

type Access = {
  readonly txn: TxnId
  readonly key: Key
  readonly rank: number
  readonly step: number
  readonly mode: 'read' | 'write'
  readonly viaPredicate: boolean
}

/**
 * Every access the graph is built from. A predicate read is expanded into an
 * access on each key it could have matched — including keys that did not exist
 * when it ran, since observing an absence is what a phantom violates.
 */
function accesses(observations: Observations): readonly Access[] {
  const list: Access[] = []
  const allKeys = new Set<Key>()
  for (const read of observations.reads) allKeys.add(read.key)
  for (const write of observations.writes) allKeys.add(write.key)
  for (const read of observations.rangeReads) for (const key of read.keys) allKeys.add(key)

  for (const read of observations.reads) {
    list.push({ txn: read.txn, key: read.key, rank: read.rank, step: read.step, mode: 'read', viaPredicate: false })
  }
  for (const read of observations.rangeReads) {
    for (const key of [...allKeys].sort((a, b) => a - b)) {
      if (!predicateContains(read.predicate, key)) continue
      list.push({ txn: read.txn, key, rank: read.rank, step: read.step, mode: 'read', viaPredicate: true })
    }
  }
  for (const write of observations.writes) {
    list.push({
      txn: write.txn,
      key: write.key,
      rank: write.rank,
      step: write.step,
      mode: 'write',
      viaPredicate: false,
    })
  }
  return list.sort((a, b) => a.rank - b.rank || a.key - b.key)
}

export function buildConflictGraph(trace: ExecutionTrace): ConflictGraph {
  const observations = observe(trace)
  // Conflict serializability is a statement about the committed transactions:
  // an aborted transaction left nothing behind to be serialized.
  const nodes = observations.transactions.filter((txn) => committed(observations, txn))
  const relevant = accesses(observations).filter((access) => nodes.includes(access.txn))

  const edges: ConflictEdge[] = []
  const seen = new Set<string>()

  for (const earlier of relevant) {
    for (const later of relevant) {
      if (later.rank <= earlier.rank) continue
      if (earlier.txn === later.txn) continue
      if (earlier.key !== later.key) continue
      if (earlier.mode === 'read' && later.mode === 'read') continue

      const kind: ConflictKind =
        earlier.mode === 'write' && later.mode === 'write'
          ? 'ww'
          : earlier.mode === 'write'
            ? 'wr'
            : 'rw'

      const signature = `${earlier.txn}->${later.txn}:${kind}:${earlier.key}`
      if (seen.has(signature)) continue
      seen.add(signature)

      edges.push({
        from: earlier.txn,
        to: later.txn,
        kind,
        key: earlier.key,
        fromStep: earlier.step,
        toStep: later.step,
        viaPredicate: earlier.viaPredicate || later.viaPredicate,
      })
    }
  }

  return { nodes, edges }
}

/**
 * A cycle in the graph, as the sequence of transactions around it, or null.
 * The returned path starts and ends at the same transaction.
 */
export function findCycle(graph: ConflictGraph): readonly TxnId[] | null {
  const outgoing = new Map<TxnId, TxnId[]>()
  for (const node of graph.nodes) outgoing.set(node, [])
  for (const edge of graph.edges) {
    if (edge.from === edge.to) continue
    outgoing.get(edge.from)?.push(edge.to)
  }

  const state = new Map<TxnId, 'unvisited' | 'onStack' | 'done'>()
  for (const node of graph.nodes) state.set(node, 'unvisited')
  const stack: TxnId[] = []

  const walk = (node: TxnId): readonly TxnId[] | null => {
    state.set(node, 'onStack')
    stack.push(node)
    for (const next of outgoing.get(node) ?? []) {
      if (state.get(next) === 'onStack') {
        const start = stack.indexOf(next)
        return [...stack.slice(start), next]
      }
      if (state.get(next) === 'unvisited') {
        const cycle = walk(next)
        if (cycle) return cycle
      }
    }
    stack.pop()
    state.set(node, 'done')
    return null
  }

  for (const node of graph.nodes) {
    if (state.get(node) !== 'unvisited') continue
    const cycle = walk(node)
    if (cycle) return cycle
  }
  return null
}

export function isConflictSerializable(graph: ConflictGraph): boolean {
  return findCycle(graph) === null
}

/** The edges that lie on a cycle, so the view can draw exactly those. */
export function edgesOnCycle(graph: ConflictGraph, cycle: readonly TxnId[]): readonly ConflictEdge[] {
  const wanted = new Set<string>()
  for (let index = 0; index < cycle.length - 1; index += 1) {
    wanted.add(`${cycle[index]}->${cycle[index + 1]}`)
  }
  return graph.edges.filter((edge) => wanted.has(`${edge.from}->${edge.to}`))
}
