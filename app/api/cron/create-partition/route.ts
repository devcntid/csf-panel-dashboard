import { NextRequest, NextResponse } from 'next/server'
import postgres from 'postgres'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL

/**
 * API Route untuk Cron Job: Membuat Partisi Bulan Selanjutnya
 * 
 * Cron ini akan berjalan setiap tanggal 25 setiap bulan untuk membuat partisi bulan depan
 * Contoh: Tanggal 25 Januari -> buat partisi untuk Maret (karena Februari sudah ada)
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

    // Hitung bulan selanjutnya (2 bulan dari sekarang untuk memastikan partisi sudah ada)
    const now = new Date()
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 1) // Bulan +2
    const monthAfterNext = new Date(now.getFullYear(), now.getMonth() + 3, 1) // Bulan +3
    
    const year = nextMonth.getFullYear()
    const month = nextMonth.getMonth() + 1 // 1-12
    const nextYear = monthAfterNext.getFullYear()
    const nextMonthNum = monthAfterNext.getMonth() + 1

    // Format nama partisi: transactions_y2026m03
    const partitionName = `transactions_y${year}m${String(month).padStart(2, '0')}`
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`
    const endDate = `${nextYear}-${String(nextMonthNum).padStart(2, '0')}-01`

    // Cek apakah partisi sudah ada
    const checkPartition = await sql`
      SELECT EXISTS (
        SELECT 1 
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = ${partitionName}
        AND n.nspname = 'public'
      ) as exists
    `
    
    const exists = Array.isArray(checkPartition) 
      ? (checkPartition[0] as any)?.exists 
      : (checkPartition as any)?.exists

    if (exists) {
      await sql.end()
      return NextResponse.json({
        success: true,
        message: `Partisi ${partitionName} sudah ada`,
        partition: partitionName,
        dateRange: `${startDate} to ${endDate}`
      })
    }

    // Buat partisi baru
    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS ${partitionName} PARTITION OF transactions
      FOR VALUES FROM ('${startDate}') TO ('${endDate}')
    `)

    await sql.end()

    return NextResponse.json({
      success: true,
      message: `Partisi ${partitionName} berhasil dibuat`,
      partition: partitionName,
      dateRange: `${startDate} to ${endDate}`,
      created: true
    })

  } catch (error: any) {
    console.error('Error creating partition:', error)
    await sql.end()
    return NextResponse.json({
      success: false,
      error: error.message || 'Error saat membuat partisi'
    }, { status: 500 })
  }
}

// POST method untuk manual trigger (optional)
export async function POST(request: NextRequest) {
  return GET(request)
}
