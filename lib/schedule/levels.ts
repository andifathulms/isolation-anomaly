/**
 * Isolation level *names*, not semantics.
 *
 * The whole point of the project is that these names do not carry consistent
 * meaning across engines: PostgreSQL's REPEATABLE READ is snapshot isolation,
 * its READ UNCOMMITTED is READ COMMITTED, and Oracle's SERIALIZABLE is
 * snapshot isolation. Meaning lives in an engine pack, never here.
 */
export const LEVELS = [
  'READ UNCOMMITTED',
  'READ COMMITTED',
  'REPEATABLE READ',
  'SNAPSHOT',
  'SERIALIZABLE',
] as const

export type IsolationLevel = (typeof LEVELS)[number]

/** Short form used in the matrix header and in URL hashes. */
export const LEVEL_ABBREVIATIONS: Record<IsolationLevel, string> = {
  'READ UNCOMMITTED': 'RU',
  'READ COMMITTED': 'RC',
  'REPEATABLE READ': 'RR',
  SNAPSHOT: 'SI',
  SERIALIZABLE: 'SER',
}

export function isIsolationLevel(value: string): value is IsolationLevel {
  return (LEVELS as readonly string[]).includes(value)
}
