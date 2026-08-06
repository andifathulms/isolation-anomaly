import { describe as suite, expect, it } from 'vitest'
import { canMove, moveRange, moveStep, notate, validateSchedule, type Schedule } from '@/lib/schedule'
import { requireScenario } from '@/lib/scenarios'
import { PACKS } from '@/lib/packs'
import { execute } from '@/lib/engine'

/**
 * Re-interleaving, tested as logic rather than as a drag gesture.
 *
 * The rule that matters: a drag changes the interleaving and never a
 * transaction's own order. If that were wrong, dragging could produce a
 * schedule no session could issue, and the executor would be answering a
 * question about a database that cannot exist.
 */

const shape = (schedule: Schedule) =>
  schedule.steps.map((step) => notate(step.op, schedule.transactions.indexOf(step.txn))).join(' ')

suite('re-interleaving a schedule', () => {
  const skew = requireScenario('write-skew').schedule

  it('moves a step later without disturbing anything else', () => {
    // b1 b2 r1[P] r2[P] w1[1=0] w2[2=0] c1 c2 — move T2's read after T1's write.
    const moved = moveStep(skew, 3, 4)
    expect(shape(moved)).toBe('b1 b2 r1[P:1..2] w1[1=0] r2[P:1..2] w2[2=0] c1 c2')
    expect(validateSchedule(moved)).toEqual([])
  })

  it('moves a step earlier', () => {
    const moved = moveStep(skew, 5, 4)
    expect(shape(moved)).toBe('b1 b2 r1[P:1..2] r2[P:1..2] w2[2=0] w1[1=0] c1 c2')
    expect(validateSchedule(moved)).toEqual([])
  })

  it('refuses to reorder a transaction against itself, clamping instead', () => {
    // T1's write (step 4) can never pass T1's own commit (step 6), so dragging
    // it to the very end lands it just before that commit.
    const moved = moveStep(skew, 4, 99)
    expect(shape(moved)).toBe('b1 b2 r1[P:1..2] r2[P:1..2] w2[2=0] w1[1=0] c1 c2')
    expect(validateSchedule(moved)).toEqual([])
  })

  it('clamps a drag to the start the same way', () => {
    // T2's write cannot precede T2's own begin.
    const moved = moveStep(skew, 5, -10)
    expect(moved.steps[1]?.txn).toBe('T2')
    expect(validateSchedule(moved)).toEqual([])
  })

  it('reports the range a step may travel', () => {
    // T1's range read at step 2 sits between b1 (0) and w1 (4).
    expect(moveRange(skew, 2)).toEqual({ first: 1, last: 3 })
    // T2's commit at step 7 can only go as late as the end, as early as after w2.
    expect(moveRange(skew, 7)).toEqual({ first: 6, last: 7 })
  })

  it('says when a step is wedged and cannot move at all', () => {
    const wedged: Schedule = {
      id: 'wedged',
      title: 'Wedged',
      transactions: ['T1'],
      initial: [{ key: 1, value: 1 }],
      steps: [
        { txn: 'T1', op: { type: 'begin' } },
        { txn: 'T1', op: { type: 'read', key: 1 } },
        { txn: 'T1', op: { type: 'commit' } },
      ],
    }
    expect(canMove(wedged, 1)).toBe(false)
    expect(moveStep(wedged, 1, 2)).toBe(wedged)
  })

  it('leaves the schedule untouched when the move changes nothing', () => {
    expect(moveStep(skew, 3, 3)).toBe(skew)
    expect(moveStep(skew, 99, 0)).toBe(skew)
  })

  it('never produces a schedule the validator rejects, for any drag of any step', () => {
    for (const scenario of [requireScenario('write-skew'), requireScenario('write-skew-locked')]) {
      const schedule = scenario.schedule
      for (let from = 0; from < schedule.steps.length; from += 1) {
        for (let to = -2; to <= schedule.steps.length + 1; to += 1) {
          const moved = moveStep(schedule, from, to)
          expect(validateSchedule(moved), `drag ${from} → ${to}`).toEqual([])
          // Each transaction's own operations keep their order.
          for (const txn of schedule.transactions) {
            const before = schedule.steps.filter((step) => step.txn === txn).map((step) => step.op)
            const after = moved.steps.filter((step) => step.txn === txn).map((step) => step.op)
            expect(after, `drag ${from} → ${to} reordered ${txn}`).toEqual(before)
          }
        }
      }
    }
  })
})

suite('re-interleaving changes the answer, which is the point', () => {
  it('turns write skew into a schedule with no anomaly by moving one step', () => {
    const pack = PACKS.find((candidate) => candidate.id === 'postgres-16')
    if (!pack) throw new Error('postgres-16 missing')
    const skew = requireScenario('write-skew').schedule

    const before = execute(skew, pack, 'REPEATABLE READ')
    if (before.type !== 'trace') throw new Error('expected a trace')
    expect(before.trace.finalState).toEqual([
      { key: 1, value: 0 },
      { key: 2, value: 0 },
    ])

    // Drag T2's begin to after T1's commit and the two stop overlapping, so the
    // same operations in a different interleaving are simply serial.
    const serial = moveStep(moveStep(skew, 1, 6), 3, 7)
    const after = execute(serial, pack, 'REPEATABLE READ')
    if (after.type !== 'trace') throw new Error('expected a trace')
    expect(validateSchedule(serial)).toEqual([])
    expect(after.trace.transactions.every((txn) => txn.outcome === 'committed')).toBe(true)
  })
})
