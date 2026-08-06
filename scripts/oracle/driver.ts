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
  openSession(txn: string): Promise<OracleSession>
  /** The engine's dialect for starting a transaction at a level. */
  beginStatement(level: IsolationLevel): string
  commitStatement(): string
  rollbackStatement(): string
  /** SQL for one modelled operation, or null if the engine needs no statement. */
  statementFor(op: Operation): string | null
  /** Committed table contents, ordered by key. */
  finalState(): Promise<readonly InitialRow[]>
  /** SQLSTATE or engine code for an error object thrown by the client. */
  errorCode(error: unknown): string
  errorMessage(error: unknown): string
  close(): Promise<void>
}
