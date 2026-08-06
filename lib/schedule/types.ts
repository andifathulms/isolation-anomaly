/**
 * The schedule model — PRD §4.
 *
 * The operation vocabulary is fixed and small on purpose. This is not a SQL
 * parser: it is the smallest set that can express every anomaly in scope,
 * including the predicate reads and inserts that phantoms require.
 *
 * Keys are integers so that a predicate read is a range over a primary-key
 * index. That is not a simplification for its own sake — MySQL InnoDB's gap
 * and next-key locks are taken on index ranges, and a model whose keys had no
 * order could not represent them.
 */

/** A transaction label as it appears in the score: `T1`, `T2`, `T3`. */
export type TxnId = string

/** Primary key of the single modelled table, `items(k int primary key, v int)`. */
export type Key = number

/** The one modelled column. Integers keep constraints checkable and SQL exact. */
export type Value = number

/**
 * A predicate read. Only closed key ranges are modelled; anything else is
 * refused rather than approximated (CLAUDE.md invariant 6).
 */
export type Predicate = {
  readonly type: 'keyRange'
  readonly from: Key
  readonly to: Key
}

export type Operation =
  | { readonly type: 'begin' }
  | { readonly type: 'read'; readonly key: Key }
  | { readonly type: 'write'; readonly key: Key; readonly value: Value }
  | { readonly type: 'readRange'; readonly predicate: Predicate }
  | { readonly type: 'insert'; readonly key: Key; readonly value: Value }
  | { readonly type: 'delete'; readonly key: Key }
  | { readonly type: 'selectForUpdate'; readonly key: Key }
  | { readonly type: 'commit' }
  | { readonly type: 'rollback' }

export type OperationType = Operation['type']

/** One position in the schedule: a transaction performs one operation. */
export type ScheduleStep = {
  readonly txn: TxnId
  readonly op: Operation
}

/** A row present before the schedule runs. */
export type InitialRow = {
  readonly key: Key
  readonly value: Value
}

export type Schedule = {
  readonly id: string
  readonly title: string
  /** Declared up front so the score has a stave per transaction from step 0. */
  readonly transactions: readonly TxnId[]
  readonly initial: readonly InitialRow[]
  readonly steps: readonly ScheduleStep[]
}

/** True for operations that observe data, and so can observe an anomaly. */
export function isReadOperation(op: Operation): boolean {
  switch (op.type) {
    case 'read':
    case 'readRange':
    case 'selectForUpdate':
      return true
    case 'begin':
    case 'write':
    case 'insert':
    case 'delete':
    case 'commit':
    case 'rollback':
      return false
    default: {
      const exhaustive: never = op
      return exhaustive
    }
  }
}

/** True for operations that create a new version of a row. */
export function isWriteOperation(op: Operation): boolean {
  switch (op.type) {
    case 'write':
    case 'insert':
    case 'delete':
      return true
    case 'begin':
    case 'read':
    case 'readRange':
    case 'selectForUpdate':
    case 'commit':
    case 'rollback':
      return false
    default: {
      const exhaustive: never = op
      return exhaustive
    }
  }
}

/** The single key an operation touches, or null for range and control ops. */
export function operationKey(op: Operation): Key | null {
  switch (op.type) {
    case 'read':
    case 'write':
    case 'insert':
    case 'delete':
    case 'selectForUpdate':
      return op.key
    case 'readRange':
    case 'begin':
    case 'commit':
    case 'rollback':
      return null
    default: {
      const exhaustive: never = op
      return exhaustive
    }
  }
}

export function predicateContains(predicate: Predicate, key: Key): boolean {
  switch (predicate.type) {
    case 'keyRange':
      return key >= predicate.from && key <= predicate.to
    default: {
      const exhaustive: never = predicate.type
      return exhaustive
    }
  }
}

/** Operations that end a transaction. Nothing may follow one on that stave. */
export function isTerminalOperation(op: Operation): boolean {
  return op.type === 'commit' || op.type === 'rollback'
}
