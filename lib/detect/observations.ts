import { predicateContains, type Key, type Predicate, type TxnId, type Value } from '@/lib/schedule'
import type { ExecutionTrace } from '@/lib/engine/trace'

/**
 * What an outside observer saw — the only input the detector is allowed.
 *
 * `lib/detect` imports nothing from `lib/engine` except types (CLAUDE.md
 * invariant 5). It does not look at snapshots, version chains, locks or the
 * pack's rules, because a detector that shared the executor's reasoning would
 * validate the executor's bugs. It sees what a person watching two psql
 * sessions would see: who read what, who wrote what, in what order, and who
 * committed.
 *
 * Order is the subtle part. A statement that waited on a lock happened when it
 * *completed*, not when it was issued, and a statement that completes during
 * step i happens after step i's own statement. Getting that wrong turns a
 * schedule that was serialized by locks into a false anomaly.
 */

export type Occurrence = {
  /** The schedule step the statement belongs to. */
  readonly step: number
  /** The step during which it actually took effect. */
  readonly effective: number
  /** True when the statement had to wait, so it ran after that step's own statement. */
  readonly afterWaiting: boolean
  /** Rank in the observed order. Compare these, never the step numbers. */
  readonly rank: number
}

export type ReadObservation = Occurrence & {
  readonly txn: TxnId
  readonly key: Key
  readonly value: Value | null
  /** A locking read observes the same thing; it just also takes a lock. */
  readonly locking: boolean
}

export type RangeReadObservation = Occurrence & {
  readonly txn: TxnId
  readonly predicate: Predicate
  readonly keys: readonly Key[]
}

export type WriteObservation = Occurrence & {
  readonly txn: TxnId
  readonly key: Key
  /** null records a delete. */
  readonly value: Value | null
  readonly kind: 'write' | 'insert' | 'delete'
}

export type EndObservation = Occurrence & {
  readonly txn: TxnId
  readonly outcome: 'committed' | 'aborted'
}

export type Observations = {
  readonly reads: readonly ReadObservation[]
  readonly rangeReads: readonly RangeReadObservation[]
  readonly writes: readonly WriteObservation[]
  readonly ends: readonly EndObservation[]
  readonly transactions: readonly TxnId[]
}

type Raw = { step: number; effective: number; afterWaiting: boolean }

function compare(a: Raw, b: Raw): number {
  if (a.effective !== b.effective) return a.effective - b.effective
  if (a.afterWaiting !== b.afterWaiting) return a.afterWaiting ? 1 : -1
  return a.step - b.step
}

export function observe(trace: ExecutionTrace): Observations {
  const reads: (ReadObservation & Raw)[] = []
  const rangeReads: (RangeReadObservation & Raw)[] = []
  const writes: (WriteObservation & Raw)[] = []
  const ends: (EndObservation & Raw)[] = []

  const outcomeOf = new Map(trace.transactions.map((result) => [result.txn, result.outcome]))

  for (const step of trace.steps) {
    const effective = step.blockedUntilStep ?? step.index
    const afterWaiting = step.blockedUntilStep !== null
    const base = { step: step.index, effective, afterWaiting, rank: 0 }

    if (step.outcome.type !== 'ok') {
      // A statement the engine refused changed nothing observable. The
      // transaction's fate is recorded separately, from its outcome.
      continue
    }

    switch (step.op.type) {
      case 'read':
      case 'selectForUpdate': {
        const read = step.outcome.read
        reads.push({
          ...base,
          txn: step.txn,
          key: step.op.key,
          value: read?.type === 'row' ? read.value : null,
          locking: step.op.type === 'selectForUpdate',
        })
        break
      }
      case 'readRange': {
        const read = step.outcome.read
        rangeReads.push({
          ...base,
          txn: step.txn,
          predicate: step.op.predicate,
          keys: read?.type === 'rows' ? read.rows.map((row) => row.key) : [],
        })
        break
      }
      case 'write':
      case 'insert':
      case 'delete': {
        if (step.outcome.rowsAffected === 0) break
        writes.push({
          ...base,
          txn: step.txn,
          key: step.op.key,
          value: step.op.type === 'delete' ? null : step.op.value,
          kind: step.op.type,
        })
        break
      }
      case 'commit':
      case 'rollback': {
        ends.push({
          ...base,
          txn: step.txn,
          // A commit the engine turned into a rollback is a rollback.
          outcome: outcomeOf.get(step.txn) === 'committed' ? 'committed' : 'aborted',
        })
        break
      }
      case 'begin':
        break
      default: {
        const exhaustive: never = step.op
        return exhaustive
      }
    }
  }

  const all: Raw[] = [...reads, ...rangeReads, ...writes, ...ends]
  const ordered = [...all].sort(compare)
  const rankOf = new Map<Raw, number>()
  ordered.forEach((item, index) => rankOf.set(item, index))

  const withRank = <T extends Raw>(items: readonly T[]): readonly T[] =>
    items.map((item) => ({ ...item, rank: rankOf.get(item) ?? 0 }))

  return {
    reads: withRank(reads),
    rangeReads: withRank(rangeReads),
    writes: withRank(writes),
    ends: withRank(ends),
    transactions: trace.transactions.map((result) => result.txn),
  }
}

/** The rank at which a transaction ended, or Infinity if it never did. */
export function endRank(observations: Observations, txn: TxnId): number {
  const end = observations.ends.find((item) => item.txn === txn)
  return end ? end.rank : Number.POSITIVE_INFINITY
}

export function outcomeOf(observations: Observations, txn: TxnId): 'committed' | 'aborted' | 'open' {
  const end = observations.ends.find((item) => item.txn === txn)
  return end ? end.outcome : 'open'
}

export function committed(observations: Observations, txn: TxnId): boolean {
  return outcomeOf(observations, txn) === 'committed'
}

/**
 * Every key a transaction observed before a given rank, whether by reading the
 * row or by reading a predicate the row falls inside. A predicate read observes
 * the *absence* of a row too, which is why an insert into its range counts.
 */
export function keysObservedBefore(
  observations: Observations,
  txn: TxnId,
  key: Key,
  rank: number,
): readonly (ReadObservation | RangeReadObservation)[] {
  const direct = observations.reads.filter(
    (read) => read.txn === txn && read.key === key && read.rank < rank,
  )
  const byPredicate = observations.rangeReads.filter(
    (read) => read.txn === txn && read.rank < rank && predicateContains(read.predicate, key),
  )
  return [...direct, ...byPredicate]
}
