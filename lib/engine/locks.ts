import type { Key, TxnId } from '@/lib/schedule'
import type { Lock, LockMode, LockResource } from './trace'

/**
 * The lock manager. No engine name appears here: packs decide *which* locks an
 * operation takes and for how long, and this decides whether a request can be
 * granted.
 *
 * Two kinds of resource. A record lock is on a row that exists in the index. A
 * gap lock is on a span between index records, and it exists to stop an insert
 * appearing where a reader has already looked — which is the only way a
 * lock-based engine can prevent a phantom, because there is no row to lock.
 *
 * The conflict rules follow InnoDB's matrix, which is the one every gap-locking
 * engine's documentation is written against: gap locks do not conflict with
 * each other or with record locks, and an insert intention lock is the one
 * thing they do conflict with.
 */

export type LockRequest = {
  readonly resource: LockResource
  readonly mode: LockMode
}

function rangesOverlap(a: { from: Key; to: Key }, b: { from: Key; to: Key }): boolean {
  return a.from <= b.to && b.from <= a.to
}

function asRange(resource: LockResource): { from: Key; to: Key } {
  return resource.type === 'record'
    ? { from: resource.key, to: resource.key }
    : { from: resource.from, to: resource.to }
}

export function conflicts(request: LockRequest, held: Lock): boolean {
  const requestIsGapKind = request.mode === 'gap' || request.mode === 'insertIntention'
  const heldIsGapKind = held.mode === 'gap' || held.mode === 'insertIntention'

  if (!requestIsGapKind && !heldIsGapKind) {
    // Record against record: shared coexists with shared, exclusive with nothing.
    if (request.resource.type !== 'record' || held.resource.type !== 'record') return false
    if (request.resource.key !== held.resource.key) return false
    return request.mode === 'exclusive' || held.mode === 'exclusive'
  }

  if (requestIsGapKind !== heldIsGapKind) {
    // A gap-kind lock and a record lock never conflict: one is about a span
    // where no row is, the other about a row that is there.
    return false
  }

  // Gap against gap: only an insert intention meeting a reserved gap conflicts.
  const oneWay = request.mode === 'insertIntention' && held.mode === 'gap'
  const otherWay = request.mode === 'gap' && held.mode === 'insertIntention'
  if (!oneWay && !otherWay) return false
  return rangesOverlap(asRange(request.resource), asRange(held.resource))
}

/** Transactions that would have to finish first, in the order they took their locks. */
export function blockers(locks: readonly Lock[], requester: TxnId, request: LockRequest): readonly TxnId[] {
  const waitingFor: TxnId[] = []
  for (const held of locks) {
    if (held.holder === requester) continue
    if (!conflicts(request, held)) continue
    if (!waitingFor.includes(held.holder)) waitingFor.push(held.holder)
  }
  return waitingFor
}

export function grant(
  locks: Lock[],
  holder: TxnId,
  request: LockRequest,
  duration: 'statement' | 'transaction',
  step: number,
): void {
  const already = locks.some(
    (lock) =>
      lock.holder === holder &&
      lock.mode === request.mode &&
      sameResource(lock.resource, request.resource),
  )
  if (already) return
  locks.push({ holder, resource: request.resource, mode: request.mode, duration, acquiredAtStep: step })
}

function sameResource(a: LockResource, b: LockResource): boolean {
  if (a.type === 'record' && b.type === 'record') return a.key === b.key
  if (a.type === 'gap' && b.type === 'gap') return a.from === b.from && a.to === b.to
  return false
}

/** Statement-duration locks are gone as soon as the statement finishes. */
export function releaseStatementLocks(locks: Lock[], holder: TxnId): Lock[] {
  return locks.filter((lock) => !(lock.holder === holder && lock.duration === 'statement'))
}

/**
 * Every lock a transaction holds is released when it ends. Asserted in every
 * test: a trace with a lock outliving its transaction is not well-formed.
 */
export function releaseTransactionLocks(locks: Lock[], holder: TxnId): Lock[] {
  return locks.filter((lock) => lock.holder !== holder)
}
