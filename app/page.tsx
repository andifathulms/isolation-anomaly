import Link from 'next/link'
import { DEFAULT_LOCALE } from '@/lib/i18n/locales'

/**
 * A static export cannot serve an HTTP redirect, so the locale root is reached
 * with a meta refresh plus a visible link for anyone the refresh does not carry.
 */
export default function RootPage() {
  const target = `/${DEFAULT_LOCALE}/`

  return (
    <>
      <meta httpEquiv="refresh" content={`0; url=.${target}`} />
      <main className="mx-auto max-w-prose px-6 py-24">
        <p className="text-ink-muted">
          Redirecting to{' '}
          <Link href={target} className="text-voiceA underline">
            Isolation Anomaly
          </Link>
          .
        </p>
      </main>
    </>
  )
}
