'use client'

import { useEffect } from 'react'

/**
 * Publishes the sticky header's real height as `--header-height`.
 *
 * The workbench's control bar sticks directly beneath the header, so the two
 * have to agree on one number. That number used to be written down twice and
 * guessed both times, and it went wrong whenever the header was taller than the
 * guess — the Indonesian nav row wrapping, a long locale label, a reader at 200%
 * zoom. A `min-height` kept the seam from opening but could not stop the bar
 * from sitting too low.
 *
 * Nothing in CSS can measure an element, so this measures it. The stylesheet
 * keeps a sensible starting value for first paint and for a reader without
 * JavaScript; from mount onwards the property carries what the header actually
 * is.
 *
 * A `ResizeObserver` rather than a resize listener, because most of the ways
 * this height changes are not window resizes: the nav row rewrapping when the
 * locale changes, and Faustina arriving and reflowing the title — `display:
 * swap` means the header is measurably shorter before the font loads than
 * after, which no amount of hardcoding could have covered.
 */

const PROPERTY = '--header-height'

/** Sub-pixel noise is not a wrap. A real change is a whole row of nav. */
const THRESHOLD = 0.5

export function HeaderHeight({ target }: { readonly target: string }) {
  useEffect(() => {
    const header = document.getElementById(target)
    if (!header) return

    const root = document.documentElement
    let last = 0

    const write = () => {
      const { height } = header.getBoundingClientRect()
      // Sub-pixel churn would write on every scroll on a fractional-DPI screen,
      // and each write is a style recalculation on the whole document.
      if (height <= 0 || Math.abs(height - last) < THRESHOLD) return
      last = height
      root.style.setProperty(PROPERTY, `${height}px`)
    }

    write()

    if (typeof ResizeObserver === 'undefined') {
      // Every browser this site supports has it; a resize listener still covers
      // the common case rather than leaving the stylesheet's value stranded.
      window.addEventListener('resize', write)
      return () => window.removeEventListener('resize', write)
    }

    const observer = new ResizeObserver(write)
    observer.observe(header)
    return () => observer.disconnect()
    // The property is deliberately left behind: the next page's header is the
    // same header, and clearing it would flash the fallback between routes.
  }, [target])

  return null
}
