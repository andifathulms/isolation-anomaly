import { describe as suite, expect, it } from 'vitest'
import { LEVELS } from '@/lib/schedule'
import { PACKS, enginePackSchema, packCitations, requirePack, resolveLevel } from '@/lib/packs'
import postgres16 from '@/data/packs/postgres-16.json'

suite('pack loading', () => {
  it('loads every registered pack through the schema', () => {
    expect(PACKS.length).toBeGreaterThan(0)
    for (const pack of PACKS) {
      expect(enginePackSchema.safeParse(pack).success).toBe(true)
    }
  })

  it('declares an entry for every standard level name', () => {
    for (const pack of PACKS) {
      for (const level of LEVELS) {
        expect(pack.levels[level], `${pack.id} is missing ${level}`).toBeDefined()
      }
    }
  })

  it('carries a citation with a quote on every rule', () => {
    for (const pack of PACKS) {
      const citations = packCitations(pack)
      expect(citations.length).toBeGreaterThan(4)
      for (const citation of citations) {
        expect(citation.quote.length).toBeGreaterThan(19)
        expect(citation.url.startsWith('https://')).toBe(true)
      }
    }
  })
})

suite('level alias declarations', () => {
  it('resolves an alias to the semantics that actually run', () => {
    const pack = requirePack('postgres-16')
    const resolved = resolveLevel(pack, 'READ UNCOMMITTED')
    expect(resolved?.effective).toBe('READ COMMITTED')
    expect(resolved?.aliasOf).toBe('READ COMMITTED')
    expect(resolved?.semantics.visibility.value.readsUncommitted).toBe(false)
  })

  it('returns null for an unsupported level rather than the closest one', () => {
    const pack = requirePack('postgres-16')
    expect(resolveLevel(pack, 'SNAPSHOT')).toBeNull()
  })
})

suite('postgres-16 pack', () => {
  const pack = requirePack('postgres-16')

  it('defaults to READ COMMITTED', () => {
    expect(pack.defaultLevel).toBe('READ COMMITTED')
  })

  it('models REPEATABLE READ as snapshot isolation, not the ANSI level', () => {
    const entry = pack.levels['REPEATABLE READ']
    if (entry.kind !== 'modelled') throw new Error('expected a modelled level')
    expect(entry.displayName).toContain('Snapshot Isolation')
    expect(entry.semantics.visibility.value.snapshot).toBe('transaction')
    expect(entry.semantics.serializationCheck.value).toBe('none')
  })

  it('never permits dirty reads at any level', () => {
    for (const level of LEVELS) {
      const resolved = resolveLevel(pack, level)
      if (!resolved) continue
      expect(resolved.semantics.visibility.value.readsUncommitted).toBe(false)
    }
  })

  it('takes no read locks — readers never block writers', () => {
    for (const level of LEVELS) {
      const resolved = resolveLevel(pack, level)
      if (!resolved) continue
      expect(resolved.semantics.locks.plainRead.value.record).toBe('none')
      expect(resolved.semantics.locks.plainRead.value.gap).toBe('none')
    }
  })

  it('has no gap locks anywhere — phantoms are prevented by the snapshot', () => {
    for (const level of LEVELS) {
      const resolved = resolveLevel(pack, level)
      if (!resolved) continue
      for (const plan of Object.values(resolved.semantics.locks)) {
        expect(plan.value.gap).toBe('none')
      }
    }
  })

  it('runs the serialization check only at SERIALIZABLE', () => {
    const withSsi = LEVELS.filter((level) => {
      const entry = pack.levels[level]
      return entry.kind === 'modelled' && entry.semantics.serializationCheck.value === 'ssi'
    })
    expect(withSsi).toEqual(['SERIALIZABLE'])
  })

  it('aborts stale writes at REPEATABLE READ and re-applies them at READ COMMITTED', () => {
    const rc = resolveLevel(pack, 'READ COMMITTED')
    const rr = resolveLevel(pack, 'REPEATABLE READ')
    expect(rc?.semantics.conflicts.value.writeOnStaleRow).toBe('applyToLatest')
    expect(rr?.semantics.conflicts.value.writeOnStaleRow).toBe('abort')
  })
})

suite('pack schema rejection', () => {
  it('rejects a rule whose citation has no quote', () => {
    const broken = structuredClone(postgres16) as Record<string, unknown>
    const levels = broken.levels as Record<string, { semantics: { visibility: { citation: { quote: string } } } }>
    const level = levels['READ COMMITTED']
    if (!level) throw new Error('fixture changed')
    level.semantics.visibility.citation.quote = ''
    expect(enginePackSchema.safeParse(broken).success).toBe(false)
  })

  it('rejects an alias pointing at a level that is not modelled', () => {
    const broken = structuredClone(postgres16) as Record<string, unknown>
    const levels = broken.levels as Record<string, unknown>
    levels['READ UNCOMMITTED'] = {
      kind: 'alias',
      displayName: 'READ UNCOMMITTED',
      of: 'SNAPSHOT',
      summary: 'A deliberately broken alias for the test.',
      citation: {
        source: 'PostgreSQL 16 — 13.2. Transaction Isolation',
        url: 'https://www.postgresql.org/docs/16/transaction-iso.html',
        quote: 'This is a long enough quote to satisfy the schema minimum length.',
      },
    }
    const result = enginePackSchema.safeParse(broken)
    expect(result.success).toBe(false)
  })
})
