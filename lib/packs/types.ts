import type { IsolationLevel } from '@/lib/schedule/levels'

/**
 * Engine packs — PRD §6.
 *
 * Engine behaviour is declarative data, not code branches. The executor is an
 * interpreter over these rules, so there is no `if (engine === 'postgres')`
 * anywhere, and a pack can be reviewed by someone who knows the engine but not
 * this codebase.
 *
 * Every rule carries a vendor citation with a verbatim quote. If a behaviour
 * cannot be cited it is not known, and it does not go in a pack.
 */

export type Citation = {
  /** Human title of the page, as it appears in the vendor documentation. */
  readonly source: string
  readonly url: string
  /** Verbatim quote. This is what makes the rule checkable by a reader. */
  readonly quote: string
}

/** A single behaviour, plus the documentation it was read from. */
export type Rule<T> = {
  readonly value: T
  readonly citation: Citation
}

export type SnapshotScope = 'statement' | 'transaction'

export type Visibility = {
  /**
   * Whether a plain read observes state as of the statement or as of the
   * transaction's first statement. For lock-based engines with no MVCC,
   * `statement` means "the latest committed value, blocking on exclusive
   * locks", which is the same observable rule.
   */
  readonly snapshot: SnapshotScope
  /** Plain reads observe versions written by transactions that have not committed. */
  readonly readsUncommitted: boolean
  /**
   * A locking read (SELECT ... FOR UPDATE) observes the latest committed
   * version rather than the transaction's snapshot. True in every engine
   * modelled so far, and the source of MySQL InnoDB's split behaviour where a
   * locking and a non-locking read disagree inside one transaction.
   */
  readonly lockingReadsSeeLatestCommitted: boolean
  /**
   * The engine silently turns a plain SELECT into a locking read at this level.
   * MySQL InnoDB does exactly this at SERIALIZABLE, which is how a level that
   * looks like snapshot isolation ends up blocking — and why write skew there
   * ends in a deadlock rather than in a clean serialization failure.
   */
  readonly plainReadsAreLocking: boolean
}

export type StaleRowOutcome =
  /** Re-evaluate against the newly committed version and carry on. */
  | 'applyToLatest'
  /** Abort with a serialization failure. */
  | 'abort'

export type Conflicts = {
  /** A write to a row another transaction updated and committed after our snapshot. */
  readonly writeOnStaleRow: StaleRowOutcome
  /** A locking read of such a row. PostgreSQL aborts at REPEATABLE READ. */
  readonly lockingReadOnStaleRow: 'readLatest' | 'abort'
  /** First-updater-wins: a writer waits for the incumbent writer to finish. */
  readonly writeWriteBlocks: boolean
}

export type RecordLockMode = 'none' | 'shared' | 'exclusive'

/**
 * Gap locking. `gap` locks the space between index records so no other
 * transaction can insert into it; `insertIntention` is what an insert requests,
 * and it is the only mode a gap lock conflicts with. This is InnoDB's model,
 * and SQL Server's key-range locks reduce to the same two questions: does the
 * read reserve the gap, and does the insert have to ask.
 */
export type GapLockMode = 'none' | 'gap' | 'insertIntention'

export type LockPlan = {
  readonly record: RecordLockMode
  readonly gap: GapLockMode
  /** Statement-duration locks are released as soon as the operation finishes. */
  readonly duration: SnapshotScope
}

export type SerializationCheck =
  | 'none'
  /**
   * Serializable Snapshot Isolation: track read/write antidependencies and
   * abort a transaction that forms a dangerous structure. No blocking.
   */
  | 'ssi'

export type LevelSemantics = {
  readonly visibility: Rule<Visibility>
  readonly conflicts: Rule<Conflicts>
  readonly locks: {
    readonly plainRead: Rule<LockPlan>
    readonly lockingRead: Rule<LockPlan>
    readonly write: Rule<LockPlan>
    readonly insert: Rule<LockPlan>
  }
  readonly serializationCheck: Rule<SerializationCheck>
}

export type LevelEntry =
  | {
      readonly kind: 'modelled'
      /** How the engine's own documentation names what this level actually is. */
      readonly displayName: string
      readonly summary: string
      readonly semantics: LevelSemantics
    }
  | {
      /**
       * The level name is accepted by the engine but means another level.
       * Declared explicitly and never silently implemented: the alias *is* the
       * lesson (CLAUDE.md invariant 4).
       */
      readonly kind: 'alias'
      readonly displayName: string
      readonly of: IsolationLevel
      readonly summary: string
      readonly citation: Citation
    }
  | {
      /** The engine has no such level. Selecting it produces a refusal. */
      readonly kind: 'unsupported'
      readonly displayName: string
      readonly summary: string
      readonly citation: Citation
    }

export type EngineErrorShape = {
  readonly code: string
  readonly message: string
  readonly citation: Citation
}

export type EnginePack = {
  /** `postgres-16`, `mysql-8-innodb`, `sqlserver-2022`. */
  readonly id: string
  readonly engine: string
  /** The version whose documentation was read. */
  readonly version: string
  /** ISO date the pack was checked against that documentation. */
  readonly verifiedOn: string
  readonly docsUrl: string
  readonly defaultLevel: IsolationLevel
  readonly summary: string
  readonly errors: {
    /** What the engine says when it aborts a write that lost a race. */
    readonly serializationFailure: EngineErrorShape
    /** Only engines that run a serialization check report this one. */
    readonly readWriteDependencies?: EngineErrorShape
    readonly deadlock?: EngineErrorShape
    /**
     * What the engine says about any statement sent to a transaction it has
     * already failed. Recorded because it is what an application actually sees
     * after a serialization failure it did not catch.
     */
    readonly abortedTransaction?: EngineErrorShape
  }
  readonly levels: Readonly<Record<IsolationLevel, LevelEntry>>
}
