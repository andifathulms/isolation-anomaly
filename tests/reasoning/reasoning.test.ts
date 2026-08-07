import { describe as suite, expect, it } from 'vitest'
import { LEVELS } from '@/lib/schedule'
import { PACKS } from '@/lib/packs'
import { SCENARIOS } from '@/lib/scenarios'
import { execute } from '@/lib/engine'

/**
 * The explanation must be the same thing as the answer.
 *
 * `explainVisibleVersion` walks the chain a second time to record its working,
 * which means there are now two pieces of code that decide what a read returns.
 * If they ever disagree, the app shows a reader a derivation that does not
 * produce the number printed beside it — which is worse than showing no
 * derivation at all, because it is wrong with the appearance of rigour.
 *
 * So: for every scenario, every pack and every level, the value the reasoning
 * arrives at must equal the value the read returned.
 */

suite('a read is explained by the value it actually returned', () => {
  for (const pack of PACKS) {
    for (const level of LEVELS) {
      if (!pack.levels[level]) continue

      it(`${pack.id} at ${level}`, () => {
        for (const scenario of SCENARIOS) {
          const result = execute(scenario.schedule, pack, level)
          if (result.type !== 'trace') continue

          for (const step of result.trace.steps) {
            if (step.outcome.type !== 'ok') continue
            const { read, reasoning } = step.outcome

            if (read === null) {
              expect(reasoning, `${scenario.id} step ${step.index} reads nothing`).toBeNull()
              continue
            }

            expect(reasoning, `${scenario.id} step ${step.index} is a read`).not.toBeNull()
            if (!reasoning) continue

            const where = `${scenario.id} ${pack.id} ${level} step ${step.index}`

            if (read.type === 'row') {
              const [decision] = reasoning.keys
              expect(reasoning.keys.length, `${where}: one key`).toBe(1)
              expect(decision?.value ?? null, `${where}: value`).toBe(read.value)
            } else {
              // A range read explains every key in the predicate, including the
              // ones it did not return — so the rows are the subset whose
              // decision found a live version, in key order.
              const live = reasoning.keys
                .filter((decision) => decision.value !== null)
                .map((decision) => ({ key: decision.key, value: decision.value }))
              expect(live, `${where}: rows`).toEqual(read.rows)
            }

            // A chosen version has to be one that was actually looked at, and
            // it has to be the one the walk marked visible.
            for (const decision of reasoning.keys) {
              if (decision.chosenSeq === null) continue
              const chosen = decision.considered.find((entry) => entry.seq === decision.chosenSeq)
              expect(chosen, `${where}: chosen version was considered`).toBeDefined()
              expect(chosen?.visible, `${where}: chosen version is visible`).toBe(true)
              expect(chosen?.value, `${where}: chosen version carries the value`).toBe(decision.value)
            }

            // Exactly one version per key may be visible: two would mean the
            // walk kept going after it had its answer.
            for (const decision of reasoning.keys) {
              const visible = decision.considered.filter((entry) => entry.visible)
              expect(visible.length, `${where}: at most one visible version`).toBeLessThanOrEqual(1)
            }
          }
        }
      })
    }
  }
})

suite('every rule shown to a reader carries its source', () => {
  it('gives each read reasoning a citation with a quote and a url', () => {
    for (const pack of PACKS) {
      for (const level of LEVELS) {
        if (!pack.levels[level]) continue
        for (const scenario of SCENARIOS) {
          const result = execute(scenario.schedule, pack, level)
          if (result.type !== 'trace') continue
          for (const step of result.trace.steps) {
            if (step.outcome.type !== 'ok' || !step.outcome.reasoning) continue
            const { citation } = step.outcome.reasoning
            expect(citation.url, `${pack.id} ${level}`).toMatch(/^https?:\/\//)
            expect(citation.quote.length, `${pack.id} ${level}`).toBeGreaterThan(0)
            expect(citation.source.length, `${pack.id} ${level}`).toBeGreaterThan(0)
          }
        }
      }
    }
  })
})
