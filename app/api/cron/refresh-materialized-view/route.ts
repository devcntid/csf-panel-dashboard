import { NextRequest, NextResponse } from 'next/server'
import postgres from 'postgres'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL

/**
 * API Route untuk Cron Job: Refresh Materialized View
 * 
 * Cron ini akan berjalan setiap hari (misalnya jam 2 pagi) untuk refresh materialized view
 * sehingga dashboard query tetap cepat dengan data terbaru
 * 
 * Vercel Cron akan memanggil endpoint ini secara otomatis
 */
export async function GET(request: NextRequest) {
  if (!databaseUrl) {
    return NextResponse.json({ error: 'Database connection not available' }, { status: 500 })
  }

  const sql = postgres(databaseUrl)

  try {
    // Verifikasi bahwa request berasal dari Vercel Cron (opsional, untuk security)
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      await sql.end()
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Refresh materialized view secara concurrent (tidak lock table)
    // Catatan: CONCURRENTLY memerlukan unique index, pastikan index sudah ada
    await sql`REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_revenue_summary`

    await sql.end()

    return NextResponse.json({
      success: true,
      message: 'Materialized view berhasil di-refresh',
      timestamp: new Date().toISOString()
    })

  } catch (error: any) {
    console.error('Error refreshing materialized view:', error)
    await sql.end()
    return NextResponse.json({
      success: false,
      error: error.message || 'Error saat refresh materialized view'
    }, { status: 500 })
  }
}

// POST method untuk manual trigger (optional)
export async function POST(request: NextRequest) {
  return GET(request)
}
