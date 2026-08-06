import type { Metadata } from 'next'
import { Faustina, Fira_Code, Work_Sans } from 'next/font/google'
import './globals.css'

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

export const metadata: Metadata = {
  title: 'Isolation Anomaly',
  description:
    'Run two database transactions at the same time and watch them corrupt each other, one step at a time — then change engine or isolation level and watch the same schedule behave completely differently.',
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
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
