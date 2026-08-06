import type { OracleReadResult, OracleRun, OracleStep, OracleStepOutcome } from '@/lib/oracle/types'
import type { TransactionOutcome } from '@/lib/oracle/types'
import type { ExecutionTrace, ReadResult, StepOutcome } from './trace'

/**
 * Projects a simulated trace into the shape the oracle records, so the two can
 * be compared field by field. Only what a real database session can observe
 * crosses over: values read, errors raised, waits, transaction outcomes and the
 * final table. Version chains and lock tables are the model's explanation of
 * those observations, not observations themselves.
 */

function projectRead(read: ReadResult | null): OracleReadResult | null {
  if (!read) return null
  if (read.type === 'row') return { type: 'row', value: read.value }
  return { type: 'rows', rows: read.rows }
}

function projectOutcome(outcome: StepOutcome): OracleStepOutcome {
  switch (outcome.type) {
    case 'ok':
      return { status: 'ok', read: projectRead(outcome.read), rowsAffected: outcome.rowsAffected }
    case 'error':
      return { status: 'error', code: outcome.code, message: outcome.message }
    case 'blocked':
      return {
        status: 'error',
        code: 'blocked',
        message: `still waiting for ${outcome.waitingFor.join(', ')} when the schedule ended.`,
      }
    case 'refused':
      return { status: 'error', code: 'refused', message: outcome.refusal.gap }
    default: {
      const exhaustive: never = outcome
      return exhaustive
    }
  }
}

export function projectToOracleShape(
  trace: ExecutionTrace,
  meta: { readonly engineVersion: string; readonly image: string; readonly recordedOn: string },
): OracleRun {
  const steps: readonly OracleStep[] = trace.steps.map((step) => ({
    index: step.index,
    txn: step.txn,
    notation: step.notation,
    blockedUntilStep: step.blockedUntilStep,
    outcome: projectOutcome(step.outcome),
  }))

  const transactions: Record<string, TransactionOutcome> = {}
  for (const result of trace.transactions) {
    // A transaction left open is rolled back when its session closes, which is
    // what the harness observes when it closes the connection.
    transactions[result.txn] = result.outcome === 'committed' ? 'committed' : 'aborted'
  }

  return {
    scenarioId: trace.scheduleId,
    packId: trace.packId,
    engine: trace.engine,
    engineVersion: meta.engineVersion,
    image: meta.image,
    recordedOn: meta.recordedOn,
    level: trace.level,
    steps,
    transactions,
    finalState: trace.finalState,
  }
}
