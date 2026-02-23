import { NextResponse } from 'next/server'
import { getZainsApiConfig } from '@/lib/services/zains-sync'

/**
 * GET: Cek URL Zains yang aktif (production vs staging).
 * Dipakai untuk verifikasi di production bahwa request ke Zains benar-benar ke URL production.
 * Hanya mengembalikan mode dan hostname (bukan full URL/secret).
 */
export async function GET() {
  try {
    const config = getZainsApiConfig()
    return NextResponse.json({
      isProduction: config.isProduction,
      mode: config.mode,
      urlHost: config.urlHost,
      urlConfigured: !!config.url,
    })
  } catch (error: any) {
    console.error('Error reading zains API env:', error)
    return NextResponse.json(
      { error: error?.message || 'Gagal baca konfigurasi Zains API' },
      { status: 500 },
    )
  }
}
