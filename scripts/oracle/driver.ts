import type { InitialRow, IsolationLevel, Operation } from '../../lib/schedule'
import type { OracleReadResult } from '../../lib/oracle/types'

/**
 * What the harness needs from a real engine. One implementation per pack.
 *
 * Deliberately thin: the harness owns the schedule stepping, the wait detection
 * and the fixture writing, so every engine is recorded by the same procedure
 * and a difference in a fixture is a difference in the database.
 */

/** What the harness expects a statement to return, decided by the operation. */
export type ReadShape = 'row' | 'rows' | 'none'

export type StatementResult = {
  readonly read: OracleReadResult | null
  readonly rowsAffected: number | null
  /**
   * The engine's command tag, where it has one. PostgreSQL answers COMMIT with
   * the tag `ROLLBACK` when the transaction had already failed, which is how
   * the harness learns the outcome from the engine rather than inferring it.
   */
  readonly tag: string | null
}

/** A single connection, standing in for one transaction's session. */
export type OracleSession = {
  readonly txn: string
  /** The engine's own id for this connection, used to ask whether it is waiting. */
  readonly id: number
  /**
   * Sends a statement and returns its promise without awaiting it. The harness
   * races it against a timer to tell "returned" from "waiting on a lock".
   */
  send(statement: string, expect: ReadShape): Promise<StatementResult>
  close(): Promise<void>
}

export type OracleDriver = {
  readonly packId: string
  readonly engine: string
  readonly image: string
  /** Compose service name, for `docker compose up`. */
  readonly service: string
  /** Whatever the running server reports about itself. */
  serverVersion(): Promise<string>
  /** Drops and recreates the modelled table with these rows. */
  reset(rows: readonly InitialRow[]): Promise<void>
  /**
   * One connection, standing in for one transaction's session. The level is
   * passed because engines differ in where it is set — PostgreSQL takes it on
   * BEGIN, MySQL on the session, and InnoDB's SERIALIZABLE also depends on
   * autocommit being off, which is a property of the session rather than of the
   * transaction.
   */
  openSession(txn: string, level: IsolationLevel): Promise<OracleSession>
  /** The engine's dialect for starting a transaction at a level. */
  beginStatement(level: IsolationLevel): string
  commitStatement(): string
  rollbackStatement(): string
  /** SQL for one modelled operation, or null if the engine needs no statement. */
  statementFor(op: Operation): string | null
  /** Committed table contents, ordered by key. */
  finalState(): Promise<readonly InitialRow[]>
  /**
   * Whether the engine reports that this session is waiting on a lock.
   *
   * This is what makes a recorded wait evidence rather than a guess: instead of
   * inferring "blocked" from a statement being slow, the harness asks the server
   * — pg_stat_activity for PostgreSQL, performance_schema.data_lock_waits for
   * InnoDB — and records the wait the engine says is happening.
   */
  isWaitingOnLock(sessionId: number): Promise<boolean>
  /**
   * Whether an error with this code left the whole transaction rolled back, as
   * opposed to failing only the statement. The engines differ, and the
   * difference decides what a later COMMIT means: PostgreSQL fails every
   * statement after an error until the block ends, while InnoDB rolls back the
   * transaction on a deadlock but keeps going after a lock wait timeout — so a
   * COMMIT that returns OK may be committing nothing at all.
   */
  errorAbortsTransaction(code: string): boolean
  /** SQLSTATE or engine code for an error object thrown by the client. */
  errorCode(error: unknown): string
  errorMessage(error: unknown): string
  close(): Promise<void>
}
