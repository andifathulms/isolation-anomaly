import type { Metadata, Viewport } from 'next'
import { Faustina, Fira_Code, Work_Sans } from 'next/font/google'
import './globals.css'

/**
 * Next does not apply `basePath` to metadata asset URLs in a static export, so
 * icon and social-card paths carry it themselves. It is empty in development
 * and `/isolation-anomaly` in a production build — see next.config.js.
 *
 * public/manifest.webmanifest sidesteps the same problem differently: every
 * path inside it is relative, so the browser resolves them against the
 * manifest's own URL and it needs no build-time substitution at all.
 */
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? ''
const SITE = 'https://andifathulms.github.io/isolation-anomaly/'

const prose = Faustina({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-prose',
})

const mono = Fira_Code({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-mono',
})

const control = Work_Sans({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-control',
})

const DESCRIPTION =
  'Run two database transactions at the same time and watch them corrupt each other, one step at a time — then change engine or isolation level and watch the same schedule behave completely differently.'

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: {
    default: 'Isolation Anomaly',
    template: '%s · Isolation Anomaly',
  },
  description: DESCRIPTION,
  applicationName: 'Isolation Anomaly',
  manifest: `${BASE}/manifest.webmanifest`,
  icons: {
    // The SVG is the mark itself — two transaction lanes crossed by the dashed
    // anomaly line — so it stays legible at 16px where a photograph would not.
    icon: [
      { url: `${BASE}/favicon.svg`, type: 'image/svg+xml' },
      { url: `${BASE}/favicon-32.png`, sizes: '32x32', type: 'image/png' },
    ],
    apple: [{ url: `${BASE}/apple-touch-icon.png`, sizes: '180x180', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    title: 'Isolation Anomaly',
    statusBarStyle: 'black-translucent',
  },
  openGraph: {
    type: 'website',
    siteName: 'Isolation Anomaly',
    title: 'Isolation Anomaly',
    description: DESCRIPTION,
    url: SITE,
    locale: 'en',
    alternateLocale: 'id',
    // Relative, not `${BASE}/og.png`: social images resolve against
    // metadataBase, whose path already ends in the basePath, so prefixing here
    // too emits .../isolation-anomaly/isolation-anomaly/og.png.
    images: [{ url: 'og.png', width: 1200, height: 630, alt: 'Isolation Anomaly' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Isolation Anomaly',
    description: DESCRIPTION,
    images: ['og.png'],
  },
}

/** Brand ink and paper — the mark's own two neutrals, not the app's tokens. */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#E7E1D4' },
    { media: '(prefers-color-scheme: dark)', color: '#171310' },
  ],
}

/**
 * Resolve the theme before first paint. A static export has no server to read
 * the preference on, so the alternative is a flash of the wrong manuscript.
 * Kept to one statement, inlined, and deliberately dependency-free.
 */
const THEME_SCRIPT = `(function(){try{var s=localStorage.getItem('theme');var d=s==='dark'||(!s&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light'}catch(e){document.documentElement.dataset.theme='light'}})()`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${prose.variable} ${mono.variable} ${control.variable}`} data-theme="light">
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
