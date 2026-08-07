'use client'

import type { ExecutionTrace } from '@/lib/engine'
import type { Recording } from '@/lib/precompute/shape'
import type { Dictionary } from '@/lib/i18n/dictionaries'

/**
 * What the real engine did, beside what the model says.
 *
 * The site has always claimed its behaviour was verified against a running
 * database, and offered no way to look. The citation answers "the documentation
 * says so"; nothing answered "and we ran it". 220 recordings — PostgreSQL
 * 16.14, MySQL 8.4.11, SQL Server 16.0.4265.3, Oracle 23.26.2.0.0, each with
 * the version the server reported and the date it was taken — sat in the test
 * directory where only a contributor would find them.
 *
 * This shows the recording for exactly the run on screen, and marks any step
 * where the two disagree. That marker should never appear: `pnpm test:oracle`
 * fails the build if it would. It is here because a claim of agreement that
 * cannot be seen failing is not worth much.
 *
 * Where the model refuses and the recording exists, the recording is still
 * shown — that pairing is the most honest thing on the page. It is what a
 * declared modelling boundary looks like from the outside: the engine did
 * something, and this model will not tell you it knows which.
 */
export function TheRecording({
  recording,
  trace,
  notations,
  dict,
}: {
  readonly recording: Recording | null
  /** Null when the model refused this run. */
  readonly trace: ExecutionTrace | null
  /** Step notation, from the schedule — the recording does not repeat it. */
  readonly notations: readonly string[]
  readonly dict: Dictionary
}) {
  if (!recording) {
    return (
      <section aria-labelledby="recording-heading">
        <h3 id="recording-heading" className="font-prose text-section">
          {dict.recording.heading}
        </h3>
        <p className="mt-1.5 max-w-reading text-body text-ink-muted">{dict.recording.none}</p>
      </section>
    )
  }

  /** What the model said at the same step, in the same words. */
  const modelled = (index: number): string | null => {
    const step = trace?.steps[index]
    if (!step) return null
    if (step.outcome.type === 'error') return step.outcome.code
    if (step.outcome.type === 'ok' && step.outcome.read) {
      return step.outcome.read.type === 'row'
        ? String(step.outcome.read.value ?? '∅')
        : `{${step.outcome.read.rows.map((row) => `${row.key}=${row.value}`).join(', ')}}`
    }
    if (step.outcome.type === 'ok') return 'ok'
    return step.outcome.type
  }

  const recorded = (step: Recording['steps'][number]): string =>
    step.status === 'error' ? (step.code ?? 'error') : (step.read ?? 'ok')

  return (
    <section aria-labelledby="recording-heading">
      <h3 id="recording-heading" className="font-prose text-section">
        {dict.recording.heading}
      </h3>
      <p className="mt-1.5 max-w-reading text-body text-ink-muted">{dict.recording.hint}</p>

      <p className="mt-2 font-mono text-caption">
        {recording.engineVersion}
        <span className="ml-2 text-ink-muted">
          {dict.recording.recordedOn} {recording.recordedOn}
        </span>
        <span className="block text-micro text-ink-soft">{recording.image}</span>
      </p>

      <div className="leaf scroll-region mt-4" tabIndex={0} role="group" aria-label={dict.recording.heading}>
        <table className="w-full text-caption">
          <caption className="sr-only">{dict.recording.hint}</caption>
          <thead className="bg-manuscript-sunk">
            <tr className="eyebrow">
              <th scope="col" className="px-3 py-1.5 text-left font-normal">
                {dict.controls.step}
              </th>
              <th scope="col" className="px-3 py-1.5 text-left font-normal">
                {dict.recording.engineSaid}
              </th>
              <th scope="col" className="px-3 py-1.5 text-left font-normal">
                {dict.recording.modelSays}
              </th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {recording.steps.map((step) => {
              const ours = modelled(step.index)
              // Red only where they actually disagree — which the oracle test
              // makes impossible, so this is a tripwire and not decoration.
              const differs = ours !== null && ours !== recorded(step)
              return (
                <tr key={step.index} className="border-t border-staff-faint/60">
                  <td className="px-3 py-1.5">
                    <span className="text-ink-soft">{step.index}</span>{' '}
                    <span>{notations[step.index] ?? ''}</span>
                    {step.blockedUntilStep !== null ? (
                      <span className="ml-2 font-control text-micro text-ink-muted">
                        {dict.outcome.waited} {step.blockedUntilStep}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-1.5">
                    {recorded(step)}
                    {step.message ? (
                      <span className="block font-prose text-micro text-ink-muted">{step.message}</span>
                    ) : null}
                  </td>
                  <td className={`px-3 py-1.5 ${differs ? 'text-conductor' : 'text-ink-muted'}`}>
                    {ours ?? dict.recording.refused}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 max-w-reading text-caption text-ink-soft">
        {trace === null ? dict.recording.refusedNote : dict.recording.gate}
      </p>
    </section>
  )
}
