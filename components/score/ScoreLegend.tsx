'use client'

import type { Dictionary } from '@/lib/i18n/dictionaries'

/**
 * The notation key for the score.
 *
 * Every glyph here is drawn with the same primitives and the same stroke widths
 * as the score itself rather than described in words, because a key that only
 * approximates the thing it explains is worse than no key — the reader learns a
 * shape that is not on screen.
 *
 * Collapsed by default: it is scaffolding a reader needs once and then never
 * again, and the score is the thing that should own the space.
 */

function Glyph({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <svg viewBox="0 0 44 28" width={44} height={28} role="img" aria-label={label} className="shrink-0">
      {children}
    </svg>
  )
}

export function ScoreLegend({ dict }: { readonly dict: Dictionary }) {
  const entries = [
    {
      term: dict.legend.voices,
      body: dict.legend.voicesBody,
      glyph: (
        <Glyph label={dict.legend.voices}>
          <line x1="2" y1="9" x2="42" y2="9" className="stroke-staff" strokeWidth={1.25} />
          <line x1="2" y1="21" x2="42" y2="21" className="stroke-staff" strokeWidth={1.25} />
          <circle cx="16" cy="9" r="5" className="fill-manuscript-raised stroke-voiceA" strokeWidth={1.5} />
          <rect
            x="24"
            y="16"
            width="10"
            height="10"
            className="fill-voiceB stroke-voiceB"
            strokeWidth={1.5}
          />
        </Glyph>
      ),
    },
    {
      term: dict.legend.read,
      body: dict.legend.readBody,
      glyph: (
        <Glyph label={dict.legend.read}>
          <line x1="2" y1="18" x2="42" y2="18" className="stroke-staff" strokeWidth={1.25} />
          <text x="22" y="8" textAnchor="middle" className="fill-ink-muted font-mono" fontSize={9}>
            50
          </text>
          <circle cx="22" cy="18" r="6" className="fill-manuscript-raised stroke-voiceA" strokeWidth={1.5} />
        </Glyph>
      ),
    },
    {
      term: dict.legend.write,
      body: dict.legend.writeBody,
      glyph: (
        <Glyph label={dict.legend.write}>
          <line x1="2" y1="14" x2="42" y2="14" className="stroke-staff" strokeWidth={1.25} />
          <circle cx="22" cy="14" r="6" className="fill-voiceA stroke-voiceA" strokeWidth={1.5} />
        </Glyph>
      ),
    },
    {
      term: dict.legend.commit,
      body: dict.legend.commitBody,
      glyph: (
        <Glyph label={dict.legend.commit}>
          <line x1="2" y1="14" x2="42" y2="14" className="stroke-staff" strokeWidth={1.25} />
          <line x1="22" y1="6" x2="22" y2="22" className="stroke-voiceA" strokeWidth={2.5} />
        </Glyph>
      ),
    },
    {
      term: dict.legend.rollback,
      body: dict.legend.rollbackBody,
      glyph: (
        <Glyph label={dict.legend.rollback}>
          <line x1="2" y1="14" x2="42" y2="14" className="stroke-staff" strokeWidth={1.25} />
          <line x1="19" y1="6" x2="19" y2="22" className="stroke-conductor" strokeWidth={2.5} />
          <line x1="25" y1="6" x2="25" y2="22" className="stroke-conductor" strokeWidth={2.5} />
        </Glyph>
      ),
    },
    {
      term: dict.legend.wait,
      body: dict.legend.waitBody,
      glyph: (
        <Glyph label={dict.legend.wait}>
          <line x1="2" y1="20" x2="42" y2="20" className="stroke-staff" strokeWidth={1.25} />
          <path
            d="M 10 15 Q 22 2 34 15"
            className="fill-none stroke-staff"
            strokeWidth={1.25}
            strokeDasharray="3 3"
          />
          <circle cx="10" cy="20" r="4" className="fill-manuscript-raised stroke-voiceA" strokeWidth={1.5} />
          <circle cx="34" cy="20" r="4" className="fill-manuscript-raised stroke-voiceA" strokeWidth={1.5} />
        </Glyph>
      ),
    },
    {
      term: dict.legend.playhead,
      body: dict.legend.playheadBody,
      glyph: (
        <Glyph label={dict.legend.playhead}>
          <line x1="2" y1="18" x2="42" y2="18" className="stroke-staff" strokeWidth={1.25} />
          <line x1="22" y1="8" x2="22" y2="26" className="stroke-ink" strokeWidth={1.5} opacity={0.5} />
          <polygon points="17,4 27,4 22,11" className="fill-ink" />
        </Glyph>
      ),
    },
    {
      term: dict.legend.mark,
      body: dict.legend.markBody,
      glyph: (
        <Glyph label={dict.legend.mark}>
          <path
            d="M 8 14 L 8 6 L 36 6 L 36 14"
            className="fill-none stroke-conductor"
            strokeWidth={2}
          />
          <line
            x1="22"
            y1="6"
            x2="22"
            y2="26"
            className="stroke-conductor"
            strokeWidth={1}
            strokeDasharray="2 4"
          />
        </Glyph>
      ),
    },
    {
      term: dict.legend.notation,
      body: dict.legend.notationBody,
      glyph: (
        <Glyph label={dict.legend.notation}>
          <text x="22" y="18" textAnchor="middle" className="fill-ink font-mono" fontSize={11}>
            w1[x]
          </text>
        </Glyph>
      ),
    },
  ]

  return (
    <details className="group leaf overflow-hidden">
      <summary
        className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 font-control text-sm
          transition-colors hover:bg-manuscript-sunk [&::-webkit-details-marker]:hidden"
      >
        <svg
          viewBox="0 0 12 12"
          width={10}
          height={10}
          aria-hidden="true"
          className="shrink-0 text-ink-soft transition-transform group-open:rotate-90"
        >
          <polygon points="3,1 10,6 3,11" className="fill-current" />
        </svg>
        <span className="group-open:hidden">{dict.legend.show}</span>
        <span className="hidden group-open:inline">{dict.legend.hide}</span>
      </summary>

      <div className="border-t border-staff-faint px-4 py-4">
        <h3 className="sr-only">{dict.legend.heading}</h3>
        <p className="max-w-reading text-sm leading-relaxed text-ink-muted">{dict.legend.intro}</p>

        <dl className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2 xl:grid-cols-3">
          {entries.map((entry) => (
            <div key={entry.term} className="flex items-start gap-3">
              <div className="mt-0.5">{entry.glyph}</div>
              <div className="min-w-0">
                <dt className="font-control text-sm text-ink">{entry.term}</dt>
                <dd className="mt-0.5 text-sm leading-relaxed text-ink-muted">{entry.body}</dd>
              </div>
            </div>
          ))}
        </dl>
      </div>
    </details>
  )
}
