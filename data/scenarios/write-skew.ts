import type { Scenario } from '@/lib/scenarios/types'

/**
 * The point of the project — PRD §1. Rows 1 and 2 are two doctors; `v = 1`
 * means on call. The constraint is that at least one of them is on call, and
 * nothing in the schema can express it.
 *
 * Both transactions read the same set, both find the constraint satisfied, and
 * each writes a *different* row. No row is written twice, so there is no write
 * conflict for the engine to notice, and snapshot isolation lets both commit.
 */

export const writeSkew: Scenario = {
  id: 'write-skew',
  title: 'The on-call roster empties',
  framing:
    'Two doctors are on call and at least one must remain. Each opens the roster, sees that the other is on call, and takes themselves off. Both commit.',
  lesson:
    'This is the anomaly that is not in the ANSI list. PostgreSQL’s REPEATABLE READ is snapshot isolation, and permits it: both transactions commit and nobody is on call. Only SERIALIZABLE catches it, and it does so by aborting the second transaction to commit with a read/write dependency failure — not by blocking. MySQL InnoDB permits it at REPEATABLE READ as well, and at SERIALIZABLE it does not detect anything — it deadlocks, and one transaction is rolled back with 1213. SQL Server permits it at SNAPSHOT, which is the same anomaly under a name that at least admits what the level is; at REPEATABLE READ and SERIALIZABLE its shared locks turn the schedule into a deadlock, and because SQL Server picks its victim by cost estimate this model refuses to say which transaction loses. And Oracle settles the argument: it permits this at the level called SERIALIZABLE, because Oracle’s SERIALIZABLE is snapshot isolation. Both doctors go off call, both commit, and no error is raised — at the strongest level name the standard has.',
  anomaly: 'write-skew',
  schedule: {
    id: 'write-skew',
    title: 'Write skew',
    transactions: ['T1', 'T2'],
    initial: [
      { key: 1, value: 1 },
      { key: 2, value: 1 },
    ],
    steps: [
      { txn: 'T1', op: { type: 'begin' } },
      { txn: 'T2', op: { type: 'begin' } },
      { txn: 'T1', op: { type: 'readRange', predicate: { type: 'keyRange', from: 1, to: 2 } } },
      { txn: 'T2', op: { type: 'readRange', predicate: { type: 'keyRange', from: 1, to: 2 } } },
      { txn: 'T1', op: { type: 'write', key: 1, value: 0 } },
      { txn: 'T2', op: { type: 'write', key: 2, value: 0 } },
      { txn: 'T1', op: { type: 'commit' } },
      { txn: 'T2', op: { type: 'commit' } },
    ],
  },
  expectedAt: {
    'postgres-16': ['READ UNCOMMITTED', 'READ COMMITTED', 'REPEATABLE READ'],
    'mysql-8-innodb': ['READ UNCOMMITTED', 'READ COMMITTED', 'REPEATABLE READ'],
    'sqlserver-2022': ['READ UNCOMMITTED', 'READ COMMITTED', 'SNAPSHOT'],
    'oracle-23ai': ['READ COMMITTED', 'SERIALIZABLE'],
  },
}

export const writeSkewLocked: Scenario = {
  id: 'write-skew-locked',
  title: 'The same roster, read with FOR UPDATE',
  framing:
    'The same two doctors, but each reads both rows with SELECT ... FOR UPDATE before writing, which is the usual advice when you cannot use SERIALIZABLE.',
  lesson:
    'The locks serialize the two transactions. The second doctor’s locking read waits and then returns a roster in which the first doctor is already off call, so this schedule is equivalent to running T1 and then T2 — there is no anomaly left for the database to permit. The roster still empties, because this schedule writes without re-checking what the locking read returned; that remaining bug is the application’s, and it is now visible in the value read rather than hidden. At REPEATABLE READ the locking read aborts with 40001 instead.',
  anomaly: 'write-skew',
  schedule: {
    id: 'write-skew-locked',
    title: 'Write skew, prevented by locking reads',
    transactions: ['T1', 'T2'],
    initial: [
      { key: 1, value: 1 },
      { key: 2, value: 1 },
    ],
    steps: [
      { txn: 'T1', op: { type: 'begin' } },
      { txn: 'T2', op: { type: 'begin' } },
      { txn: 'T1', op: { type: 'selectForUpdate', key: 1 } },
      { txn: 'T1', op: { type: 'selectForUpdate', key: 2 } },
      { txn: 'T2', op: { type: 'selectForUpdate', key: 1 } },
      { txn: 'T1', op: { type: 'write', key: 1, value: 0 } },
      { txn: 'T1', op: { type: 'commit' } },
      { txn: 'T2', op: { type: 'selectForUpdate', key: 2 } },
      { txn: 'T2', op: { type: 'write', key: 2, value: 0 } },
      { txn: 'T2', op: { type: 'commit' } },
    ],
  },
  expectedAt: {
    'postgres-16': [],
    'mysql-8-innodb': [],
    'sqlserver-2022': [],
    'oracle-23ai': [],
  },
}
