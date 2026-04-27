import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export const dynamic = 'force-dynamic'

/** Neon kadang mengembalikan baris non-array; normalisasi ke array. */
function asRowArray<T>(r: unknown): T[] {
  if (Array.isArray(r)) return r as T[]
  if (r && typeof r === 'object' && Array.isArray((r as { rows?: unknown }).rows)) {
    return (r as { rows: T[] }).rows
  }
  return []
}

type Period = 'month' | 'quarter' | 'year'

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

/** YYYY-MM-DD in UTC for calendar boundaries (trx_date is DATE). */
function isoDate(y: number, m0: number, d: number) {
  return `${y}-${pad2(m0 + 1)}-${pad2(d)}`
}

function daysInMonth(y: number, m0: number) {
  return new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate()
}

function rangeForPeriod(period: Period, ref: Date): { tgl_awal: string; tgl_akhir: string } {
  const y = ref.getUTCFullYear()
  const m = ref.getUTCMonth()
  if (period === 'month') {
    const last = daysInMonth(y, m)
    return { tgl_awal: isoDate(y, m, 1), tgl_akhir: isoDate(y, m, last) }
  }
  if (period === 'quarter') {
    const q = Math.floor(m / 3)
    const mStart = q * 3
    const mEnd = mStart + 2
    const last = daysInMonth(y, mEnd)
    return { tgl_awal: isoDate(y, mStart, 1), tgl_akhir: isoDate(y, mEnd, last) }
  }
  return { tgl_awal: isoDate(y, 0, 1), tgl_akhir: isoDate(y, 11, 31) }
}

function previousRange(period: Period, ref: Date): { tgl_awal: string; tgl_akhir: string } {
  const y = ref.getUTCFullYear()
  const m = ref.getUTCMonth()
  if (period === 'month') {
    const pm = m === 0 ? 11 : m - 1
    const py = m === 0 ? y - 1 : y
    const last = daysInMonth(py, pm)
    return { tgl_awal: isoDate(py, pm, 1), tgl_akhir: isoDate(py, pm, last) }
  }
  if (period === 'quarter') {
    const q = Math.floor(m / 3)
    if (q === 0) {
      const py = y - 1
      return { tgl_awal: isoDate(py, 9, 1), tgl_akhir: isoDate(py, 11, 31) }
    }
    const mStart = (q - 1) * 3
    const mEnd = mStart + 2
    const last = daysInMonth(y, mEnd)
    return { tgl_awal: isoDate(y, mStart, 1), tgl_akhir: isoDate(y, mEnd, last) }
  }
  const py = y - 1
  return { tgl_awal: isoDate(py, 0, 1), tgl_akhir: isoDate(py, 11, 31) }
}

function monthLabel(y: number, m0: number) {
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
  return `${names[m0]} ${y}`
}

function parsePeriod(v: string | null): Period {
  if (v === 'quarter' || v === 'year') return v
  return 'month'
}

/**
 * Agregasi dari `transactions` untuk Dashboard Lembaga.
 * Metrik: COUNT(*) = jumlah baris transaksi (bukan kunjungan unik kecuali disebut lain).
 */
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const kpiPeriod = parsePeriod(url.searchParams.get('kpi_period'))
    const summaryPeriod = parsePeriod(url.searchParams.get('summary_period') ?? url.searchParams.get('kpi_period'))
    const chartClinicIdRaw = url.searchParams.get('chart_clinic_id')
    const chartClinicId =
      chartClinicIdRaw && chartClinicIdRaw !== 'all' && chartClinicIdRaw !== ''
        ? Number(chartClinicIdRaw)
        : null
    const chartMonths = Math.min(24, Math.max(1, Number(url.searchParams.get('chart_months')) || 6))

    const ref = new Date()
    const curr = rangeForPeriod(kpiPeriod, ref)
    const prev = previousRange(kpiPeriod, ref)
    const summaryRange = rangeForPeriod(summaryPeriod, ref)

    const buildKpi = async (range: { tgl_awal: string; tgl_akhir: string }) => {
      const rows = (await sql`
        SELECT
          COUNT(*)::int AS transaction_count,
          COALESCE(SUM(t.paid_total), 0)::numeric AS paid_total,
          COUNT(DISTINCT t.patient_id) FILTER (WHERE t.patient_id IS NOT NULL)::int AS distinct_patients
        FROM transactions t
        WHERE t.trx_date >= ${range.tgl_awal}
          AND t.trx_date <= ${range.tgl_akhir}
      `) as any[]
      const r = Array.isArray(rows) ? rows[0] : rows
      return {
        transaction_count: Number(r?.transaction_count ?? 0),
        paid_total: Number(r?.paid_total ?? 0),
        distinct_patients: Number(r?.distinct_patients ?? 0),
      }
    }

    const kpiCurr = await buildKpi(curr)
    const kpiPrev = await buildKpi(prev)

    const topClinicsRows = (await sql`
      SELECT
        c.id AS clinic_id,
        COALESCE(NULLIF(TRIM(c.summary_alias), ''), c.name) AS clinic_name,
        COUNT(*)::int AS cnt
      FROM transactions t
      INNER JOIN clinics c ON c.id = t.clinic_id AND c.is_active = true
      WHERE t.trx_date >= ${curr.tgl_awal}
        AND t.trx_date <= ${curr.tgl_akhir}
      GROUP BY c.id, c.summary_alias, c.name
      ORDER BY cnt DESC
      LIMIT 5
    `) as any[]

    const topPoliRows = (await sql`
      SELECT
        COALESCE(mp.name, NULLIF(TRIM(t.polyclinic), ''), '(Tanpa poli)') AS poly_name,
        COUNT(*)::int AS cnt
      FROM transactions t
      LEFT JOIN master_polies mp ON mp.id = t.poly_id
      WHERE t.trx_date >= ${curr.tgl_awal}
        AND t.trx_date <= ${curr.tgl_akhir}
      GROUP BY 1
      ORDER BY cnt DESC
      LIMIT 5
    `) as any[]

    const summaryRows = (await sql`
      SELECT COALESCE(SUM(t.paid_total), 0)::numeric AS paid_total
      FROM transactions t
      WHERE t.trx_date >= ${summaryRange.tgl_awal}
        AND t.trx_date <= ${summaryRange.tgl_akhir}
    `) as any[]
    const summaryPaid = Number((Array.isArray(summaryRows) ? summaryRows[0] : summaryRows)?.paid_total ?? 0)

    const chartStart = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() - (chartMonths - 1), 1))
    const chartStartStr = isoDate(chartStart.getUTCFullYear(), chartStart.getUTCMonth(), 1)
    const chartEndStr = rangeForPeriod('month', ref).tgl_akhir

    const hasChartClinic =
      chartClinicId != null && Number.isFinite(chartClinicId) && chartClinicId > 0

    const monthlyRowsRaw = hasChartClinic
      ? await sql`
      SELECT
        to_char(date_trunc('month', t.trx_date::timestamp), 'YYYY-MM') AS month_key,
        COUNT(*)::int AS transaction_count,
        COALESCE(SUM(t.paid_total), 0)::numeric AS paid_total
      FROM transactions t
      WHERE t.trx_date >= ${chartStartStr}
        AND t.trx_date <= ${chartEndStr}
        AND t.clinic_id = ${chartClinicId!}
      GROUP BY 1
      ORDER BY month_key ASC
    `
      : await sql`
      SELECT
        to_char(date_trunc('month', t.trx_date::timestamp), 'YYYY-MM') AS month_key,
        COUNT(*)::int AS transaction_count,
        COALESCE(SUM(t.paid_total), 0)::numeric AS paid_total
      FROM transactions t
      WHERE t.trx_date >= ${chartStartStr}
        AND t.trx_date <= ${chartEndStr}
      GROUP BY 1
      ORDER BY month_key ASC
    `
    const monthlyRows = asRowArray<{
      month_key: string
      transaction_count: number
      paid_total: string | number
    }>(monthlyRowsRaw)

    const monthList: { label: string; y: number; m0: number }[] = []
    for (let i = chartMonths - 1; i >= 0; i--) {
      const d = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() - i, 1))
      monthList.push({
        label: monthLabel(d.getUTCFullYear(), d.getUTCMonth()),
        y: d.getUTCFullYear(),
        m0: d.getUTCMonth(),
      })
    }

    const byMonth = new Map<string, { c: number; p: number }>()
    for (const row of monthlyRows) {
      const key = String(row.month_key ?? '')
        .trim()
        .slice(0, 7)
      if (!/^\d{4}-\d{2}$/.test(key)) continue
      byMonth.set(key, {
        c: Number(row.transaction_count ?? 0),
        p: Number(row.paid_total ?? 0),
      })
    }

    const chartLabels: string[] = []
    const chartTransactionCounts: number[] = []
    const chartPaidMillions: number[] = []
    for (const { label, y, m0 } of monthList) {
      const key = `${y}-${pad2(m0 + 1)}`
      const v = byMonth.get(key) ?? { c: 0, p: 0 }
      chartLabels.push(label)
      chartTransactionCounts.push(v.c)
      chartPaidMillions.push(Math.round((v.p / 1_000_000) * 100) / 100)
    }

    const recentRows = (await sql`
      SELECT
        t.id,
        t.trx_date,
        t.trx_no,
        COALESCE(NULLIF(TRIM(c.summary_alias), ''), c.name) AS clinic_name,
        t.patient_name,
        t.paid_total
      FROM transactions t
      INNER JOIN clinics c ON c.id = t.clinic_id
      ORDER BY t.created_at DESC NULLS LAST, t.id DESC
      LIMIT 10
    `) as any[]

    const clinicsForFilter = (await sql`
      SELECT id, COALESCE(NULLIF(TRIM(summary_alias), ''), name) AS name
      FROM clinics
      WHERE is_active = true
      ORDER BY COALESCE(summary_order, 9999), name
    `) as any[]

    const pct = (currVal: number, prevVal: number) => {
      if (!Number.isFinite(prevVal) || prevVal === 0) return null
      return Math.round(((currVal - prevVal) / prevVal) * 1000) / 10
    }

    return NextResponse.json({
      success: true,
      kpi_period: kpiPeriod,
      summary_period: summaryPeriod,
      ranges: {
        kpi: curr,
        kpi_prev: prev,
        summary: summaryRange,
        chart: { tgl_awal: chartStartStr, tgl_akhir: chartEndStr },
      },
      kpis: {
        transaction_count: kpiCurr.transaction_count,
        transaction_count_delta_pct: pct(kpiCurr.transaction_count, kpiPrev.transaction_count),
        paid_total: kpiCurr.paid_total,
        paid_total_delta_pct: pct(kpiCurr.paid_total, kpiPrev.paid_total),
        distinct_patients: kpiCurr.distinct_patients,
        distinct_patients_delta_pct: pct(kpiCurr.distinct_patients, kpiPrev.distinct_patients),
      },
      top_clinics: (Array.isArray(topClinicsRows) ? topClinicsRows : []).map((r: any) => ({
        clinic_id: Number(r.clinic_id),
        name: String(r.clinic_name ?? ''),
        count: Number(r.cnt ?? 0),
      })),
      top_polies: (Array.isArray(topPoliRows) ? topPoliRows : []).map((r: any) => ({
        name: String(r.poly_name ?? ''),
        count: Number(r.cnt ?? 0),
      })),
      chart: {
        labels: chartLabels,
        transaction_counts: chartTransactionCounts,
        paid_totals_millions: chartPaidMillions,
      },
      ringkasan_pendapatan_klinik: summaryPaid,
      recent_transactions: (Array.isArray(recentRows) ? recentRows : []).map((r: any) => ({
        id: String(r.id),
        trx_date: r.trx_date ? String(r.trx_date).slice(0, 10) : '',
        trx_no: r.trx_no != null ? String(r.trx_no) : '',
        clinic_name: String(r.clinic_name ?? ''),
        patient_name: r.patient_name != null ? String(r.patient_name) : '',
        paid_total: Number(r.paid_total ?? 0),
      })),
      clinics_filter: (Array.isArray(clinicsForFilter) ? clinicsForFilter : []).map((r: any) => ({
        id: Number(r.id),
        name: String(r.name ?? ''),
      })),
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gagal memuat statistik yayasan'
    console.error('yayasan-stats:', error)
    return NextResponse.json({ success: false, message }, { status: 500 })
  }
}
