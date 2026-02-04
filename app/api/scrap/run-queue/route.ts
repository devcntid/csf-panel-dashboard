import { NextResponse } from 'next/server'
import { sql } from '@/lib/db'

// Endpoint untuk enqueue scrap queue job secara manual
// AMAN untuk Vercel production: tidak menjalankan Playwright di Vercel,
// hanya menambahkan job ke queue database
// Worker scraping harus dijalankan secara manual di Mac lokal atau via cron

function getTodayJakarta(): string {
  const now = new Date()
  // Format yyyy-mm-dd di timezone Asia/Jakarta
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return formatter.format(now) // en-CA => YYYY-MM-DD
}

export async function POST() {
  try {
    const today = getTodayJakarta()
    console.log(`[scrap:queue] Enqueueing jobs untuk tanggal ${today} (WIB)...`)

    // Skip jika hari ini adalah hari libur / cuti bersama
    const [holidayCheck] = (await sql`
      SELECT EXISTS (
        SELECT 1
        FROM public_holidays
        WHERE holiday_date = ${today}::date
      ) AS "is_holiday"
    `) as Array<{ is_holiday: boolean }>

    if (holidayCheck?.is_holiday) {
      console.log('[scrap:queue] ⏭️  Hari ini terdaftar sebagai hari libur/cuti bersama, enqueue di-skip')
      return NextResponse.json({
        success: true,
        message: 'Hari ini adalah hari libur/cuti bersama. Enqueue di-skip.',
        skipped: true,
        note: 'Jalankan `pnpm scrap:github:queue` di Mac lokal untuk memproses queue yang sudah ada.',
      })
    }

    // Insert satu item queue per klinik aktif untuk hari ini,
    // hindari duplikasi jika sudah ada pending/processing untuk tanggal yang sama.
    const result = await sql`
      INSERT INTO scrap_queue (clinic_id, tgl_awal, tgl_akhir, status, requested_by)
      SELECT
        c.id,
        ${today}::date AS tgl_awal,
        ${today}::date AS tgl_akhir,
        'pending'::varchar AS status,
        'manual'::varchar AS requested_by
      FROM clinics c
      WHERE c.is_active = true
        AND NOT EXISTS (
          SELECT 1
          FROM scrap_queue q
          WHERE q.clinic_id = c.id
            AND q.tgl_awal = ${today}::date
            AND q.tgl_akhir = ${today}::date
            AND q.status IN ('pending', 'processing')
        )
      RETURNING id
    `

    const enqueuedCount = result.length || 0
    console.log(`[scrap:queue] ✅ Enqueue completed. ${enqueuedCount} jobs ditambahkan ke queue.`)

    return NextResponse.json({
      success: true,
      message: `Scrap queue jobs telah di-enqueue (${enqueuedCount} jobs). ` +
               'Jalankan `pnpm scrap:github:queue` di Mac lokal untuk memproses queue.',
      enqueued_count: enqueuedCount,
      note: 'Worker scraping harus dijalankan secara manual di Mac atau via cron job lokal',
    })
  } catch (error: any) {
    console.error('[scrap:queue] Error enqueueing jobs:', error)
    return NextResponse.json(
      {
        success: false,
        message: 'Gagal enqueue scrap queue jobs',
        error: error?.message || 'Unknown error',
      },
      { status: 500 }
    )
  }
}

