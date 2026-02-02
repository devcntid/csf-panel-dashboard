import { sql } from '@/lib/db'

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

async function enqueueTodayScrapQueue() {
  const today = getTodayJakarta()

  console.log(`Enqueue scrap_queue untuk tanggal ${today} (WIB)`)

  try {
    // Skip jika hari ini adalah hari libur / cuti bersama
    const [holidayCheck] = (await sql`
      SELECT EXISTS (
        SELECT 1
        FROM public_holidays
        WHERE holiday_date = ${today}::date
      ) AS "is_holiday"
    `) as Array<{ is_holiday: boolean }>

    if (holidayCheck?.is_holiday) {
      console.log('⏭️  Hari ini terdaftar sebagai hari libur/cuti bersama, enqueue scrap_queue di-skip')
      return
    }

    // Insert satu item queue per klinik aktif untuk hari ini,
    // hindari duplikasi jika sudah ada pending/processing untuk tanggal yang sama.
    await sql`
      INSERT INTO scrap_queue (clinic_id, tgl_awal, tgl_akhir, status, requested_by)
      SELECT
        c.id,
        ${today}::date AS tgl_awal,
        ${today}::date AS tgl_akhir,
        'pending'::varchar AS status,
        'cron'::varchar AS requested_by
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
    `

    console.log('✅ Enqueue scrap_queue untuk hari ini selesai')
  } catch (error) {
    console.error('❌ Error saat enqueue scrap_queue:', error)
    throw error
  }
}

enqueueTodayScrapQueue()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })

