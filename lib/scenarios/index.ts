import { dirtyRead, dirtyWrite } from '@/data/scenarios/uncommitted'
import { lostUpdate, lostUpdateLocked } from '@/data/scenarios/lost-updates'
import { nonRepeatableRead, readSkew } from '@/data/scenarios/repeatability'
import { phantomInsertRace, phantomRead } from '@/data/scenarios/phantoms'
import { writeSkew, writeSkewLocked } from '@/data/scenarios/write-skew'
import type { Scenario } from './types'

export type { Scenario } from './types'

/**
 * Ordered as a reading order, not alphabetically: the phenomena that involve an
 * unfinished transaction, then repeatability, then the two that snapshot
 * isolation does not save you from.
 */
export const SCENARIOS: readonly Scenario[] = [
  dirtyRead,
  dirtyWrite,
  nonRepeatableRead,
  readSkew,
  lostUpdate,
  lostUpdateLocked,
  phantomRead,
  writeSkew,
  writeSkewLocked,
  phantomInsertRace,
]

export function getScenario(id: string): Scenario | null {
  return SCENARIOS.find((scenario) => scenario.id === id) ?? null
}

export function requireScenario(id: string): Scenario {
  const scenario = getScenario(id)
  if (!scenario) throw new Error(`No scenario with id ${id}`)
  return scenario
}
