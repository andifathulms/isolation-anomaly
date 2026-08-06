/**
 * English is the default locale; Indonesian is secondary.
 * Database terminology stays in English in both — PRD §8: the reader will meet
 * `dirty read`, `write skew`, `snapshot`, `gap lock` in that form in the
 * vendor documentation and in error messages.
 */
export const LOCALES = ['en', 'id'] as const

export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'en'

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  id: 'Bahasa Indonesia',
}

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value)
}
