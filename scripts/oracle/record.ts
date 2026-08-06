/**
 * DEVELOPMENT ONLY — PRD §7, CLAUDE.md invariant 9.
 *
 * Brings up real databases in containers, runs every library schedule against
 * them at every level the pack does not declare unsupported, and writes what
 * happened to tests/oracle/. Never runs in CI, never ships in the bundle.
 *
 * Record the fixture, then implement. When the simulator disagrees with a
 * fixture, the simulator is wrong.
 *
 *   pnpm oracle:record                 # all packs, all levels
 *   pnpm oracle:record --keep          # leave containers running
 *   pnpm oracle:record --scenario=write-skew
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { LEVELS, type IsolationLevel } from '../../lib/schedule'
import { requirePack } from '../../lib/packs'
import { SCENARIOS } from '../../lib/scenarios'
import { fixtureName } from '../../lib/oracle/types'
import { createPostgresDriver } from './postgres'
import { createMysqlDriver } from './mysql'
import { createSqlServerDriver } from './sqlserver'
import { createOracleDriver } from './oracle'
import type { OracleDriver } from './driver'
import { runScheduleAgainstEngine } from './run-schedule'

const COMPOSE_FILE = 'docker-compose.oracle.yml'
const FIXTURE_ROOT = join(process.cwd(), 'tests', 'oracle')

const args = process.argv.slice(2)
const keepRunning = args.includes('--keep')
const onlyScenario = args.find((arg) => arg.startsWith('--scenario='))?.split('=')[1]
const onlyPack = args.find((arg) => arg.startsWith('--pack='))?.split('=')[1]

const DRIVERS: readonly (() => OracleDriver)[] = [
  createPostgresDriver,
  createMysqlDriver,
  () => createSqlServerDriver('sqlserver-2022'),
  () => createSqlServerDriver('sqlserver-2022-rcsi'),
  createOracleDriver,
]

function compose(...commandArgs: string[]): void {
  execFileSync('docker', ['compose', '-f', COMPOSE_FILE, ...commandArgs], { stdio: 'inherit' })
}

/** Levels worth recording: everything the pack does not declare unsupported. */
function recordableLevels(packId: string): readonly IsolationLevel[] {
  const pack = requirePack(packId)
  return LEVELS.filter((level) => pack.levels[level].kind !== 'unsupported')
}

async function main(): Promise<void> {
  const drivers = DRIVERS.map((create) => create()).filter(
    (driver) => !onlyPack || driver.packId === onlyPack,
  )
  if (drivers.length === 0) throw new Error(`No driver matches --pack=${onlyPack}`)

  const scenarios = SCENARIOS.filter((scenario) => !onlyScenario || scenario.id === onlyScenario)
  if (scenarios.length === 0) throw new Error(`No scenario matches --scenario=${onlyScenario}`)

  const recordedOn = new Date().toISOString().slice(0, 10)
  let written = 0

  for (const driver of drivers) {
    console.log(`\n▸ ${driver.engine} (${driver.image})`)
    compose('up', '-d', '--wait', driver.service)

    const engineVersion = await driver.serverVersion()
    console.log(`  server reports version ${engineVersion}`)

    const outDir = join(FIXTURE_ROOT, driver.packId)
    mkdirSync(outDir, { recursive: true })

    for (const scenario of scenarios) {
      for (const level of recordableLevels(driver.packId)) {
        const run = await runScheduleAgainstEngine(driver, scenario.schedule, level, scenario.id, {
          engineVersion,
          recordedOn,
        })
        const file = join(outDir, fixtureName(scenario.id, level))
        writeFileSync(file, `${JSON.stringify(run, null, 2)}\n`)
        written += 1

        const aborted = Object.entries(run.transactions)
          .filter(([, outcome]) => outcome === 'aborted')
          .map(([txn]) => txn)
        const errors = run.steps.filter((step) => step.outcome.status === 'error').length
        console.log(
          `  ${scenario.id.padEnd(22)} ${level.padEnd(18)} ` +
            `aborted: ${aborted.length > 0 ? aborted.join(',') : '—'}  errors: ${errors}  ` +
            `final: ${run.finalState.map((row) => `${row.key}=${row.value}`).join(' ') || '(empty)'}`,
        )
      }
    }

    await driver.close()
  }

  if (!keepRunning) {
    console.log('\n▸ tearing down containers')
    compose('down', '-v')
  }

  console.log(`\n${written} fixture(s) written to tests/oracle/.`)
}

main().catch((error: unknown) => {
  console.error(error)
  if (!keepRunning) {
    try {
      compose('down', '-v')
    } catch {
      // The teardown failing must not mask the original error.
    }
  }
  process.exit(1)
})
