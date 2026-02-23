'use client'

import React, { Suspense } from 'react'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import Image from 'next/image'
import { signIn, useSession } from 'next-auth/react'
import { APP_SETTINGS_KEYS } from '@/lib/app-settings-keys'

type LoginSettings = Partial<Record<string, string>>

function ErrorMessageHandler({ onError }: { onError: (message: string | null) => void }) {
  const searchParams = useSearchParams()
  useEffect(() => {
    const error = searchParams.get('error')
    if (error === 'AccessDenied') {
      onError('Akun Google Anda tidak terdaftar di sistem. Silakan hubungi admin.')
    } else {
      onError(null)
    }
  }, [searchParams])
  return null
}

export function LoginClient({ settings }: { settings: LoginSettings }) {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [loading, setLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const logoUrl = settings?.[APP_SETTINGS_KEYS.LOGO_URL] || '/asset/logo_csf_new.png'
  const companyName = settings?.[APP_SETTINGS_KEYS.COMPANY_NAME] || 'Cita Sehat Foundation'
  const bgImage = settings?.[APP_SETTINGS_KEYS.LOGIN_BG_IMAGE] || 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d'
  const toneBg = settings?.[APP_SETTINGS_KEYS.LOGIN_TONE_BG] || 'linear-gradient(to bottom right, rgba(19,78,74,0.85), rgba(25,58,58,0.75), rgba(30,58,138,0.85))'
  const defaultLoginContent = `<h2>Kelola Klinik dengan Lebih Efisien</h2>
<p>Pantau transaksi, kelola pasien, dan optimalkan operasional klinik dalam satu dashboard yang terpadu.</p>
<ul>
<li><strong>Monitoring Real-time</strong> — Lihat progres transaksi dan aktivitas klinik secara langsung dengan update real-time.</li>
<li><strong>Tim Lebih Terkoordinasi</strong> — Berikan akses terkontrol untuk operator dan tim lapangan dengan manajemen peran yang fleksibel.</li>
<li><strong>Laporan Siap Pakai</strong> — Unduh laporan transaksi dan kehadiran pasien untuk evaluasi dan analisis operasional klinik.</li>
</ul>`
  const loginContent = settings?.[APP_SETTINGS_KEYS.LOGIN_CONTENT] ?? defaultLoginContent

  useEffect(() => {
    if (status === 'authenticated') router.push('/dashboard')
  }, [status, router])

  const handleGoogleLogin = async () => {
    try {
      setLoading(true)
      setErrorMessage(null)
      await signIn('google', { callbackUrl: '/dashboard' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 lg:p-8 relative overflow-hidden">
      <Suspense fallback={null}>
        <ErrorMessageHandler onError={setErrorMessage} />
      </Suspense>

      <div className="absolute inset-0 z-0">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat scale-105"
          style={{ backgroundImage: `url('${bgImage}')`, backgroundAttachment: 'fixed' }}
        />
        <div className="absolute inset-0" style={{ background: toneBg }} />
        <div className="absolute inset-0 backdrop-blur-md md:backdrop-blur-sm" />
      </div>

      <div className="relative z-10 w-full max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          <div className="w-full flex justify-center lg:justify-start">
            <div className="w-full max-w-md">
              <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 md:p-10 space-y-5 sm:space-y-6 md:space-y-8 border border-white/20">
                <div className="flex justify-center">
                  <div className="relative w-48 h-16 md:w-56 md:h-20">
                    <Image
                      src={logoUrl}
                      alt="Logo"
                      fill
                      className="object-contain"
                      priority
                      onError={(e) => {
                        const target = e.target as HTMLImageElement
                        target.src = '/icon.svg'
                      }}
                    />
                  </div>
                </div>
                <div className="text-center space-y-2">
                  <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Executive Dashboard</h1>
                  <p className="text-xs md:text-sm text-slate-500">
                    Gunakan akun Google yang telah terdaftar untuk mengakses dashboard admin.
                  </p>
                </div>
                {errorMessage && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 md:p-4">
                    <div className="flex items-start gap-2">
                      <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-xs md:text-sm text-red-700 font-medium">{errorMessage}</p>
                    </div>
                  </div>
                )}
                <Button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="w-full h-12 md:h-14 bg-white hover:bg-slate-50 text-slate-900 border-2 border-slate-200 hover:border-slate-300 rounded-xl font-semibold text-sm md:text-base shadow-sm transition-all duration-200 flex items-center justify-center gap-3"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-5 w-5 text-slate-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Memproses...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 md:w-6 md:h-6" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                      </svg>
                      <span>Masuk dengan Google</span>
                    </>
                  )}
                </Button>
                <p className="text-xs text-center text-slate-500 leading-relaxed px-4">
                  Dengan masuk, Anda menyetujui{' '}
                  <a href="#" className="text-teal-600 hover:text-teal-700 font-medium underline underline-offset-2">Syarat & Ketentuan</a>
                  {' '}dan{' '}
                  <a href="#" className="text-teal-600 hover:text-teal-700 font-medium underline underline-offset-2">Kebijakan Privasi</a>.
                </p>
              </div>
              <p className="text-center text-white/90 text-sm mt-6 lg:hidden">
                © 2026 {companyName}. All rights reserved.
              </p>
            </div>
          </div>

          <div
            className="hidden lg:block text-white text-lg xl:text-xl leading-relaxed space-y-4 prose prose-invert prose-headings:text-white prose-p:text-white/90 prose-li:text-white/90 max-w-none [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-0.5 [&_ul]:marker:text-white [&_ol]:marker:text-white"
            dangerouslySetInnerHTML={{ __html: loginContent }}
          />
        </div>
        <p className="hidden lg:block text-center text-white/90 text-sm mt-8">
          © 2026 {companyName}. All rights reserved.
        </p>
      </div>
    </div>
  )
}
