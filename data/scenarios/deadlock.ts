import type { Scenario } from '@/lib/scenarios/types'

/**
 * The one scenario that documents a response rather than an anomaly.
 *
 * Two transfers lock the same two accounts in opposite order. Nothing here is
 * an anomaly from the catalogue — no value is read wrongly and no constraint is
 * violated — because neither transaction gets to finish. What the schedule
 * exposes is the *other* half of what an isolation level costs you: the engine
 * has to break the tie, and each of them breaks it differently.
 *
 * It also exists to test a claim rather than to teach one. Two packs declare
 * that the transaction whose wait closed the cycle is the one rolled back;
 * until this schedule was recorded, one of those declarations had no recording
 * behind it.
 */
export const deadlock: Scenario = {
  id: 'deadlock',
  title: 'Two transfers that lock the same accounts in opposite order',
  framing:
    'Two transfers run at once. One moves money from account 1 to account 2 and locks them in that order; the other moves money from 2 to 1 and locks them the other way round. Each holds what the other needs next.',
  lesson:
    'Neither transaction did anything unusual, and no isolation level prevents this — locking in a consistent order is the application’s job. What differs is the engine’s answer. PostgreSQL and MySQL InnoDB roll a transaction back and name it, so the other proceeds. SQL Server chooses its victim by internal cost estimate and Oracle says plainly that either session could get the error, so for those three this model refuses to say who loses rather than inventing it — and Oracle would roll back only the statement in any case, leaving the transaction open.',
  anomaly: null,
  schedule: {
    id: 'deadlock',
    title: 'Deadlock',
    transactions: ['T1', 'T2'],
    initial: [
      { key: 1, value: 100 },
      { key: 2, value: 100 },
    ],
    steps: [
      { txn: 'T1', op: { type: 'begin' } },
      { txn: 'T2', op: { type: 'begin' } },
      { txn: 'T1', op: { type: 'selectForUpdate', key: 1 } },
      { txn: 'T2', op: { type: 'selectForUpdate', key: 2 } },
      // Each now wants the row the other is holding.
      { txn: 'T1', op: { type: 'selectForUpdate', key: 2 } },
      { txn: 'T2', op: { type: 'selectForUpdate', key: 1 } },
      { txn: 'T1', op: { type: 'commit' } },
      { txn: 'T2', op: { type: 'commit' } },
    ],
  },
  expectedAt: {
    'postgres-16': [],
    'mysql-8-innodb': [],
    'sqlserver-2022': [],
    'sqlserver-2022-rcsi': [],
    'oracle-23ai': [],
  },
}
