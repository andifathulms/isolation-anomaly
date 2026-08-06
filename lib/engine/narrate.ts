import { describe } from '@/lib/schedule'
import { ANOMALIES, type DetectedAnomaly } from '@/lib/detect'
import type { ExecutionTrace, TraceStep } from './trace'

/**
 * The score in words.
 *
 * The staves are a picture of the trace, and a picture needs a description that
 * carries the same information rather than one that describes the drawing. So
 * this says what happened — who read what, who waited for whom, who was rolled
 * back — in the order it happened, and it is generated from the trace like
 * everything else the reader is shown.
 */

export function narrateStep(step: TraceStep): string {
  const parts: string[] = [`Step ${step.index}, ${step.txn}: ${describe(step.op)}`]

  switch (step.outcome.type) {
    case 'ok': {
      const read = step.outcome.read
      if (read?.type === 'row') {
        parts.push(read.value === null ? 'found no row' : `read ${read.value}`)
      } else if (read?.type === 'rows') {
        parts.push(
          read.rows.length === 0
            ? 'returned no rows'
            : `returned ${read.rows.length} row${read.rows.length === 1 ? '' : 's'}: ` +
                read.rows.map((row) => `key ${row.key} is ${row.value}`).join(', '),
        )
      } else if (step.outcome.rowsAffected !== null) {
        parts.push(`changed ${step.outcome.rowsAffected} row${step.outcome.rowsAffected === 1 ? '' : 's'}`)
      }
      break
    }
    case 'error':
      parts.push(`failed with ${step.outcome.code}, ${step.outcome.message}`)
      break
    case 'blocked':
      parts.push(`was still waiting for ${step.outcome.waitingFor.join(' and ')} when the schedule ended`)
      break
    case 'refused':
      parts.push(`was refused: ${step.outcome.refusal.gap}`)
      break
    default: {
      const exhaustive: never = step.outcome
      return exhaustive
    }
  }

  if (step.blockedUntilStep !== null) {
    parts.push(`after waiting for a lock until step ${step.blockedUntilStep}`)
  }

  return `${parts.join(', ')}.`
}

export function narrateTrace(
  trace: ExecutionTrace,
  anomalies: readonly DetectedAnomaly[],
): string {
  const voices = trace.transactions
    .map((result) => `${result.txn} ${result.outcome}`)
    .join(', ')

  const opening =
    `Schedule ${trace.scheduleId} on ${trace.engine} ${trace.engineVersion} at ${trace.level}` +
    (trace.aliasOf ? ` (which this engine runs as ${trace.aliasOf})` : '') +
    `. ${trace.transactions.length} transactions over ${trace.steps.length} steps: ${voices}.`

  const found =
    anomalies.length === 0
      ? 'No anomaly occurred.'
      : anomalies
          .map(
            (anomaly) =>
              `${ANOMALIES[anomaly.id].name} occurred, becoming inevitable at step ${anomaly.causeStep}.`,
          )
          .join(' ')

  const table =
    trace.finalState.length === 0
      ? 'The table is left empty.'
      : `The table is left as ${trace.finalState.map((row) => `key ${row.key} is ${row.value}`).join(', ')}.`

  return [opening, found, ...trace.steps.map(narrateStep), table].join(' ')
}
