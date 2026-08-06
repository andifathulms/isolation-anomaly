import type { Scenario } from '@/lib/scenarios/types'

/**
 * Read-modify-write on a counter, the most common shape in application code,
 * and the same schedule with the row locked — which is how you fix it without
 * changing isolation level.
 */

export const lostUpdate: Scenario = {
  id: 'lost-update',
  title: 'Two stock decrements become one',
  framing:
    'Ten units in stock. Two orders each read the stock level, subtract one, and write the result back. Nine units are recorded, and one unit has been sold twice.',
  lesson:
    'Neither transaction did anything wrong on its own, no error was raised, and the count is wrong. READ COMMITTED re-applies the second write to the newly committed version, so it writes 9 over 9. REPEATABLE READ refuses instead, aborting with 40001 — an error your code can retry.',
  anomaly: 'lost-update',
  schedule: {
    id: 'lost-update',
    title: 'Lost update',
    transactions: ['T1', 'T2'],
    initial: [{ key: 1, value: 10 }],
    steps: [
      { txn: 'T1', op: { type: 'begin' } },
      { txn: 'T2', op: { type: 'begin' } },
      { txn: 'T1', op: { type: 'read', key: 1 } },
      { txn: 'T2', op: { type: 'read', key: 1 } },
      { txn: 'T1', op: { type: 'write', key: 1, value: 9 } },
      { txn: 'T1', op: { type: 'commit' } },
      { txn: 'T2', op: { type: 'write', key: 1, value: 9 } },
      { txn: 'T2', op: { type: 'commit' } },
    ],
  },
  expectedAt: {
    'postgres-16': ['READ UNCOMMITTED', 'READ COMMITTED'],
  },
}

export const lostUpdateLocked: Scenario = {
  id: 'lost-update-locked',
  title: 'The same two decrements, with the row locked',
  framing:
    'The same two orders, but each reads the stock level with SELECT ... FOR UPDATE before writing it back.',
  lesson:
    'The second order’s locking read waits for the first to commit. At READ COMMITTED it then returns the new value, 9, so the second decrement is computed from what is actually there. At REPEATABLE READ the locking read of a row that changed under the snapshot aborts with 40001 instead — the same protection, delivered as an error.',
  anomaly: 'lost-update',
  schedule: {
    id: 'lost-update-locked',
    title: 'Lost update, prevented by a locking read',
    transactions: ['T1', 'T2'],
    initial: [{ key: 1, value: 10 }],
    steps: [
      { txn: 'T1', op: { type: 'begin' } },
      { txn: 'T2', op: { type: 'begin' } },
      { txn: 'T1', op: { type: 'selectForUpdate', key: 1 } },
      { txn: 'T2', op: { type: 'selectForUpdate', key: 1 } },
      { txn: 'T1', op: { type: 'write', key: 1, value: 9 } },
      { txn: 'T1', op: { type: 'commit' } },
      { txn: 'T2', op: { type: 'write', key: 1, value: 8 } },
      { txn: 'T2', op: { type: 'commit' } },
    ],
  },
  expectedAt: {
    'postgres-16': [],
  },
}
