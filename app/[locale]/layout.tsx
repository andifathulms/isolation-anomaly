import { notFound } from 'next/navigation'
import { LOCALES, isLocale } from '@/lib/i18n/locales'

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }))
}

export default function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: { locale: string }
}) {
  if (!isLocale(params.locale)) notFound()
  // The root <html lang> is static in a shared layout, so the locale is
  // declared here instead — the Indonesian pages must not claim to be English.
  return (
    <div lang={params.locale} className="manuscript-ground min-h-screen">
      {children}
    </div>
  )
}
