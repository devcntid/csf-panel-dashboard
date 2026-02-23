/**
 * Konfigurasi URL Zains API (production vs staging).
 * File ini tanpa 'use server' agar getZainsApiConfig bisa dipakai sebagai fungsi sync
 * dari API route dan dari lib/services/zains-sync.ts (yang berisi Server Actions).
 */

function isProductionEnv(): boolean {
  const v = process.env.IS_PRODUCTION
  if (v == null || v === '') return false
  const s = String(v).toLowerCase().trim()
  return s === 'true' || s === '1' || s === 'yes'
}

/**
 * Ambil URL dan mode Zains untuk logging/verifikasi (export untuk endpoint cek env).
 */
export function getZainsApiConfig(): {
  url: string
  mode: 'production' | 'staging'
  isProduction: boolean
  urlHost: string
} {
  const explicitUrl = process.env.URL_API_ZAINS?.trim()
  if (explicitUrl) {
    try {
      const u = new URL(explicitUrl)
      return {
        url: explicitUrl,
        mode: 'production',
        isProduction: true,
        urlHost: u.hostname,
      }
    } catch {
      return { url: explicitUrl, mode: 'production', isProduction: true, urlHost: '(invalid url)' }
    }
  }
  const isProduction = isProductionEnv()
  const url = isProduction
    ? (process.env.URL_API_ZAINS_PRODUCTION || '').trim()
    : (process.env.URL_API_ZAINS_STAGING || '').trim()
  let urlHost = ''
  try {
    if (url) urlHost = new URL(url).hostname
  } catch {
    urlHost = '(invalid url)'
  }
  return {
    url,
    mode: isProduction ? 'production' : 'staging',
    isProduction,
    urlHost: urlHost || '(empty)',
  }
}
