import type { Scenario } from '@/lib/scenarios/types'

/**
 * Reading the same thing twice. The first scenario reads one row twice; the
 * second reads two rows that a concurrent transaction changed together, which
 * is the harder case — each individual read is of a committed value, and the
 * pair still describes a state that never existed.
 */

export const nonRepeatableRead: Scenario = {
  id: 'non-repeatable-read',
  title: 'The same row, read twice, with two different values',
  framing:
    'A checkout re-reads the price of an item to compute tax after having read it to compute the subtotal. Between the two reads, a price update commits.',
  lesson:
    'At READ COMMITTED every statement takes a fresh snapshot, so the two reads legitimately disagree. REPEATABLE READ takes one snapshot for the transaction and both reads return 100.',
  anomaly: 'non-repeatable-read',
  schedule: {
    id: 'non-repeatable-read',
    title: 'Non-repeatable read',
    transactions: ['T1', 'T2'],
    initial: [{ key: 1, value: 100 }],
    steps: [
      { txn: 'T1', op: { type: 'begin' } },
      { txn: 'T1', op: { type: 'read', key: 1 } },
      { txn: 'T2', op: { type: 'begin' } },
      { txn: 'T2', op: { type: 'write', key: 1, value: 150 } },
      { txn: 'T2', op: { type: 'commit' } },
      { txn: 'T1', op: { type: 'read', key: 1 } },
      { txn: 'T1', op: { type: 'commit' } },
    ],
  },
  expectedAt: {
    'postgres-16': ['READ UNCOMMITTED', 'READ COMMITTED'],
    'mysql-8-innodb': ['READ UNCOMMITTED', 'READ COMMITTED'],
    'sqlserver-2022': ['READ UNCOMMITTED', 'READ COMMITTED'],
    'oracle-23ai': ['READ COMMITTED'],
    'sqlserver-2022-rcsi': ['READ UNCOMMITTED', 'READ COMMITTED'],
  },
}

export const readSkew: Scenario = {
  id: 'read-skew',
  title: 'A transfer seen half-finished',
  framing:
    'Accounts 1 and 2 hold 100 each and the invariant is that they total 200. An audit reads account 1, a transfer of 50 from account 1 to account 2 commits, and then the audit reads account 2.',
  lesson:
    'The audit reads 100 and then 150 and reports a total of 250. Neither read saw uncommitted data and both values were committed — but not at the same time. This is why a report needs one snapshot, not two correct reads.',
  anomaly: 'read-skew',
  schedule: {
    id: 'read-skew',
    title: 'Read skew',
    transactions: ['T1', 'T2'],
    initial: [
      { key: 1, value: 100 },
      { key: 2, value: 100 },
    ],
    steps: [
      { txn: 'T1', op: { type: 'begin' } },
      { txn: 'T1', op: { type: 'read', key: 1 } },
      { txn: 'T2', op: { type: 'begin' } },
      { txn: 'T2', op: { type: 'write', key: 1, value: 50 } },
      { txn: 'T2', op: { type: 'write', key: 2, value: 150 } },
      { txn: 'T2', op: { type: 'commit' } },
      { txn: 'T1', op: { type: 'read', key: 2 } },
      { txn: 'T1', op: { type: 'commit' } },
    ],
  },
  expectedAt: {
    'postgres-16': ['READ UNCOMMITTED', 'READ COMMITTED'],
    'mysql-8-innodb': ['READ UNCOMMITTED', 'READ COMMITTED'],
    'sqlserver-2022': ['READ UNCOMMITTED', 'READ COMMITTED'],
    'oracle-23ai': ['READ COMMITTED'],
    'sqlserver-2022-rcsi': ['READ UNCOMMITTED', 'READ COMMITTED'],
  },
}
