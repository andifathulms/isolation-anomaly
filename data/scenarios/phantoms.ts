import type { Scenario } from '@/lib/scenarios/types'

/**
 * Predicate reads. Rows 1..5 are the slots of a room booking calendar; a row
 * exists when the slot is booked. Phantoms are where engines diverge most,
 * because preventing them is the difference between one snapshot and a lock
 * over a range of an index that has no rows in it yet.
 */

export const phantomRead: Scenario = {
  id: 'phantom-read',
  title: 'A booking that appears inside one transaction',
  framing:
    'Slots 1 and 2 of a five-slot calendar are booked. A report counts the bookings, someone books slot 3 and commits, and the report counts again to render a total.',
  lesson:
    'At READ COMMITTED the second count returns three rows where the first returned two. PostgreSQL’s REPEATABLE READ prevents this — which the SQL standard does not require of that level, and which is exactly why the level name cannot be trusted across engines. SQL Server settles the argument about what the level name means: its REPEATABLE READ holds shared locks on the rows it read but cannot lock a row that does not exist yet, so the phantom appears there and not on PostgreSQL — the same level name, opposite answers, and ANSI permits both.',
  anomaly: 'phantom-read',
  schedule: {
    id: 'phantom-read',
    title: 'Phantom read',
    transactions: ['T1', 'T2'],
    initial: [
      { key: 1, value: 1 },
      { key: 2, value: 1 },
    ],
    steps: [
      { txn: 'T1', op: { type: 'begin' } },
      { txn: 'T1', op: { type: 'readRange', predicate: { type: 'keyRange', from: 1, to: 5 } } },
      { txn: 'T2', op: { type: 'begin' } },
      { txn: 'T2', op: { type: 'insert', key: 3, value: 1 } },
      { txn: 'T2', op: { type: 'commit' } },
      { txn: 'T1', op: { type: 'readRange', predicate: { type: 'keyRange', from: 1, to: 5 } } },
      { txn: 'T1', op: { type: 'commit' } },
    ],
  },
  expectedAt: {
    'postgres-16': ['READ UNCOMMITTED', 'READ COMMITTED'],
    'mysql-8-innodb': ['READ UNCOMMITTED', 'READ COMMITTED'],
    'sqlserver-2022': ['READ UNCOMMITTED', 'READ COMMITTED', 'REPEATABLE READ'],
    'oracle-23ai': ['READ COMMITTED'],
  },
}

export const phantomInsertRace: Scenario = {
  id: 'phantom-insert-race',
  title: 'Two bookings for a calendar that was empty when both looked',
  framing:
    'Nobody has booked slots 1 to 5. Two people each check that the range is empty, and each book a different slot in it.',
  lesson:
    'Both range reads return nothing, and both inserts succeed, so the calendar ends with two bookings where each booker believed there would be one. No row was written twice, so nothing conflicts — this is write skew wearing a phantom’s clothes, and only SERIALIZABLE stops it.',
  anomaly: 'write-skew',
  schedule: {
    id: 'phantom-insert-race',
    title: 'Phantom insert race',
    transactions: ['T1', 'T2'],
    initial: [],
    steps: [
      { txn: 'T1', op: { type: 'begin' } },
      { txn: 'T2', op: { type: 'begin' } },
      { txn: 'T1', op: { type: 'readRange', predicate: { type: 'keyRange', from: 1, to: 5 } } },
      { txn: 'T2', op: { type: 'readRange', predicate: { type: 'keyRange', from: 1, to: 5 } } },
      { txn: 'T1', op: { type: 'insert', key: 1, value: 1 } },
      { txn: 'T2', op: { type: 'insert', key: 2, value: 1 } },
      { txn: 'T1', op: { type: 'commit' } },
      { txn: 'T2', op: { type: 'commit' } },
    ],
  },
  expectedAt: {
    'postgres-16': ['READ UNCOMMITTED', 'READ COMMITTED', 'REPEATABLE READ'],
    'mysql-8-innodb': ['READ UNCOMMITTED', 'READ COMMITTED', 'REPEATABLE READ'],
    'sqlserver-2022': ['READ UNCOMMITTED', 'READ COMMITTED', 'REPEATABLE READ', 'SNAPSHOT'],
    'oracle-23ai': ['READ COMMITTED', 'SERIALIZABLE'],
  },
}
