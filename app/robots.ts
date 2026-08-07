import type { MetadataRoute } from 'next'
import { SITE } from '@/lib/i18n/metadata'

/**
 * There was no robots.txt at all, which is not fatal — absent means "crawl
 * everything" — but it also meant nothing pointed at the sitemap.
 *
 * Nothing is disallowed. This is a static teaching site with no private routes,
 * and a disallow rule here would only ever be a mistake.
 */
export const dynamic = 'force-static'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/' }],
    sitemap: `${SITE}/sitemap.xml`,
  }
}
