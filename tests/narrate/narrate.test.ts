import { describe as suite, expect, it } from 'vitest'
import { LEVELS } from '@/lib/schedule'
import { PACKS, requirePack } from '@/lib/packs'
import { SCENARIOS, requireScenario } from '@/lib/scenarios'
import { execute, narrateStep, narrateTrace } from '@/lib/engine'
import { detect } from '@/lib/detect'

/**
 * The score's description is the score, for anyone not looking at it. So it is
 * held to the same standard as the picture: it must carry the values read, the
 * waits, the failures and the anomaly — not describe the drawing.
 */

suite('narration', () => {
  const pack = requirePack('postgres-16')

  it('describes write skew at REPEATABLE READ well enough to follow without the picture', () => {
    const scenario = requireScenario('write-skew')
    const result = execute(scenario.schedule, pack, 'REPEATABLE READ')
    if (result.type !== 'trace') throw new Error('expected a trace')
    const text = narrateTrace(result.trace, detect(result.trace))

    expect(text).toContain('PostgreSQL')
    expect(text).toContain('REPEATABLE READ')
    expect(text).toContain('T1 committed')
    expect(text).toContain('T2 committed')
    expect(text).toContain('Write skew occurred')
    // The roster ends up empty, and the description has to say so.
    expect(text).toContain('key 1 is 0')
    expect(text).toContain('key 2 is 0')
  })

  it('names the level a pack only pretends to have', () => {
    const scenario = requireScenario('dirty-read')
    const result = execute(scenario.schedule, pack, 'READ UNCOMMITTED')
    if (result.type !== 'trace') throw new Error('expected a trace')
    expect(narrateTrace(result.trace, [])).toContain('which this engine runs as READ COMMITTED')
  })

  it('reports a wait, and what the statement did once it was released', () => {
    const result = execute(requireScenario('lost-update-locked').schedule, pack, 'READ COMMITTED')
    if (result.type !== 'trace') throw new Error('expected a trace')
    const waited = result.trace.steps.find((step) => step.blockedUntilStep !== null)
    expect(waited).toBeDefined()
    if (!waited) return
    const text = narrateStep(waited)
    expect(text).toContain('after waiting for a lock until step 5')
    expect(text).toContain('read 9')
  })

  it('reports a failure with its code and message', () => {
    const result = execute(requireScenario('lost-update').schedule, pack, 'REPEATABLE READ')
    if (result.type !== 'trace') throw new Error('expected a trace')
    const failed = result.trace.steps.find((step) => step.outcome.type === 'error')
    expect(failed).toBeDefined()
    if (!failed) return
    expect(narrateStep(failed)).toContain('failed with 40001')
  })

  it('says something for every step of every run, on every engine', () => {
    for (const candidate of PACKS) {
      for (const scenario of SCENARIOS) {
        for (const level of LEVELS) {
          const result = execute(scenario.schedule, candidate, level)
          if (result.type !== 'trace') continue
          for (const step of result.trace.steps) {
            const text = narrateStep(step)
            const where = `${candidate.id} ${scenario.id} @ ${level} step ${step.index}`
            // Every step says which step it is, whose it is, and ends a sentence.
            expect(text, where).toContain(`Step ${step.index}`)
            expect(text, where).toContain(step.txn)
            expect(text.endsWith('.'), where).toBe(true)
            // Nothing is described by a placeholder or left half-built.
            expect(text, where).not.toContain('undefined')
            expect(text, where).not.toContain('[object')
          }
          expect(narrateTrace(result.trace, detect(result.trace))).toContain('The table is left')
        }
      }
    }
  })
})
