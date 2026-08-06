import { LEVEL_ABBREVIATIONS, LEVELS, type IsolationLevel, type Schedule } from '@/lib/schedule'
import { DEFAULT_PACK_ID } from '@/lib/packs'

/**
 * Sharing by URL hash — PRD §5.7. No accounts and no server, so the state of a
 * run has to travel in the link: which scenario or custom schedule, which
 * engine, which level, and which step the reader was looking at.
 */

export type ShareState = {
  readonly scenarioId: string | null
  /** A schedule carried in the link, for one the reader built themselves. */
  readonly schedule: Schedule | null
  readonly packId: string
  readonly level: IsolationLevel
  readonly step: number
}

const ABBREVIATION_TO_LEVEL = new Map<string, IsolationLevel>(
  LEVELS.map((level) => [LEVEL_ABBREVIATIONS[level], level]),
)

function encodeSchedule(schedule: Schedule): string {
  const json = JSON.stringify(schedule)
  const bytes = new TextEncoder().encode(json)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  // URL-safe base64, so the hash survives being pasted into a chat client.
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function decodeSchedule(encoded: string): Schedule | null {
  try {
    const padded = encoded.replace(/-/g, '+').replace(/_/g, '/')
    const binary = atob(padded)
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0))
    const parsed: unknown = JSON.parse(new TextDecoder().decode(bytes))
    if (typeof parsed !== 'object' || parsed === null) return null
    if (!('steps' in parsed) || !('transactions' in parsed)) return null
    return parsed as Schedule
  } catch {
    return null
  }
}

export function encodeShareState(state: ShareState): string {
  const parts: string[] = []
  if (state.schedule) parts.push(`d=${encodeSchedule(state.schedule)}`)
  else if (state.scenarioId) parts.push(`s=${state.scenarioId}`)
  parts.push(`p=${state.packId}`)
  parts.push(`l=${LEVEL_ABBREVIATIONS[state.level]}`)
  parts.push(`i=${state.step}`)
  return parts.join('&')
}

export function decodeShareState(hash: string, fallback: ShareState): ShareState {
  const params = new URLSearchParams(hash.replace(/^#/, ''))

  const encodedSchedule = params.get('d')
  const schedule = encodedSchedule ? decodeSchedule(encodedSchedule) : null
  const levelParam = params.get('l')
  const level = levelParam ? ABBREVIATION_TO_LEVEL.get(levelParam) : undefined
  const stepParam = params.get('i')
  const step = stepParam !== null && /^\d+$/.test(stepParam) ? Number(stepParam) : fallback.step

  return {
    scenarioId: schedule ? null : (params.get('s') ?? fallback.scenarioId),
    schedule,
    packId: params.get('p') ?? fallback.packId ?? DEFAULT_PACK_ID,
    level: level ?? fallback.level,
    step,
  }
}
