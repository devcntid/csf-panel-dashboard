'use server'

import { sql } from '@/lib/db'

export type DashboardFilters = {
  dateFrom: string
  dateTo: string
  clinicId?: number
}

export type DashboardData = {
  totalRevenue: number
  totalPatients: number
  previousPeriodRevenue: number
  previousPeriodPatients: number
  revenueChangePercent: number
  patientsChangePercent: number
  targetRevenue: number
  actualRevenue: number
  targetPercent: number
  gapRevenue: number
  revenueByDate: { day: number; bulanIni: number; bulanLalu: number }[]
  revenueTrendLabels: { bulanIniLabel: string; bulanLaluLabel: string }
  revenueByClinic: { clinicName: string; revenue: number }[]
  patientComposition: { label: string; count: number; percent: number }[]
  polyComposition: { label: string; count: number; percent: number }[]
}

function getYearToDateRange(): { dateFrom: string; dateTo: string } {
  const now = new Date()
  const year = now.getFullYear()
  const dateFrom = `${year}-01-01`
  const dateTo = now.toISOString().split('T')[0]
  return { dateFrom, dateTo }
}

function getMonthRanges(): {
  bulanIniStart: string
  bulanIniEnd: string
  bulanLaluStart: string
  bulanLaluEnd: string
  bulanIniYear: number
  bulanIniMonth: number
  bulanLaluYear: number
  bulanLaluMonth: number
} {
  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()

  const bulanIniStart = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`
  const lastDayIni = new Date(currentYear, currentMonth, 0) // JS Date: month 0-idx, day 0 = last day of prev month
  const bulanIniEnd = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(lastDayIni.getDate()).padStart(2, '0')}`

  const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1
  const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear
  const bulanLaluStart = `${prevYear}-${String(prevMonth).padStart(2, '0')}-01`
  const lastDayLalu = new Date(prevYear, prevMonth, 0)
  const bulanLaluEnd = `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(lastDayLalu.getDate()).padStart(2, '0')}`

  return {
    bulanIniStart,
    bulanIniEnd,
    bulanLaluStart,
    bulanLaluEnd,
    bulanIniYear: currentYear,
    bulanIniMonth: currentMonth,
    bulanLaluYear: prevYear,
    bulanLaluMonth: prevMonth,
  }
}

export async function getDashboardData(
  filters?: Partial<DashboardFilters>
): Promise<DashboardData> {
  const { dateFrom, dateTo } = filters?.dateFrom && filters?.dateTo
    ? { dateFrom: filters.dateFrom, dateTo: filters.dateTo }
    : getYearToDateRange()

  const clinicId = filters?.clinicId ?? null

  try {
    // 1. Total pendapatan & pasien periode saat ini
    const [revenueResult] = await sql`
      SELECT 
        COALESCE(SUM(t.paid_total), 0)::numeric as total_revenue,
        COUNT(DISTINCT t.id)::int as total_patients
      FROM transactions t
      WHERE t.trx_date >= ${dateFrom} AND t.trx_date <= ${dateTo}
        AND (${clinicId}::bigint IS NULL OR t.clinic_id = ${clinicId})
    `

    const totalRevenue = Number((revenueResult as any)?.total_revenue || 0)
    const totalPatients = Number((revenueResult as any)?.total_patients || 0)

    // 2. Periode sebelumnya (untuk perbandingan) - periode dengan durasi sama
    const fromDate = new Date(dateFrom)
    const toDate = new Date(dateTo)
    const daysDiff = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24))
    const prevToDate = new Date(fromDate)
    prevToDate.setDate(prevToDate.getDate() - 1)
    const prevFromDate = new Date(prevToDate)
    prevFromDate.setDate(prevFromDate.getDate() - daysDiff)

    const prevDateFrom = prevFromDate.toISOString().split('T')[0]
    const prevDateTo = prevToDate.toISOString().split('T')[0]

    const [prevRevenueResult] = await sql`
      SELECT 
        COALESCE(SUM(t.paid_total), 0)::numeric as total_revenue,
        COUNT(DISTINCT t.id)::int as total_patients
      FROM transactions t
      WHERE t.trx_date >= ${prevDateFrom} AND t.trx_date <= ${prevDateTo}
        AND (${clinicId}::bigint IS NULL OR t.clinic_id = ${clinicId})
    `

    const previousPeriodRevenue = Number((prevRevenueResult as any)?.total_revenue || 0)
    const previousPeriodPatients = Number((prevRevenueResult as any)?.total_patients || 0)

    const revenueChangePercent = previousPeriodRevenue > 0
      ? ((totalRevenue - previousPeriodRevenue) / previousPeriodRevenue) * 100
      : 0
    const patientsChangePercent = previousPeriodPatients > 0
      ? ((totalPatients - previousPeriodPatients) / previousPeriodPatients) * 100
      : 0

    // 3. Target: SUM(target_revenue) FROM clinic_daily_targets WHERE source_id = 1 AND target_year = tahun ini (full year)
    const year = new Date().getFullYear()

    const [targetRows] = await sql`
      SELECT COALESCE(SUM(cdt.target_revenue), 0)::numeric as total_target
      FROM clinic_daily_targets cdt
      WHERE cdt.source_id = 1
        AND cdt.target_year = ${year}
        AND (${clinicId}::bigint IS NULL OR cdt.clinic_id = ${clinicId})
    `

    const targetRevenue = Number((targetRows as any)?.total_target || 0)

    const actualRevenue = totalRevenue
    const targetPercent = targetRevenue > 0 ? (actualRevenue / targetRevenue) * 100 : 0
    const gapRevenue = targetRevenue - actualRevenue

    // 4. Tren pendapatan per tanggal - Bulan Ini vs Bulan Lalu
    // Sumbu X: tanggal 1-31, setiap titik = day of month (bandingkan tgl 1 bulan ini vs tgl 1 bulan lalu)
    const {
      bulanIniStart,
      bulanIniEnd,
      bulanLaluStart,
      bulanLaluEnd,
      bulanIniYear,
      bulanIniMonth,
      bulanLaluYear,
      bulanLaluMonth,
    } = getMonthRanges()

    // Tren Pendapatan Per Tanggal: Hanya terpengaruh filter klinik. Waktu tetap bulan ini & bulan lalu tahun ini.
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
    const bulanIniLabel = `${monthNames[bulanIniMonth - 1]} ${bulanIniYear}`
    const bulanLaluLabel = `${monthNames[bulanLaluMonth - 1]} ${bulanLaluYear}`

    const [bulanIniRows, bulanLaluRows] = await Promise.all([
      sql`
        SELECT trx_date as date, SUM(paid_total)::numeric as revenue
        FROM transactions
        WHERE trx_date >= ${bulanIniStart} AND trx_date <= ${bulanIniEnd}
          AND (${clinicId}::bigint IS NULL OR clinic_id = ${clinicId})
        GROUP BY trx_date
        ORDER BY trx_date
      `,
      sql`
        SELECT trx_date as date, SUM(paid_total)::numeric as revenue
        FROM transactions
        WHERE trx_date >= ${bulanLaluStart} AND trx_date <= ${bulanLaluEnd}
          AND (${clinicId}::bigint IS NULL OR clinic_id = ${clinicId})
        GROUP BY trx_date
        ORDER BY trx_date
      `,
    ])

    // Normalisasi date ke YYYY-MM-DD (hindari timezone/format yang salah)
    const toDateKey = (d: any): string => {
      if (!d) return ''
      const s = typeof d === 'string' ? d : d?.toISOString?.()?.split('T')[0] || String(d)
      return s.substring(0, 10)
    }

    const biMap = new Map<string, number>()
    ;(bulanIniRows as any[]).forEach((r: any) => {
      const key = toDateKey(r.date)
      if (key) biMap.set(key, Number(r.revenue || 0))
    })
    const blMap = new Map<string, number>()
    ;(bulanLaluRows as any[]).forEach((r: any) => {
      const key = toDateKey(r.date)
      if (key) blMap.set(key, Number(r.revenue || 0))
    })

    // Sumbu X: 1-31 (hari dalam bulan), bandingkan tgl X bulan ini vs tgl X bulan lalu
    const revenueByDate: { day: number; bulanIni: number; bulanLalu: number }[] = []
    const maxDay = 31
    for (let day = 1; day <= maxDay; day++) {
      const dayStr = String(day).padStart(2, '0')
      const bulanIniKey = `${bulanIniYear}-${String(bulanIniMonth).padStart(2, '0')}-${dayStr}`
      const bulanLaluKey = `${bulanLaluYear}-${String(bulanLaluMonth).padStart(2, '0')}-${dayStr}`

      // Hanya include jika tanggal valid (Feb 30/31 tidak ada)
      // JS Date month 0-indexed: new Date(y, m, 0) = last day of month (m-1)
      const lastDayIni = new Date(bulanIniYear, bulanIniMonth, 0).getDate()
      const lastDayLalu = new Date(bulanLaluYear, bulanLaluMonth, 0).getDate()
      if (day > lastDayIni && day > lastDayLalu) break

      revenueByDate.push({
        day,
        bulanIni: day <= lastDayIni ? biMap.get(bulanIniKey) ?? 0 : 0,
        bulanLalu: day <= lastDayLalu ? blMap.get(bulanLaluKey) ?? 0 : 0,
      })
    }

    // 5. Performa klinik cabang (by filter utama)
    const clinicRevenueRows = await sql`
      SELECT 
        c.name as clinic_name,
        COALESCE(SUM(t.paid_total), 0)::numeric as revenue
      FROM clinics c
      LEFT JOIN transactions t ON t.clinic_id = c.id 
        AND t.trx_date >= ${dateFrom} AND t.trx_date <= ${dateTo}
      WHERE c.is_active = true
        AND (${clinicId}::bigint IS NULL OR c.id = ${clinicId})
      GROUP BY c.id, c.name
      ORDER BY revenue DESC
    `

    const revenueByClinic = (clinicRevenueRows as any[]).map((r: any) => ({
      clinicName: r.clinic_name || 'Unknown',
      revenue: Number(r.revenue || 0),
    }))

    // 6. Komposisi pasien by insurance (BPJS, Umum, Asuransi)
    const compositionRows = await sql`
      SELECT 
        COALESCE(mit.name, 'Lainnya') as label,
        COUNT(t.id)::int as cnt
      FROM transactions t
      LEFT JOIN master_insurance_types mit ON mit.id = t.insurance_type_id
      WHERE t.trx_date >= ${dateFrom} AND t.trx_date <= ${dateTo}
        AND (${clinicId}::bigint IS NULL OR t.clinic_id = ${clinicId})
      GROUP BY mit.id, mit.name
      ORDER BY cnt DESC
    `

    const totalForComposition = (compositionRows as any[]).reduce(
      (sum: number, r: any) => sum + Number(r.cnt || 0),
      0
    )

    const patientComposition = (compositionRows as any[]).map((r: any) => {
      const count = Number(r.cnt || 0)
      const percent = totalForComposition > 0 ? (count / totalForComposition) * 100 : 0
      let label = r.label || 'Lainnya'
      if (label.toUpperCase().includes('BPJS')) label = 'BPJS'
      else if (label.toUpperCase().includes('UMUM') || label.toUpperCase().includes('PRIBADI')) label = 'Umum'
      else if (label.toUpperCase().includes('ASURANSI') || label.toUpperCase().includes('SWASTA')) label = 'Asuransi'
      else if (label.toUpperCase().includes('SOSIAL') || label.toUpperCase().includes('MITRA')) label = 'Sosial/Mitra'
      return { label, count, percent }
    })

    // 7. Komposisi poli by master_polies
    const polyRows = await sql`
      SELECT 
        COALESCE(mp.name, t.polyclinic, 'Lainnya') as label,
        COUNT(t.id)::int as cnt
      FROM transactions t
      LEFT JOIN master_polies mp ON mp.id = t.poly_id
      WHERE t.trx_date >= ${dateFrom} AND t.trx_date <= ${dateTo}
        AND (${clinicId}::bigint IS NULL OR t.clinic_id = ${clinicId})
      GROUP BY COALESCE(mp.name, t.polyclinic, 'Lainnya')
      ORDER BY cnt DESC
    `

    const totalForPoly = (polyRows as any[]).reduce(
      (sum: number, r: any) => sum + Number(r.cnt || 0),
      0
    )

    const polyComposition = (polyRows as any[]).map((r: any) => {
      const count = Number(r.cnt || 0)
      const percent = totalForPoly > 0 ? (count / totalForPoly) * 100 : 0
      return { label: r.label || 'Lainnya', count, percent }
    })

    return {
      totalRevenue,
      totalPatients,
      previousPeriodRevenue,
      previousPeriodPatients,
      revenueChangePercent,
      patientsChangePercent,
      targetRevenue,
      actualRevenue,
      targetPercent,
      gapRevenue,
      revenueByDate,
      revenueTrendLabels: { bulanIniLabel, bulanLaluLabel },
      revenueByClinic,
      patientComposition,
      polyComposition,
    }
  } catch (error) {
    console.error('Error fetching dashboard data:', error)
    return {
      totalRevenue: 0,
      totalPatients: 0,
      previousPeriodRevenue: 0,
      previousPeriodPatients: 0,
      revenueChangePercent: 0,
      patientsChangePercent: 0,
      targetRevenue: 0,
      actualRevenue: 0,
      targetPercent: 0,
      gapRevenue: 0,
      revenueByDate: [],
      revenueTrendLabels: { bulanIniLabel: '', bulanLaluLabel: '' },
      revenueByClinic: [],
      patientComposition: [],
      polyComposition: [],
    }
  }
}
