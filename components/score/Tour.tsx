'use client'

import { useEffect, useState } from 'react'
import type { Dictionary } from '@/lib/i18n/dictionaries'

const STORAGE_KEY = 'tour-seen'

/**
 * A three-beat introduction shown once, on a reader's first visit to the
 * schedule page.
 *
 * It is a panel in the flow rather than an overlay with cut-outs: the score is
 * already the thing directly beneath it, so pointing at it with a modal would
 * cover the only thing worth looking at. Dismissal is remembered, and a reader
 * who has never had storage available simply sees it again — which is better
 * than a first-time reader who never sees it at all.
 */
export function Tour({ dict }: { readonly dict: Dictionary }) {
  const [beat, setBeat] = useState(0)
  // Starts hidden. Anything else flashes the panel at every returning reader
  // for as long as it takes the effect to read storage.
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    try {
      if (!window.localStorage.getItem(STORAGE_KEY)) setVisible(true)
    } catch {
      setVisible(true)
    }
  }, [])

  const dismiss = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      // Nothing to remember it with; the panel simply returns next time.
    }
    setVisible(false)
  }

  if (!visible) return null

  const beats = [
    { heading: dict.tour.step1Heading, body: dict.tour.step1Body },
    { heading: dict.tour.step2Heading, body: dict.tour.step2Body },
    { heading: dict.tour.step3Heading, body: dict.tour.step3Body },
  ]
  const current = beats[beat] ?? beats[0]
  if (!current) return null
  const last = beat === beats.length - 1

  return (
    <aside
      aria-label={current.heading}
      className="leaf border-l-2 border-l-voiceA px-4 py-4 sm:px-5"
    >
      <div className="flex items-baseline justify-between gap-4">
        <p className="eyebrow">
          {beat + 1} {dict.tour.progress} {beats.length}
        </p>
        <div className="flex gap-1" aria-hidden="true">
          {beats.map((_, index) => (
            <span
              key={index}
              className={`h-1.5 w-1.5 rounded-full ${index === beat ? 'bg-voiceA' : 'bg-staff-faint'}`}
            />
          ))}
        </div>
      </div>

      <h2 className="mt-2 font-prose text-section">{current.heading}</h2>
      <p className="mt-2 max-w-reading text-body text-ink-muted">{current.body}</p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {last ? (
          <button type="button" onClick={dismiss} className="control control-strong">
            {dict.tour.done}
          </button>
        ) : (
          <button type="button" onClick={() => setBeat(beat + 1)} className="control control-strong">
            {dict.tour.next}
          </button>
        )}
        {beat > 0 ? (
          <button type="button" onClick={() => setBeat(beat - 1)} className="control">
            {dict.tour.back}
          </button>
        ) : null}
        <button
          type="button"
          onClick={dismiss}
          className="ml-auto font-control text-caption text-ink-soft underline decoration-staff underline-offset-4 hover:text-ink"
        >
          {dict.tour.skip}
        </button>
      </div>
    </aside>
  )
}
