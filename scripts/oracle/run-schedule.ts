import type { IsolationLevel, Schedule, TxnId } from '../../lib/schedule'
import { notate } from '../../lib/schedule'
import type { OracleRun, OracleStep, OracleStepOutcome, TransactionOutcome } from '../../lib/oracle/types'
import type { OracleDriver, OracleSession, ReadShape, StatementResult } from './driver'

/**
 * Executes one schedule against a real engine, one connection per transaction.
 *
 * The hard part is telling "the statement returned" from "the statement is
 * waiting on a lock". A statement is sent without being awaited and raced
 * against a timer: if the timer wins, the step is recorded as blocked and the
 * harness moves on to the next step, exactly as a human at two psql prompts
 * would. When a later step releases the lock, the pending statement settles and
 * is recorded against the step that unblocked it.
 *
 * Blocking is behaviour, so it goes in the fixture. A simulator that produces
 * the right values by never blocking is not modelling the engine.
 */

/** How long to wait before calling a statement blocked. */
const BLOCK_MS = 350
/** How long to let pending statements settle after each step. */
const SETTLE_MS = 150

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

type Pending = {
  readonly stepIndex: number
  settled: boolean
  result: StatementResult | null
  error: unknown
  failed: boolean
}

type SessionState = {
  readonly session: OracleSession
  pending: Pending | null
  /** True once the engine has reported an error on this session. */
  failed: boolean
  outcome: TransactionOutcome | null
}

function readShapeFor(step: Schedule['steps'][number]): ReadShape {
  switch (step.op.type) {
    case 'read':
    case 'selectForUpdate':
      return 'row'
    case 'readRange':
      return 'rows'
    default:
      return 'none'
  }
}

export async function runScheduleAgainstEngine(
  driver: OracleDriver,
  schedule: Schedule,
  level: IsolationLevel,
  scenarioId: string,
  meta: { readonly engineVersion: string; readonly recordedOn: string },
): Promise<OracleRun> {
  await driver.reset(schedule.initial)

  const states = new Map<TxnId, SessionState>()
  for (const txn of schedule.transactions) {
    states.set(txn, {
      session: await driver.openSession(txn),
      pending: null,
      failed: false,
      outcome: null,
    })
  }

  const outcomes = new Map<number, OracleStepOutcome>()
  const blockedUntil = new Map<number, number>()

  const track = (state: SessionState, stepIndex: number, promise: Promise<StatementResult>) => {
    const pending: Pending = { stepIndex, settled: false, result: null, error: null, failed: false }
    state.pending = pending
    void promise.then(
      (result) => {
        pending.settled = true
        pending.result = result
      },
      (error: unknown) => {
        pending.settled = true
        pending.failed = true
        pending.error = error
        state.failed = true
      },
    )
    return pending
  }

  const record = (state: SessionState, pending: Pending) => {
    if (pending.failed) {
      outcomes.set(pending.stepIndex, {
        status: 'error',
        code: driver.errorCode(pending.error),
        message: driver.errorMessage(pending.error),
      })
      return
    }
    const result = pending.result
    outcomes.set(pending.stepIndex, {
      status: 'ok',
      read: result?.read ?? null,
      rowsAffected: result?.rowsAffected ?? null,
    })
  }

  for (const [index, step] of schedule.steps.entries()) {
    const state = states.get(step.txn)
    if (!state) throw new Error(`${scenarioId}: step ${index} names undeclared transaction ${step.txn}`)
    if (state.pending) {
      throw new Error(
        `${scenarioId} at ${level}: step ${index} is sent to ${step.txn}, whose statement from ` +
          `step ${state.pending.stepIndex} is still waiting. A real session could not accept it.`,
      )
    }

    const statement =
      step.op.type === 'begin'
        ? driver.beginStatement(level)
        : step.op.type === 'commit'
          ? driver.commitStatement()
          : step.op.type === 'rollback'
            ? driver.rollbackStatement()
            : driver.statementFor(step.op)

    if (statement === null) {
      throw new Error(`${scenarioId}: ${driver.engine} has no statement for ${step.op.type}`)
    }

    const pending = track(state, index, state.session.send(statement, readShapeFor(step)))

    // Race the statement against the block timer.
    const started = Date.now()
    while (!pending.settled && Date.now() - started < BLOCK_MS) {
      await delay(10)
    }

    if (pending.settled) {
      record(state, pending)
      state.pending = null
    }

    // Whatever this step released may have let an earlier statement through.
    await delay(SETTLE_MS)
    for (const other of states.values()) {
      if (other.pending && other.pending.settled) {
        record(other, other.pending)
        blockedUntil.set(other.pending.stepIndex, index)
        other.pending = null
      }
    }

    if (step.op.type === 'commit' && outcomes.get(index)?.status === 'ok') {
      // PostgreSQL answers COMMIT with the tag ROLLBACK when the transaction
      // had already failed, so the engine reports the outcome itself.
      const tag = pending.result?.tag ?? null
      state.outcome = tag === 'ROLLBACK' ? 'aborted' : 'committed'
    } else if (step.op.type === 'commit') {
      state.outcome = 'aborted'
    } else if (step.op.type === 'rollback') {
      state.outcome = 'aborted'
    }
  }

  // Anything still waiting at the end of the schedule never got its lock.
  for (const [txn, state] of states) {
    if (!state.pending) continue
    const stuck = state.pending
    await delay(BLOCK_MS)
    if (stuck.settled) {
      record(state, stuck)
      blockedUntil.set(stuck.stepIndex, schedule.steps.length - 1)
    } else {
      outcomes.set(stuck.stepIndex, {
        status: 'error',
        code: 'blocked',
        message: `${txn} was still waiting when the schedule ended.`,
      })
    }
    state.pending = null
  }

  const finalState = await driver.finalState()

  for (const state of states.values()) await state.session.close()

  const steps: OracleStep[] = schedule.steps.map((step, index) => {
    const outcome = outcomes.get(index)
    if (!outcome) throw new Error(`${scenarioId}: step ${index} was never recorded`)
    return {
      index,
      txn: step.txn,
      notation: notate(step.op, schedule.transactions.indexOf(step.txn)),
      blockedUntilStep: blockedUntil.get(index) ?? null,
      outcome,
    }
  })

  const transactions: Record<TxnId, TransactionOutcome> = {}
  for (const [txn, state] of states) {
    // A transaction with no terminal operation is left open, and the engine
    // rolls it back when the connection closes.
    transactions[txn] = state.outcome ?? 'aborted'
  }

  return {
    scenarioId,
    packId: driver.packId,
    engine: driver.engine,
    engineVersion: meta.engineVersion,
    image: driver.image,
    recordedOn: meta.recordedOn,
    level,
    steps,
    transactions,
    finalState,
  }
}
