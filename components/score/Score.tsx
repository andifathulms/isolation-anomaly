'use client'

import { useState } from 'react'
import { moveRange, type Schedule } from '@/lib/schedule'
import type { ExecutionTrace } from '@/lib/engine'
import type { DetectedAnomaly } from '@/lib/detect'

/**
 * The score — PRD §5.1.
 *
 * Transactions are parallel staves running left to right in step order, and
 * operations are marks on the line. Bar lines fall at every execution step so
 * that reading straight down a bar line tells you what was happening
 * simultaneously, which is the entire skill of reading a schedule.
 *
 * Nothing is computed here: the component renders a trace. Colours are semantic
 * tokens only, and conductor's red appears on nothing but anomalies and aborts.
 *
 * Marks can be dragged sideways to re-interleave the schedule (PRD §5.1). A
 * mark can only travel between its own transaction's neighbours, and the range
 * it may reach is shaded while dragging — you are choosing the interleaving, not
 * rewriting the transaction, and the shading says so before the drop.
 *
 * Accessibility: this is one graphic with a written summary, not a grid of
 * buttons. Marks stay clickable and draggable for a mouse, but the keyboard and
 * screen-reader path is the step list and the editor's move buttons — real
 * controls, in order, with the same information. Focusable SVG groups would have
 * produced dozens of tab stops announcing coordinates, which is worse than a
 * single good description.
 */

const GUTTER = 76
const COLUMN = 86
const STAVE_GAP = 78
const TOP = 74
const BOTTOM_PAD = 34

/**
 * Voices carry a marker shape as well as a hue, so a transaction is never
 * identified by colour alone.
 */
const VOICES = [
  { tone: 'text-voiceA', marker: 'circle' },
  { tone: 'text-voiceB', marker: 'square' },
  { tone: 'text-voiceC', marker: 'diamond' },
] as const

type Props = {
  readonly schedule: Schedule
  readonly trace: ExecutionTrace
  readonly currentStep: number
  readonly anomalies: readonly DetectedAnomaly[]
  readonly onSelectStep: (step: number) => void
  /** Omitted when the score is read-only. */
  readonly onMoveStep?: (from: number, to: number) => void
  readonly labels: {
    readonly conductorMark: string
    readonly region: string
    /** Marks the start of a transaction-scoped snapshot's span. */
    readonly snapshot: string
  }
  /** Written description of the whole score, for anyone not looking at it. */
  readonly summary: string
}

function Marker({ shape, x, y, filled }: { shape: string; x: number; y: number; filled: boolean }) {
  const fill = filled ? 'fill-current' : 'fill-manuscript-raised'
  if (shape === 'square') {
    return (
      <rect x={x - 6} y={y - 6} width={12} height={12} className={`${fill} stroke-current`} strokeWidth={1.5} />
    )
  }
  if (shape === 'diamond') {
    return (
      <polygon
        points={`${x},${y - 7} ${x + 7},${y} ${x},${y + 7} ${x - 7},${y}`}
        className={`${fill} stroke-current`}
        strokeWidth={1.5}
      />
    )
  }
  return <circle cx={x} cy={y} r={6.5} className={`${fill} stroke-current`} strokeWidth={1.5} />
}

export function Score({
  schedule,
  trace,
  currentStep,
  anomalies,
  onSelectStep,
  onMoveStep,
  labels,
  summary,
}: Props) {
  const [dragging, setDragging] = useState<{ from: number; to: number } | null>(null)
  const width = GUTTER + schedule.steps.length * COLUMN + 16
  const height = TOP + schedule.transactions.length * STAVE_GAP + BOTTOM_PAD
  const columnX = (index: number) => GUTTER + index * COLUMN + COLUMN / 2
  const staveY = (txnIndex: number) => TOP + txnIndex * STAVE_GAP

  const columnAt = (clientX: number, element: SVGSVGElement) => {
    const box = element.getBoundingClientRect()
    const scale = width / box.width
    const x = (clientX - box.left) * scale
    return Math.min(Math.max(Math.floor((x - GUTTER) / COLUMN), 0), schedule.steps.length - 1)
  }

  const allowed = dragging ? moveRange(schedule, dragging.from) : null

  const causeSteps = [...new Set(anomalies.map((found) => found.causeStep))].sort((a, b) => a - b)
  const involved = new Set(anomalies.flatMap((found) => found.steps))

  /**
   * How long each transaction's view is frozen for, and which commits fell
   * inside it that the transaction cannot see.
   *
   * The score drew every operation and never drew the one thing this project is
   * about. A snapshot is an extent, not an event: at a transaction-scoped level
   * it is taken once and covers everything that follows, so any commit landing
   * inside that extent is invisible to the reader however recent it is. That is
   * the whole mechanism, and it was only ever available by reading a step number
   * out of a panel and holding it in your head while looking at a mark.
   *
   * A statement-scoped snapshot has no span to draw — it is retaken for every
   * statement — and the absence is the contrast that teaches the difference.
   */
  const world = trace.steps[currentStep]?.state
  const spans = (world?.transactions ?? []).flatMap((state) => {
    const snapshot = state.snapshot
    if (!snapshot || snapshot.scope !== 'transaction') return []
    const txnIndex = schedule.transactions.indexOf(state.txn)
    if (txnIndex < 0) return []
    const visible = new Set(snapshot.visibleXids)
    const ends = state.endedAtStep ?? currentStep
    return [{
      txnIndex,
      from: snapshot.takenAtStep,
      to: ends,
      // Committed by someone else, *inside* this span, and not in the snapshot.
      // Both bounds matter: a commit before the snapshot is visible, and one
      // after this transaction ended never had the chance to be hidden from it.
      unseen: (world?.transactions ?? [])
        .filter(
          (other) =>
            other.xid !== state.xid &&
            other.status === 'committed' &&
            other.endedAtStep !== null &&
            other.endedAtStep > snapshot.takenAtStep &&
            other.endedAtStep <= ends &&
            !visible.has(other.xid),
        )
        .map((other) => other.endedAtStep as number),
    }]
  })

  return (
    /*
     * A tab stop, because this box scrolls sideways and holds nothing focusable
     * — the marks are deliberately not buttons. Without one there is no keyboard
     * route to the right-hand end of a wide score at all, which on a narrow
     * window is where the conductor's mark tends to be. `group` is the standard
     * scrollable-region pattern: focusable, named, and left to the browser's own
     * arrow-key scrolling.
     */
    <div
      className="leaf scroll-region"
      tabIndex={0}
      role="group"
      aria-label={labels.region}
    >
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={summary}
        className="block"
      >
        {/* Bar lines: scaffolding, not content. */}
        {[...schedule.steps, null].map((_, index) => (
          <line
            key={`bar-${index}`}
            x1={GUTTER + index * COLUMN}
            x2={GUTTER + index * COLUMN}
            y1={TOP - 34}
            y2={height - BOTTOM_PAD + 14}
            className="stroke-staff-faint"
            strokeWidth={1}
          />
        ))}

        {schedule.steps.map((_, index) => (
          <text
            key={`num-${index}`}
            x={columnX(index)}
            y={TOP - 42}
            textAnchor="middle"
            className="fill-ink-muted font-mono"
            fontSize={10}
          >
            {index}
          </text>
        ))}

        {/* One stave per transaction. */}
        {schedule.transactions.map((txn, txnIndex) => {
          const voice = VOICES[txnIndex % VOICES.length] ?? VOICES[0]
          const y = staveY(txnIndex)
          const result = trace.transactions.find((candidate) => candidate.txn === txn)
          const ended = result?.outcome === 'aborted'
          return (
            <g key={txn} className={voice.tone}>
              <line x1={GUTTER} x2={width - 16} y1={y} y2={y} className="stroke-staff" strokeWidth={1.25} />
              <text x={12} y={y + 4} className="fill-current font-mono" fontSize={13}>
                {txn}
              </text>
              <text
                x={12}
                y={y + 20}
                className={`font-control ${ended ? 'fill-conductor' : 'fill-ink-muted'}`}
                fontSize={9}
              >
                {result?.outcome ?? 'open'}
              </text>
            </g>
          )
        })}

        {/*
          The snapshot's extent, under its own stave. Drawn in staff grey and
          thin: it is the ground a transaction reads against, not an event, and
          conductor's red stays reserved for anomalies and aborts.
        */}
        {spans.map((span) => {
          const y = staveY(span.txnIndex) + 44
          const x1 = columnX(span.from)
          const x2 = columnX(span.to)
          return (
            <g key={`span-${span.txnIndex}`} className="text-staff">
              <line x1={x1} x2={x2} y1={y} y2={y} className="stroke-current" strokeWidth={1} />
              <line x1={x1} x2={x1} y1={y - 4} y2={y + 4} className="stroke-current" strokeWidth={1} />
              <line x1={x2} x2={x2} y1={y - 4} y2={y + 4} className="stroke-current" strokeWidth={1} />
              <text x={x1 + 5} y={y - 6} className="fill-ink-soft font-control" fontSize={9}>
                {labels.snapshot}
              </text>

              {/* A commit that landed inside the span and stayed invisible. */}
              {span.unseen.map((step) => (
                <circle
                  key={`unseen-${span.txnIndex}-${step}`}
                  cx={columnX(step)}
                  cy={y}
                  r={4}
                  className="fill-manuscript-raised stroke-current"
                  strokeWidth={1.25}
                  strokeDasharray="2 2"
                />
              ))}
            </g>
          )
        })}

        {/* A wait, drawn as a tie from the statement to the step that released it. */}
        {trace.steps.map((step) => {
          if (step.blockedUntilStep === null) return null
          const y = staveY(schedule.transactions.indexOf(step.txn))
          const from = columnX(step.index)
          const to = columnX(step.blockedUntilStep)
          return (
            <path
              key={`tie-${step.index}`}
              d={`M ${from} ${y - 14} Q ${(from + to) / 2} ${y - 36} ${to} ${y - 14}`}
              className="fill-none stroke-staff"
              strokeWidth={1.25}
              strokeDasharray="3 3"
            />
          )
        })}

        {/* While dragging: the span this mark may travel, and where it would land. */}
        {dragging && allowed ? (
          <g>
            <rect
              x={GUTTER + allowed.first * COLUMN}
              y={TOP - 34}
              width={(allowed.last - allowed.first + 1) * COLUMN}
              height={height - BOTTOM_PAD - TOP + 48}
              className="fill-voiceA-wash"
              opacity={0.55}
            />
            <line
              x1={GUTTER + dragging.to * COLUMN + COLUMN / 2}
              x2={GUTTER + dragging.to * COLUMN + COLUMN / 2}
              y1={TOP - 34}
              y2={height - BOTTOM_PAD + 14}
              className="stroke-voiceA"
              strokeWidth={2}
            />
          </g>
        ) : null}

        {/* Operation marks. */}
        {trace.steps.map((step) => {
          const txnIndex = schedule.transactions.indexOf(step.txn)
          const voice = VOICES[txnIndex % VOICES.length] ?? VOICES[0]
          const x = columnX(step.index)
          const y = staveY(txnIndex)
          const failed = step.outcome.type === 'error' || step.outcome.type === 'blocked'
          const isControl =
            step.op.type === 'begin' || step.op.type === 'commit' || step.op.type === 'rollback'
          const filled = step.op.type === 'write' || step.op.type === 'insert' || step.op.type === 'delete'
          const conductor = step.op.type === 'rollback' || failed
          const tone = conductor ? 'text-conductor' : voice.tone

          return (
            <g
              key={`op-${step.index}`}
              className={`${tone} ${onMoveStep ? 'cursor-grab' : 'cursor-pointer'}`}
              onClick={() => onSelectStep(step.index)}
              onPointerDown={(event) => {
                if (!onMoveStep) return
                event.currentTarget.ownerSVGElement?.setPointerCapture(event.pointerId)
                setDragging({ from: step.index, to: step.index })
              }}
              onPointerMove={(event) => {
                if (!onMoveStep || !dragging) return
                const svg = event.currentTarget.ownerSVGElement
                if (!svg) return
                const range = moveRange(schedule, dragging.from)
                const column = columnAt(event.clientX, svg)
                const clamped = Math.min(Math.max(column, range.first), range.last)
                if (clamped !== dragging.to) setDragging({ ...dragging, to: clamped })
              }}
              onPointerUp={() => {
                if (!onMoveStep || !dragging) return
                if (dragging.to !== dragging.from) onMoveStep(dragging.from, dragging.to)
                setDragging(null)
              }}
              onPointerCancel={() => setDragging(null)}
            >
              {involved.has(step.index) ? (
                <circle cx={x} cy={y} r={14} className="fill-conductor-wash" />
              ) : null}
              {isControl ? (
                // A commit is one bar and a rollback is two, so the difference
                // survives without colour.
                <g className="stroke-current" strokeWidth={2.5}>
                  <line x1={x - (step.op.type === 'rollback' ? 3 : 0)} x2={x - (step.op.type === 'rollback' ? 3 : 0)} y1={y - 9} y2={y + 9} />
                  {step.op.type === 'rollback' ? <line x1={x + 3} x2={x + 3} y1={y - 9} y2={y + 9} /> : null}
                </g>
              ) : (
                <Marker shape={voice.marker} x={x} y={y} filled={filled} />
              )}
              <text x={x} y={y + 30} textAnchor="middle" className="fill-current font-mono" fontSize={11}>
                {step.notation}
              </text>
              {step.outcome.type === 'ok' && step.outcome.read ? (
                <text
                  x={x}
                  y={y - 20}
                  textAnchor="middle"
                  className="fill-ink-muted font-mono"
                  fontSize={10}
                >
                  {step.outcome.read.type === 'row'
                    ? (step.outcome.read.value ?? '∅')
                    : `{${step.outcome.read.rows.map((row) => row.key).join(',') || '∅'}}`}
                </text>
              ) : null}
            </g>
          )
        })}

        {/* The conductor's mark. */}
        {causeSteps.map((step) => (
          <g key={`mark-${step}`} className="text-conductor">
            <path
              d={`M ${columnX(step) - 20} 32 L ${columnX(step) - 20} 20 L ${columnX(step) + 20} 20 L ${columnX(step) + 20} 32`}
              className="fill-none stroke-current"
              strokeWidth={2}
            />
            <line
              x1={columnX(step)}
              x2={columnX(step)}
              y1={20}
              y2={height - BOTTOM_PAD + 8}
              className="stroke-current"
              strokeWidth={1}
              strokeDasharray="2 4"
            />
            <text x={columnX(step)} y={14} textAnchor="middle" className="fill-current font-control" fontSize={9}>
              {labels.conductorMark}
            </text>
          </g>
        ))}

        {/* The playhead. */}
        <g className="text-ink">
          <line
            x1={columnX(currentStep)}
            x2={columnX(currentStep)}
            y1={TOP - 34}
            y2={height - BOTTOM_PAD + 14}
            className="stroke-current"
            strokeWidth={1.5}
            opacity={0.5}
          />
          <polygon
            points={`${columnX(currentStep) - 5},${TOP - 36} ${columnX(currentStep) + 5},${TOP - 36} ${columnX(currentStep)},${TOP - 28}`}
            className="fill-current"
          />
        </g>
      </svg>
    </div>
  )
}
