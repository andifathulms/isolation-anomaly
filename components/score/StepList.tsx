'use client'

import { describe } from '@/lib/schedule'
import type { Dictionary } from '@/lib/i18n/dictionaries'
import type { ExecutionTrace } from '@/lib/engine'

/** The schedule as a list, for reading in order and for screen readers. */
export function StepList({
  trace,
  currentStep,
  onSelectStep,
  dict,
}: {
  readonly trace: ExecutionTrace
  readonly currentStep: number
  readonly onSelectStep: (step: number) => void
  readonly dict: Dictionary
}) {
  return (
    <ol className="divide-y divide-staff-faint rounded-sm border border-staff-faint bg-manuscript-raised">
      {trace.steps.map((step) => {
        const selected = step.index === currentStep
        const failed = step.outcome.type === 'error' || step.outcome.type === 'blocked'
        return (
          <li key={step.index}>
            <button
              type="button"
              onClick={() => onSelectStep(step.index)}
              aria-current={selected}
              className={`flex w-full flex-wrap items-baseline gap-x-3 px-3 py-2 text-left ${
                selected ? 'bg-manuscript-sunk' : ''
              }`}
            >
              <span className="w-6 font-mono text-xs text-ink-muted">{step.index}</span>
              <span className="w-10 font-mono text-sm">{step.txn}</span>
              <span className="font-mono text-sm">{step.notation}</span>
              <span className="text-sm text-ink-muted">{describe(step.op)}</span>

              {step.outcome.type === 'ok' && step.outcome.read ? (
                <span className="font-mono text-sm">
                  → {step.outcome.read.type === 'row'
                    ? (step.outcome.read.value ?? dict.outcome.noRow)
                    : `{${step.outcome.read.rows.map((row) => `${row.key}=${row.value}`).join(', ') || '∅'}}`}
                </span>
              ) : null}

              {step.outcome.type === 'ok' && step.outcome.rowsAffected !== null ? (
                <span className="font-mono text-xs text-ink-muted">
                  {step.outcome.rowsAffected} {dict.outcome.rowsAffected}
                </span>
              ) : null}

              {failed ? (
                <span className="font-mono text-sm text-conductor">
                  {step.outcome.type === 'error'
                    ? `${step.outcome.code} ${step.outcome.message}`
                    : dict.outcome.blocked}
                </span>
              ) : null}

              {step.outcome.type === 'refused' ? (
                <span className="font-mono text-sm text-conductor">
                  {dict.outcome.refused}: {step.outcome.refusal.gap}
                </span>
              ) : null}

              {step.blockedUntilStep !== null ? (
                <span className="font-control text-xs text-ink-muted">
                  {dict.outcome.waited} {step.blockedUntilStep}
                </span>
              ) : null}
            </button>
          </li>
        )
      })}
    </ol>
  )
}
