import type { MetadataRoute } from 'next'
import { LOCALES } from '@/lib/i18n/locales'
import { SITE, SECTIONS } from '@/lib/i18n/metadata'

/**
 * Every page, in every locale, with its translations declared.
 *
 * There was no sitemap and no robots.txt, so the only route into the site for a
 * crawler was the meta-refresh at the root and whatever links it found from
 * there. The alternates matter more than the list does: without them a crawler
 * sees twelve pages rather than six pages in two languages, and picks one of
 * each pair arbitrarily.
 *
 * Generated from the same locale and section lists the pages themselves use, so
 * a new page cannot be added without appearing here.
 */
export const dynamic = 'force-static'

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = [null, ...SECTIONS]
  return LOCALES.flatMap((locale) =>
    paths.map((section) => {
      const path = section === null ? `/${locale}/` : `/${locale}/${section}/`
      return {
        url: `${SITE}${path}`,
        changeFrequency: 'monthly' as const,
        // The overview and the tool are the pages worth landing on.
        priority: section === null ? 1 : section === 'schedule' ? 0.9 : 0.7,
        alternates: {
          languages: Object.fromEntries(
            LOCALES.map((other) => [
              other,
              `${SITE}${section === null ? `/${other}/` : `/${other}/${section}/`}`,
            ]),
          ),
        },
      }
    }),
  )
}
