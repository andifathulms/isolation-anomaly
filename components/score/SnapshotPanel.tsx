'use client'

import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { InitialRow } from '@/lib/schedule'
import type { TransactionState, Xid } from '@/lib/engine'

/** Which transactions were visible when each snapshot was taken — PRD §5.2. */
export function SnapshotPanel({
  transactions,
  committedRows,
  dict,
}: {
  readonly transactions: readonly TransactionState[]
  readonly committedRows: readonly InitialRow[]
  readonly dict: Dictionary
}) {
  const nameOf = (xid: Xid) => transactions.find((txn) => txn.xid === xid)?.txn ?? `xid ${xid}`
  const withSnapshots = transactions.filter((txn) => txn.snapshot !== null)

  return (
    <section aria-labelledby="snapshots-heading">
      <h3 id="snapshots-heading" className="font-prose text-section">
        {dict.panels.snapshots}
      </h3>
      <p className="mt-1.5 text-body text-ink-muted">{dict.panels.snapshotsHint}</p>

      {withSnapshots.length === 0 ? (
        <p className="mt-3 font-mono text-caption text-ink-soft">{dict.panels.snapshotsEmpty}</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {withSnapshots.map((txn) => {
            const snapshot = txn.snapshot
            if (!snapshot) return null
            return (
              <li
                key={txn.txn}
                className="leaf px-3 py-2 font-mono text-caption"
              >
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span>{txn.txn}</span>
                  <span className="text-micro text-ink-muted">
                    {snapshot.scope} · {dict.panels.takenAtStep} {snapshot.takenAtStep}
                  </span>
                </div>
                <div className="mt-1 text-micro">
                  <span className="text-ink-muted">{dict.panels.sees}: </span>
                  {snapshot.visibleXids.length === 0
                    ? '—'
                    : snapshot.visibleXids.map(nameOf).join(', ')}
                </div>
                {snapshot.inProgressXids.length > 0 ? (
                  <div className="text-micro">
                    <span className="text-ink-muted">{dict.panels.stillRunning}: </span>
                    {snapshot.inProgressXids.map(nameOf).join(', ')}
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}

      <div className="mt-4">
        <h4 className="eyebrow">
          {dict.panels.committedTable}
        </h4>
        <p className="mt-1 font-mono text-caption">
          {committedRows.length === 0
            ? dict.panels.empty
            : committedRows.map((row) => `${row.key}=${row.value}`).join('  ')}
        </p>
      </div>
    </section>
  )
}
