/**
 * The anomaly catalogue, from the published definitions.
 *
 * The formal phenomena are Berenson et al.'s, in their notation: `w1[x]` is
 * transaction 1 writing x, `r1[P]` is transaction 1 reading a predicate,
 * `c1`/`a1` are commit and abort. Detection is written against these strings
 * and nothing else — the detector never asks the executor what it thinks
 * happened (CLAUDE.md invariant 5).
 *
 * Write skew is on this list and absent from ANSI's. That absence is why so
 * many applications are built on the assumption that snapshot isolation is
 * enough.
 */
export const ANOMALY_IDS = [
  'dirty-write',
  'dirty-read',
  'lost-update',
  'non-repeatable-read',
  'phantom-read',
  'read-skew',
  'write-skew',
] as const

export type AnomalyId = (typeof ANOMALY_IDS)[number]

export type AnomalySource = {
  readonly title: string
  readonly url: string
}

const BERENSON: AnomalySource = {
  title: 'Berenson, Bernstein, Gray, Melton, O’Neil & O’Neil (1995), A Critique of ANSI SQL Isolation Levels',
  url: 'https://arxiv.org/abs/cs/0701157',
}

const ANSI: AnomalySource = {
  title: 'ANSI SQL-92 §4.28, Isolation levels of SQL-transactions',
  url: 'https://www.contrib.andrew.cmu.edu/~shadow/sql/sql1992.txt',
}

export type AnomalyDefinition = {
  readonly id: AnomalyId
  readonly name: string
  /** The phenomenon in schedule notation, as published. */
  readonly formal: string
  /** Berenson et al.'s label, where they give one. */
  readonly label: string
  readonly definition: string
  /** Why an application developer should care, in one sentence. */
  readonly stakes: string
  /** True where the ANSI SQL-92 list names this phenomenon. */
  readonly inAnsiList: boolean
  readonly sources: readonly AnomalySource[]
}

export const ANOMALIES: Readonly<Record<AnomalyId, AnomalyDefinition>> = {
  'dirty-write': {
    id: 'dirty-write',
    name: 'Dirty write',
    label: 'P0',
    formal: 'w1[x] ... w2[x] ... ((c1 or a1) and (c2 or a2) in any order)',
    definition:
      'Two transactions write the same row before either has ended, so a rollback cannot restore a consistent state — one transaction’s write is interleaved with another’s.',
    stakes:
      'A rollback stops being a rollback: undoing one transaction restores a value the other transaction already replaced.',
    inAnsiList: false,
    sources: [BERENSON],
  },
  'dirty-read': {
    id: 'dirty-read',
    name: 'Dirty read',
    label: 'P1',
    formal: 'w1[x] ... r2[x] ... (c1 or a1)',
    definition:
      'A transaction reads a row version written by another transaction that has not yet committed, so the value read may never have existed in any committed state.',
    stakes: 'You act on a number that was rolled back a millisecond later.',
    inAnsiList: true,
    sources: [ANSI, BERENSON],
  },
  'lost-update': {
    id: 'lost-update',
    name: 'Lost update',
    label: 'P4',
    formal: 'r1[x] ... w2[x] ... w1[x] ... c1',
    definition:
      'Two transactions read the same row, then both write it based on what they read. The first write is overwritten by a value computed without knowledge of it.',
    stakes:
      'Read-modify-write on a counter: two decrements of a stock level become one, and the inventory is wrong with no error anywhere.',
    inAnsiList: false,
    sources: [BERENSON],
  },
  'non-repeatable-read': {
    id: 'non-repeatable-read',
    name: 'Non-repeatable read',
    label: 'P2',
    formal: 'r1[x] ... w2[x] ... c2 ... r1[x]',
    definition:
      'A transaction reads a row twice and gets different values, because another transaction committed a change in between.',
    stakes:
      'Two parts of one request disagree about the same row, and whichever branch runs second wins.',
    inAnsiList: true,
    sources: [ANSI, BERENSON],
  },
  'phantom-read': {
    id: 'phantom-read',
    name: 'Phantom read',
    label: 'P3',
    formal: 'r1[P] ... w2[y in P] ... c2 ... r1[P]',
    definition:
      'A transaction runs the same predicate read twice and the second run returns rows the first did not, because another transaction inserted or deleted a row matching the predicate.',
    stakes:
      'You check that a slot is free, and by the time you write the booking the set you checked has grown.',
    inAnsiList: true,
    sources: [ANSI, BERENSON],
  },
  'read-skew': {
    id: 'read-skew',
    name: 'Read skew',
    label: 'A5A',
    formal: 'r1[x] ... w2[x] ... w2[y] ... c2 ... r1[y]',
    definition:
      'A transaction reads two rows and sees them in states that never coexisted, because another transaction committed a change to both in between.',
    stakes:
      'A bank transfer read at the wrong moment: you see the debit but not the credit, and the books do not balance.',
    inAnsiList: false,
    sources: [BERENSON],
  },
  'write-skew': {
    id: 'write-skew',
    name: 'Write skew',
    label: 'A5B',
    formal: 'r1[x] ... r2[y] ... w1[y] ... w2[x] ... (c1 and c2)',
    definition:
      'Two transactions read an overlapping set, each check a constraint over it, and each write a different row. No row is written twice and nothing conflicts, yet the constraint holds for each transaction alone and fails for the pair.',
    stakes:
      'The on-call roster empties. Two doctors each check that someone else is on call, each go off call, and both commit — snapshot isolation permits it, and no error is raised.',
    inAnsiList: false,
    sources: [BERENSON],
  },
}

export function anomaly(id: AnomalyId): AnomalyDefinition {
  return ANOMALIES[id]
}
