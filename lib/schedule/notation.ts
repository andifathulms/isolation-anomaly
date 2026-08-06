import type { Operation, Predicate } from './types'

/**
 * How an operation reads on the score. Two forms:
 *
 *  - `notate` — the dense algebraic form used in schedule literature and in
 *    the operation marks: `r1[x]`, `w1[x=5]`, `c1`.
 *  - `describe` — a short English phrase for the step list and screen readers.
 *
 * Kept beside the model rather than in a component: CLAUDE.md invariant 13.
 */

export function notatePredicate(predicate: Predicate): string {
  switch (predicate.type) {
    case 'keyRange':
      return `${predicate.from}..${predicate.to}`
    default: {
      const exhaustive: never = predicate.type
      return exhaustive
    }
  }
}

export function notate(op: Operation, txnIndex: number): string {
  const t = txnIndex + 1
  switch (op.type) {
    case 'begin':
      return `b${t}`
    case 'read':
      return `r${t}[${op.key}]`
    case 'write':
      return `w${t}[${op.key}=${op.value}]`
    case 'readRange':
      return `r${t}[P:${notatePredicate(op.predicate)}]`
    case 'insert':
      return `i${t}[${op.key}=${op.value}]`
    case 'delete':
      return `d${t}[${op.key}]`
    case 'selectForUpdate':
      return `r${t}[${op.key}]•`
    case 'commit':
      return `c${t}`
    case 'rollback':
      return `a${t}`
    default: {
      const exhaustive: never = op
      return exhaustive
    }
  }
}

export function describe(op: Operation): string {
  switch (op.type) {
    case 'begin':
      return 'begin'
    case 'read':
      return `read key ${op.key}`
    case 'write':
      return `write key ${op.key} = ${op.value}`
    case 'readRange':
      return `range read over keys ${notatePredicate(op.predicate)}`
    case 'insert':
      return `insert key ${op.key} = ${op.value}`
    case 'delete':
      return `delete key ${op.key}`
    case 'selectForUpdate':
      return `select key ${op.key} for update`
    case 'commit':
      return 'commit'
    case 'rollback':
      return 'rollback'
    default: {
      const exhaustive: never = op
      return exhaustive
    }
  }
}

/**
 * The SQL the oracle harness runs for this operation, against the single
 * modelled table `items(k int primary key, v int)`. Living here rather than in
 * the harness keeps the simulator and the real engine reading one vocabulary.
 */
export function toSql(op: Operation): string | null {
  switch (op.type) {
    case 'read':
      return `SELECT v FROM items WHERE k = ${op.key}`
    case 'write':
      return `UPDATE items SET v = ${op.value} WHERE k = ${op.key}`
    case 'readRange':
      return `SELECT k, v FROM items WHERE k BETWEEN ${op.predicate.from} AND ${op.predicate.to} ORDER BY k`
    case 'insert':
      return `INSERT INTO items (k, v) VALUES (${op.key}, ${op.value})`
    case 'delete':
      return `DELETE FROM items WHERE k = ${op.key}`
    case 'selectForUpdate':
      return `SELECT v FROM items WHERE k = ${op.key} FOR UPDATE`
    case 'begin':
    case 'commit':
    case 'rollback':
      // Transaction control differs per engine dialect; the harness emits it.
      return null
    default: {
      const exhaustive: never = op
      return exhaustive
    }
  }
}
