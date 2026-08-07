'use client'

import { useMemo, useState } from 'react'
import {
  canMove,
  describe,
  moveStep,
  validateSchedule,
  type InitialRow,
  type Operation,
  type OperationType,
  type Schedule,
  type ScheduleStep,
  type TxnId,
} from '@/lib/schedule'
import type { Dictionary } from '@/lib/i18n/dictionaries'

/**
 * The schedule editor — PRD §5.7. Build your own interleaving and get an answer
 * for the exact one that broke production last week.
 *
 * The operation vocabulary is fixed, so this is a set of dropdowns rather than a
 * text field: there is nothing to parse, and nothing that can be asked for that
 * the engines cannot be asked for too.
 */

const OPERATIONS: readonly OperationType[] = [
  'begin',
  'read',
  'write',
  'readRange',
  'insert',
  'delete',
  'selectForUpdate',
  'commit',
  'rollback',
]

function blankOperation(type: OperationType, previous: Operation): Operation {
  const key = 'key' in previous ? previous.key : 1
  const value = 'value' in previous ? previous.value : 0
  switch (type) {
    case 'begin':
      return { type: 'begin' }
    case 'commit':
      return { type: 'commit' }
    case 'rollback':
      return { type: 'rollback' }
    case 'read':
      return { type: 'read', key }
    case 'selectForUpdate':
      return { type: 'selectForUpdate', key }
    case 'delete':
      return { type: 'delete', key }
    case 'write':
      return { type: 'write', key, value }
    case 'insert':
      return { type: 'insert', key, value }
    case 'readRange':
      return { type: 'readRange', predicate: { type: 'keyRange', from: 1, to: 5 } }
    default: {
      const exhaustive: never = type
      return exhaustive
    }
  }
}

const control = 'rounded-md border border-staff bg-manuscript-raised px-2 py-1 font-mono text-caption'
const button = 'rounded-md border border-staff px-2 py-1 font-control text-micro transition-colors hover:bg-manuscript-sunk'

export function Editor({
  schedule,
  onChange,
  dict,
}: {
  readonly schedule: Schedule
  readonly onChange: (next: Schedule) => void
  readonly dict: Dictionary
}) {
  const issues = useMemo(() => validateSchedule(schedule), [schedule])
  const [dragFrom, setDragFrom] = useState<number | null>(null)

  const setSteps = (steps: readonly ScheduleStep[]) => onChange({ ...schedule, steps })

  const patchStep = (index: number, patch: Partial<ScheduleStep>) =>
    setSteps(schedule.steps.map((step, at) => (at === index ? { ...step, ...patch } : step)))

  // Moves go through the same clamping the score's drag uses, so a step can
  // never be pushed past its own transaction's neighbours.
  const move = (index: number, by: number) => onChange(moveStep(schedule, index, index + by))

  const addTransaction = () => {
    const next = `T${schedule.transactions.length + 1}`
    onChange({
      ...schedule,
      transactions: [...schedule.transactions, next],
      steps: [...schedule.steps, { txn: next, op: { type: 'begin' } }],
    })
  }

  const setInitial = (rows: readonly InitialRow[]) => onChange({ ...schedule, initial: rows })

  return (
    <div className="leaf space-y-6 p-4">
      <section>
        <h3 className="font-prose text-section">{dict.panels.committedTable}</h3>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {schedule.initial.map((row, index) => (
            <span key={index} className="flex items-center gap-1">
              <input
                type="number"
                value={row.key}
                aria-label={`${dict.panels.key} ${index}`}
                onChange={(event) =>
                  setInitial(
                    schedule.initial.map((candidate, at) =>
                      at === index ? { ...candidate, key: Number(event.target.value) } : candidate,
                    ),
                  )
                }
                className={`${control} w-16`}
              />
              <span className="font-mono text-caption">=</span>
              <input
                type="number"
                value={row.value}
                aria-label={`${dict.panels.value} ${index}`}
                onChange={(event) =>
                  setInitial(
                    schedule.initial.map((candidate, at) =>
                      at === index ? { ...candidate, value: Number(event.target.value) } : candidate,
                    ),
                  )
                }
                className={`${control} w-20`}
              />
              <button
                type="button"
                className={button}
                onClick={() => setInitial(schedule.initial.filter((_, at) => at !== index))}
              >
                ×
              </button>
            </span>
          ))}
          <button
            type="button"
            className={button}
            onClick={() =>
              setInitial([
                ...schedule.initial,
                { key: (schedule.initial.at(-1)?.key ?? 0) + 1, value: 0 },
              ])
            }
          >
            + row
          </button>
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-baseline gap-3">
          <h3 className="font-prose text-section">{dict.controls.step}s</h3>
          <button type="button" className={button} onClick={addTransaction}>
            + transaction
          </button>
        </div>

        <ol className="mt-3 space-y-1">
          {schedule.steps.map((step, index) => (
            <li
              key={index}
              draggable={canMove(schedule, index)}
              onDragStart={() => setDragFrom(index)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (dragFrom !== null) onChange(moveStep(schedule, dragFrom, index))
                setDragFrom(null)
              }}
              onDragEnd={() => setDragFrom(null)}
              className={`flex flex-wrap items-center gap-1.5 ${
                dragFrom === index ? 'opacity-50' : ''
              } ${canMove(schedule, index) ? 'cursor-grab' : ''}`}
            >
              <span className="w-6 font-mono text-micro text-ink-muted">{index}</span>

              <select
                value={step.txn}
                aria-label={`Transaction for step ${index}`}
                onChange={(event) => patchStep(index, { txn: event.target.value as TxnId })}
                className={control}
              >
                {schedule.transactions.map((txn) => (
                  <option key={txn} value={txn}>
                    {txn}
                  </option>
                ))}
              </select>

              <select
                value={step.op.type}
                aria-label={`Operation for step ${index}`}
                onChange={(event) =>
                  patchStep(index, {
                    op: blankOperation(event.target.value as OperationType, step.op),
                  })
                }
                className={control}
              >
                {OPERATIONS.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>

              {'key' in step.op ? (
                <input
                  type="number"
                  value={step.op.key}
                  aria-label={`Key for step ${index}`}
                  onChange={(event) =>
                    patchStep(index, { op: { ...step.op, key: Number(event.target.value) } as Operation })
                  }
                  className={`${control} w-16`}
                />
              ) : null}

              {'value' in step.op ? (
                <input
                  type="number"
                  value={step.op.value}
                  aria-label={`Value for step ${index}`}
                  onChange={(event) =>
                    patchStep(index, { op: { ...step.op, value: Number(event.target.value) } as Operation })
                  }
                  className={`${control} w-20`}
                />
              ) : null}

              {step.op.type === 'readRange' ? (
                <span className="flex items-center gap-1">
                  <input
                    type="number"
                    value={step.op.predicate.from}
                    aria-label={`Range start for step ${index}`}
                    onChange={(event) =>
                      patchStep(index, {
                        op: {
                          type: 'readRange',
                          predicate: {
                            type: 'keyRange',
                            from: Number(event.target.value),
                            to: step.op.type === 'readRange' ? step.op.predicate.to : 0,
                          },
                        },
                      })
                    }
                    className={`${control} w-16`}
                  />
                  <span className="font-mono text-caption">..</span>
                  <input
                    type="number"
                    value={step.op.predicate.to}
                    aria-label={`Range end for step ${index}`}
                    onChange={(event) =>
                      patchStep(index, {
                        op: {
                          type: 'readRange',
                          predicate: {
                            type: 'keyRange',
                            from: step.op.type === 'readRange' ? step.op.predicate.from : 0,
                            to: Number(event.target.value),
                          },
                        },
                      })
                    }
                    className={`${control} w-16`}
                  />
                </span>
              ) : null}

              <span className="text-micro text-ink-muted">{describe(step.op)}</span>

              <span className="ml-auto flex gap-1">
                <button type="button" className={button} onClick={() => move(index, -1)} aria-label="Move earlier">
                  ↑
                </button>
                <button type="button" className={button} onClick={() => move(index, 1)} aria-label="Move later">
                  ↓
                </button>
                <button
                  type="button"
                  className={button}
                  aria-label="Duplicate step"
                  onClick={() =>
                    setSteps([
                      ...schedule.steps.slice(0, index + 1),
                      step,
                      ...schedule.steps.slice(index + 1),
                    ])
                  }
                >
                  +
                </button>
                <button
                  type="button"
                  className={button}
                  aria-label="Remove step"
                  onClick={() => setSteps(schedule.steps.filter((_, at) => at !== index))}
                >
                  ×
                </button>
              </span>
            </li>
          ))}
        </ol>
      </section>

      {issues.length > 0 ? (
        <ul className="space-y-1 border-l-2 border-conductor pl-3">
          {issues.map((issue, index) => (
            <li key={index} className="text-caption text-conductor">
              {issue.step === null ? '' : `step ${issue.step}: `}
              {issue.message}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
