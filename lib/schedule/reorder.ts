import type { Schedule } from './types'

/**
 * Re-interleaving — PRD §5.1, "drag to re-interleave and re-run".
 *
 * Dragging a step changes *when* it happens relative to the other transaction,
 * and nothing else. A transaction's own operations keep their order, because a
 * session issues its statements one after another and cannot be persuaded to
 * commit before it reads. So a step can only travel as far as its own
 * transaction's neighbouring steps, and a drag past them stops there rather
 * than producing a schedule no database could be handed.
 *
 * That constraint is the lesson as much as the feature: the interleaving is the
 * only thing you get to choose.
 */

/**
 * How far a step may move, as the inclusive range of target positions.
 * Both bounds are indices in the resulting array.
 */
export function moveRange(
  schedule: Schedule,
  from: number,
): { readonly first: number; readonly last: number } {
  const step = schedule.steps[from]
  if (!step) return { first: from, last: from }

  const ownPositions = schedule.steps
    .map((candidate, index) => (candidate.txn === step.txn ? index : -1))
    .filter((index) => index >= 0)

  const place = ownPositions.indexOf(from)
  const previousOwn = place > 0 ? ownPositions[place - 1] : undefined
  const nextOwn = place < ownPositions.length - 1 ? ownPositions[place + 1] : undefined

  return {
    first: previousOwn === undefined ? 0 : previousOwn + 1,
    last: nextOwn === undefined ? schedule.steps.length - 1 : nextOwn - 1,
  }
}

/**
 * Moves a step to a new position, clamped so the schedule stays runnable.
 * Returns the same schedule when the move would change nothing.
 */
export function moveStep(schedule: Schedule, from: number, to: number): Schedule {
  if (from === to) return schedule
  if (from < 0 || from >= schedule.steps.length) return schedule

  const { first, last } = moveRange(schedule, from)
  const target = Math.min(Math.max(to, first), last)
  if (target === from) return schedule

  const steps = [...schedule.steps]
  const [taken] = steps.splice(from, 1)
  if (!taken) return schedule
  steps.splice(target, 0, taken)

  return { ...schedule, steps }
}

/** True when this step could be moved at all — a step wedged between its own is fixed. */
export function canMove(schedule: Schedule, from: number): boolean {
  const { first, last } = moveRange(schedule, from)
  return last > first
}
