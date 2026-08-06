/**
 * Pack integrity gate — PRD §7, §11. Runs before `next build`.
 *
 * Beyond the Zod schema this checks the things a schema cannot: that every
 * pack file on disk is registered, that pack ids match their filenames, and
 * that every citation URL sits under the engine's own documentation host. A
 * citation pointing at a blog post is not a vendor citation.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join, basename } from 'node:path'
import { enginePackSchema } from '../lib/packs/schema'
import { LEVELS } from '../lib/schedule/levels'

const PACK_DIR = join(process.cwd(), 'data', 'packs')

/** Hosts trusted to be the vendor's own documentation, by pack id prefix. */
const VENDOR_HOSTS: Record<string, readonly string[]> = {
  postgres: ['www.postgresql.org'],
  mysql: ['dev.mysql.com'],
  sqlserver: ['learn.microsoft.com'],
  oracle: ['docs.oracle.com'],
}

type Failure = { readonly pack: string; readonly message: string }

const failures: Failure[] = []
const files = readdirSync(PACK_DIR).filter((file) => file.endsWith('.json')).sort()

if (files.length === 0) {
  console.error('No engine packs found in data/packs.')
  process.exit(1)
}

for (const file of files) {
  const label = basename(file)
  const raw: unknown = JSON.parse(readFileSync(join(PACK_DIR, file), 'utf8'))
  const parsed = enginePackSchema.safeParse(raw)

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      failures.push({ pack: label, message: `${issue.path.join('.') || '(root)'}: ${issue.message}` })
    }
    continue
  }

  const pack = parsed.data

  if (`${pack.id}.json` !== file) {
    failures.push({ pack: label, message: `pack id "${pack.id}" does not match its filename.` })
  }

  const vendorKey = Object.keys(VENDOR_HOSTS).find((key) => pack.id.startsWith(key))
  if (!vendorKey) {
    failures.push({
      pack: label,
      message: `no vendor documentation host is registered for pack id "${pack.id}".`,
    })
  }
  const hosts = vendorKey ? VENDOR_HOSTS[vendorKey] : undefined

  const checkCitation = (path: string, url: string) => {
    if (!hosts) return
    const host = new URL(url).host
    if (!hosts.includes(host)) {
      failures.push({
        pack: label,
        message: `${path}: ${host} is not ${pack.engine}'s own documentation host.`,
      })
    }
  }

  for (const [name, shape] of Object.entries(pack.errors)) {
    if (shape) checkCitation(`errors.${name}`, shape.citation.url)
  }

  let aliasCount = 0
  let unsupportedCount = 0

  for (const level of LEVELS) {
    const entry = pack.levels[level]
    switch (entry.kind) {
      case 'alias':
        aliasCount += 1
        checkCitation(`levels.${level}`, entry.citation.url)
        break
      case 'unsupported':
        unsupportedCount += 1
        checkCitation(`levels.${level}`, entry.citation.url)
        break
      case 'modelled': {
        const { semantics } = entry
        checkCitation(`levels.${level}.visibility`, semantics.visibility.citation.url)
        checkCitation(`levels.${level}.conflicts`, semantics.conflicts.citation.url)
        checkCitation(
          `levels.${level}.serializationCheck`,
          semantics.serializationCheck.citation.url,
        )
        for (const [opClass, plan] of Object.entries(semantics.locks)) {
          checkCitation(`levels.${level}.locks.${opClass}`, plan.citation.url)
        }
        break
      }
    }
  }

  const modelled = LEVELS.length - aliasCount - unsupportedCount
  console.log(
    `✓ ${pack.id} — ${pack.engine} ${pack.version}, verified ${pack.verifiedOn}: ` +
      `${modelled} modelled, ${aliasCount} alias, ${unsupportedCount} unsupported`,
  )
}

if (failures.length > 0) {
  console.error(`\n${failures.length} pack problem(s):`)
  for (const failure of failures) console.error(`  ✗ ${failure.pack} — ${failure.message}`)
  process.exit(1)
}

console.log(`\n${files.length} pack(s) valid.`)
