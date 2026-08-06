import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe as suite, expect, it } from 'vitest'
import { LEVELS, type IsolationLevel } from '@/lib/schedule'
import { PACKS } from '@/lib/packs'
import { SCENARIOS } from '@/lib/scenarios'
import { execute } from '@/lib/engine'
import { ANOMALY_IDS, detect, detectedIds } from '@/lib/detect'

/**
 * Both directions, for every scenario, at every level of every pack — PRD §7.
 *
 * A one-directional test would pass a detector that fires constantly, so each
 * scenario asserts the anomaly is there at the levels that permit it *and* that
 * it is absent everywhere else. The permitting levels are a documented claim,
 * and every one of them is also checked against a recording of the real engine
 * in tests/oracle.
 */

suite('anomaly detection in both directions', () => {
  for (const pack of PACKS) {
    const levels = LEVELS.filter((level) => pack.levels[level].kind !== 'unsupported')

    for (const scenario of SCENARIOS) {
      const permitting = scenario.expectedAt[pack.id]
      if (!permitting) continue

      for (const level of levels) {
        const shouldOccur = permitting.includes(level)

        it(`${pack.id} · ${scenario.id} · ${level} ${shouldOccur ? 'produces' : 'does not produce'} ${scenario.anomaly}`, () => {
          const result = execute(scenario.schedule, pack, level)

          // A refused run makes no claim either way, so it must not be listed as
          // a level that permits the anomaly — that would be claiming something
          // the model has just declined to work out.
          if (result.type === 'refused') {
            expect(
              shouldOccur,
              `${scenario.id} @ ${level} on ${pack.id} is refused (${result.refusal.type}), ` +
                `so it cannot be listed as permitting ${scenario.anomaly}`,
            ).toBe(false)
            return
          }
          const found = detectedIds(result.trace)
          if (shouldOccur) {
            expect(found, `expected ${scenario.anomaly}, found [${found.join(', ')}]`).toContain(
              scenario.anomaly,
            )
          } else {
            expect(found, `expected no ${scenario.anomaly}, found [${found.join(', ')}]`).not.toContain(
              scenario.anomaly,
            )
          }
        })
      }
    }
  }
})

suite('the detector is not a rubber stamp', () => {
  it('finds nothing in a schedule that is already serial', () => {
    const pack = PACKS[0]
    if (!pack) throw new Error('no packs')
    const serial = {
      id: 'serial',
      title: 'One after another',
      transactions: ['T1', 'T2'],
      initial: [{ key: 1, value: 5 }],
      steps: [
        { txn: 'T1' as const, op: { type: 'begin' as const } },
        { txn: 'T1' as const, op: { type: 'read' as const, key: 1 } },
        { txn: 'T1' as const, op: { type: 'write' as const, key: 1, value: 6 } },
        { txn: 'T1' as const, op: { type: 'commit' as const } },
        { txn: 'T2' as const, op: { type: 'begin' as const } },
        { txn: 'T2' as const, op: { type: 'read' as const, key: 1 } },
        { txn: 'T2' as const, op: { type: 'write' as const, key: 1, value: 7 } },
        { txn: 'T2' as const, op: { type: 'commit' as const } },
      ],
    }
    for (const level of LEVELS) {
      const result = execute(serial, pack, level)
      if (result.type !== 'trace') continue
      expect(detect(result.trace), `at ${level}`).toEqual([])
    }
  })

  it('finds nothing at all at the strictest level of every pack', () => {
    for (const pack of PACKS) {
      const strictest: IsolationLevel = 'SERIALIZABLE'
      if (pack.levels[strictest].kind === 'unsupported') continue
      for (const scenario of SCENARIOS) {
        const result = execute(scenario.schedule, pack, strictest)
        if (result.type !== 'trace') continue
        const found = detectedIds(result.trace)
        expect(found, `${pack.id} ${scenario.id} at SERIALIZABLE`).toEqual([])
      }
    }
  })
})

suite('detected anomalies are reported usefully', () => {
  it('names the steps involved, a cause step, and a mechanism drawn from the trace', () => {
    const pack = PACKS.find((candidate) => candidate.id === 'postgres-16')
    if (!pack) throw new Error('postgres-16 pack missing')
    const scenario = SCENARIOS.find((candidate) => candidate.id === 'write-skew')
    if (!scenario) throw new Error('write-skew scenario missing')
    const result = execute(scenario.schedule, pack, 'REPEATABLE READ')
    if (result.type !== 'trace') throw new Error('expected a trace')

    const anomalies = detect(result.trace)
    const skew = anomalies.find((found) => found.id === 'write-skew')
    expect(skew).toBeDefined()
    if (!skew) return
    expect(skew.transactions).toEqual(['T1', 'T2'])
    expect(skew.keys).toEqual([1, 2])
    expect(skew.causeStep).toBe(5)
    expect(skew.steps).toEqual([4, 5])
    expect(skew.mechanism).toContain('no row was written twice')
    // Every step it names must exist in the schedule.
    for (const step of skew.steps) {
      expect(step).toBeLessThan(scenario.schedule.steps.length)
    }
  })

  it('marks the cause, not the commit that revealed it', () => {
    const pack = PACKS.find((candidate) => candidate.id === 'postgres-16')
    if (!pack) throw new Error('postgres-16 pack missing')
    const scenario = SCENARIOS.find((candidate) => candidate.id === 'lost-update')
    if (!scenario) throw new Error('lost-update scenario missing')
    const result = execute(scenario.schedule, pack, 'READ COMMITTED')
    if (result.type !== 'trace') throw new Error('expected a trace')
    const lost = detect(result.trace).find((found) => found.id === 'lost-update')
    // Step 6 is T2's write, not step 7 where it commits.
    expect(lost?.causeStep).toBe(6)
  })
})

suite('the catalogue', () => {
  it('has a definition and a source for every anomaly the detector can report', () => {
    const detectable = new Set<string>()
    for (const pack of PACKS) {
      for (const scenario of SCENARIOS) {
        for (const level of LEVELS) {
          const result = execute(scenario.schedule, pack, level)
          if (result.type !== 'trace') continue
          for (const found of detect(result.trace)) detectable.add(found.id)
        }
      }
    }
    for (const id of detectable) {
      expect(ANOMALY_IDS as readonly string[]).toContain(id)
    }
  })

  it('keeps anomaly ids stable, because they appear in scenario data and shared URLs', () => {
    expect([...ANOMALY_IDS]).toEqual([
      'dirty-write',
      'dirty-read',
      'lost-update',
      'non-repeatable-read',
      'phantom-read',
      'read-skew',
      'write-skew',
    ])
  })
})

suite('every scenario claim is also backed by a recording', () => {
  it('has an oracle fixture for each pack it makes a claim about', () => {
    for (const scenario of SCENARIOS) {
      for (const packId of Object.keys(scenario.expectedAt)) {
        const dir = join(process.cwd(), 'tests', 'oracle', packId)
        const files = readdirSync(dir).filter((file) => file.startsWith(`${scenario.id}--`))
        expect(files.length, `${scenario.id} has no fixtures for ${packId}`).toBeGreaterThan(0)
        for (const file of files) {
          const raw: unknown = JSON.parse(readFileSync(join(dir, file), 'utf8'))
          expect(raw).toHaveProperty('engineVersion')
        }
      }
    }
  })
})
