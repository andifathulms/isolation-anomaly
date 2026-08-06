import type { IsolationLevel, InitialRow, Key, Operation, TxnId, Value } from '@/lib/schedule'
import type { Refusal } from './refuse'

/**
 * The recorded execution — everything the UI renders and everything the
 * detector reads. Nothing is computed in a component (CLAUDE.md invariant 13),
 * and stepping backwards is free because execution is recorded, not re-run.
 */

/** Transaction id as the engine sees it. 0 is the pseudo-transaction that loaded the initial rows. */
export type Xid = number

export type ReadResult =
  | { readonly type: 'row'; readonly value: Value | null }
  | { readonly type: 'rows'; readonly rows: readonly InitialRow[] }

export type RowVersion = {
  readonly key: Key
  /** null is a tombstone: the version records a deletion. */
  readonly value: Value | null
  /** The transaction that created this version. */
  readonly xmin: Xid
  /** The transaction that superseded or deleted it, if any. */
  readonly xmax: Xid | null
  /** Schedule step that created it, or null for the initial load. */
  readonly createdAtStep: number | null
  readonly deletedAtStep: number | null
  /** Creation order across all keys, so a chain is unambiguous. */
  readonly seq: number
}

export type VersionChain = {
  readonly key: Key
  readonly versions: readonly RowVersion[]
}

export type LockResource =
  | { readonly type: 'record'; readonly key: Key }
  | { readonly type: 'gap'; readonly from: Key; readonly to: Key }

export type LockMode = 'shared' | 'exclusive' | 'gap' | 'insertIntention'

export type Lock = {
  readonly holder: TxnId
  readonly resource: LockResource
  readonly mode: LockMode
  readonly duration: 'statement' | 'transaction'
  readonly acquiredAtStep: number
}

export type SnapshotInfo = {
  readonly txn: TxnId
  /** The step at which this snapshot was taken. */
  readonly takenAtStep: number
  /** Scope the level declares, so the panel can say why two reads agreed. */
  readonly scope: 'statement' | 'transaction'
  /** Transactions whose writes this snapshot can see. */
  readonly visibleXids: readonly Xid[]
  /** Transactions that were still running when it was taken. */
  readonly inProgressXids: readonly Xid[]
}

export type TransactionStatus = 'notStarted' | 'running' | 'committed' | 'aborted'

export type TransactionState = {
  readonly txn: TxnId
  readonly xid: Xid
  readonly status: TransactionStatus
  readonly beganAtStep: number | null
  readonly endedAtStep: number | null
  readonly snapshot: SnapshotInfo | null
}

export type WaitState = {
  readonly txn: TxnId
  /** The step whose statement is waiting. */
  readonly stepIndex: number
  readonly waitingFor: readonly TxnId[]
  readonly resource: LockResource
}

/** Everything true about the modelled database after one step. */
export type WorldState = {
  readonly chains: readonly VersionChain[]
  readonly locks: readonly Lock[]
  readonly transactions: readonly TransactionState[]
  readonly waits: readonly WaitState[]
  /** Committed contents, as a reader outside every transaction would see them. */
  readonly committedRows: readonly InitialRow[]
}

export type AbortCause =
  | 'staleWrite'
  | 'staleLockingRead'
  | 'readWriteDependencies'
  | 'transactionAlreadyAborted'

export type StepOutcome =
  | {
      readonly type: 'ok'
      readonly read: ReadResult | null
      readonly rowsAffected: number | null
    }
  | {
      readonly type: 'error'
      readonly code: string
      readonly message: string
      readonly cause: AbortCause
    }
  | {
      /** Still waiting when the schedule ended. */
      readonly type: 'blocked'
      readonly waitingFor: readonly TxnId[]
    }
  | { readonly type: 'refused'; readonly refusal: Refusal }

export type TraceStep = {
  readonly index: number
  readonly txn: TxnId
  readonly op: Operation
  readonly notation: string
  readonly outcome: StepOutcome
  /**
   * The step after which this statement finally completed, or null if it did
   * not wait. Recorded because blocking is behaviour, and because it is what
   * the oracle records.
   */
  readonly blockedUntilStep: number | null
  /** The world after this step, including any waiting statement it released. */
  readonly state: WorldState
  /**
   * One sentence generated from the trace, never written prose — PRD §5.3.
   * Null when there is nothing to say beyond what the mark already shows.
   */
  readonly note: string | null
}

/**
 * A read/write antidependency: `from` read a row and `to` then wrote it, so in
 * any serial order `from` would have to come first. Two of these in sequence
 * are what a serialization check looks for.
 */
export type RwEdge = {
  readonly from: TxnId
  readonly to: TxnId
  readonly key: Key
  readonly atStep: number
}

export type TransactionOutcome = 'committed' | 'aborted' | 'open'

export type TransactionResult = {
  readonly txn: TxnId
  readonly xid: Xid
  readonly outcome: TransactionOutcome
  readonly abortedAtStep: number | null
  readonly error: { readonly code: string; readonly message: string; readonly cause: AbortCause } | null
}

export type ExecutionTrace = {
  readonly scheduleId: string
  readonly packId: string
  readonly engine: string
  readonly engineVersion: string
  /** The level that was asked for. */
  readonly level: IsolationLevel
  /** The level whose semantics actually ran — different when the pack declares an alias. */
  readonly effectiveLevel: IsolationLevel
  readonly aliasOf: IsolationLevel | null
  readonly steps: readonly TraceStep[]
  readonly transactions: readonly TransactionResult[]
  readonly finalState: readonly InitialRow[]
  /** Antidependencies observed during execution, for the serialization check and the graph. */
  readonly rwEdges: readonly RwEdge[]
}

export type ExecutionResult =
  | { readonly type: 'trace'; readonly trace: ExecutionTrace }
  | { readonly type: 'refused'; readonly refusal: Refusal }
