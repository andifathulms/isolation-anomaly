/**
 * The score, above the fold, as a picture rather than a promise.
 *
 * A visitor arriving at the landing page used to meet four paragraphs before
 * anything showed them what this is, and the shape of the page — serif, ruled
 * paper, a long measure — reads as an essay. This is the same notation the real
 * score uses, drawn once at a fixed schedule, so the first thing on the page is
 * the thing the site does.
 *
 * It is a figure, not the tool: nothing is computed here and nothing is
 * executed. The marks are the recorded write-skew run at PostgreSQL 16 /
 * REPEATABLE READ, transcribed by hand, which is why this is presentation and
 * carries no import from `lib/engine`. It is a server component with no state,
 * so it costs the bundle nothing.
 *
 * The vocabulary is deliberately identical to `Score` — voices carry a marker
 * shape as well as a hue, a commit is a single bar line, an open mark is a read
 * and a filled one is a write, and conductor's red appears on nothing but the
 * anomaly. By the time a reader reaches the real score, they have seen it.
 */

const GUTTER = 46
const COLUMN = 66
const STAVE_A = 66
const STAVE_B = 132
const STEPS = 8
const WIDTH = GUTTER + STEPS * COLUMN + 14
const HEIGHT = 186
const ANOMALY_STEP = 5

const columnX = (step: number) => GUTTER + step * COLUMN + COLUMN / 2

/** The recorded run, transcribed. `read` is what the engine returned. */
const MARKS = [
  { step: 0, y: STAVE_A, kind: 'bar', notation: 'b1' },
  { step: 1, y: STAVE_B, kind: 'bar', notation: 'b2' },
  { step: 2, y: STAVE_A, kind: 'circle', notation: 'r1[P:1..2]', read: '{1,2}' },
  { step: 3, y: STAVE_B, kind: 'square', notation: 'r2[P:1..2]', read: '{1,2}' },
  { step: 4, y: STAVE_A, kind: 'circle', notation: 'w1[1=0]', filled: true },
  { step: 5, y: STAVE_B, kind: 'square', notation: 'w2[2=0]', filled: true },
  { step: 6, y: STAVE_A, kind: 'bar', notation: 'c1' },
  { step: 7, y: STAVE_B, kind: 'bar', notation: 'c2' },
] as const

/** The two writes are the anomaly's operations, so both carry the wash. */
const INVOLVED = new Set([4, 5])

export function HeroFigure({
  labels,
}: {
  readonly labels: {
    readonly alt: string
    readonly conductorMark: string
    readonly committed: string
  }
}) {
  return (
    <div className="leaf overflow-x-auto">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={labels.alt}
        className="block h-auto w-full min-w-[30rem]"
      >
        {/* Bar lines: scaffolding, not content. */}
        {Array.from({ length: STEPS + 1 }, (_, index) => (
          <line
            key={`bar-${index}`}
            x1={GUTTER + index * COLUMN}
            x2={GUTTER + index * COLUMN}
            y1={38}
            y2={HEIGHT - 14}
            className="stroke-staff-faint"
            strokeWidth={1}
          />
        ))}

        {Array.from({ length: STEPS }, (_, index) => (
          <text
            key={`num-${index}`}
            x={columnX(index)}
            y={32}
            textAnchor="middle"
            className="fill-ink-muted font-mono"
            fontSize={10}
          >
            {index}
          </text>
        ))}

        {/* One stave per transaction, each labelled with how it ended. */}
        {[
          { txn: 'T1', y: STAVE_A, tone: 'text-voiceA' },
          { txn: 'T2', y: STAVE_B, tone: 'text-voiceB' },
        ].map((stave) => (
          <g key={stave.txn} className={stave.tone}>
            <line
              x1={GUTTER}
              x2={WIDTH - 14}
              y1={stave.y}
              y2={stave.y}
              className="stroke-staff"
              strokeWidth={1.25}
            />
            <text x={8} y={stave.y + 4} className="fill-current font-mono" fontSize={13}>
              {stave.txn}
            </text>
            <text x={8} y={stave.y + 19} className="fill-ink-muted font-control" fontSize={9}>
              {labels.committed}
            </text>
          </g>
        ))}

        {/* Operation marks. */}
        {MARKS.map((mark) => {
          const x = columnX(mark.step)
          const tone = mark.y === STAVE_A ? 'text-voiceA' : 'text-voiceB'
          const fill = 'filled' in mark && mark.filled ? 'fill-current' : 'fill-manuscript-raised'
          return (
            <g key={mark.step} className={tone}>
              {INVOLVED.has(mark.step) ? (
                <circle cx={x} cy={mark.y} r={14} className="fill-conductor-wash" />
              ) : null}

              {mark.kind === 'bar' ? (
                <line
                  x1={x}
                  x2={x}
                  y1={mark.y - 9}
                  y2={mark.y + 9}
                  className="stroke-current"
                  strokeWidth={2.5}
                />
              ) : mark.kind === 'square' ? (
                <rect
                  x={x - 6}
                  y={mark.y - 6}
                  width={12}
                  height={12}
                  className={`${fill} stroke-current`}
                  strokeWidth={1.5}
                />
              ) : (
                <circle
                  cx={x}
                  cy={mark.y}
                  r={6.5}
                  className={`${fill} stroke-current`}
                  strokeWidth={1.5}
                />
              )}

              <text
                x={x}
                y={mark.y + 29}
                textAnchor="middle"
                className="fill-current font-mono"
                fontSize={10}
              >
                {mark.notation}
              </text>

              {'read' in mark && mark.read ? (
                <text
                  x={x}
                  y={mark.y - 19}
                  textAnchor="middle"
                  className="fill-ink-muted font-mono"
                  fontSize={10}
                >
                  {mark.read}
                </text>
              ) : null}
            </g>
          )
        })}

        {/* The conductor's mark, on the step where it became unavoidable. */}
        <g className="text-conductor">
          <path
            d={`M ${columnX(ANOMALY_STEP) - 20} 24 L ${columnX(ANOMALY_STEP) - 20} 13
               L ${columnX(ANOMALY_STEP) + 20} 13 L ${columnX(ANOMALY_STEP) + 20} 24`}
            className="fill-none stroke-current"
            strokeWidth={2}
          />
          <line
            x1={columnX(ANOMALY_STEP)}
            x2={columnX(ANOMALY_STEP)}
            y1={13}
            y2={HEIGHT - 14}
            className="stroke-current"
            strokeWidth={1}
            strokeDasharray="2 4"
          />
          <text
            x={columnX(ANOMALY_STEP)}
            y={8}
            textAnchor="middle"
            className="fill-current font-control"
            fontSize={9}
          >
            {labels.conductorMark}
          </text>
        </g>
      </svg>
    </div>
  )
}
