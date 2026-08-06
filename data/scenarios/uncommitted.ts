import type { Scenario } from '@/lib/scenarios/types'

/**
 * The two phenomena that involve an unfinished transaction: reading its writes,
 * and writing over them. PostgreSQL permits neither at any level, which is
 * itself the lesson — READ UNCOMMITTED is a name it accepts, not a mode it has.
 */

export const dirtyRead: Scenario = {
  id: 'dirty-read',
  title: 'Reading a value that was rolled back',
  framing:
    'A refund is being processed. The refund transaction has already reduced the balance to 0 when a reporting query reads it, and then the refund fails and rolls back.',
  lesson:
    'ANSI defines READ UNCOMMITTED as the level that permits this. PostgreSQL accepts the name and gives you READ COMMITTED, so the reporting query sees 100 at every level — the balance that was actually committed. MySQL InnoDB is the contrast: its READ UNCOMMITTED is real, and the reporting query there reads 0 — a balance that never existed. SQL Server’s READ UNCOMMITTED is real too, and it reads 0 for the same reason.',
  anomaly: 'dirty-read',
  schedule: {
    id: 'dirty-read',
    title: 'Dirty read',
    transactions: ['T1', 'T2'],
    initial: [{ key: 1, value: 100 }],
    steps: [
      { txn: 'T1', op: { type: 'begin' } },
      { txn: 'T2', op: { type: 'begin' } },
      { txn: 'T1', op: { type: 'write', key: 1, value: 0 } },
      { txn: 'T2', op: { type: 'read', key: 1 } },
      { txn: 'T1', op: { type: 'rollback' } },
      { txn: 'T2', op: { type: 'read', key: 1 } },
      { txn: 'T2', op: { type: 'commit' } },
    ],
  },
  expectedAt: {
    'postgres-16': [],
    'mysql-8-innodb': ['READ UNCOMMITTED'],
    'sqlserver-2022': ['READ UNCOMMITTED'],
  },
}

export const dirtyWrite: Scenario = {
  id: 'dirty-write',
  title: 'Two transactions writing the same row before either ends',
  framing:
    'Two administrators edit the same setting at the same time. The first one’s edit is still uncommitted when the second one writes.',
  lesson:
    'The second write waits for the first transaction to end rather than overwriting an uncommitted value — first updater wins. Because the first transaction rolls back, the second proceeds from the original row.',
  anomaly: 'dirty-write',
  schedule: {
    id: 'dirty-write',
    title: 'Dirty write',
    transactions: ['T1', 'T2'],
    initial: [{ key: 1, value: 100 }],
    steps: [
      { txn: 'T1', op: { type: 'begin' } },
      { txn: 'T2', op: { type: 'begin' } },
      { txn: 'T1', op: { type: 'write', key: 1, value: 10 } },
      { txn: 'T2', op: { type: 'write', key: 1, value: 20 } },
      { txn: 'T1', op: { type: 'rollback' } },
      { txn: 'T2', op: { type: 'commit' } },
    ],
  },
  expectedAt: {
    'postgres-16': [],
    'mysql-8-innodb': [],
    'sqlserver-2022': [],
  },
}
