import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import type { OracleRun } from '@/lib/oracle/types'
import { recordingKey, type Recording, type Recordings } from './shape'

/**
 * The recordings, read off disk at build time.
 *
 * 220 runs against PostgreSQL 16.14, MySQL 8.4.11, SQL Server 16.0.4265.3 and
 * Oracle 23.26.2.0.0, in containers, each carrying the engine version and the
 * date it was taken. They are the reason this project's claims are worth more
 * than a blog post's, and until now they were visible only to someone browsing
 * the test directory. The site said "verified against the real engine" and
 * offered no way to look.
 *
 * `node:fs` rather than 220 imports, and this module is only ever reached from
 * a server component during static generation — the harness itself still never
 * ships (CLAUDE.md invariant 9). What ships is a projection: 86 kB of JSON that
 * gzips to about 2.5 kB, because a recording is mostly nulls and the word "ok".
 *
 * If a fixture is unreadable the build does not fail. Evidence being absent
 * should degrade to saying so, not to taking the site down.
 */

const DIRECTORY = join(process.cwd(), 'tests', 'oracle')

export function recordings(): Recordings {
  const entries: Record<string, Recording> = {}

  let packDirs: string[]
  try {
    packDirs = readdirSync(DIRECTORY, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
  } catch {
    return { entries: {}, count: 0 }
  }

  for (const packDir of packDirs) {
    for (const file of readdirSync(join(DIRECTORY, packDir))) {
      if (!file.endsWith('.json')) continue
      let run: OracleRun
      try {
        run = JSON.parse(readFileSync(join(DIRECTORY, packDir, file), 'utf8')) as OracleRun
      } catch {
        continue
      }

      entries[recordingKey(run.scenarioId, run.packId, run.level)] = {
        engineVersion: run.engineVersion,
        image: run.image,
        recordedOn: run.recordedOn,
        steps: run.steps.map((step) => ({
          index: step.index,
          blockedUntilStep: step.blockedUntilStep,
          status: step.outcome.status,
          read:
            step.outcome.status === 'ok' && step.outcome.read
              ? step.outcome.read.type === 'row'
                ? String(step.outcome.read.value ?? '∅')
                : `{${step.outcome.read.rows.map((row) => `${row.key}=${row.value}`).join(', ')}}`
              : null,
          code: step.outcome.status === 'error' ? step.outcome.code : null,
          message: step.outcome.status === 'error' ? step.outcome.message : null,
        })),
        transactions: run.transactions,
        finalState: run.finalState.map((row) => `${row.key}=${row.value}`),
      }
    }
  }

  return { entries, count: Object.keys(entries).length }
}
