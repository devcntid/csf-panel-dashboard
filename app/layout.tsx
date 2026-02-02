import React from "react"
import type { Metadata } from 'next'
import { Source_Sans_3 } from 'next/font/google'
import { Analytics } from '@vercel/analytics/next'
import { Toaster } from 'sonner'
import './globals.css'
import { AppSessionProvider } from '@/components/session-provider'

const sourceSansPro = Source_Sans_3({ 
  subsets: ["latin"],
  display: 'swap'
});

export const metadata: Metadata = {
  title: 'Cita Sehat - Dashboard',
  description: 'Executive Dashboard untuk Yayasan Cita Sehat - Sistem Monitoring Klinik',
  generator: 'v0.app',
  icons: {
    icon: [
      { url: '/favicon.png', sizes: 'any', type: 'image/png' },
    ],
    shortcut: '/favicon.png',
    apple: '/favicon.png',
  },
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
