import { describe as suite, expect, it } from 'vitest'
import { countInterleavings, interleavings } from '@/lib/schedule'
import { SCENARIOS } from '@/lib/scenarios'

/**
 * The count on screen is a claim about completeness — "17 of 70" is only worth
 * anything if there are exactly 70 and every one of them was tried. So: the
 * enumeration has to produce as many schedules as the formula predicts, each
 * one distinct, and each one has to preserve every transaction's own order.
 */
suite('the interleaving space is enumerated completely and legally', () => {
  for (const scenario of SCENARIOS) {
    it(scenario.id, () => {
      const result = interleavings(scenario.schedule)
      expect(result.kind).toBe('enumerated')
      if (result.kind !== 'enumerated') return

      expect(result.schedules.length).toBe(countInterleavings(scenario.schedule))

      const seen = new Set<string>()
      for (const candidate of result.schedules) {
        // Every ordering is distinct.
        const key = candidate.steps.map((step) => `${step.txn}:${step.op.type}`).join('>')
        seen.add(key)

        // Same statements, same multiset.
        expect(candidate.steps.length).toBe(scenario.schedule.steps.length)

        // Each transaction issues its own statements in the original order.
        for (const txn of scenario.schedule.transactions) {
          const before = scenario.schedule.steps.filter((step) => step.txn === txn)
          const after = candidate.steps.filter((step) => step.txn === txn)
          expect(after).toEqual(before)
        }
      }
      expect(seen.size).toBe(result.schedules.length)
    })
  }
})

suite('an unenumerable space is refused rather than sampled', () => {
  it('reports the total and does not truncate', () => {
    const base = SCENARIOS[0]!.schedule
    // Four transactions of six statements: 2.3 billion orderings.
    const steps = ['T1', 'T2', 'T3', 'T4'].flatMap((txn) =>
      Array.from({ length: 6 }, () => ({ txn, op: { type: 'begin' } as const })),
    )
    const result = interleavings({ ...base, transactions: ['T1', 'T2', 'T3', 'T4'], steps })
    expect(result.kind).toBe('tooMany')
    if (result.kind === 'tooMany') expect(result.total).toBeGreaterThan(result.limit)
  })
})
