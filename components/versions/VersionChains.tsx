'use client'

import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { TransactionState, VersionChain, Xid } from '@/lib/engine'
import { BOOTSTRAP_XID } from '@/lib/engine'

/** MVCC made concrete — PRD §5.2. One row per version, in creation order. */
export function VersionChains({
  chains,
  transactions,
  dict,
}: {
  readonly chains: readonly VersionChain[]
  readonly transactions: readonly TransactionState[]
  readonly dict: Dictionary
}) {
  const nameOf = (xid: Xid | null): string => {
    if (xid === null) return '—'
    if (xid === BOOTSTRAP_XID) return 'initial'
    return transactions.find((txn) => txn.xid === xid)?.txn ?? `xid ${xid}`
  }

  return (
    <section aria-labelledby="versions-heading">
      <h3 id="versions-heading" className="font-prose text-section">
        {dict.panels.versions}
      </h3>
      <p className="mt-1.5 text-body text-ink-muted">{dict.panels.versionsHint}</p>
      {chains.length === 0 ? (
        <p className="mt-3 font-mono text-caption text-ink-soft">{dict.panels.empty}</p>
      ) : (
        <div className="mt-4 space-y-3">
          {chains.map((chain) => (
            <div key={chain.key} className="leaf overflow-hidden">
              <div className="flex items-baseline gap-2 border-b border-staff-faint bg-manuscript-sunk px-3 py-2">
                <span className="eyebrow">
                  {dict.panels.key}
                </span>
                <span className="font-mono text-caption">{chain.key}</span>
              </div>
              <table className="w-full text-caption">
                <thead>
                  <tr className="eyebrow">
                    <th scope="col" className="px-3 py-1 text-left font-normal">{dict.panels.value}</th>
                    <th scope="col" className="px-3 py-1 text-left font-normal">{dict.panels.createdBy}</th>
                    <th scope="col" className="px-3 py-1 text-left font-normal">{dict.panels.deletedBy}</th>
                    {/* Named, not blank: an empty header cell is announced as "blank"
                        against every cell in the column. */}
                    <th scope="col" className="px-3 py-1 text-left font-normal">
                      <span className="sr-only">{dict.a11y.stateColumn}</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {chain.versions.map((version) => {
                    const state =
                      version.xmax !== null
                        ? version.value === null
                          ? dict.panels.deleted
                          : dict.panels.superseded
                        : version.value === null
                          ? dict.panels.deleted
                          : dict.panels.live
                    return (
                      <tr key={version.seq} className="border-t border-staff-faint/60">
                        <td className="px-3 py-1">{version.value ?? '∅'}</td>
                        <td className="px-3 py-1">
                          {nameOf(version.xmin)}
                          {version.createdAtStep !== null ? (
                            <span className="ml-1 text-micro text-ink-muted">
                              {dict.panels.atStep} {version.createdAtStep}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-1">
                          {nameOf(version.xmax)}
                          {version.deletedAtStep !== null ? (
                            <span className="ml-1 text-micro text-ink-muted">
                              {dict.panels.atStep} {version.deletedAtStep}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-1">
                          <span className="eyebrow">
                            {state}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
