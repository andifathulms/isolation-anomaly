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
    'Interleave two transactions by hand, watch the anomaly happen, then switch database engine and isolation level and watch the same schedule behave completely differently.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${prose.variable} ${mono.variable} ${control.variable}`}>
      <body>{children}</body>
    </html>
  )
}
