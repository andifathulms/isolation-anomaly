import type { Schedule, TxnId } from './types'

/**
 * Every legal interleaving of a schedule.
 *
 * A session issues its statements in order, so the only freedom is how the
 * transactions' statements interleave — which is exactly what the score's drag
 * lets a reader change, one drop at a time. Enumerating the whole space turns
 * "I moved it and the anomaly went away" into "17 of these 70 orderings produce
 * it, and none of the 70 do at SERIALIZABLE".
 *
 * The count is a multinomial: for lanes of length a, b, c… it is
 * (a+b+c)! / (a! b! c!). The library's schedules run from 20 to 252, so the
 * whole corpus is enumerable in milliseconds. A hand-built schedule with three
 * or four transactions is not, which is what `LIMIT` is for.
 */

/**
 * Above this, the space is reported and not enumerated.
 *
 * Partial enumeration would be worse than none: a count over some of the
 * orderings reads exactly like a count over all of them, and there is no honest
 * way to label it. Refusing is the same answer the engine gives for anything it
 * cannot model.
 */
export const LIMIT = 4096

export type Interleavings =
  | { readonly kind: 'enumerated'; readonly total: number; readonly schedules: readonly Schedule[] }
  | { readonly kind: 'tooMany'; readonly total: number; readonly limit: number }

/** Statement indices per transaction, in the order that transaction issues them. */
function lanes(schedule: Schedule): readonly (readonly number[])[] {
  const byTxn = new Map<TxnId, number[]>()
  schedule.steps.forEach((step, index) => {
    const lane = byTxn.get(step.txn) ?? []
    lane.push(index)
    byTxn.set(step.txn, lane)
  })
  return [...byTxn.values()]
}

/** (Σn)! / Πn! — computed multiplicatively so it does not overflow on the way. */
export function countInterleavings(schedule: Schedule): number {
  let total = 1
  let remaining = schedule.steps.length
  for (const lane of lanes(schedule)) {
    // C(remaining, lane.length)
    let choose = 1
    for (let i = 0; i < lane.length; i += 1) {
      choose = (choose * (remaining - i)) / (i + 1)
    }
    total *= Math.round(choose)
    remaining -= lane.length
    if (total > Number.MAX_SAFE_INTEGER) return Number.MAX_SAFE_INTEGER
  }
  return total
}

export function interleavings(schedule: Schedule): Interleavings {
  const total = countInterleavings(schedule)
  if (total > LIMIT) return { kind: 'tooMany', total, limit: LIMIT }

  const laneSets = lanes(schedule)
  const schedules: Schedule[] = []
  const order: number[] = []
  const cursor = laneSets.map(() => 0)

  const walk = (): void => {
    if (order.length === schedule.steps.length) {
      schedules.push({ ...schedule, steps: order.map((index) => schedule.steps[index]!) })
      return
    }
    // Always advancing the lanes in the same order keeps the enumeration
    // deterministic, which the counts on screen depend on.
    laneSets.forEach((lane, laneIndex) => {
      const at = cursor[laneIndex]!
      if (at >= lane.length) return
      cursor[laneIndex] = at + 1
      order.push(lane[at]!)
      walk()
      order.pop()
      cursor[laneIndex] = at
    })
  }

  walk()
  return { kind: 'enumerated', total, schedules }
}
