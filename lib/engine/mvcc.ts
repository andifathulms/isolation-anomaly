import type { InitialRow, Key, Value } from '@/lib/schedule'
import type { RowVersion, VersionChain, Xid } from './trace'

/**
 * Version chains and visibility. One core, parameterised by the pack — engines
 * differ in which snapshot they hand a statement, not in how a chain works.
 *
 * A version is created by a transaction (`xmin`) and superseded or deleted by
 * one (`xmax`). Nothing is ever overwritten in place, which is what makes
 * step-back free and makes a reader's view a matter of arithmetic on
 * transaction ids rather than of state.
 */

/** The pseudo-transaction that loaded the initial rows; committed before all time. */
export const BOOTSTRAP_XID: Xid = 0

export type VersionStore = {
  /** Insertion-ordered by key so a serialised trace is byte-identical. */
  readonly chains: Map<Key, RowVersion[]>
  nextSeq: number
}

export function createStore(initial: readonly InitialRow[]): VersionStore {
  const chains = new Map<Key, RowVersion[]>()
  let nextSeq = 0
  for (const row of [...initial].sort((a, b) => a.key - b.key)) {
    chains.set(row.key, [
      {
        key: row.key,
        value: row.value,
        xmin: BOOTSTRAP_XID,
        xmax: null,
        createdAtStep: null,
        deletedAtStep: null,
        seq: nextSeq++,
      },
    ])
  }
  return { chains, nextSeq }
}

/**
 * Which transactions' writes a reader can see.
 *
 * `committed` is the set of transactions that had committed when the snapshot
 * was taken — for a statement-scoped snapshot that is "now", for a
 * transaction-scoped one it is frozen at the transaction's first statement.
 * `readsUncommitted` short-circuits the whole question, which is the only way a
 * dirty read can happen.
 */
export type View = {
  readonly self: Xid
  readonly committed: ReadonlySet<Xid>
  readonly readsUncommitted: boolean
  /**
   * Transactions the engine has rolled back. A dirty read sees work that has
   * not committed *yet*; it never sees work that was undone, because those
   * versions are dead however permissive the reader is.
   */
  readonly aborted: ReadonlySet<Xid>
}

/** Whether this view accepts a version written by the given transaction. */
function accepts(xid: Xid, view: View): boolean {
  if (xid === BOOTSTRAP_XID || xid === view.self) return true
  return view.readsUncommitted ? !view.aborted.has(xid) : view.committed.has(xid)
}

function isVisible(version: RowVersion, view: View): boolean {
  if (!accepts(version.xmin, view)) return false
  if (version.xmax === null) return true
  return !accepts(version.xmax, view)
}

/** The version of `key` this view sees, or null if it sees no live row. */
export function visibleVersion(store: VersionStore, key: Key, view: View): RowVersion | null {
  const chain = store.chains.get(key)
  if (!chain) return null
  for (let index = chain.length - 1; index >= 0; index -= 1) {
    const version = chain[index]
    if (version && isVisible(version, view)) {
      return version.value === null ? null : version
    }
  }
  return null
}

export function visibleValue(store: VersionStore, key: Key, view: View): Value | null {
  return visibleVersion(store, key, view)?.value ?? null
}

/** Keys with a live row under this view, in key order. */
export function visibleKeys(store: VersionStore, view: View): readonly Key[] {
  return [...store.chains.keys()]
    .sort((a, b) => a - b)
    .filter((key) => visibleVersion(store, key, view) !== null)
}

/** The newest version of a key regardless of visibility — what a writer must respect. */
export function newestVersion(store: VersionStore, key: Key): RowVersion | null {
  const chain = store.chains.get(key)
  if (!chain || chain.length === 0) return null
  return chain[chain.length - 1] ?? null
}

/**
 * Creates a version, superseding the current newest one.
 * `value` of null records a deletion.
 */
export function appendVersion(
  store: VersionStore,
  key: Key,
  value: Value | null,
  xid: Xid,
  step: number,
): RowVersion {
  const chain = store.chains.get(key) ?? []
  const previous = chain[chain.length - 1]
  if (previous && previous.xmax === null) {
    chain[chain.length - 1] = { ...previous, xmax: xid, deletedAtStep: step }
  }
  const version: RowVersion = {
    key,
    value,
    xmin: xid,
    xmax: null,
    createdAtStep: step,
    deletedAtStep: null,
    seq: store.nextSeq++,
  }
  chain.push(version)
  store.chains.set(key, chain)
  return version
}

export function toChains(store: VersionStore): readonly VersionChain[] {
  return [...store.chains.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([key, versions]) => ({ key, versions: [...versions] }))
}

/** The table as a reader outside every transaction would see it. */
export function committedRows(store: VersionStore, committed: ReadonlySet<Xid>): readonly InitialRow[] {
  const view: View = { self: -1, committed, readsUncommitted: false, aborted: new Set() }
  return visibleKeys(store, view).map((key) => ({
    key,
    value: visibleValue(store, key, view) as Value,
  }))
}
