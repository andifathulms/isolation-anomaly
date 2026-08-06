import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe as suite, expect, it } from 'vitest'
import { LEVELS } from '@/lib/schedule'
import { PACKS } from '@/lib/packs'
import { SCENARIOS } from '@/lib/scenarios'
import { fixtureName, type OracleRun } from '@/lib/oracle/types'

/**
 * Integrity of the recorded evidence, before anything is compared against it.
 *
 * A fixture without an engine version is not evidence — vendor behaviour
 * changes across versions (CLAUDE.md invariant 10). A missing fixture is worse
 * than a failing one, because it silently removes a claim from verification.
 */

const ROOT = join(process.cwd(), 'tests', 'oracle')

export function loadFixture(packId: string, scenarioId: string, level: string): OracleRun | null {
  const file = join(ROOT, packId, fixtureName(scenarioId, level as never))
  if (!existsSync(file)) return null
  return JSON.parse(readFileSync(file, 'utf8')) as OracleRun
}

suite('oracle fixtures', () => {
  for (const pack of PACKS) {
    const recordable = LEVELS.filter((level) => pack.levels[level].kind !== 'unsupported')

    it(`${pack.id} has a fixture for every scenario at every level it supports`, () => {
      const missing: string[] = []
      for (const scenario of SCENARIOS) {
        for (const level of recordable) {
          if (!loadFixture(pack.id, scenario.id, level)) {
            missing.push(`${scenario.id} @ ${level}`)
          }
        }
      }
      expect(missing, `run pnpm oracle:record — missing: ${missing.join(', ')}`).toEqual([])
    })

    it(`${pack.id} fixtures record the engine version, image and date`, () => {
      for (const scenario of SCENARIOS) {
        for (const level of recordable) {
          const run = loadFixture(pack.id, scenario.id, level)
          if (!run) continue
          expect(run.engineVersion, `${scenario.id} @ ${level}`).toMatch(/\d/)
          expect(run.image).toContain(':')
          expect(run.recordedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/)
          expect(run.engine).toBe(pack.engine)
          expect(run.level).toBe(level)
        }
      }
    })

    it(`${pack.id} fixtures record an outcome for every step and every transaction`, () => {
      for (const scenario of SCENARIOS) {
        for (const level of recordable) {
          const run = loadFixture(pack.id, scenario.id, level)
          if (!run) continue
          expect(run.steps.length, `${scenario.id} @ ${level}`).toBe(scenario.schedule.steps.length)
          run.steps.forEach((step, index) => {
            expect(step.index).toBe(index)
            expect(step.txn).toBe(scenario.schedule.steps[index]?.txn)
          })
          for (const txn of scenario.schedule.transactions) {
            expect(['committed', 'aborted']).toContain(run.transactions[txn])
          }
        }
      }
    })

    it(`${pack.id} never records a transaction as committed while one of its statements was still waiting`, () => {
      // A statement can be left waiting when the schedule ends — that is real
      // behaviour and it is recorded. What must never happen is a fixture
      // claiming such a transaction committed, because it plainly did not.
      for (const scenario of SCENARIOS) {
        for (const level of recordable) {
          const run = loadFixture(pack.id, scenario.id, level)
          if (!run) continue
          const stuck = run.steps.filter(
            (step) =>
              step.outcome.status === 'error' &&
              (step.outcome.code === 'blocked' || step.outcome.code === 'sessionBusy'),
          )
          for (const step of stuck) {
            expect(
              run.transactions[step.txn],
              `${scenario.id} @ ${level}: ${step.txn} was stuck at step ${step.index}`,
            ).toBe('aborted')
          }
        }
      }
    })
  }
})

suite('what the oracle says about PostgreSQL', () => {
  // These are not simulator assertions. They are readings of the recorded
  // evidence, kept as tests so that a re-recording against a new PostgreSQL
  // release that changes them fails loudly rather than passing quietly.
  const pack = 'postgres-16'

  it('permits write skew at REPEATABLE READ and refuses it at SERIALIZABLE', () => {
    const rr = loadFixture(pack, 'write-skew', 'REPEATABLE READ')
    const ser = loadFixture(pack, 'write-skew', 'SERIALIZABLE')
    expect(rr?.transactions).toEqual({ T1: 'committed', T2: 'committed' })
    expect(rr?.finalState).toEqual([
      { key: 1, value: 0 },
      { key: 2, value: 0 },
    ])
    expect(ser?.transactions).toEqual({ T1: 'committed', T2: 'aborted' })
    expect(ser?.finalState).toEqual([
      { key: 1, value: 0 },
      { key: 2, value: 1 },
    ])
  })

  it('never permits a dirty read, even at READ UNCOMMITTED', () => {
    const run = loadFixture(pack, 'dirty-read', 'READ UNCOMMITTED')
    const read = run?.steps[3]?.outcome
    expect(read?.status).toBe('ok')
    expect(read?.status === 'ok' ? read.read : null).toEqual({ type: 'row', value: 100 })
  })

  it('prevents phantoms at REPEATABLE READ, which ANSI does not require', () => {
    const run = loadFixture(pack, 'phantom-read', 'REPEATABLE READ')
    const first = run?.steps[1]?.outcome
    const second = run?.steps[5]?.outcome
    expect(first?.status === 'ok' ? first.read : null).toEqual(
      second?.status === 'ok' ? second.read : undefined,
    )
  })

  it('records the wait when a locking read meets a held row lock', () => {
    const run = loadFixture(pack, 'lost-update-locked', 'READ COMMITTED')
    const blocked = run?.steps.find((step) => step.blockedUntilStep !== null)
    expect(blocked?.notation).toBe('r2[1]•')
    expect(blocked?.blockedUntilStep).toBe(5)
  })
})

suite('what one database option does to SQL Server', () => {
  // The two SQL Server packs differ only in READ_COMMITTED_SNAPSHOT, and this is
  // the whole point of shipping the second one: the option does not change what
  // a read returns, it changes whether the read has to wait for a writer.
  const scenario = 'dirty-read'
  const level = 'READ COMMITTED'

  it('makes a read wait when it is off, and not wait when it is on', () => {
    const locking = loadFixture('sqlserver-2022', scenario, level)
    const versioned = loadFixture('sqlserver-2022-rcsi', scenario, level)
    expect(locking).not.toBeNull()
    expect(versioned).not.toBeNull()
    if (!locking || !versioned) return

    // With shared locks, the read is blocked by the uncommitted write until the
    // writer rolls back.
    const blocked = locking.steps.filter((step) => step.blockedUntilStep !== null)
    expect(blocked.map((step) => step.notation)).toEqual(['r2[1]'])

    // With row versioning, nothing waits at all.
    expect(versioned.steps.filter((step) => step.blockedUntilStep !== null)).toEqual([])
  })

  it('does not change a single value that was read', () => {
    const locking = loadFixture('sqlserver-2022', scenario, level)
    const versioned = loadFixture('sqlserver-2022-rcsi', scenario, level)
    if (!locking || !versioned) return
    const reads = (run: OracleRun) =>
      run.steps.map((step) => (step.outcome.status === 'ok' ? step.outcome.read : null))
    expect(reads(versioned)).toEqual(reads(locking))
    expect(versioned.finalState).toEqual(locking.finalState)
  })
})

suite('what the deadlock scenario proves about naming a victim', () => {
  // This is the evidence behind two packs declaring their victim unmodelled, and
  // two others declaring the last waiter. It is recorded rather than reasoned.
  const victimOf = (packId: string, level: string): string | null => {
    const run = loadFixture(packId, 'deadlock', level)
    if (!run) return null
    const codes = ['40P01', '1213', '1205', '60']
    const failed = run.steps.find(
      (step) => step.outcome.status === 'error' && codes.includes(step.outcome.code),
    )
    return failed?.txn ?? null
  }

  it('is consistent on PostgreSQL and MySQL: the transaction whose wait closed the cycle', () => {
    for (const level of ['READ UNCOMMITTED', 'READ COMMITTED', 'REPEATABLE READ', 'SERIALIZABLE']) {
      expect(victimOf('postgres-16', level), `postgres @ ${level}`).toBe('T2')
      expect(victimOf('mysql-8-innodb', level), `mysql @ ${level}`).toBe('T2')
    }
  })

  it('is not consistent on SQL Server, which is why the model refuses to name it', () => {
    const levels = ['READ UNCOMMITTED', 'READ COMMITTED', 'REPEATABLE READ', 'SNAPSHOT', 'SERIALIZABLE']
    const victims = levels.flatMap((level) => [
      victimOf('sqlserver-2022', level),
      victimOf('sqlserver-2022-rcsi', level),
    ])
    // The same schedule on the same server loses a different transaction
    // depending on the level, and the two database options disagree with each
    // other as well. No rule over waiting order reproduces that.
    expect(new Set(victims.filter(Boolean)).size, 'SQL Server picked the same victim every time').toBe(2)
  })

  it('leaves the table untouched everywhere, because nobody finished', () => {
    for (const packId of ['postgres-16', 'mysql-8-innodb', 'sqlserver-2022', 'oracle-23ai']) {
      for (const level of ['READ COMMITTED', 'SERIALIZABLE']) {
        const run = loadFixture(packId, 'deadlock', level)
        if (!run) continue
        expect(run.finalState, `${packId} @ ${level}`).toEqual([
          { key: 1, value: 100 },
          { key: 2, value: 100 },
        ])
      }
    }
  })

  it('rolls back only the statement on Oracle, so both transactions survive', () => {
    const run = loadFixture('oracle-23ai', 'deadlock', 'READ COMMITTED')
    expect(run).not.toBeNull()
    if (!run) return
    // ORA-00060 ends the statement, not the transaction — both still commit,
    // having done nothing.
    expect(run.transactions).toEqual({ T1: 'committed', T2: 'committed' })
  })
})
