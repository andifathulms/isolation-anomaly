'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { LEVELS, moveStep, validateSchedule, type IsolationLevel, type Schedule } from '@/lib/schedule'
import { PACKS, requirePack } from '@/lib/packs'
import { SCENARIOS, getScenario } from '@/lib/scenarios'
import { execute, narrateStep, narrateTrace, refusalHeadline } from '@/lib/engine'
import { detect } from '@/lib/detect'
import { buildConflictGraph, explainCycle, findCycle } from '@/lib/serial'
import { decodeShareState, encodeShareState, type ShareState } from '@/lib/share'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import { anomalyText, scenarioLegend, scenarioText } from '@/lib/i18n/content'
import type { Locale } from '@/lib/i18n/locales'
import { Editor } from './Editor'
import { Score } from './Score'
import { ScoreLegend } from './ScoreLegend'
import { StepList } from './StepList'
import { Tour } from './Tour'
import { AnomalyCallout } from './AnomalyCallout'
import { WhyRead } from './WhyRead'
import { KeyLegend } from './KeyLegend'
import { SnapshotPanel } from './SnapshotPanel'
import { VersionChains } from '@/components/versions/VersionChains'
import { LockTable } from '@/components/locks/LockTable'

/**
 * The workbench: pick a scenario, an engine and a level, then step through the
 * recorded execution. Step-back is free because execution is recorded, not
 * re-run — the trace carries the world after every step.
 *
 * State lives in the URL hash, so a run can be shared as a link (PRD §5.7).
 *
 * The page is ordered by what a reader wants to know, not by what is easiest to
 * lay out: what is running, the score, the controls that move through it, the
 * verdict, and only then the engine internals that explain the verdict. The
 * verdict used to sit below three dense panels, which put the answer to the
 * reader's actual question below the fold.
 */

/** Milliseconds per statement when playing. Slow enough to read the score. */
const PLAY_INTERVAL = 1100

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
  const [playing, setPlaying] = useState(false)
  const [stillness, setStillness] = useState(false)

  /**
   * Autoplay is the one thing on the site that moves without being asked to
   * again — a `setTimeout`, so the reduced-motion rules in the stylesheet never
   * touched it. Where the preference is set, Play is not offered: stepping is a
   * complete equivalent, and it is the reader who decides when the score moves.
   *
   * Read from a media query listener rather than once, because the preference
   * can be changed while the page is open.
   */
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const read = () => {
      setStillness(query.matches)
      if (query.matches) setPlaying(false)
    }
    read()
    query.addEventListener('change', read)
    return () => query.removeEventListener('change', read)
  }, [])

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
      // Alt+← is Back and Cmd+← is Back; both used to step the score on their
      // way out of the page. A modified arrow is never meant for us.
      if (event.altKey || event.metaKey || event.ctrlKey || event.shiftKey) return
      if (event.target instanceof HTMLElement && ['INPUT', 'SELECT', 'TEXTAREA'].includes(event.target.tagName)) {
        return
      }
      // Inside a region that scrolls sideways, the arrows belong to the region:
      // it is the only way a keyboard can reach the right-hand end of a score.
      if (event.target instanceof HTMLElement && event.target.closest('.scroll-region')) return
      if (event.key === 'ArrowRight') {
        setPlaying(false)
        goTo(step + 1)
      }
      if (event.key === 'ArrowLeft') {
        setPlaying(false)
        goTo(step - 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goTo, step])

  // Playing advances one statement at a time and stops at the end rather than
  // looping — the last step is the outcome, and looping would scroll past it.
  useEffect(() => {
    if (!playing) return
    if (step >= maxStep) {
      setPlaying(false)
      return
    }
    const timer = window.setTimeout(() => goTo(step + 1), PLAY_INTERVAL)
    return () => window.clearTimeout(timer)
  }, [playing, step, maxStep, goTo])

  // Changing what is being run invalidates a run in progress.
  const change = useCallback(
    (next: Partial<ShareState>) => {
      setPlaying(false)
      update(next)
    },
    [update],
  )

  if (!schedule) return null

  const levelEntry = pack.levels[state.level]
  const world = trace?.steps[step]?.state
  const current = trace?.steps[step]
  const context = `${pack.engine} ${pack.version} · ${state.level}`
  const legend = scenario ? scenarioLegend(locale, scenario) : null

  /**
   * Anomalies whose cause step the run has actually reached.
   *
   * The verdict used to be computed from the whole trace and rendered at step 0,
   * so a reader arriving from the landing page met "the database gave a wrong
   * answer" before a single statement had run — the conclusion above the
   * evidence, and a lesson that the anomaly is a property of the schedule rather
   * than something that becomes true at a particular moment.
   */
  const revealed = anomalies.filter((found) => found.causeStep <= step)
  const atEnd = step >= maxStep

  /**
   * The verdict, as one sentence, in a region that is always mounted.
   *
   * The callout used to carry `aria-live` on whichever of its two branches was
   * rendered — so changing the level swapped the live element rather than
   * updating it, and a live region inserted at the same moment as its content
   * is not reliably announced by NVDA or VoiceOver. The most important sentence
   * on the page was silent. Here it is one persistent node whose text changes.
   */
  const verdict = trace
    ? revealed.length > 0
      ? `${dict.anomaly.foundHeadline} — ${revealed
          .map((found) => anomalyText(locale, found.id).name)
          .join(', ')} — ${context}`
      : atEnd
        ? `${dict.anomaly.noneHeadline} — ${context}`
        : ''
    : result?.type === 'refused'
      ? `${dict.refusal.heading} — ${context}`
      : ''

  return (
    <div className="space-y-8">
      <p aria-live="polite" className="sr-only">
        {verdict}
      </p>

      <Tour dict={dict} />

      {/*
        The three dials that drive everything, in a bar that stays put while the
        reader scrolls through the panels below — changing the level and seeing
        the outcome change is the core loop, and it used to require scrolling
        back to the top of the page. It sits slightly under the header's own
        height so the two never separate and let content show through the seam.
        The offset is `--header-height`, which the header also takes as a
        `min-height`, so the two cannot drift apart when the nav row wraps.

        Static below `sm`: stacked on a phone the three selects are four rows
        tall, and pinning that to the top would leave almost no room for the
        score it is supposed to be controlling.
      */}
      <div className="z-20 -mx-4 border-y border-staff-faint bg-manuscript px-4 py-3 sm:sticky sm:top-[var(--header-height)] sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
          <p className="eyebrow w-full sm:sr-only">{dict.controls.setup}</p>

          <label className="flex w-full min-w-0 flex-col gap-1 sm:w-auto">
            <span className="eyebrow">{dict.controls.scenario}</span>
            <select
              value={scenario?.id ?? ''}
              onChange={(event) => change({ scenarioId: event.target.value, schedule: null, step: 0 })}
              className="control w-full sm:w-auto sm:min-w-56"
            >
              {state.schedule ? <option value="">shared schedule</option> : null}
              {SCENARIOS.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {scenarioText(locale, candidate).title}
                </option>
              ))}
            </select>
          </label>

          <label className="flex w-full min-w-0 flex-col gap-1 sm:w-auto">
            <span className="eyebrow">{dict.controls.engine}</span>
            <select
              value={pack.id}
              onChange={(event) => change({ packId: event.target.value, step: 0 })}
              className="control w-full sm:w-auto"
            >
              {PACKS.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.engine} {candidate.version}
                </option>
              ))}
            </select>
          </label>

          <label className="flex w-full min-w-0 flex-col gap-1 sm:w-auto">
            <span className="eyebrow">{dict.controls.level}</span>
            <select
              value={state.level}
              onChange={(event) => change({ level: event.target.value as IsolationLevel, step: 0 })}
              className="control w-full font-mono sm:w-auto"
            >
              {LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level}
                  {pack.levels[level].kind === 'alias' ? ` (${dict.controls.alias})` : ''}
                </option>
              ))}
            </select>
          </label>

          <div className="ml-auto flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                // Editing starts from whatever is on screen, and the edited
                // schedule travels in the hash from then on.
                if (!editing && schedule) change({ schedule, scenarioId: null })
                setEditing(!editing)
              }}
              aria-pressed={editing}
              className="control"
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
              className="control"
            >
              {copied ? dict.controls.copied : dict.controls.copyLink}
            </button>
          </div>
        </div>
      </div>

      {levelEntry.kind === 'alias' ? (
        <p className="max-w-reading rounded-r-md border-l-2 border-voiceB bg-voiceB-wash/40 px-4 py-3 text-body">
          <span className="font-mono">{state.level}</span> — {dict.controls.aliasNote}{' '}
          <span className="font-mono">{levelEntry.of}</span>. {levelEntry.summary}
        </p>
      ) : null}

      {result?.type === 'refused' ? (
        <section className="max-w-reading rounded-lg border border-conductor/30 border-l-2 border-l-conductor bg-conductor-wash/40 px-5 py-4">
          <h2 className="font-prose text-section text-conductor">{dict.refusal.heading}</h2>
          <p className="mt-1 font-mono text-caption">{refusalHeadline(result.refusal)}</p>
          <p className="mt-2 text-body">{result.refusal.gap}</p>
          <p className="mt-2 text-body text-ink-muted">{dict.refusal.body}</p>
          {'citation' in result.refusal ? (
            <blockquote className="mt-3 border-l border-staff pl-3 text-body italic text-ink-muted">
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
          onChange={(next: Schedule) => change({ schedule: next, scenarioId: null })}
          dict={dict}
        />
      ) : null}

      {issues.length > 0 ? (
        <p className="max-w-reading border-l-2 border-conductor pl-3 text-body">
          {dict.editor.invalid}
        </p>
      ) : null}

      {trace && world && current ? (
        <>
          <Score
            schedule={schedule}
            trace={trace}
            currentStep={step}
            anomalies={anomalies}
            onSelectStep={(target) => {
              setPlaying(false)
              goTo(target)
            }}
            onMoveStep={(from, to) => {
              // Re-interleaving produces a new schedule, so it stops being the
              // library scenario and starts travelling in the link instead.
              const next = moveStep(schedule, from, to)
              if (next !== schedule) change({ schedule: next, scenarioId: null, step: to })
            }}
            labels={{ conductorMark: dict.anomaly.found.toLowerCase(), region: dict.a11y.scoreRegion }}
            summary={summary}
          />

          {legend ? <KeyLegend legend={legend} dict={dict} /> : null}

          {/* Stepping is the one thing that changes without the page changing,
              so it is announced rather than left to be noticed. */}
          <p aria-live="polite" className="sr-only">
            {narrateStep(current)}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <span className="eyebrow mr-1">{dict.controls.playback}</span>

            <button
              type="button"
              onClick={() => goTo(0)}
              disabled={step === 0}
              aria-label={dict.controls.first}
              className="control px-2"
            >
              ⏮
            </button>
            <button
              type="button"
              onClick={() => {
                setPlaying(false)
                goTo(step - 1)
              }}
              disabled={step === 0}
              className="control"
            >
              ← <span className="hidden sm:inline">{dict.controls.previous}</span>
            </button>

            {stillness ? null : (
              <button
                type="button"
                onClick={() => {
                  if (step >= maxStep) goTo(0)
                  setPlaying(!playing)
                }}
                aria-pressed={playing}
                className="control control-strong"
              >
                {playing ? '❚❚' : '▶'}{' '}
                <span className="hidden sm:inline">
                  {playing ? dict.controls.pause : step >= maxStep ? dict.controls.replay : dict.controls.play}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setPlaying(false)
                goTo(step + 1)
              }}
              disabled={step === maxStep}
              className="control"
            >
              <span className="hidden sm:inline">{dict.controls.next}</span> →
            </button>
            <button
              type="button"
              onClick={() => {
                setPlaying(false)
                goTo(maxStep)
              }}
              disabled={step === maxStep}
              aria-label={dict.controls.last}
              className="control px-2"
            >
              ⏭
            </button>

            <span className="font-mono text-caption text-ink-muted">
              {dict.controls.step} {step} {dict.controls.ofSteps} {maxStep}
            </span>
          </div>

          {/* The derivation, next to the value it produced. */}
          {current.outcome.type === 'ok' && current.outcome.reasoning ? (
            <WhyRead
              reasoning={current.outcome.reasoning}
              transactions={world.transactions}
              legend={legend}
              dict={dict}
            />
          ) : null}

          {current.note ? (
            <p className="max-w-reading border-l-2 border-staff pl-3 text-body text-ink-muted">
              {current.note}
            </p>
          ) : null}

          {/* The answer to the question the reader arrived with. */}
          <AnomalyCallout
            anomalies={revealed}
            settled={atEnd}
            dict={dict}
            locale={locale}
            context={context}
          />

          <ScoreLegend dict={dict} />

          <p className="max-w-reading text-body text-ink-muted">
            {dict.editor.dragHint} {dict.controls.keyboardHint}
          </p>

          <section aria-labelledby="panels-heading" className="border-t border-staff-faint pt-8">
            <h2 id="panels-heading" className="font-prose text-title">
              {dict.panels.heading}
            </h2>
            <p className="mt-2 max-w-reading text-body text-ink-muted">
              {dict.panels.headingHint}
            </p>

            <div className="mt-6 grid gap-8 lg:grid-cols-3">
              <VersionChains chains={world.chains} transactions={world.transactions} dict={dict} />
              <LockTable locks={world.locks} waits={world.waits} dict={dict} />
              <SnapshotPanel
                transactions={world.transactions}
                committedRows={world.committedRows}
                dict={dict}
              />
            </div>
          </section>

          <nav aria-label={dict.controls.step}>
            <StepList trace={trace} currentStep={step} onSelectStep={goTo} dict={dict} />
          </nav>

          {graph ? (
            <section aria-labelledby="serial-heading" className="max-w-reading">
              <h3 id="serial-heading" className="font-prose text-section">
                {cycle ? dict.graph.cycle : dict.graph.noCycle}
              </h3>
              <p className="mt-1 text-body text-ink-muted">
                {cycle ? explainCycle(cycle) : dict.graph.noCycleBody}
              </p>
              {!cycle && graph.nodes.length > 0 ? (
                <p className="mt-1 font-mono text-caption">{graph.nodes.join(' → ')}</p>
              ) : null}
            </section>
          ) : null}

          {scenario ? (
            <section className="max-w-reading space-y-3 border-t border-staff-faint pt-8">
              <h3 className="font-prose text-section">{scenarioText(locale, scenario).title}</h3>
              <p className="text-body">
                <span className="eyebrow">{dict.scenarios.framing}: </span>
                {scenarioText(locale, scenario).framing}
              </p>
              <p className="text-body">
                <span className="eyebrow">{dict.scenarios.lesson}: </span>
                {scenarioText(locale, scenario).lesson}
              </p>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
