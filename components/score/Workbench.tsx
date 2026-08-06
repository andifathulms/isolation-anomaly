'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { LEVELS, validateSchedule, type IsolationLevel, type Schedule } from '@/lib/schedule'
import { PACKS, requirePack } from '@/lib/packs'
import { SCENARIOS, getScenario } from '@/lib/scenarios'
import { execute, narrateStep, narrateTrace, refusalHeadline } from '@/lib/engine'
import { detect } from '@/lib/detect'
import { buildConflictGraph, explainCycle, findCycle } from '@/lib/serial'
import { decodeShareState, encodeShareState, type ShareState } from '@/lib/share'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { scenarioText } from '@/lib/i18n/content'
import type { Locale } from '@/lib/i18n/locales'
import { Editor } from './Editor'
import { Score } from './Score'
import { StepList } from './StepList'
import { AnomalyCallout } from './AnomalyCallout'
import { SnapshotPanel } from './SnapshotPanel'
import { VersionChains } from '@/components/versions/VersionChains'
import { LockTable } from '@/components/locks/LockTable'

/**
 * The workbench: pick a scenario, an engine and a level, then step through the
 * recorded execution. Step-back is free because execution is recorded, not
 * re-run — the trace carries the world after every step.
 *
 * State lives in the URL hash, so a run can be shared as a link (PRD §5.7).
 */
export function Workbench({
  dict,
  locale,
  initialScenarioId,
}: {
  readonly dict: Dictionary
  readonly locale: Locale
  readonly initialScenarioId: string
}) {
  const fallback: ShareState = useMemo(
    () => ({
      scenarioId: initialScenarioId,
      schedule: null,
      packId: PACKS[0]?.id ?? 'postgres-16',
      level: requirePack(PACKS[0]?.id ?? 'postgres-16').defaultLevel,
      step: 0,
    }),
    [initialScenarioId],
  )

  const [state, setState] = useState<ShareState>(fallback)
  const [copied, setCopied] = useState(false)
  const [editing, setEditing] = useState(false)

  // Read the hash on mount and whenever it changes, so a pasted link works.
  useEffect(() => {
    const read = () => setState((current) => decodeShareState(window.location.hash, current))
    read()
    window.addEventListener('hashchange', read)
    return () => window.removeEventListener('hashchange', read)
  }, [])

  const scenario = state.schedule ? null : getScenario(state.scenarioId ?? initialScenarioId)
  const schedule = state.schedule ?? scenario?.schedule ?? SCENARIOS[0]?.schedule
  const pack = requirePack(state.packId)

  const issues = useMemo(() => (schedule ? validateSchedule(schedule) : []), [schedule])

  const result = useMemo(
    () => (schedule && issues.length === 0 ? execute(schedule, pack, state.level) : null),
    [schedule, issues.length, pack, state.level],
  )

  const trace = result?.type === 'trace' ? result.trace : null
  const anomalies = useMemo(() => (trace ? detect(trace) : []), [trace])
  const summary = useMemo(() => (trace ? narrateTrace(trace, anomalies) : ''), [trace, anomalies])
  const graph = useMemo(() => (trace ? buildConflictGraph(trace) : null), [trace])
  const cycle = useMemo(() => (graph ? findCycle(graph) : null), [graph])

  const maxStep = (trace?.steps.length ?? 1) - 1
  const step = Math.min(Math.max(state.step, 0), Math.max(maxStep, 0))

  const update = useCallback((next: Partial<ShareState>) => {
    setState((current) => {
      const merged = { ...current, ...next }
      window.history.replaceState(null, '', `#${encodeShareState(merged)}`)
      return merged
    })
  }, [])

  const goTo = useCallback(
    (target: number) => update({ step: Math.min(Math.max(target, 0), Math.max(maxStep, 0)) }),
    [update, maxStep],
  )

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && ['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName)) {
        return
      }
      if (event.key === 'ArrowRight') goTo(step + 1)
      if (event.key === 'ArrowLeft') goTo(step - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goTo, step])

  if (!schedule) return null

  const levelEntry = pack.levels[state.level]
  const world = trace?.steps[step]?.state
  const current = trace?.steps[step]

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1">
          <span className="font-control text-xs uppercase tracking-wide text-ink-muted">
            {dict.controls.scenario}
          </span>
          <select
            value={scenario?.id ?? ''}
            onChange={(event) => update({ scenarioId: event.target.value, schedule: null, step: 0 })}
            className="min-w-56 rounded-sm border border-staff bg-manuscript-raised px-2 py-1.5 font-control text-sm"
          >
            {state.schedule ? <option value="">shared schedule</option> : null}
            {SCENARIOS.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {scenarioText(locale, candidate).title}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-control text-xs uppercase tracking-wide text-ink-muted">
            {dict.controls.engine}
          </span>
          <select
            value={pack.id}
            onChange={(event) => update({ packId: event.target.value, step: 0 })}
            className="rounded-sm border border-staff bg-manuscript-raised px-2 py-1.5 font-control text-sm"
          >
            {PACKS.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.engine} {candidate.version}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-control text-xs uppercase tracking-wide text-ink-muted">
            {dict.controls.level}
          </span>
          <select
            value={state.level}
            onChange={(event) => update({ level: event.target.value as IsolationLevel, step: 0 })}
            className="rounded-sm border border-staff bg-manuscript-raised px-2 py-1.5 font-mono text-sm"
          >
            {LEVELS.map((level) => (
              <option key={level} value={level}>
                {level}
                {pack.levels[level].kind === 'alias' ? ` (${dict.controls.alias})` : ''}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={() => {
            // Editing starts from whatever is on screen, and the edited
            // schedule travels in the hash from then on.
            if (!editing && schedule) update({ schedule, scenarioId: null })
            setEditing(!editing)
          }}
          className="rounded-sm border border-staff px-3 py-1.5 font-control text-sm"
        >
          {editing ? dict.editor.done : dict.editor.edit}
        </button>

        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(window.location.href).then(() => {
              setCopied(true)
              window.setTimeout(() => setCopied(false), 1600)
            })
          }}
          className="rounded-sm border border-staff px-3 py-1.5 font-control text-sm"
        >
          {copied ? dict.controls.copied : dict.controls.copyLink}
        </button>
      </div>

      {levelEntry.kind === 'alias' ? (
        <p className="max-w-prose border-l-2 border-voiceB bg-voiceB-wash/40 px-3 py-2 text-sm">
          <span className="font-mono">{state.level}</span> — {dict.controls.aliasNote}{' '}
          <span className="font-mono">{levelEntry.of}</span>. {levelEntry.summary}
        </p>
      ) : null}

      {result?.type === 'refused' ? (
        <section className="max-w-prose rounded-sm border-l-2 border-conductor bg-conductor-wash/40 px-4 py-3">
          <h2 className="font-prose text-lg text-conductor">{dict.refusal.heading}</h2>
          <p className="mt-1 font-mono text-sm">{refusalHeadline(result.refusal)}</p>
          <p className="mt-2 text-sm">{result.refusal.gap}</p>
          <p className="mt-2 text-sm text-ink-muted">{dict.refusal.body}</p>
          {'citation' in result.refusal ? (
            <blockquote className="mt-3 border-l border-staff pl-3 text-sm italic text-ink-muted">
              “{result.refusal.citation.quote}”
              <footer className="mt-1 not-italic">
                <a
                  href={result.refusal.citation.url}
                  className="text-voiceA underline decoration-staff underline-offset-2"
                  target="_blank"
                  rel="noreferrer"
                >
                  {result.refusal.citation.source}
                </a>
              </footer>
            </blockquote>
          ) : null}
        </section>
      ) : null}

      {editing && schedule ? (
        <Editor
          schedule={schedule}
          onChange={(next: Schedule) => update({ schedule: next, scenarioId: null })}
          dict={dict}
        />
      ) : null}

      {issues.length > 0 ? (
        <p className="max-w-prose border-l-2 border-conductor pl-3 text-sm">{dict.editor.invalid}</p>
      ) : null}

      {trace && world && current ? (
        <>
          <Score
            schedule={schedule}
            trace={trace}
            currentStep={step}
            anomalies={anomalies}
            onSelectStep={goTo}
            labels={{ conductorMark: dict.anomaly.found.toLowerCase() }}
            summary={summary}
          />

          {/* Stepping is the one thing that changes without the page changing,
              so it is announced rather than left to be noticed. */}
          <p aria-live="polite" className="sr-only">
            {narrateStep(current)}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => goTo(0)}
              disabled={step === 0}
              className="rounded-sm border border-staff px-2 py-1 font-control text-sm disabled:opacity-40"
            >
              ⏮ {dict.controls.first}
            </button>
            <button
              type="button"
              onClick={() => goTo(step - 1)}
              disabled={step === 0}
              className="rounded-sm border border-staff px-2 py-1 font-control text-sm disabled:opacity-40"
            >
              ← {dict.controls.previous}
            </button>
            <span className="font-mono text-sm">
              {dict.controls.step} {step} {dict.controls.ofSteps} {maxStep}
            </span>
            <button
              type="button"
              onClick={() => goTo(step + 1)}
              disabled={step === maxStep}
              className="rounded-sm border border-staff px-2 py-1 font-control text-sm disabled:opacity-40"
            >
              {dict.controls.next} →
            </button>
            <button
              type="button"
              onClick={() => goTo(maxStep)}
              disabled={step === maxStep}
              className="rounded-sm border border-staff px-2 py-1 font-control text-sm disabled:opacity-40"
            >
              {dict.controls.last} ⏭
            </button>
          </div>

          {current.note ? (
            <p className="max-w-prose border-l-2 border-staff pl-3 text-sm text-ink-muted">{current.note}</p>
          ) : null}

          <AnomalyCallout anomalies={anomalies} dict={dict} locale={locale} />

          <div className="grid gap-8 lg:grid-cols-3">
            <VersionChains chains={world.chains} transactions={world.transactions} dict={dict} />
            <LockTable locks={world.locks} waits={world.waits} dict={dict} />
            <SnapshotPanel
              transactions={world.transactions}
              committedRows={world.committedRows}
              dict={dict}
            />
          </div>

          <nav aria-label={dict.controls.step}>
            <StepList trace={trace} currentStep={step} onSelectStep={goTo} dict={dict} />
          </nav>

          {graph ? (
            <section aria-labelledby="serial-heading" className="max-w-prose">
              <h3 id="serial-heading" className="font-prose text-lg">
                {cycle ? dict.graph.cycle : dict.graph.noCycle}
              </h3>
              <p className="mt-1 text-sm text-ink-muted">
                {cycle ? explainCycle(cycle) : dict.graph.noCycleBody}
              </p>
              {!cycle && graph.nodes.length > 0 ? (
                <p className="mt-1 font-mono text-sm">{graph.nodes.join(' → ')}</p>
              ) : null}
            </section>
          ) : null}

          {scenario ? (
            <section className="max-w-prose space-y-2 border-t border-staff-faint pt-6">
              <h3 className="font-prose text-lg">{scenarioText(locale, scenario).title}</h3>
              <p className="text-sm">
                <span className="font-control text-xs uppercase tracking-wide text-ink-muted">
                  {dict.scenarios.framing}:{' '}
                </span>
                {scenarioText(locale, scenario).framing}
              </p>
              <p className="text-sm">
                <span className="font-control text-xs uppercase tracking-wide text-ink-muted">
                  {dict.scenarios.lesson}:{' '}
                </span>
                {scenarioText(locale, scenario).lesson}
              </p>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
