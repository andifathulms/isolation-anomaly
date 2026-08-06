import type { Citation } from '@/lib/packs/types'
import type { IsolationLevel, Operation, TxnId } from '@/lib/schedule'

/**
 * Structured refusals — CLAUDE.md invariant 6.
 *
 * An operation, level or engine feature outside the modelled set produces one
 * of these, naming the gap. Never a guess, never "closest" semantics: teaching
 * the wrong database behaviour is the one failure this project cannot absorb.
 */
export type Refusal =
  | {
      readonly type: 'unsupportedLevel'
      readonly packId: string
      readonly level: IsolationLevel
      /** What the engine offers instead, named so the reader can act on it. */
      readonly gap: string
      readonly citation: Citation
    }
  | {
      readonly type: 'unmodelledOperation'
      readonly packId: string
      readonly operation: Operation['type']
      readonly gap: string
    }
  | {
      readonly type: 'unmodelledPredicate'
      readonly packId: string
      readonly gap: string
    }
  | {
      /**
       * These statements deadlock, and this engine does not choose its victim by
       * any rule that can be reproduced. Which transaction survives decides the
       * outcome, so the run is refused rather than half-answered.
       */
      readonly type: 'unmodelledDeadlock'
      readonly packId: string
      readonly txns: readonly TxnId[]
      readonly gap: string
      readonly citation: Citation
    }
  | {
      /**
       * The schedule sends an operation to a transaction whose previous
       * statement is still waiting on a lock. A real session could not accept
       * it, so the schedule cannot be executed as written.
       */
      readonly type: 'sessionBusy'
      readonly txn: TxnId
      readonly waitingSince: number
      readonly gap: string
    }

export function refusalHeadline(refusal: Refusal): string {
  switch (refusal.type) {
    case 'unsupportedLevel':
      return `${refusal.packId} has no ${refusal.level} isolation level`
    case 'unmodelledOperation':
      return `${refusal.packId} does not model the ${refusal.operation} operation`
    case 'unmodelledPredicate':
      return `Only closed key ranges are modelled as predicates`
    case 'unmodelledDeadlock':
      return `${refusal.txns.join(' and ')} deadlock, and ${refusal.packId} does not choose its victim predictably`
    case 'sessionBusy':
      return `${refusal.txn} is still waiting on the statement from step ${refusal.waitingSince}`
    default: {
      const exhaustive: never = refusal
      return exhaustive
    }
  }
}
