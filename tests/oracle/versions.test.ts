import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe as suite, expect, it } from 'vitest'
import { PACKS } from '@/lib/packs'
import type { OracleRun } from '@/lib/oracle/types'

/**
 * Fixtures and packs must be talking about the same engine.
 *
 * A pack that says it models PostgreSQL 16 while its evidence was recorded
 * against 17 is making an unbacked claim, and the failure would be silent: every
 * comparison would still pass, against the wrong database. This is the check
 * that turns a version bump into an operation with a result rather than a hope —
 * change the image, run `pnpm oracle:record`, and these tests say whether the
 * recorded behaviour still matches what the pack claims.
 */

const ROOT = join(process.cwd(), 'tests', 'oracle')

/** How a pack's declared version relates to what the server reports. */
const VERSION_MATCHES: Readonly<Record<string, (reported: string) => boolean>> = {
  // "16" against a server reporting "16.14".
  'postgres-16': (reported) => reported.startsWith('16.'),
  // "8.4" against "8.4.11".
  'mysql-8-innodb': (reported) => reported.startsWith('8.4.'),
  // "2022" is a product name; the server reports the build, 16.0.x.
  'sqlserver-2022': (reported) => reported.startsWith('16.0.'),
  'sqlserver-2022-rcsi': (reported) => reported.startsWith('16.0.'),
  // "23ai Free" against "23.26.2.0.0".
  'oracle-23ai': (reported) => reported.startsWith('23.'),
}

function fixtures(packId: string): readonly OracleRun[] {
  const dir = join(ROOT, packId)
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter((file) => file.endsWith('.json'))
    .map((file) => JSON.parse(readFileSync(join(dir, file), 'utf8')) as OracleRun)
}

suite('packs and their evidence agree on the engine', () => {
  for (const pack of PACKS) {
    it(`${pack.id} recorded against the version it claims to model`, () => {
      const matches = VERSION_MATCHES[pack.id]
      expect(matches, `no version rule declared for ${pack.id}`).toBeDefined()
      if (!matches) return

      const runs = fixtures(pack.id)
      expect(runs.length, `${pack.id} has no fixtures`).toBeGreaterThan(0)

      for (const run of runs) {
        expect(
          matches(run.engineVersion),
          `${pack.id} claims ${pack.version} but ${run.scenarioId} was recorded against ${run.engineVersion}`,
        ).toBe(true)
      }
    })

    it(`${pack.id} fixtures were all recorded against one server and one image`, () => {
      const runs = fixtures(pack.id)
      const versions = [...new Set(runs.map((run) => run.engineVersion))]
      const images = [...new Set(runs.map((run) => run.image))]
      // Fixtures recorded against two different builds cannot be compared with
      // each other, and a difference between them would look like a bug.
      expect(versions, `${pack.id} mixes engine versions`).toHaveLength(1)
      expect(images, `${pack.id} mixes container images`).toHaveLength(1)
    })

    it(`${pack.id} was checked against its documentation no earlier than its evidence`, () => {
      const runs = fixtures(pack.id)
      for (const run of runs) {
        // A pack read from the docs long before the recording is a pack whose
        // rules were never confronted with the engine that answered.
        expect(
          run.recordedOn >= pack.verifiedOn,
          `${pack.id} was verified ${pack.verifiedOn} but ${run.scenarioId} was recorded ${run.recordedOn}`,
        ).toBe(true)
      }
    })
  }

  it('every pack that ships has a version rule, so a new one cannot skip this', () => {
    const unruled = PACKS.filter((pack) => !VERSION_MATCHES[pack.id]).map((pack) => pack.id)
    expect(unruled).toEqual([])
  })
})
