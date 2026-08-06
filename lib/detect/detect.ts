import type { Key, TxnId } from '@/lib/schedule'
import type { ExecutionTrace } from '@/lib/engine/trace'
import { ANOMALIES, type AnomalyId } from './catalog'
import {
  committed,
  endRank,
  keysObservedBefore,
  observe,
  type Observations,
  type WriteObservation,
} from './observations'

/**
 * Anomaly detection, from the published definitions and nothing else.
 *
 * Each detector below is a transcription of a phenomenon in Berenson et al.'s
 * notation into a question about the observed order. Where a definition is a
 * pattern over four operations, the code reads as that pattern.
 */

export type DetectedAnomaly = {
  readonly id: AnomalyId
  /** The schedule steps that make up the phenomenon, in observed order. */
  readonly steps: readonly number[]
  /**
   * The step at which the anomaly became inevitable — the conductor's mark.
   * It points at the cause, not the symptom: the write that could no longer be
   * made safe, rather than the commit that revealed it.
   */
  readonly causeStep: number
  readonly transactions: readonly TxnId[]
  readonly keys: readonly Key[]
  /** One sentence, generated from the observations rather than written. */
  readonly mechanism: string
}

export function detect(trace: ExecutionTrace): readonly DetectedAnomaly[] {
  const observations = observe(trace)
  const found = [
    ...detectDirtyWrite(observations),
    ...detectDirtyRead(observations),
    ...detectLostUpdate(observations),
    ...detectNonRepeatableRead(observations),
    ...detectPhantomRead(observations),
    ...detectReadSkew(observations),
    ...detectWriteSkew(observations),
  ]
  // Stable order: earliest cause first, then by the catalogue's order.
  const catalogueOrder = Object.keys(ANOMALIES) as AnomalyId[]
  return [...found].sort(
    (a, b) => a.causeStep - b.causeStep || catalogueOrder.indexOf(a.id) - catalogueOrder.indexOf(b.id),
  )
}

export function detectedIds(trace: ExecutionTrace): readonly AnomalyId[] {
  return [...new Set(detect(trace).map((anomaly) => anomaly.id))]
}

/** P0 — w1[x] ... w2[x] before either transaction ends. */
function detectDirtyWrite(observations: Observations): readonly DetectedAnomaly[] {
  const found: DetectedAnomaly[] = []
  for (const first of observations.writes) {
    for (const second of observations.writes) {
      if (first.txn === second.txn) continue
      if (second.rank <= first.rank) continue
      if (second.key !== first.key) continue
      // The first writer must still be running when the second writes.
      if (endRank(observations, first.txn) < second.rank) continue
      found.push({
        id: 'dirty-write',
        steps: [first.step, second.step],
        causeStep: second.step,
        transactions: [first.txn, second.txn],
        keys: [first.key],
        mechanism:
          `${second.txn} wrote key ${second.key} at step ${second.step} while ${first.txn}'s write ` +
          `from step ${first.step} was still uncommitted, so rolling either one back cannot restore a consistent value.`,
      })
    }
  }
  return found
}

/** P1 — w1[x] ... r2[x] ... (c1 or a1). */
function detectDirtyRead(observations: Observations): readonly DetectedAnomaly[] {
  const found: DetectedAnomaly[] = []
  for (const read of observations.reads) {
    // The most recent write of this key before the read decides what a
    // committed reader could have seen.
    const priorWrites = observations.writes
      .filter((write) => write.key === read.key && write.rank < read.rank)
      .sort((a, b) => a.rank - b.rank)
    const latest = priorWrites[priorWrites.length - 1]
    if (!latest || latest.txn === read.txn) continue
    if (endRank(observations, latest.txn) < read.rank) continue // the writer had finished
    if (read.value !== latest.value) continue // the reader did not see it
    found.push({
      id: 'dirty-read',
      steps: [latest.step, read.step],
      causeStep: read.step,
      transactions: [latest.txn, read.txn],
      keys: [read.key],
      mechanism:
        `${read.txn} read key ${read.key} at step ${read.step} and saw ${String(read.value)}, ` +
        `which ${latest.txn} wrote at step ${latest.step} and had not committed.`,
    })
  }
  return found
}

/** P4 — r1[x] ... w2[x] ... w1[x] ... c1, with the earlier write lost. */
function detectLostUpdate(observations: Observations): readonly DetectedAnomaly[] {
  const found: DetectedAnomaly[] = []
  for (const loserRead of observations.reads) {
    if (!committed(observations, loserRead.txn)) continue
    const overwrite = observations.writes.find(
      (write) =>
        write.key === loserRead.key &&
        write.txn !== loserRead.txn &&
        write.rank > loserRead.rank &&
        committed(observations, write.txn),
    )
    if (!overwrite) continue
    const blindWrite = observations.writes.find(
      (write) => write.txn === loserRead.txn && write.key === loserRead.key && write.rank > overwrite.rank,
    )
    if (!blindWrite) continue
    // If the transaction re-read the row after the other write, its write was
    // no longer based on stale data and nothing was lost.
    const reReadAfter = observations.reads.some(
      (read) =>
        read.txn === loserRead.txn &&
        read.key === loserRead.key &&
        read.rank > overwrite.rank &&
        read.rank < blindWrite.rank,
    )
    if (reReadAfter) continue
    found.push({
      id: 'lost-update',
      steps: [loserRead.step, overwrite.step, blindWrite.step],
      causeStep: blindWrite.step,
      transactions: [loserRead.txn, overwrite.txn],
      keys: [loserRead.key],
      mechanism:
        `${loserRead.txn} read key ${loserRead.key} at step ${loserRead.step}, ${overwrite.txn} wrote and ` +
        `committed it at step ${overwrite.step}, and ${loserRead.txn} then wrote at step ${blindWrite.step} ` +
        `from the value it read first — so ${overwrite.txn}'s update is gone with no error raised.`,
    })
  }
  return found
}

/** P2 — r1[x] ... w2[x] ... c2 ... r1[x], the two reads disagreeing. */
function detectNonRepeatableRead(observations: Observations): readonly DetectedAnomaly[] {
  const found: DetectedAnomaly[] = []
  for (const first of observations.reads) {
    for (const second of observations.reads) {
      if (first.txn !== second.txn) continue
      if (second.rank <= first.rank) continue
      if (second.key !== first.key) continue
      if (first.value === second.value) continue
      const cause = observations.writes.find(
        (write) =>
          write.key === first.key &&
          write.txn !== first.txn &&
          write.rank > first.rank &&
          write.rank < second.rank,
      )
      if (!cause) continue
      found.push({
        id: 'non-repeatable-read',
        steps: [first.step, cause.step, second.step],
        causeStep: second.step,
        transactions: [first.txn, cause.txn],
        keys: [first.key],
        mechanism:
          `${first.txn} read key ${first.key} as ${String(first.value)} at step ${first.step} and as ` +
          `${String(second.value)} at step ${second.step}, because ${cause.txn} changed it in between.`,
      })
    }
  }
  return found
}

/** P3 — r1[P] ... w2[y in P] ... c2 ... r1[P], the two reads returning different sets. */
function detectPhantomRead(observations: Observations): readonly DetectedAnomaly[] {
  const found: DetectedAnomaly[] = []
  for (const first of observations.rangeReads) {
    for (const second of observations.rangeReads) {
      if (first.txn !== second.txn) continue
      if (second.rank <= first.rank) continue
      if (JSON.stringify(first.predicate) !== JSON.stringify(second.predicate)) continue
      const before = new Set(first.keys)
      const after = new Set(second.keys)
      const appeared = [...after].filter((key) => !before.has(key))
      const vanished = [...before].filter((key) => !after.has(key))
      if (appeared.length === 0 && vanished.length === 0) continue
      const cause = observations.writes.find(
        (write) =>
          write.txn !== first.txn &&
          write.rank > first.rank &&
          write.rank < second.rank &&
          (appeared.includes(write.key) || vanished.includes(write.key)),
      )
      if (!cause) continue
      found.push({
        id: 'phantom-read',
        steps: [first.step, cause.step, second.step],
        causeStep: second.step,
        transactions: [first.txn, cause.txn],
        keys: [...appeared, ...vanished],
        mechanism:
          `${first.txn} ran the same range read at steps ${first.step} and ${second.step} and the set changed` +
          `${appeared.length > 0 ? `, with key ${appeared.join(', ')} appearing` : ''}` +
          `${vanished.length > 0 ? `, with key ${vanished.join(', ')} gone` : ''}, ` +
          `because ${cause.txn} committed a ${cause.kind} at step ${cause.step}.`,
      })
    }
  }
  return found
}

/** A5A — r1[x] ... w2[x] ... w2[y] ... c2 ... r1[y]: two rows seen in states that never coexisted. */
function detectReadSkew(observations: Observations): readonly DetectedAnomaly[] {
  const found: DetectedAnomaly[] = []
  for (const staleRead of observations.reads) {
    // A write of the row this transaction read, committed after that read.
    const missed = observations.writes.filter(
      (write) =>
        write.key === staleRead.key &&
        write.txn !== staleRead.txn &&
        write.rank > staleRead.rank &&
        committed(observations, write.txn),
    )
    for (const write of missed) {
      const partner = observations.writes.find(
        (other) => other.txn === write.txn && other.key !== write.key,
      )
      if (!partner) continue
      const freshRead = observations.reads.find(
        (read) =>
          read.txn === staleRead.txn &&
          read.key === partner.key &&
          read.rank > partner.rank &&
          read.value === partner.value,
      )
      if (!freshRead) continue
      found.push({
        id: 'read-skew',
        steps: [staleRead.step, write.step, partner.step, freshRead.step],
        causeStep: freshRead.step,
        transactions: [staleRead.txn, write.txn],
        keys: [staleRead.key, partner.key],
        mechanism:
          `${staleRead.txn} read key ${staleRead.key} at step ${staleRead.step}, before ${write.txn} changed ` +
          `keys ${write.key} and ${partner.key} together, and then read key ${partner.key} at step ` +
          `${freshRead.step} after it — so the two rows it holds were never true at the same time.`,
      })
    }
  }
  return found
}

/**
 * A5B — r1[x] ... r2[y] ... w1[y] ... w2[x] ... (c1 and c2).
 *
 * Two committed transactions, each writing a row the other had already read
 * without seeing this write, and no row written by both. Nothing conflicts, so
 * no engine mechanism short of a serialization check notices — and the pair
 * violates a constraint each transaction verified on its own.
 */
function detectWriteSkew(observations: Observations): readonly DetectedAnomaly[] {
  const found: DetectedAnomaly[] = []
  const txns = observations.transactions

  for (let i = 0; i < txns.length; i += 1) {
    for (let j = i + 1; j < txns.length; j += 1) {
      const a = txns[i]
      const b = txns[j]
      if (a === undefined || b === undefined) continue
      if (!committed(observations, a) || !committed(observations, b)) continue

      const writesOf = (txn: TxnId) => observations.writes.filter((write) => write.txn === txn)
      const aWrites = writesOf(a)
      const bWrites = writesOf(b)
      if (aWrites.length === 0 || bWrites.length === 0) continue

      // A row written by both is a write-write conflict, not write skew.
      const shared = aWrites.some((write) => bWrites.some((other) => other.key === write.key))
      if (shared) continue

      const antidependency = (writes: readonly WriteObservation[], reader: TxnId) =>
        writes.find((write) => keysObservedBefore(observations, reader, write.key, write.rank).length > 0)

      const aWroteWhatBRead = antidependency(aWrites, b)
      const bWroteWhatARead = antidependency(bWrites, a)
      if (!aWroteWhatBRead || !bWroteWhatARead) continue

      const causeStep = Math.max(aWroteWhatBRead.step, bWroteWhatARead.step)
      const firstWrite =
        aWroteWhatBRead.rank < bWroteWhatARead.rank ? aWroteWhatBRead : bWroteWhatARead
      const secondWrite =
        aWroteWhatBRead.rank < bWroteWhatARead.rank ? bWroteWhatARead : aWroteWhatBRead

      found.push({
        id: 'write-skew',
        steps: [firstWrite.step, secondWrite.step],
        causeStep,
        transactions: [a, b],
        keys: [aWroteWhatBRead.key, bWroteWhatARead.key],
        mechanism:
          `${firstWrite.txn} wrote key ${firstWrite.key} at step ${firstWrite.step} and ${secondWrite.txn} ` +
          `wrote key ${secondWrite.key} at step ${secondWrite.step}. Each had already read the row the other ` +
          `wrote, neither saw the other's write, and no row was written twice — so nothing conflicted and ` +
          `both committed.`,
      })
    }
  }
  return found
}
