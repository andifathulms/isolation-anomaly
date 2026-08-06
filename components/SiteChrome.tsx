import Link from 'next/link'
import { LOCALES, LOCALE_LABELS, type Locale } from '@/lib/i18n/locales'
import { dictionary } from '@/lib/i18n/dictionaries'

/**
 * Header, navigation and the standing statement about what this is — every page
 * says plainly that it models documented behaviour rather than being a database.
 */
export function SiteChrome({
  locale,
  active,
  children,
}: {
  readonly locale: Locale
  readonly active: keyof ReturnType<typeof dictionary>['nav']
  readonly children: React.ReactNode
}) {
  const dict = dictionary(locale)
  const base = `/${locale}`
  const links = [
    { key: 'home' as const, href: `${base}/` },
    { key: 'schedule' as const, href: `${base}/schedule/` },
    { key: 'scenarios' as const, href: `${base}/scenarios/` },
    { key: 'matrix' as const, href: `${base}/matrix/` },
    { key: 'graph' as const, href: `${base}/graph/` },
    { key: 'engines' as const, href: `${base}/engines/` },
  ]

  return (
    <div className="min-h-screen">
      <header className="border-b border-staff-faint bg-manuscript-raised/70">
        <div className="mx-auto flex max-w-6xl flex-wrap items-baseline gap-x-6 gap-y-2 px-6 py-4">
          <Link href={`${base}/`} className="font-prose text-xl">
            {dict.site.title}
          </Link>
          <nav aria-label="Sections" className="flex flex-wrap gap-x-4 gap-y-1">
            {links.map((link) => (
              <Link
                key={link.key}
                href={link.href}
                aria-current={link.key === active ? 'page' : undefined}
                className={`font-control text-sm ${
                  link.key === active ? 'text-ink underline decoration-conductor underline-offset-4' : 'text-ink-muted'
                }`}
              >
                {dict.nav[link.key]}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-baseline gap-2">
            <span className="font-control text-xs uppercase tracking-wide text-ink-muted">
              {dict.site.language}
            </span>
            {LOCALES.map((candidate) => (
              <Link
                key={candidate}
                href={`/${candidate}/`}
                hrefLang={candidate}
                className={`font-control text-sm ${candidate === locale ? 'text-ink' : 'text-ink-muted'}`}
              >
                {LOCALE_LABELS[candidate]}
              </Link>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>

      <footer className="border-t border-staff-faint">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <p className="max-w-prose text-sm text-ink-muted">{dict.site.disclaimer}</p>
        </div>
      </footer>
    </div>
  )
}
