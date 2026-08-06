'use client'

import { useEffect, useState } from 'react'
import type { Dictionary } from '@/lib/i18n/dictionaries'

type Theme = 'light' | 'dark'

/**
 * Light or dark manuscript. The initial value is resolved by the inline script
 * in the root layout before first paint, so this only ever reads what is
 * already on the element — it never decides the theme on mount, which would
 * flash.
 */
export function ThemeToggle({ dict }: { readonly dict: Dictionary }) {
  const [theme, setTheme] = useState<Theme | null>(null)

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')
  }, [])

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    try {
      window.localStorage.setItem('theme', next)
    } catch {
      // A blocked storage API is not a reason to refuse the toggle.
    }
    setTheme(next)
  }

  // Until the effect has run the button would have to guess at its own label,
  // so it reserves its space and says nothing.
  const label = theme === null ? '' : theme === 'dark' ? dict.site.themeToLight : dict.site.themeToDark

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className="rounded-md border border-staff-faint p-1.5 text-ink-muted transition-colors hover:border-staff hover:text-ink"
    >
      {theme === 'dark' ? (
        // A sun: switching away from dark.
        <svg viewBox="0 0 20 20" width={16} height={16} aria-hidden="true" className="block">
          <circle cx="10" cy="10" r="3.6" className="fill-current" />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
            <line
              key={angle}
              x1="10"
              y1="1.8"
              x2="10"
              y2="4.2"
              transform={`rotate(${angle} 10 10)`}
              className="stroke-current"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          ))}
        </svg>
      ) : (
        // A crescent: switching towards dark.
        <svg viewBox="0 0 20 20" width={16} height={16} aria-hidden="true" className="block">
          <path
            d="M15.6 12.6A6.6 6.6 0 0 1 7.4 4.4a6.6 6.6 0 1 0 8.2 8.2Z"
            className="fill-current"
          />
        </svg>
      )}
    </button>
  )
}
