import postgres16 from '@/data/packs/postgres-16.json'
import { enginePackSchema } from './schema'
import type { Citation, EnginePack, LevelEntry, LevelSemantics } from './types'
import type { IsolationLevel } from '@/lib/schedule/levels'

/**
 * Packs are imported, not fetched — the site is a static export with no runtime
 * requests. Parsing happens once at module load; `pnpm packs:validate` runs the
 * same schema in the build so a malformed pack never reaches a page.
 */
const RAW_PACKS: readonly unknown[] = [postgres16]

function parse(raw: unknown): EnginePack {
  const result = enginePackSchema.safeParse(raw)
  if (!result.success) {
    const id =
      typeof raw === 'object' && raw !== null && 'id' in raw ? String((raw as { id: unknown }).id) : 'unknown'
    throw new Error(`Engine pack ${id} failed validation: ${result.error.message}`)
  }
  return result.data as EnginePack
}

export const PACKS: readonly EnginePack[] = RAW_PACKS.map(parse)

export const DEFAULT_PACK_ID = 'postgres-16'

export function getPack(id: string): EnginePack | null {
  return PACKS.find((pack) => pack.id === id) ?? null
}

export function requirePack(id: string): EnginePack {
  const pack = getPack(id)
  if (!pack) throw new Error(`No engine pack with id ${id}. Available: ${PACKS.map((p) => p.id).join(', ')}`)
  return pack
}

export function defaultPack(): EnginePack {
  return requirePack(DEFAULT_PACK_ID)
}

/**
 * Follows a declared alias to the level whose semantics actually run.
 * Returns null for an unsupported level — the caller turns that into a refusal
 * rather than guessing at the closest thing.
 */
export function resolveLevel(
  pack: EnginePack,
  level: IsolationLevel,
): { readonly effective: IsolationLevel; readonly semantics: LevelSemantics; readonly aliasOf: IsolationLevel | null } | null {
  const entry = pack.levels[level]
  switch (entry.kind) {
    case 'modelled':
      return { effective: level, semantics: entry.semantics, aliasOf: null }
    case 'alias': {
      const target = pack.levels[entry.of]
      if (target.kind !== 'modelled') return null
      return { effective: entry.of, semantics: target.semantics, aliasOf: entry.of }
    }
    case 'unsupported':
      return null
    default: {
      const exhaustive: never = entry
      return exhaustive
    }
  }
}

export function levelEntry(pack: EnginePack, level: IsolationLevel): LevelEntry {
  return pack.levels[level]
}

/** Every citation in a pack, de-duplicated by URL and quote, for the engines page. */
export function packCitations(pack: EnginePack): readonly Citation[] {
  const seen = new Map<string, Citation>()

  const add = (citation: Citation) => {
    const key = `${citation.url}::${citation.quote}`
    if (!seen.has(key)) seen.set(key, citation)
  }

  for (const shape of Object.values(pack.errors)) {
    if (shape) add(shape.citation)
  }

  for (const entry of Object.values(pack.levels)) {
    switch (entry.kind) {
      case 'alias':
      case 'unsupported':
        add(entry.citation)
        break
      case 'modelled': {
        const { semantics } = entry
        add(semantics.visibility.citation)
        add(semantics.conflicts.citation)
        add(semantics.serializationCheck.citation)
        for (const plan of Object.values(semantics.locks)) add(plan.citation)
        break
      }
      default: {
        const exhaustive: never = entry
        return exhaustive
      }
    }
  }

  return [...seen.values()]
}
