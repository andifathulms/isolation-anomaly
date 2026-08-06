import { isTerminalOperation, type Schedule } from './types'

/**
 * Structural validation of a schedule, before any engine sees it. This catches
 * schedules that no database could ever be handed — an operation on a
 * transaction that never began, work after a commit — as distinct from
 * schedules that are legal but that a given engine refuses to run.
 */
export type ScheduleIssue = {
  /** Index into `schedule.steps`, or null for whole-schedule issues. */
  readonly step: number | null
  readonly message: string
}

export function validateSchedule(schedule: Schedule): readonly ScheduleIssue[] {
  const issues: ScheduleIssue[] = []
  const declared = new Set(schedule.transactions)

  if (schedule.transactions.length === 0) {
    issues.push({ step: null, message: 'A schedule needs at least one transaction.' })
  }
  if (declared.size !== schedule.transactions.length) {
    issues.push({ step: null, message: 'Transaction ids must be unique.' })
  }

  const seenKeys = new Set<number>()
  for (const row of schedule.initial) {
    if (seenKeys.has(row.key)) {
      issues.push({ step: null, message: `Initial state declares key ${row.key} twice.` })
    }
    seenKeys.add(row.key)
  }

  const begun = new Set<string>()
  const finished = new Set<string>()

  schedule.steps.forEach((step, index) => {
    if (!declared.has(step.txn)) {
      issues.push({ step: index, message: `${step.txn} is not declared in transactions.` })
      return
    }
    if (finished.has(step.txn)) {
      issues.push({ step: index, message: `${step.txn} has already committed or rolled back.` })
      return
    }
    if (step.op.type === 'begin') {
      if (begun.has(step.txn)) {
        issues.push({ step: index, message: `${step.txn} begins twice.` })
      }
      begun.add(step.txn)
      return
    }
    if (!begun.has(step.txn)) {
      issues.push({ step: index, message: `${step.txn} acts before it begins.` })
      return
    }
    if (isTerminalOperation(step.op)) {
      finished.add(step.txn)
    }
  })

  for (const txn of schedule.transactions) {
    if (!begun.has(txn)) {
      issues.push({ step: null, message: `${txn} never begins.` })
    }
  }

  return issues
}

export function assertValidSchedule(schedule: Schedule): void {
  const issues = validateSchedule(schedule)
  if (issues.length > 0) {
    const detail = issues
      .map((issue) => (issue.step === null ? issue.message : `step ${issue.step}: ${issue.message}`))
      .join('; ')
    throw new Error(`Invalid schedule ${schedule.id}: ${detail}`)
  }
}
