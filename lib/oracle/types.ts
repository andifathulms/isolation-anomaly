import type { InitialRow, IsolationLevel, TxnId } from '@/lib/schedule'

/**
 * What a real database did, recorded — PRD §7.
 *
 * This is the oracle. Every fixture records the engine version and the date,
 * because vendor behaviour changes across versions and a fixture without a
 * version is not evidence (CLAUDE.md invariant 10).
 *
 * The simulator is projected into this same shape and compared field by field.
 * When they disagree, the simulator is wrong — investigate in that order.
 */

export type OracleReadResult =
  /** A single-row read. `value` is null when the row is not visible. */
  | { readonly type: 'row'; readonly value: number | null }
  /** A predicate read, ordered by key. */
  | { readonly type: 'rows'; readonly rows: readonly InitialRow[] }

export type OracleStepOutcome =
  | {
      readonly status: 'ok'
      readonly read: OracleReadResult | null
      /** Rows the statement changed, where the engine reports it. */
      readonly rowsAffected: number | null
    }
  | {
      readonly status: 'error'
      /** SQLSTATE, or the engine's own code. */
      readonly code: string
      readonly message: string
    }

export type OracleStep = {
  readonly index: number
  readonly txn: TxnId
  /** Schedule notation, so a fixture is readable without the scenario beside it. */
  readonly notation: string
  /**
   * The step after which this statement finally completed, or null if it
   * completed without waiting. Blocking is behaviour, so it is recorded.
   */
  readonly blockedUntilStep: number | null
  readonly outcome: OracleStepOutcome
}

export type TransactionOutcome = 'committed' | 'aborted'

export type OracleRun = {
  readonly scenarioId: string
  readonly packId: string
  readonly engine: string
  /** Exactly what the running server reported, not the pack's version field. */
  readonly engineVersion: string
  /** The container image the fixture was recorded against. */
  readonly image: string
  /** ISO date of recording. */
  readonly recordedOn: string
  readonly level: IsolationLevel
  readonly steps: readonly OracleStep[]
  readonly transactions: Readonly<Record<TxnId, TransactionOutcome>>
  /** The committed table contents after the schedule, ordered by key. */
  readonly finalState: readonly InitialRow[]
}

/** Stable file name for a fixture, used by both the recorder and the tests. */
export function fixtureName(scenarioId: string, level: IsolationLevel): string {
  return `${scenarioId}--${level.toLowerCase().replace(/ /g, '-')}.json`
}
