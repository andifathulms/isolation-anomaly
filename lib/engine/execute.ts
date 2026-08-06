import {
  predicateContains,
  notate,
  type IsolationLevel,
  type Key,
  type Operation,
  type Predicate,
  type Schedule,
  type TxnId,
} from '@/lib/schedule'
import { resolveLevel } from '@/lib/packs/load'
import type { EnginePack, EngineErrorShape, LockPlan } from '@/lib/packs/types'
import {
  BOOTSTRAP_XID,
  appendVersion,
  committedRows,
  createStore,
  newestVersion,
  toChains,
  visibleKeys,
  visibleValue,
  type View,
} from './mvcc'
import { blockers, grant, releaseStatementLocks, releaseTransactionLocks } from './locks'
import type { Refusal } from './refuse'
import type {
  AbortCause,
  ExecutionResult,
  ExecutionTrace,
  Lock,
  ReadResult,
  RowVersion,
  RwEdge,
  SnapshotInfo,
  StepOutcome,
  TraceStep,
  TransactionResult,
  TransactionStatus,
  WaitState,
  WorldState,
  Xid,
} from './trace'
import type { LockRequest } from './locks'

/**
 * THE ONE EXECUTOR — CLAUDE.md invariant 2.
 *
 * `(schedule, pack, level) → ExecutionTrace`, pure and deterministic: no clock,
 * no randomness, no DOM, no module-level mutable state. There is no branch on
 * engine identity anywhere in this file; every difference between PostgreSQL,
 * MySQL and SQL Server is a value read out of the pack. That is the only reason
 * the comparison matrix means anything — it compares semantics, not two
 * implementations of a simulator.
 *
 * Blocking is modelled the way the oracle harness records it: a statement that
 * cannot get its lock stays pending, the schedule moves on, and the pending
 * statement completes at the step that releases the lock. A simulator that
 * produced the right values by never waiting would not be modelling the engine.
 */

type Runtime = {
  readonly txn: TxnId
  readonly xid: Xid
  status: TransactionStatus
  beganAtStep: number | null
  endedAtStep: number | null
  snapshot: SnapshotInfo | null
  /** Committed transactions frozen into a transaction-scoped snapshot. */
  snapshotCommitted: ReadonlySet<Xid> | null
  pending: { readonly stepIndex: number; readonly op: Operation; waitingFor: readonly TxnId[] } | null
  error: { code: string; message: string; cause: AbortCause } | null
  /** Single-key reads, for the serialization check and the conflict graph. */
  readonly readKeys: Set<Key>
  readonly readPredicates: Predicate[]
}

type Attempt =
  | StepOutcome
  | { readonly type: 'wait'; readonly waitingFor: readonly TxnId[]; readonly resource: LockRequest['resource'] }

export function execute(
  schedule: Schedule,
  pack: EnginePack,
  level: IsolationLevel,
): ExecutionResult {
  const resolved = resolveLevel(pack, level)
  if (!resolved) {
    const entry = pack.levels[level]
    const refusal: Refusal = {
      type: 'unsupportedLevel',
      packId: pack.id,
      level,
      gap: entry.summary,
      citation: entry.kind === 'modelled' ? pack.errors.serializationFailure.citation : entry.citation,
    }
    return { type: 'refused', refusal }
  }

  const semantics = resolved.semantics
  const store = createStore(schedule.initial)
  let locks: Lock[] = []
  const rwEdges: RwEdge[] = []

  const runtimes = new Map<TxnId, Runtime>()
  schedule.transactions.forEach((txn, index) => {
    runtimes.set(txn, {
      txn,
      xid: index + 1,
      status: 'notStarted',
      beganAtStep: null,
      endedAtStep: null,
      snapshot: null,
      snapshotCommitted: null,
      pending: null,
      error: null,
      readKeys: new Set<Key>(),
      readPredicates: [],
    })
  })

  const outcomes = new Map<number, StepOutcome>()
  const blockedUntil = new Map<number, number>()
  const waitResource = new Map<number, WaitState['resource']>()
  const states: WorldState[] = []

  /**
   * Single statements the engine ran outside any transaction after rolling one
   * back. They are committed the moment they run, so every reader sees them.
   */
  const autocommitted = new Set<Xid>()
  let nextAutocommitXid = 1000

  const committedXids = (): ReadonlySet<Xid> => {
    const set = new Set<Xid>(autocommitted)
    for (const runtime of runtimes.values()) {
      if (runtime.status === 'committed') set.add(runtime.xid)
    }
    return set
  }

  const abortedXids = (): ReadonlySet<Xid> => {
    const set = new Set<Xid>()
    for (const runtime of runtimes.values()) {
      if (runtime.status === 'aborted') set.add(runtime.xid)
    }
    return set
  }

  const runningXids = (): readonly Xid[] =>
    [...runtimes.values()].filter((runtime) => runtime.status === 'running').map((runtime) => runtime.xid)

  const takeSnapshot = (runtime: Runtime, step: number): SnapshotInfo => {
    const committed = committedXids()
    const snapshot: SnapshotInfo = {
      txn: runtime.txn,
      takenAtStep: step,
      scope: semantics.visibility.value.snapshot,
      visibleXids: [...committed].sort((a, b) => a - b),
      inProgressXids: runningXids()
        .filter((xid) => xid !== runtime.xid)
        .sort((a, b) => a - b),
    }
    runtime.snapshot = snapshot
    return snapshot
  }

  /**
   * The set of transactions whose commits a reader can see. A
   * transaction-scoped snapshot is taken at the transaction's first data
   * statement — which is when the engine takes it — and frozen from then on.
   */
  const snapshotCommitted = (runtime: Runtime, step: number): ReadonlySet<Xid> => {
    if (semantics.visibility.value.snapshot === 'transaction') {
      if (!runtime.snapshotCommitted) {
        takeSnapshot(runtime, step)
        runtime.snapshotCommitted = committedXids()
      }
      return runtime.snapshotCommitted
    }
    takeSnapshot(runtime, step)
    return committedXids()
  }

  const viewFor = (runtime: Runtime, step: number): View => ({
    self: runtime.xid,
    committed: snapshotCommitted(runtime, step),
    readsUncommitted: semantics.visibility.value.readsUncommitted,
    aborted: abortedXids(),
  })

  /** The newest version of a key whose creator has committed, tombstone included. */
  const newestCommitted = (key: Key, runtime: Runtime): RowVersion | null => {
    const chain = store.chains.get(key)
    if (!chain) return null
    const committed = committedXids()
    for (let index = chain.length - 1; index >= 0; index -= 1) {
      const version = chain[index]
      if (!version) continue
      if (version.xmin === BOOTSTRAP_XID || version.xmin === runtime.xid || committed.has(version.xmin)) {
        return version
      }
    }
    return null
  }

  /**
   * A row is stale for this transaction when its newest committed version was
   * created by a transaction the reader's snapshot cannot see. That is the
   * condition PostgreSQL turns into 40001 at REPEATABLE READ and re-applies at
   * READ COMMITTED — one rule, two pack values.
   */
  const isStale = (version: RowVersion | null, runtime: Runtime, step: number): boolean => {
    if (!version) return false
    if (version.xmin === BOOTSTRAP_XID || version.xmin === runtime.xid) return false
    return !snapshotCommitted(runtime, step).has(version.xmin)
  }

  const requestsFor = (plan: LockPlan, resource: { key: Key } | Predicate): readonly LockRequest[] => {
    const requests: LockRequest[] = []
    if ('key' in resource) {
      if (plan.record !== 'none') {
        requests.push({ resource: { type: 'record', key: resource.key }, mode: plan.record })
      }
      if (plan.gap !== 'none') {
        requests.push({
          resource: { type: 'gap', from: resource.key, to: resource.key },
          mode: plan.gap,
        })
      }
      return requests
    }
    if (plan.record !== 'none') {
      for (const key of [...store.chains.keys()].sort((a, b) => a - b)) {
        if (predicateContains(resource, key)) {
          requests.push({ resource: { type: 'record', key }, mode: plan.record })
        }
      }
    }
    if (plan.gap !== 'none') {
      requests.push({ resource: { type: 'gap', from: resource.from, to: resource.to }, mode: plan.gap })
    }
    return requests
  }

  /** Acquires every lock the plan asks for, or reports who to wait for. */
  const acquire = (
    runtime: Runtime,
    plan: LockPlan,
    resource: { key: Key } | Predicate,
    step: number,
  ): { readonly type: 'granted' } | { readonly type: 'wait'; readonly waitingFor: readonly TxnId[]; readonly resource: LockRequest['resource'] } => {
    const requests = requestsFor(plan, resource)
    for (const request of requests) {
      const waitingFor = blockers(locks, runtime.txn, request)
      if (waitingFor.length > 0) return { type: 'wait', waitingFor, resource: request.resource }
    }
    for (const request of requests) grant(locks, runtime.txn, request, plan.duration, step)
    return { type: 'granted' }
  }

  const abort = (runtime: Runtime, step: number, shape: EngineErrorShape, cause: AbortCause): StepOutcome => {
    runtime.status = 'aborted'
    runtime.endedAtStep = step
    runtime.error = { code: shape.code, message: shape.message, cause }
    locks = releaseTransactionLocks(locks, runtime.txn)
    return { type: 'error', code: shape.code, message: shape.message, cause }
  }

  /** Records read/write antidependencies created by a write to `key`. */
  const recordAntidependencies = (writer: Runtime, key: Key, step: number): void => {
    for (const reader of runtimes.values()) {
      if (reader.txn === writer.txn) continue
      if (reader.status === 'notStarted') continue
      const overlaps = reader.endedAtStep === null || reader.endedAtStep >= (writer.beganAtStep ?? 0)
      if (!overlaps) continue
      const readTheRow =
        reader.readKeys.has(key) ||
        reader.readPredicates.some((predicate) => predicateContains(predicate, key))
      if (!readTheRow) continue
      const already = rwEdges.some((edge) => edge.from === reader.txn && edge.to === writer.txn && edge.key === key)
      if (!already) rwEdges.push({ from: reader.txn, to: writer.txn, key, atStep: step })
    }
  }

  /**
   * The serialization check. A transaction is a pivot when something read what
   * it wrote and it read what something else wrote — two antidependencies in
   * sequence. PostgreSQL aborts the pivot when its outgoing conflict committed
   * first, which is why in write skew the *second* transaction to commit is the
   * one that fails.
   */
  const dangerousStructure = (runtime: Runtime): boolean => {
    if (semantics.serializationCheck.value !== 'ssi') return false
    const hasIncoming = rwEdges.some((edge) => edge.to === runtime.txn && edge.from !== runtime.txn)
    if (!hasIncoming) return false
    return rwEdges.some(
      (edge) => edge.from === runtime.txn && runtimes.get(edge.to)?.status === 'committed',
    )
  }

  /**
   * Runs one statement as its own transaction, immediately committed.
   *
   * This is what a session does on an engine that keeps accepting statements
   * after it rolled the transaction back: there is no transaction any more, so
   * each statement stands alone and lands in the table on its own. An
   * application whose error handler swallowed the failure goes on writing.
   */
  const autocommit = (runtime: Runtime, op: Operation, step: number): Attempt => {
    const xid = nextAutocommitXid
    nextAutocommitXid += 1
    autocommitted.add(xid)
    const view: View = {
      self: xid,
      committed: committedXids(),
      readsUncommitted: semantics.visibility.value.readsUncommitted,
      aborted: abortedXids(),
    }

    switch (op.type) {
      case 'read':
      case 'selectForUpdate':
        return { type: 'ok', read: { type: 'row', value: visibleValue(store, op.key, view) }, rowsAffected: null }
      case 'readRange': {
        const rows = visibleKeys(store, view)
          .filter((key) => predicateContains(op.predicate, key))
          .map((key) => ({ key, value: visibleValue(store, key, view) as number }))
        return { type: 'ok', read: { type: 'rows', rows }, rowsAffected: null }
      }
      case 'write':
      case 'delete': {
        const live = visibleValue(store, op.key, view) !== null
        if (!live) return { type: 'ok', read: null, rowsAffected: 0 }
        appendVersion(store, op.key, op.type === 'write' ? op.value : null, xid, step)
        recordAntidependencies(runtime, op.key, step)
        return { type: 'ok', read: null, rowsAffected: 1 }
      }
      case 'insert': {
        appendVersion(store, op.key, op.value, xid, step)
        recordAntidependencies(runtime, op.key, step)
        return { type: 'ok', read: null, rowsAffected: 1 }
      }
      default:
        return { type: 'ok', read: null, rowsAffected: null }
    }
  }

  const attempt = (txn: TxnId, op: Operation, step: number): Attempt => {
    const runtime = runtimes.get(txn)
    if (!runtime) {
      return {
        type: 'refused',
        refusal: { type: 'sessionBusy', txn, waitingSince: step, gap: `${txn} is not declared.` },
      }
    }

    if (op.type === 'begin') {
      runtime.status = 'running'
      runtime.beganAtStep = step
      return { type: 'ok', read: null, rowsAffected: null }
    }

    // Once the engine has failed a transaction, what happens to the statements
    // that follow is the engine's business, and the engines disagree.
    if (runtime.status === 'aborted' && op.type !== 'commit' && op.type !== 'rollback') {
      if ((pack.afterAbort?.value ?? 'rejectStatements') === 'autocommitStatements') {
        return autocommit(runtime, op, step)
      }
      const shape = pack.errors.abortedTransaction
      if (!shape) {
        return {
          type: 'refused',
          refusal: {
            type: 'unmodelledOperation',
            packId: pack.id,
            operation: op.type,
            gap: `${pack.engine}'s behaviour for a statement sent to an already-failed transaction is not declared in the pack.`,
          },
        }
      }
      return { type: 'error', code: shape.code, message: shape.message, cause: 'transactionAlreadyAborted' }
    }

    // The snapshot belongs to the moment the statement started, not to the
    // moment its lock was granted. A statement that waits still sees the state
    // it began from — which is precisely why a locking read that waited for
    // another transaction can then fail with a serialization error instead of
    // quietly returning the newer row.
    if (op.type !== 'commit' && op.type !== 'rollback') snapshotCommitted(runtime, step)

    switch (op.type) {
      case 'read': {
        const acquired = acquire(runtime, semantics.locks.plainRead.value, { key: op.key }, step)
        if (acquired.type === 'wait') return acquired
        runtime.readKeys.add(op.key)

        // Where the engine turns a plain SELECT into a locking read, it reads
        // the freshest committed row rather than the transaction's snapshot.
        if (semantics.visibility.value.plainReadsAreLocking) {
          const newest = newestCommitted(op.key, runtime)
          if (isStale(newest, runtime, step) && semantics.conflicts.value.lockingReadOnStaleRow === 'abort') {
            return abort(runtime, step, pack.errors.serializationFailure, 'staleLockingRead')
          }
          locks = releaseStatementLocks(locks, runtime.txn)
          return { type: 'ok', read: { type: 'row', value: newest?.value ?? null }, rowsAffected: null }
        }

        const value = visibleValue(store, op.key, viewFor(runtime, step))
        locks = releaseStatementLocks(locks, runtime.txn)
        return { type: 'ok', read: { type: 'row', value }, rowsAffected: null }
      }

      case 'readRange': {
        if (op.predicate.type !== 'keyRange') {
          return {
            type: 'refused',
            refusal: {
              type: 'unmodelledPredicate',
              packId: pack.id,
              gap: 'Only closed key ranges are modelled as predicates.',
            },
          }
        }
        const acquired = acquire(runtime, semantics.locks.plainRead.value, op.predicate, step)
        if (acquired.type === 'wait') return acquired
        const view = semantics.visibility.value.plainReadsAreLocking
          ? { self: runtime.xid, committed: committedXids(), readsUncommitted: false, aborted: abortedXids() }
          : viewFor(runtime, step)
        const rows = visibleKeys(store, view)
          .filter((key) => predicateContains(op.predicate, key))
          .map((key) => ({ key, value: visibleValue(store, key, view) as number }))
        runtime.readPredicates.push(op.predicate)
        locks = releaseStatementLocks(locks, runtime.txn)
        return { type: 'ok', read: { type: 'rows', rows }, rowsAffected: null }
      }

      case 'selectForUpdate': {
        const acquired = acquire(runtime, semantics.locks.lockingRead.value, { key: op.key }, step)
        if (acquired.type === 'wait') return acquired
        runtime.readKeys.add(op.key)
        const newest = newestCommitted(op.key, runtime)
        if (semantics.visibility.value.lockingReadsSeeLatestCommitted) {
          if (isStale(newest, runtime, step) && semantics.conflicts.value.lockingReadOnStaleRow === 'abort') {
            return abort(runtime, step, pack.errors.serializationFailure, 'staleLockingRead')
          }
          return {
            type: 'ok',
            read: { type: 'row', value: newest?.value ?? null },
            rowsAffected: null,
          }
        }
        return {
          type: 'ok',
          read: { type: 'row', value: visibleValue(store, op.key, viewFor(runtime, step)) },
          rowsAffected: null,
        }
      }

      case 'write':
      case 'delete': {
        const acquired = acquire(runtime, semantics.locks.write.value, { key: op.key }, step)
        if (acquired.type === 'wait') return acquired
        const newest = newestCommitted(op.key, runtime)
        if (isStale(newest, runtime, step) && semantics.conflicts.value.writeOnStaleRow === 'abort') {
          return abort(runtime, step, pack.errors.serializationFailure, 'staleWrite')
        }
        const live = newest !== null && newest.value !== null
        if (!live) {
          // Nothing to update: the engine reports zero rows rather than failing.
          locks = releaseStatementLocks(locks, runtime.txn)
          return { type: 'ok', read: null, rowsAffected: 0 }
        }
        appendVersion(store, op.key, op.type === 'write' ? op.value : null, runtime.xid, step)
        recordAntidependencies(runtime, op.key, step)
        locks = releaseStatementLocks(locks, runtime.txn)
        return { type: 'ok', read: null, rowsAffected: 1 }
      }

      case 'insert': {
        const acquired = acquire(runtime, semantics.locks.insert.value, { key: op.key }, step)
        if (acquired.type === 'wait') return acquired
        const newest = newestVersion(store, op.key)
        if (newest && newest.value !== null && newest.xmax === null) {
          return {
            type: 'refused',
            refusal: {
              type: 'unmodelledOperation',
              packId: pack.id,
              operation: 'insert',
              gap: `Key ${op.key} already exists, and ${pack.engine}'s duplicate-key behaviour is not modelled.`,
            },
          }
        }
        appendVersion(store, op.key, op.value, runtime.xid, step)
        recordAntidependencies(runtime, op.key, step)
        locks = releaseStatementLocks(locks, runtime.txn)
        return { type: 'ok', read: null, rowsAffected: 1 }
      }

      case 'commit': {
        if (runtime.status === 'aborted') {
          // Engines differ on what COMMIT means here. PostgreSQL and MySQL
          // accept it and commit nothing; SQL Server rolled the transaction back
          // when it failed, so there is no transaction left to commit.
          const shape = pack.errors.commitAfterAbort
          if (shape) {
            return {
              type: 'error',
              code: shape.code,
              message: shape.message,
              cause: 'transactionAlreadyAborted',
            }
          }
          return { type: 'ok', read: null, rowsAffected: null }
        }
        if (dangerousStructure(runtime)) {
          const shape = pack.errors.readWriteDependencies ?? pack.errors.serializationFailure
          return abort(runtime, step, shape, 'readWriteDependencies')
        }
        runtime.status = 'committed'
        runtime.endedAtStep = step
        locks = releaseTransactionLocks(locks, runtime.txn)
        return { type: 'ok', read: null, rowsAffected: null }
      }

      case 'rollback': {
        runtime.status = 'aborted'
        runtime.endedAtStep = step
        locks = releaseTransactionLocks(locks, runtime.txn)
        return { type: 'ok', read: null, rowsAffected: null }
      }

      default: {
        const exhaustive: never = op
        return exhaustive
      }
    }
  }

  /**
   * Breaks one deadlock, if the waiting statements form a cycle.
   *
   * Every engine modelled here documents that it detects deadlocks and rolls
   * back a transaction to break them, and none promises *which*. So the choice
   * is a declared pack rule rather than a guess baked in here: PostgreSQL and
   * InnoDB roll back the transaction whose wait closed the cycle, SQL Server the
   * one that had been waiting longest. Both were read off the recordings, and
   * every shipped schedule checks the victim against the real engine.
   *
   * Returns true when a victim was rolled back, so the caller can retry the
   * statements the released locks may have freed.
   */
  let unmodelledDeadlock: Refusal | null = null

  const breakDeadlock = (step: number): boolean => {
    const waiters = schedule.transactions
      .map((txn) => runtimes.get(txn))
      .filter((runtime): runtime is Runtime & { pending: NonNullable<Runtime['pending']> } =>
        runtime !== undefined && runtime.pending !== null,
      )
    if (waiters.length < 2) return false

    const waitingFor = new Map<TxnId, readonly TxnId[]>()
    for (const waiter of waiters) waitingFor.set(waiter.txn, waiter.pending.waitingFor)

    // Any transaction reachable from itself through waits is deadlocked.
    const cycle = (from: TxnId): readonly TxnId[] | null => {
      const path: TxnId[] = []
      const seen = new Set<TxnId>()
      let current: TxnId | undefined = from
      while (current !== undefined) {
        if (seen.has(current)) return path.slice(path.indexOf(current))
        seen.add(current)
        path.push(current)
        current = (waitingFor.get(current) ?? []).find((next) => waitingFor.has(next))
      }
      return null
    }

    for (const waiter of waiters) {
      const found = cycle(waiter.txn)
      if (!found || found.length < 2) continue
      const inCycle = found
        .map((txn) => runtimes.get(txn))
        .filter((runtime): runtime is Runtime & { pending: NonNullable<Runtime['pending']> } =>
          runtime !== undefined && runtime.pending !== null,
        )
      const victimRule = pack.deadlockVictim?.value ?? 'lastWaiter'
      if (victimRule === 'unmodelled') {
        // Which transaction loses decides the outcome, and this engine's choice
        // cannot be reproduced. Half of this run would be invention.
        unmodelledDeadlock = {
          type: 'unmodelledDeadlock',
          packId: pack.id,
          txns: found,
          gap:
            `${found.join(' and ')} deadlock here. ${pack.engine} chooses which one to roll back by its own ` +
            `cost estimate, and that choice decides what the other transaction reads and whether it commits — ` +
            `so this model will not guess it.`,
          citation: pack.deadlockVictim?.citation ?? pack.errors.serializationFailure.citation,
        }
        return false
      }
      const takeLastWaiter = victimRule === 'lastWaiter'
      const deadlocked = inCycle.reduce((chosen, candidate) =>
        takeLastWaiter
          ? candidate.pending.stepIndex > chosen.pending.stepIndex
            ? candidate
            : chosen
          : candidate.pending.stepIndex < chosen.pending.stepIndex
            ? candidate
            : chosen,
      )
      const pendingStep = deadlocked.pending.stepIndex
      const pendingOp = deadlocked.pending.op
      const victim: Runtime = deadlocked
      const shape = pack.errors.deadlock
      if (!shape) {
        outcomes.set(pendingStep, {
          type: 'refused',
          refusal: {
            type: 'unmodelledOperation',
            packId: pack.id,
            operation: pendingOp.type,
            gap: `These statements deadlock, and ${pack.engine}'s deadlock behaviour is not declared in the pack.`,
          },
        })
      } else {
        outcomes.set(pendingStep, {
          type: 'error',
          code: shape.code,
          message: shape.message,
          cause: 'deadlock',
        })
        victim.status = 'aborted'
        victim.endedAtStep = step
        victim.error = { code: shape.code, message: shape.message, cause: 'deadlock' }
        locks = releaseTransactionLocks(locks, victim.txn)
      }
      // Deadlock detection is immediate, so a statement that deadlocked in the
      // step that issued it never waited across a step boundary.
      if (pendingStep !== step) blockedUntil.set(pendingStep, step)
      victim.pending = null
      return true
    }

    return false
  }

  const captureState = (): WorldState => ({
    chains: toChains(store),
    locks: [...locks],
    transactions: [...runtimes.values()].map((runtime) => ({
      txn: runtime.txn,
      xid: runtime.xid,
      status: runtime.status,
      beganAtStep: runtime.beganAtStep,
      endedAtStep: runtime.endedAtStep,
      snapshot: runtime.snapshot,
    })),
    waits: [...runtimes.values()]
      .filter((runtime): runtime is Runtime & { pending: NonNullable<Runtime['pending']> } => runtime.pending !== null)
      .map((runtime) => ({
        txn: runtime.txn,
        stepIndex: runtime.pending.stepIndex,
        waitingFor: runtime.pending.waitingFor,
        resource: waitResource.get(runtime.pending.stepIndex) ?? { type: 'record', key: 0 },
      })),
    committedRows: committedRows(store, committedXids()),
  })

  schedule.steps.forEach((step, index) => {
    const runtime = runtimes.get(step.txn)

    if (runtime?.pending) {
      outcomes.set(index, {
        type: 'refused',
        refusal: {
          type: 'sessionBusy',
          txn: step.txn,
          waitingSince: runtime.pending.stepIndex,
          gap: `${step.txn} cannot accept another statement while its statement from step ${runtime.pending.stepIndex} is waiting.`,
        },
      })
    } else {
      const result = attempt(step.txn, step.op, index)
      if (result.type === 'wait' && runtime) {
        runtime.pending = { stepIndex: index, op: step.op, waitingFor: result.waitingFor }
        waitResource.set(index, result.resource)
      } else if (result.type !== 'wait') {
        outcomes.set(index, result)
      }
    }

    // This step may have released a lock a waiting statement needed. Retry to a
    // fixpoint, because one statement completing can release the next, then
    // break any deadlock the new waits created and retry again.
    const drainWaiters = () => {
      let progressed = true
      while (progressed) {
        progressed = false
        for (const txn of schedule.transactions) {
          const waiting = runtimes.get(txn)
          if (!waiting?.pending) continue
          const pending = waiting.pending
          const retry = attempt(txn, pending.op, pending.stepIndex)
          if (retry.type === 'wait') {
            waiting.pending = { ...pending, waitingFor: retry.waitingFor }
            waitResource.set(pending.stepIndex, retry.resource)
            continue
          }
          outcomes.set(pending.stepIndex, retry)
          if (pending.stepIndex !== index) blockedUntil.set(pending.stepIndex, index)
          waiting.pending = null
          progressed = true
        }
      }
    }

    drainWaiters()
    while (breakDeadlock(index)) drainWaiters()

    states[index] = captureState()
  })

  // Anything still waiting when the schedule ends never got its lock.
  for (const runtime of runtimes.values()) {
    if (!runtime.pending) continue
    outcomes.set(runtime.pending.stepIndex, {
      type: 'blocked',
      waitingFor: runtime.pending.waitingFor,
    })
    runtime.pending = null
  }

  if (unmodelledDeadlock !== null) return { type: 'refused', refusal: unmodelledDeadlock }

  const steps: readonly TraceStep[] = schedule.steps.map((step, index) => {
    const outcome = outcomes.get(index)
    if (!outcome) throw new Error(`Executor produced no outcome for step ${index}`)
    const state = states[index]
    if (!state) throw new Error(`Executor produced no state for step ${index}`)
    const blocked = blockedUntil.get(index) ?? null
    return {
      index,
      txn: step.txn,
      op: step.op,
      notation: notate(step.op, schedule.transactions.indexOf(step.txn)),
      outcome,
      blockedUntilStep: blocked,
      state,
      note: noteFor(outcome, blocked, step.txn),
    }
  })

  const transactions: readonly TransactionResult[] = [...runtimes.values()].map((runtime) => ({
    txn: runtime.txn,
    xid: runtime.xid,
    outcome:
      runtime.status === 'committed' ? 'committed' : runtime.status === 'aborted' ? 'aborted' : 'open',
    abortedAtStep: runtime.status === 'aborted' ? runtime.endedAtStep : null,
    error: runtime.error,
  }))

  const trace: ExecutionTrace = {
    scheduleId: schedule.id,
    packId: pack.id,
    engine: pack.engine,
    engineVersion: pack.version,
    level,
    effectiveLevel: resolved.effective,
    aliasOf: resolved.aliasOf,
    steps,
    transactions,
    finalState: committedRows(store, committedXids()),
    rwEdges,
  }

  return { type: 'trace', trace }
}

/** One sentence, generated from the trace rather than written — PRD §5.3. */
function noteFor(outcome: StepOutcome, blockedUntil: number | null, txn: TxnId): string | null {
  const waited =
    blockedUntil === null ? '' : `${txn} waited, and its statement completed at step ${blockedUntil}. `

  switch (outcome.type) {
    case 'ok':
      return waited === '' ? null : waited.trim()
    case 'error':
      switch (outcome.cause) {
        case 'staleWrite':
          return `${waited}The row had been changed and committed by another transaction after this transaction's snapshot, so the write could not be applied: ${outcome.code} ${outcome.message}.`
        case 'staleLockingRead':
          return `${waited}The locking read found a row committed by another transaction after this transaction's snapshot: ${outcome.code} ${outcome.message}.`
        case 'readWriteDependencies':
          return `${waited}The serialization check found this transaction between two read/write dependencies, so no serial order produces this outcome: ${outcome.code} ${outcome.message}.`
        case 'deadlock':
          return `${waited}This statement and another were each waiting for a lock the other held, so the engine broke the deadlock by rolling this transaction back: ${outcome.code} ${outcome.message}.`
        case 'transactionAlreadyAborted':
          return `${waited}The engine had already failed this transaction, so the statement was ignored: ${outcome.code}.`
        default: {
          const exhaustive: never = outcome.cause
          return exhaustive
        }
      }
    case 'blocked':
      return `Still waiting for ${outcome.waitingFor.join(', ')} when the schedule ended.`
    case 'refused':
      return outcome.refusal.gap
    default: {
      const exhaustive: never = outcome
      return exhaustive
    }
  }
}

export type { ReadResult }
