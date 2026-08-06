'use client'

import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { Lock, LockResource, WaitState } from '@/lib/engine'

function describeResource(resource: LockResource): string {
  return resource.type === 'record'
    ? `record ${resource.key}`
    : resource.from === resource.to
      ? `gap at ${resource.from}`
      : `gap ${resource.from}..${resource.to}`
}

/**
 * Locks held — PRD §5.2. Range and gap locks included, because that is where
 * phantom prevention actually lives in a lock-based engine.
 *
 * A lock is not an error and is never drawn in conductor's red.
 */
export function LockTable({
  locks,
  waits,
  dict,
}: {
  readonly locks: readonly Lock[]
  readonly waits: readonly WaitState[]
  readonly dict: Dictionary
}) {
  return (
    <section aria-labelledby="locks-heading">
      <h3 id="locks-heading" className="font-prose text-section">
        {dict.panels.locks}
      </h3>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{dict.panels.locksHint}</p>

      {locks.length === 0 ? (
        <p className="mt-3 font-mono text-sm text-ink-soft">{dict.panels.locksEmpty}</p>
      ) : (
        <table className="leaf mt-4 w-full overflow-hidden text-sm">
          <thead className="bg-manuscript-sunk">
            <tr className="eyebrow">
              <th scope="col" className="px-3 py-1.5 text-left font-normal">{dict.panels.holder}</th>
              <th scope="col" className="px-3 py-1.5 text-left font-normal">{dict.panels.resource}</th>
              <th scope="col" className="px-3 py-1.5 text-left font-normal">{dict.panels.mode}</th>
              <th scope="col" className="px-3 py-1.5 text-left font-normal">{dict.panels.duration}</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {locks.map((lock, index) => (
              <tr key={`${lock.holder}-${index}`} className="border-t border-staff-faint/60">
                <td className="px-3 py-1.5">{lock.holder}</td>
                <td className="px-3 py-1.5">{describeResource(lock.resource)}</td>
                <td className="px-3 py-1.5">{lock.mode}</td>
                <td className="px-3 py-1.5">{lock.duration}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {waits.length > 0 ? (
        <ul className="mt-3 space-y-1 font-mono text-xs">
          {waits.map((wait) => (
            <li key={`${wait.txn}-${wait.stepIndex}`} className="text-ink-muted">
              {wait.txn} ({dict.panels.atStep} {wait.stepIndex}) {dict.panels.waitingFor}{' '}
              {wait.waitingFor.join(', ')} — {describeResource(wait.resource)}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  )
}
