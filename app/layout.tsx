import React from 'react'
import type { Metadata } from 'next'
import { Source_Sans_3 } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from 'sonner'
import './globals.css'
import { AppSessionProvider } from '@/components/session-provider'
import { getAllAppSettings } from '@/lib/settings'

const sourceSansPro = Source_Sans_3({
  subsets: ['latin'],
  display: 'swap',
})

export async function generateMetadata(): Promise<Metadata> {
  try {
    const s = await getAllAppSettings()
    const title = (s.app_title ?? '').trim() || 'Cita Sehat - Dashboard'
    const faviconUrl = (s.app_favicon_url ?? '').trim() || '/favicon.png'
    return {
      title,
      description: 'Executive Dashboard untuk Yayasan Cita Sehat - Sistem Monitoring Klinik',
      generator: 'v0.app',
      icons: {
        icon: [{ url: faviconUrl, sizes: 'any' }],
        shortcut: faviconUrl,
        apple: faviconUrl,
      },
    }
  } catch {
    return {
      title: 'Cita Sehat - Dashboard',
      description: 'Executive Dashboard untuk Yayasan Cita Sehat - Sistem Monitoring Klinik',
      icons: {
        icon: [{ url: '/favicon.png', sizes: 'any' }],
        shortcut: '/favicon.png',
        apple: '/favicon.png',
      },
    }
  }
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="id">
      <body className={`${sourceSansPro.className} font-sans antialiased`} suppressHydrationWarning>
        <AppSessionProvider>
          {children}
          <Toaster position="top-right" />
          <Analytics />
        </AppSessionProvider>
      </body>
    </html>
  )
}
