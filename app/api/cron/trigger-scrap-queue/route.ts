import { NextRequest, NextResponse } from 'next/server'

/**
 * Vercel Cron: Trigger Scrap Queue Worker
 * 
 * Cron ini akan trigger Railway service untuk menjalankan scrap queue worker
 * Schedule: */30 1-14 * * 1-6 (setiap 30 menit, 01:00-14:00 UTC = 08:00-21:00 WIB, Senin-Sabtu)
 * 
 * Vercel Cron akan memanggil endpoint ini secara otomatis
 */
export async function GET(request: NextRequest) {
  try {
    const railwayServiceUrl = process.env.RAILWAY_SERVICE_URL

    if (!railwayServiceUrl) {
      console.warn('[cron:trigger-scrap-queue] RAILWAY_SERVICE_URL tidak ditemukan')
      return NextResponse.json({
        success: false,
        message: 'RAILWAY_SERVICE_URL tidak ditemukan di environment variables',
      })
    }

    // Trigger Railway service untuk run scrap queue
    const triggerUrl = `${railwayServiceUrl}/trigger`
    
    const response = await fetch(triggerUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        isCron: true, // Flag untuk bedakan cron vs manual
      }),
      // Timeout 10 detik (tidak perlu tunggu job selesai)
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[cron:trigger-scrap-queue] Railway trigger failed:', response.status, errorText)
      return NextResponse.json(
        {
          success: false,
          message: 'Gagal trigger Railway service',
          error: `Railway returned ${response.status}: ${errorText}`,
        },
        { status: 500 }
      )
    }

    const result = await response.json()
    console.log('[cron:trigger-scrap-queue] Railway service triggered:', result)

    return NextResponse.json({
      success: true,
      message: 'Railway scrap queue worker triggered successfully',
      timestamp: new Date().toISOString(),
      railwayResponse: result,
    })
  } catch (error: any) {
    console.error('[cron:trigger-scrap-queue] Error:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Gagal trigger Railway service',
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
