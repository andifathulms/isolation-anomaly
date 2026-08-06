import Link from 'next/link'
import { LOCALES, LOCALE_LABELS, type Locale } from '@/lib/i18n/locales'
import { dictionary } from '@/lib/i18n/dictionaries'
import { ThemeToggle } from './ThemeToggle'
import { MakerSignature } from './MakerSignature'
import { BrandMark } from './BrandMark'

/**
 * Header, navigation and the standing statement about what this is — every page
 * says plainly that it models documented behaviour rather than being a database.
 *
 * The header is two rows rather than one wrapping row: identity and settings on
 * top, sections beneath. At the old single-row arrangement the six section links
 * wrapped into the title on a phone and the whole thing read as a word soup.
 * The section row scrolls sideways instead of wrapping, so the header keeps a
 * fixed height and the page below it never jumps.
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
    <div className="flex min-h-screen flex-col">
      <a
        href="#content"
        className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:left-4 focus-visible:top-4
          focus-visible:z-50 focus-visible:rounded-md focus-visible:bg-manuscript-raised focus-visible:px-4
          focus-visible:py-2 focus-visible:font-control focus-visible:text-sm"
      >
        {dict.site.skipToContent}
      </a>

      {/* Opaque rather than translucent: at 90% the page's ruled ground and the
          score's own marks ghosted through the header as it scrolled past. */}
      <header className="sticky top-0 z-30 border-b border-staff-faint bg-manuscript">
        <div className="mx-auto flex max-w-6xl items-center gap-x-4 px-4 pt-3 sm:px-6">
          <Link
            href={`${base}/`}
            className="flex items-center gap-2.5 whitespace-nowrap font-prose text-xl leading-none tracking-tight"
          >
            <BrandMark size={26} />
            {dict.site.title}
          </Link>

          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-baseline gap-1.5">
              <span className="sr-only">{dict.site.language}</span>
              {LOCALES.map((candidate) => (
                <Link
                  key={candidate}
                  href={`/${candidate}/`}
                  hrefLang={candidate}
                  aria-label={LOCALE_LABELS[candidate]}
                  aria-current={candidate === locale ? 'true' : undefined}
                  className={`whitespace-nowrap rounded px-1.5 py-0.5 font-control text-xs uppercase tracking-wider
                    transition-colors ${
                      candidate === locale
                        ? 'bg-manuscript-sunk text-ink'
                        : 'text-ink-soft hover:text-ink'
                    }`}
                >
                  {/* "Bahasa Indonesia" wraps a phone header onto three lines,
                      so narrow screens get the code and the full name stays in
                      the accessible name. */}
                  <span className="md:hidden">{candidate}</span>
                  <span className="hidden md:inline">{LOCALE_LABELS[candidate]}</span>
                </Link>
              ))}
            </div>
            <ThemeToggle dict={dict} />
          </div>
        </div>

        <nav aria-label={dict.site.menu} className="mx-auto max-w-6xl px-4 sm:px-6">
          <ul className="-mb-px flex gap-x-5 overflow-x-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {links.map((link) => (
              <li key={link.key} className="shrink-0">
                <Link
                  href={link.href}
                  aria-current={link.key === active ? 'page' : undefined}
                  className={`block border-b-2 pb-1.5 font-control text-sm transition-colors ${
                    link.key === active
                      ? 'border-conductor text-ink'
                      : 'border-transparent text-ink-muted hover:border-staff hover:text-ink'
                  }`}
                >
                  {dict.nav[link.key]}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main id="content" className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
        {children}
      </main>

      {/*
        One seam. The standing statement about what this models and the maker's
        mark share the footer's single rule and are held apart by alignment
        instead of another divider — a claim about the work's evidence and a
        personal credit should not read as one paragraph.
      */}
      <footer className="mt-8 border-t border-staff-faint bg-manuscript-raised">
        <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 md:flex-row md:items-end md:justify-between md:gap-12">
          <div>
            <h2 className="eyebrow">{dict.site.disclaimerHeading}</h2>
            <p className="mt-2 max-w-reading text-sm leading-relaxed text-ink-muted">
              {dict.site.disclaimer}
            </p>
          </div>
          <MakerSignature />
        </div>
      </footer>
    </div>
  )
}
