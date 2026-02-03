import { NextRequest, NextResponse } from 'next/server'

/**
 * Vercel Cron: Wake Railway Service
 * 
 * Cron ini akan wake Railway service 5 menit sebelum scraping dimulai
 * Schedule: 55 7-20 * * 1-6 (07:55-20:55 WIB, Senin-Sabtu, setiap 30 menit)
 * 
 * Vercel Cron akan memanggil endpoint ini secara otomatis
 */
export async function GET(request: NextRequest) {
  try {
    const railwayServiceUrl = process.env.RAILWAY_SERVICE_URL

    if (!railwayServiceUrl) {
      console.warn('[cron:wake-railway] RAILWAY_SERVICE_URL tidak ditemukan')
      return NextResponse.json({
        success: false,
        message: 'RAILWAY_SERVICE_URL tidak ditemukan di environment variables',
      })
    }

    // Wake Railway service
    const wakeUrl = `${railwayServiceUrl}/wake`
    
    const response = await fetch(wakeUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Timeout 10 detik
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[cron:wake-railway] Railway wake failed:', response.status, errorText)
      return NextResponse.json(
        {
          success: false,
          message: 'Gagal wake Railway service',
          error: `Railway returned ${response.status}: ${errorText}`,
        },
        { status: 500 }
      )
    }

    const result = await response.json()
    console.log('[cron:wake-railway] Railway service woken up:', result)

    return NextResponse.json({
      success: true,
      message: 'Railway service woken up successfully',
      timestamp: new Date().toISOString(),
      railwayResponse: result,
    })
  } catch (error: any) {
    console.error('[cron:wake-railway] Error:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Gagal wake Railway service',
        error: error?.message || 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// POST method untuk manual trigger (optional)
export async function POST(request: NextRequest) {
  return GET(request)
}
