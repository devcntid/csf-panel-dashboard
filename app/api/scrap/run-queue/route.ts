import { NextResponse } from 'next/server'

// Endpoint untuk men-trigger proses scrap queue secara manual via Railway
// AMAN untuk Vercel production: tidak menjalankan Playwright di Vercel,
// tapi trigger Railway service yang jalan di Railway infrastructure

export async function POST() {
  try {
    // Cek apakah ada Railway service URL untuk trigger worker
    const railwayServiceUrl = process.env.RAILWAY_SERVICE_URL

    if (!railwayServiceUrl) {
      console.warn(
        '[scrap:queue] RAILWAY_SERVICE_URL tidak ditemukan. ' +
        'Silakan set di Vercel Environment Variables untuk enable manual trigger dari UI.'
      )
      
      // Fallback: return success tapi dengan warning
      // Job tetap ter-enqueue di database, akan diproses oleh cron berikutnya
      return NextResponse.json({
        success: true,
        message: 'Scrap queue akan diproses pada cron berikutnya (30 menit). ' +
                 'Untuk trigger segera, set RAILWAY_SERVICE_URL di Vercel env vars',
        note: 'Job sudah ter-enqueue di database dan akan diproses otomatis oleh Railway cron',
      })
    }

    // Trigger Railway service via HTTP dengan retry logic
    const triggerUrl = `${railwayServiceUrl}/trigger`

    // Retry logic: coba sampai 3 kali dengan delay
    let lastError: any = null
    let success = false

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await fetch(triggerUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            isCron: false, // Manual trigger dari UI
          }),
          // Timeout 10 detik untuk trigger (tidak perlu tunggu job selesai)
          signal: AbortSignal.timeout(10000),
        })

        if (response.ok) {
          const result = await response.json()
          console.log(`[scrap:queue] Railway service triggered successfully (attempt ${attempt}):`, result)
          success = true
          break
        }

        // Jika 429 (rate limit) atau 503 (service unavailable), retry dengan delay
        if (response.status === 429 || response.status === 503 || response.status === 502) {
          const errorText = await response.text()
          console.warn(`[scrap:queue] Railway service unavailable (attempt ${attempt}/3):`, response.status, errorText)
          
          if (attempt < 3) {
            // Exponential backoff: 2s, 4s, 8s
            const delayMs = Math.pow(2, attempt) * 1000
            console.log(`[scrap:queue] Retrying in ${delayMs}ms...`)
            await new Promise(resolve => setTimeout(resolve, delayMs))
            continue
          }
        }

        // Error lain, langsung throw
        const errorText = await response.text()
        lastError = { status: response.status, message: errorText }
        console.error(`[scrap:queue] Railway service error (attempt ${attempt}):`, response.status, errorText)
        break

      } catch (fetchError: any) {
        lastError = fetchError
        console.error(`[scrap:queue] Fetch error (attempt ${attempt}):`, fetchError.message)
        
        if (attempt < 3) {
          const delayMs = Math.pow(2, attempt) * 1000
          await new Promise(resolve => setTimeout(resolve, delayMs))
        }
      }
    }

    if (!success) {
      return NextResponse.json(
        {
          success: false,
          message: 'Gagal trigger Railway service setelah 3 kali percobaan',
          error: lastError?.message || `Railway service returned ${lastError?.status || 'unknown error'}`,
          note: 'Job akan tetap diproses pada cron berikutnya (30 menit) oleh Railway cron',
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Scrap queue worker telah di-trigger via Railway. Proses akan berjalan dalam beberapa detik.',
    })
  } catch (error: any) {
    console.error('[scrap:queue] Error men-trigger worker:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Gagal men-trigger scrap queue worker',
        error: error?.message || 'Unknown error',
      },
      { status: 500 }
    )
  }
}

