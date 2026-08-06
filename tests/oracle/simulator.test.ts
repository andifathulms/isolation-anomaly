import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe as suite, expect, it } from 'vitest'
import { LEVELS, type IsolationLevel } from '@/lib/schedule'
import { PACKS } from '@/lib/packs'
import { SCENARIOS } from '@/lib/scenarios'
import { fixtureName, type OracleRun } from '@/lib/oracle/types'
import { execute } from '@/lib/engine'
import { projectToOracleShape } from '@/lib/engine/project'

/**
 * The simulator against the recorded databases — the backbone of PRD §7.
 *
 * When these disagree, the simulator is wrong. Investigate in that order, and
 * never adjust a fixture to make a test pass.
 */

const ROOT = join(process.cwd(), 'tests', 'oracle')

function fixture(packId: string, scenarioId: string, level: IsolationLevel): OracleRun | null {
  const file = join(ROOT, packId, fixtureName(scenarioId, level))
  if (!existsSync(file)) return null
  return JSON.parse(readFileSync(file, 'utf8')) as OracleRun
}

suite('simulator versus recorded real databases', () => {
  for (const pack of PACKS) {
    const levels = LEVELS.filter((level) => pack.levels[level].kind !== 'unsupported')

    for (const scenario of SCENARIOS) {
      for (const level of levels) {
        const recorded = fixture(pack.id, scenario.id, level)
        if (!recorded) continue

        suite(`${pack.id} · ${scenario.id} · ${level}`, () => {
          const result = execute(scenario.schedule, pack, level)
          if (result.type !== 'trace') {
            throw new Error(`Executor refused a level the pack models: ${result.refusal.type}`)
          }
          const simulated = projectToOracleShape(result.trace, {
            engineVersion: recorded.engineVersion,
            image: recorded.image,
            recordedOn: recorded.recordedOn,
          })

          it('reads the same values the engine read', () => {
            const engineReads = recorded.steps.map((step) =>
              step.outcome.status === 'ok' ? step.outcome.read : null,
            )
            const modelReads = simulated.steps.map((step) =>
              step.outcome.status === 'ok' ? step.outcome.read : null,
            )
            expect(modelReads).toEqual(engineReads)
          })

          it('raises the same errors, with the same codes, at the same steps', () => {
            const shape = (run: OracleRun) =>
              run.steps
                .filter((step) => step.outcome.status === 'error')
                .map((step) =>
                  step.outcome.status === 'error'
                    ? { index: step.index, code: step.outcome.code }
                    : null,
                )
            expect(shape(simulated)).toEqual(shape(recorded))
          })

          it('waits where the engine waited', () => {
            const waits = (run: OracleRun) =>
              run.steps
                .filter((step) => step.blockedUntilStep !== null)
                .map((step) => ({ index: step.index, until: step.blockedUntilStep }))
            expect(waits(simulated)).toEqual(waits(recorded))
          })

          it('commits and aborts the same transactions', () => {
            expect(simulated.transactions).toEqual(recorded.transactions)
          })

          it('leaves the same rows behind', () => {
            expect(simulated.finalState).toEqual(recorded.finalState)
          })

          it('reports the same rows affected by each write', () => {
            const affected = (run: OracleRun) =>
              run.steps.map((step) =>
                step.outcome.status === 'ok' ? step.outcome.rowsAffected : null,
              )
            expect(affected(simulated)).toEqual(affected(recorded))
          })
        })
      }
    }
  }
})

suite('determinism', () => {
  it('produces a byte-identical trace for identical inputs', () => {
    for (const pack of PACKS) {
      for (const scenario of SCENARIOS) {
        const once = execute(scenario.schedule, pack, pack.defaultLevel)
        const twice = execute(scenario.schedule, pack, pack.defaultLevel)
        expect(JSON.stringify(once)).toBe(JSON.stringify(twice))
      }
    }
  })
})

suite('refusal rather than approximation', () => {
  it('refuses a level the engine does not have, naming what it offers instead', () => {
    const pack = PACKS.find((candidate) => candidate.id === 'postgres-16')
    if (!pack) throw new Error('postgres-16 pack missing')
    const result = execute(SCENARIOS[0]!.schedule, pack, 'SNAPSHOT')
    expect(result.type).toBe('refused')
    if (result.type !== 'refused') return
    expect(result.refusal.type).toBe('unsupportedLevel')
    expect(result.refusal.gap).toContain('REPEATABLE READ')
  })
})

suite('trace well-formedness', () => {
  it('releases every lock when its transaction ends', () => {
    for (const pack of PACKS) {
      const levels = LEVELS.filter((level) => pack.levels[level].kind !== 'unsupported')
      for (const scenario of SCENARIOS) {
        for (const level of levels) {
          const result = execute(scenario.schedule, pack, level)
          if (result.type !== 'trace') continue
          const last = result.trace.steps[result.trace.steps.length - 1]
          if (!last) continue
          const ended = new Set(
            last.state.transactions
              .filter((txn) => txn.status === 'committed' || txn.status === 'aborted')
              .map((txn) => txn.txn),
          )
          const leaked = last.state.locks.filter((lock) => ended.has(lock.holder))
          expect(
            leaked,
            `${pack.id} ${scenario.id} @ ${level} leaks ${leaked.length} lock(s)`,
          ).toEqual([])
        }
      }
    }
  })

  it('never records a version or a snapshot from the future', () => {
    for (const pack of PACKS) {
      const levels = LEVELS.filter((level) => pack.levels[level].kind !== 'unsupported')
      for (const scenario of SCENARIOS) {
        for (const level of levels) {
          const result = execute(scenario.schedule, pack, level)
          if (result.type !== 'trace') continue
          for (const step of result.trace.steps) {
            for (const chain of step.state.chains) {
              // Chains are append-only and ordered by creation.
              const seqs = chain.versions.map((version) => version.seq)
              expect([...seqs].sort((a, b) => a - b)).toEqual(seqs)
              for (const version of chain.versions) {
                expect(version.createdAtStep ?? -1).toBeLessThanOrEqual(step.index)
                expect(version.deletedAtStep ?? -1).toBeLessThanOrEqual(step.index)
              }
            }
            for (const txn of step.state.transactions) {
              if (txn.snapshot) expect(txn.snapshot.takenAtStep).toBeLessThanOrEqual(step.index)
              // A snapshot can never count a transaction as both visible and running.
              if (txn.snapshot) {
                const overlap = txn.snapshot.visibleXids.filter((xid) =>
                  txn.snapshot?.inProgressXids.includes(xid),
                )
                expect(overlap).toEqual([])
              }
            }
          }
        }
      }
    }
  })

  it('keeps every version chain consistent: at most one live version per key', () => {
    for (const pack of PACKS) {
      for (const scenario of SCENARIOS) {
        const result = execute(scenario.schedule, pack, pack.defaultLevel)
        if (result.type !== 'trace') continue
        for (const step of result.trace.steps) {
          for (const chain of step.state.chains) {
            const live = chain.versions.filter((version) => version.xmax === null)
            expect(live.length, `${scenario.id} key ${chain.key}`).toBeLessThanOrEqual(1)
          }
        }
      }
    }
  })
})
