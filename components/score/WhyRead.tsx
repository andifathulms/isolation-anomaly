'use client'

import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { ReadReasoning, TransactionState, VisibilityReason, Xid } from '@/lib/engine'
import { BOOTSTRAP_XID } from '@/lib/engine'
import type { ScenarioLegend } from '@/lib/scenarios/types'

/**
 * The derivation, beside the value it produced.
 *
 * This is the answer to the question the whole project is about: not what the
 * read returned, but why. The engine records which versions it considered and
 * on what grounds it passed over each one; this renders that walk, in order,
 * with the pack rule and the vendor quote that decided it.
 *
 * It sits directly under the score, next to the step it explains — not on a
 * separate page and not in a tooltip, which would be invisible on touch and
 * unsearchable.
 *
 * Nothing is computed here (CLAUDE.md invariant 13): every judgement on screen
 * was made in lib/engine and is read out of the trace.
 */

const REASON_KEY: Readonly<Record<VisibilityReason, keyof Dictionary['why']>> = {
  ownWrite: 'ownWrite',
  initialRow: 'initialRow',
  creatorCommitted: 'creatorCommitted',
  creatorNotYetCommitted: 'creatorNotYetCommitted',
  levelReadsUncommitted: 'levelReadsUncommitted',
  creatorRolledBack: 'creatorRolledBack',
  supersededByVisibleWrite: 'supersededByVisibleWrite',
  newerVersionTaken: 'newerVersionTaken',
}

export function WhyRead({
  reasoning,
  transactions,
  legend,
  dict,
}: {
  readonly reasoning: ReadReasoning
  readonly transactions: readonly TransactionState[]
  /** What the keys and values mean in the scenario's own terms, if it says. */
  readonly legend: ScenarioLegend | null
  readonly dict: Dictionary
}) {
  const nameOf = (xid: Xid | null): string => {
    if (xid === null) return '—'
    if (xid === BOOTSTRAP_XID) return dict.why.initialRow
    return transactions.find((txn) => txn.xid === xid)?.txn ?? `xid ${xid}`
  }

  const reasonText = (reason: VisibilityReason, xid: Xid | null): string =>
    dict.why[REASON_KEY[reason]].replace('{txn}', nameOf(xid))

  const rule =
    reasoning.rule === 'snapshot'
      ? { name: dict.why.ruleSnapshot, body: dict.why.ruleSnapshotBody }
      : reasoning.rule === 'latestCommitted'
        ? { name: dict.why.ruleLatest, body: dict.why.ruleLatestBody }
        : { name: dict.why.ruleUncommitted, body: dict.why.ruleUncommittedBody }

  const meaning = (key: number, value: number | null): string | null => {
    if (!legend || value === null) return null
    return legend.values[String(value)] ?? null
  }

  return (
    <section aria-labelledby="why-heading" className="leaf px-4 py-4 sm:px-5">
      <h3 id="why-heading" className="font-prose text-section">
        {dict.why.heading}
      </h3>

      {/* The rule that decided it, and the words the vendor used for it. */}
      <div className="mt-3 border-l-2 border-voiceA pl-3">
        <p className="font-control text-caption font-medium">{rule.name}</p>
        <p className="mt-1 max-w-reading text-body text-ink-muted">{rule.body}</p>
        {reasoning.snapshotTakenAtStep !== null ? (
          <p className="mt-1 font-mono text-caption">
            {dict.panels.takenAtStep} {reasoning.snapshotTakenAtStep} · {dict.why.sees}:{' '}
            {reasoning.visibleXids.filter((xid) => xid !== BOOTSTRAP_XID).length === 0
              ? dict.why.nobody
              : reasoning.visibleXids
                  .filter((xid) => xid !== BOOTSTRAP_XID)
                  .map((xid) => nameOf(xid))
                  .join(', ')}
          </p>
        ) : null}
      </div>

      {/* The walk itself, one key at a time, newest version first. */}
      <div className="mt-5 space-y-5">
        {reasoning.keys.map((decision) => (
          <div key={decision.key}>
            <p className="font-mono text-caption">
              {dict.panels.key} {decision.key}
              {legend?.keys[String(decision.key)] ? (
                <span className="ml-2 font-prose text-ink-muted">
                  {legend.keys[String(decision.key)]}
                </span>
              ) : null}
            </p>

            {decision.considered.length === 0 ? (
              <p className="mt-1 text-body text-ink-muted">{dict.why.noVersions}</p>
            ) : (
              <ol className="mt-2 space-y-1">
                {decision.considered.map((version) => {
                  const taken = version.seq === decision.chosenSeq
                  return (
                    <li
                      key={version.seq}
                      className={`flex flex-wrap items-baseline gap-x-2 rounded-md px-2 py-1.5 ${
                        taken ? 'bg-voiceA-wash/60' : ''
                      }`}
                    >
                      <span className="font-mono text-caption">
                        {version.value === null ? '∅' : version.value}
                      </span>
                      <span className="font-mono text-micro text-ink-muted">
                        xmin {nameOf(version.xmin)}
                        {version.xmax === null ? '' : ` · xmax ${nameOf(version.xmax)}`}
                      </span>
                      <span
                        className={`font-control text-micro font-medium ${
                          taken ? 'text-voiceA' : 'text-ink-soft'
                        }`}
                      >
                        {taken ? dict.why.taken : dict.why.passedOver}
                      </span>
                      <span className="w-full text-caption text-ink-muted">
                        {reasonText(
                          version.because,
                          version.because === 'supersededByVisibleWrite' ? version.xmax : version.xmin,
                        )}
                      </span>
                    </li>
                  )
                })}
              </ol>
            )}

            <p className="mt-1.5 font-mono text-caption">
              {dict.why.result}: {decision.value === null ? dict.why.noRow : decision.value}
              {meaning(decision.key, decision.value) ? (
                <span className="ml-2 font-prose text-ink-muted">
                  {meaning(decision.key, decision.value)}
                </span>
              ) : null}
            </p>
          </div>
        ))}
      </div>

      {/* The rule in the vendor's own words, here rather than in a footnote. */}
      <div className="mt-5 border-t border-staff-faint pt-3">
        <h4 className="eyebrow">{dict.why.source}</h4>
        <blockquote className="mt-1 border-l border-staff pl-3 text-body italic text-ink-muted">
          “{reasoning.citation.quote}”
          <footer className="mt-1 not-italic">
            <a
              href={reasoning.citation.url}
              className="text-voiceA underline decoration-staff underline-offset-2"
              target="_blank"
              rel="noreferrer"
            >
              {reasoning.citation.source}
            </a>
          </footer>
        </blockquote>
      </div>

      {/*
        Honesty, inline. The oracle fixtures prove this model returns what the
        real engine returns; they say nothing about how the engine got there.
        Presenting a derivation without that distinction would overclaim in
        exactly the place this project has been most careful not to.
      */}
      <p className="mt-4 max-w-reading text-caption text-ink-soft">{dict.why.modelNote}</p>
    </section>
  )
}
