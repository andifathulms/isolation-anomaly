import type { Metadata } from 'next'
import { dictionary } from './dictionaries'
import { LOCALES, type Locale } from './locales'

/**
 * Page metadata, derived from the dictionary the page itself renders.
 *
 * Every route used to inherit one title and one description from the root
 * layout, so all twelve pages announced themselves as "Isolation Anomaly" with
 * the same sentence, `og:url` pointed at the site root whatever you shared, and
 * the Indonesian pages declared `og:locale: en`. A shared link to the conflict
 * graph previewed as the home page.
 *
 * The title and description here are the page's own heading and lead — the same
 * strings the reader sees — rather than a second copy written by hand. A
 * description that drifts from the page is worse than none, and the only way to
 * guarantee it cannot drift is to have one source.
 */

export const SITE = 'https://andifathulms.github.io/isolation-anomaly'

/** Every page except the overview, which is the locale root. */
export const SECTIONS = ['schedule', 'scenarios', 'matrix', 'graph', 'engines'] as const
export type Section = (typeof SECTIONS)[number]

/** The heading and lead each section renders, by the key they are stored under. */
function copyFor(locale: Locale, section: Section | null): { title: string; description: string } {
  const dict = dictionary(locale)
  if (section === null) return { title: dict.site.title, description: dict.site.standfirst }
  const block = dict[section]
  return { title: block.heading, description: block.lead }
}

function pathFor(locale: Locale, section: Section | null): string {
  return section === null ? `/${locale}/` : `/${locale}/${section}/`
}

export function metadataFor(locale: Locale, section: Section | null): Metadata {
  const { title, description } = copyFor(locale, section)
  const path = pathFor(locale, section)
  const url = `${SITE}${path}`

  return {
    // The root layout's template appends " · Isolation Anomaly"; the overview is
    // the site itself, so it uses the bare name rather than saying it twice.
    title: section === null ? { absolute: title } : title,
    description,
    alternates: {
      canonical: url,
      // Both locales of *this* page, plus the locale-neutral root — so a search
      // engine can offer the right language instead of guessing from the path.
      languages: {
        ...Object.fromEntries(
          LOCALES.map((candidate) => [candidate, `${SITE}${pathFor(candidate, section)}`]),
        ),
        'x-default': `${SITE}${pathFor('en', section)}`,
      },
    },
    openGraph: {
      type: 'website',
      siteName: dictionary(locale).site.title,
      title,
      description,
      url,
      locale,
      alternateLocale: LOCALES.filter((candidate) => candidate !== locale),
      images: [{ url: 'og.png', width: 1200, height: 630, alt: title }],
    },
    twitter: { card: 'summary_large_image', title, description, images: ['og.png'] },
  }
}
