import { describe as suite, expect, it } from 'vitest'
import { SCENARIOS } from '@/lib/scenarios'
import { decodeShareState, encodeShareState, type ShareState } from '@/lib/share'
import { execute } from '@/lib/engine'
import { requirePack } from '@/lib/packs'
import { assertValidSchedule } from '@/lib/schedule'

/**
 * A run is a link — PRD §5.7. If a shared link does not reproduce the run, the
 * feature is worse than not having it, so the round trip is asserted rather
 * than assumed.
 */

const base: ShareState = {
  scenarioId: 'write-skew',
  schedule: null,
  packId: 'postgres-16',
  level: 'REPEATABLE READ',
  step: 4,
}

suite('sharing a run by URL hash', () => {
  it('round-trips a scenario, engine, level and step', () => {
    const decoded = decodeShareState(`#${encodeShareState(base)}`, base)
    expect(decoded).toEqual(base)
  })

  it('keeps the hash short and readable for a scenario', () => {
    expect(encodeShareState(base)).toBe('s=write-skew&p=postgres-16&l=RR&i=4')
  })

  it('round-trips a hand-built schedule, and it still executes the same way', () => {
    const scenario = SCENARIOS.find((candidate) => candidate.id === 'write-skew')
    if (!scenario) throw new Error('write-skew scenario missing')
    const state: ShareState = { ...base, scenarioId: null, schedule: scenario.schedule }

    const decoded = decodeShareState(`#${encodeShareState(state)}`, base)
    expect(decoded.schedule).toEqual(scenario.schedule)
    if (!decoded.schedule) return

    assertValidSchedule(decoded.schedule)
    const pack = requirePack(decoded.packId)
    const before = execute(scenario.schedule, pack, decoded.level)
    const after = execute(decoded.schedule, pack, decoded.level)
    expect(JSON.stringify(after)).toBe(JSON.stringify(before))
  })

  it('falls back rather than throwing on a hash it does not understand', () => {
    expect(decodeShareState('#l=NONSENSE&i=abc&p=', base).level).toBe(base.level)
    expect(decodeShareState('#i=abc', base).step).toBe(base.step)
    expect(decodeShareState('#d=not-base64!!', base).schedule).toBeNull()
    expect(decodeShareState('', base)).toEqual(base)
  })

  it('prefers a carried schedule over a scenario id, so an edited run wins', () => {
    const scenario = SCENARIOS[0]
    if (!scenario) throw new Error('no scenarios')
    const encoded = encodeShareState({ ...base, schedule: scenario.schedule })
    expect(encoded.startsWith('d=')).toBe(true)
    expect(encoded).not.toContain('s=')
  })
})
