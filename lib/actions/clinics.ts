'use server'

import { sql } from '@/lib/db'
import { cache } from 'react'

// Cache untuk performa maksimal
export const getClinics = cache(async () => {
  try {
    const clinics = await sql`
      SELECT 
        c.*,
        COUNT(DISTINCT p.id) as total_patients,
        COUNT(DISTINCT t.id) as total_transactions,
        COALESCE(SUM(CASE WHEN t.trx_date = CURRENT_DATE THEN t.bill_total ELSE 0 END), 0) as revenue_today,
        COALESCE(SUM(CASE WHEN t.trx_date = CURRENT_DATE THEN t.bill_total ELSE 0 END), 0) as revenue_target,
        MAX(t.trx_date) as last_transaction_date
      FROM clinics c
      LEFT JOIN patients p ON p.clinic_id = c.id
      LEFT JOIN transactions t ON t.clinic_id = c.id
      WHERE c.is_active = true
      GROUP BY c.id
      ORDER BY c.name
    `
    return clinics
  } catch (error) {
    console.error('Error fetching clinics:', error)
    return []
  }
})

export const getClinicById = cache(async (id: string | number) => {
  try {
    const clinicId = typeof id === 'string' ? parseInt(id) : id
    const [clinic] = await sql`
      SELECT 
        c.*,
        COUNT(DISTINCT p.id) as total_patients,
        COUNT(DISTINCT t.id) as total_transactions,
        COALESCE(SUM(CASE WHEN t.trx_date = CURRENT_DATE THEN t.bill_total ELSE 0 END), 0) as revenue_today,
        COALESCE(AVG(t.bill_total), 0) as avg_transaction
      FROM clinics c
      LEFT JOIN patients p ON p.clinic_id = c.id
      LEFT JOIN transactions t ON t.clinic_id = c.id
      WHERE c.id = ${clinicId}
      GROUP BY c.id
    `
    return clinic || null
  } catch (error) {
    console.error('Error fetching clinic:', error)
    return null
  }
})

export const getClinicStats = cache(async (clinicId: number) => {
  try {
    const today = new Date().toISOString().split('T')[0]
    
    const [stats] = await sql`
      SELECT 
        COUNT(DISTINCT t.id) as transactions_today,
        COALESCE(SUM(t.paid_total), 0) as revenue_today,
        COUNT(DISTINCT t.erm_no) as unique_patients_today,
        COALESCE(AVG(t.paid_total), 0) as avg_transaction
      FROM transactions t
      WHERE t.clinic_id = ${clinicId} AND t.trx_date = ${today}
    `
    
    return stats || {
      transactions_today: 0,
      revenue_today: 0,
      unique_patients_today: 0,
      avg_transaction: 0,
    }
  } catch (error) {
    console.error('Error fetching clinic stats:', error)
    return {
      transactions_today: 0,
      revenue_today: 0,
      unique_patients_today: 0,
      avg_transaction: 0,
    }
  }
})

/** Data lengkap untuk dashboard detail klinik (id = clinic id dari database) */
export type ClinicDashboardData = {
  clinic: { id: number; name: string; location: string | null } | null
  revenueInPeriod: number
  revenueTarget: number
  revenueYtd: number
  totalTransactionsInPeriod: number
  /** Target kunjungan (visit) tahunan klinik ini */
  visitsTarget: number
  avgTransaction: number
  targetRealization: number
  /** Pendapatan per poli + target untuk progress */
  poliData: { name: string; revenue: number; percentage: number; targetRevenue: number; progressPercent: number }[]
  /** Kunjungan (jumlah transaksi) per poli untuk pie chart */
  visitsPerPoli: { name: string; count: number; percent: number; targetVisits: number; progressPercent: number }[]
  /** Kunjungan (jumlah transaksi) per insurance type untuk pie chart */
  visitsPerInsurance: { name: string; count: number; percent: number }[]
  monthlyRevenue: number[]
  /** Jumlah kunjungan (transaksi) per bulan [Jan..Des] sesuai filter */
  monthlyVisits: number[]
}

function getYearToDateRange(): { dateFrom: string; dateTo: string } {
  const now = new Date()
  const year = now.getFullYear()
  const dateFrom = `${year}-01-01`
  const dateTo = now.toISOString().split('T')[0]
  return { dateFrom, dateTo }
}

export const getClinicDashboardData = cache(async (
  clinicId: number,
  options?: { dateFrom?: string; dateTo?: string }
): Promise<ClinicDashboardData> => {
  const { dateFrom: optFrom, dateTo: optTo } = options ?? {}
  const { dateFrom: ytdFrom, dateTo: ytdTo } = getYearToDateRange()
  const dateFrom = (optFrom && optTo) ? optFrom : ytdFrom
  const dateTo = (optFrom && optTo) ? optTo : ytdTo

  const year = new Date(dateTo).getFullYear()
  const yearStart = `${year}-01-01`

  const defaultData: ClinicDashboardData = {
    clinic: null,
    revenueInPeriod: 0,
    revenueTarget: 0,
    revenueYtd: 0,
    totalTransactionsInPeriod: 0,
    visitsTarget: 0,
    avgTransaction: 0,
    targetRealization: 0,
    poliData: [],
    visitsPerPoli: [],
    visitsPerInsurance: [],
    monthlyRevenue: Array(12).fill(0),
    monthlyVisits: Array(12).fill(0),
  }

  try {
    const [clinicRow] = await sql`
      SELECT id, name, location FROM clinics WHERE id = ${clinicId} AND is_active = true
    `
    if (!clinicRow) return defaultData

    const clinic = {
      id: Number((clinicRow as any).id),
      name: String((clinicRow as any).name),
      location: (clinicRow as any).location ? String((clinicRow as any).location) : null,
    }

    const [periodRow] = await sql`
      SELECT 
        COALESCE(SUM(t.paid_total), 0)::numeric as revenue,
        COUNT(t.id)::int as cnt,
        COALESCE(AVG(t.paid_total), 0)::numeric as avg_tx
      FROM transactions t
      WHERE t.clinic_id = ${clinicId} AND t.trx_date >= ${dateFrom} AND t.trx_date <= ${dateTo}
    `
    const revenueInPeriod = Number((periodRow as any)?.revenue ?? 0)
    const totalTransactionsInPeriod = Number((periodRow as any)?.cnt ?? 0)
    const avgTransaction = Number((periodRow as any)?.avg_tx ?? 0)

    const [targetRow] = await sql`
      SELECT 
        COALESCE(SUM(cdt.target_revenue), 0)::numeric as target_revenue,
        COALESCE(SUM(cdt.target_visits), 0)::numeric as target_visits
      FROM clinic_daily_targets cdt
      WHERE cdt.clinic_id = ${clinicId} AND cdt.target_year = ${year} AND cdt.source_id = 1
    `
    const revenueTarget = Number((targetRow as any)?.target_revenue ?? 0)
    const visitsTarget = Number((targetRow as any)?.target_visits ?? 0)

    const [ytdRow] = await sql`
      SELECT COALESCE(SUM(t.paid_total), 0)::numeric as revenue_ytd
      FROM transactions t
      WHERE t.clinic_id = ${clinicId} AND t.trx_date >= ${yearStart} AND t.trx_date <= ${dateTo}
    `
    const revenueYtd = Number((ytdRow as any)?.revenue_ytd ?? 0)
    const targetRealization = revenueTarget > 0 ? (revenueYtd / revenueTarget) * 100 : 0

    const poliRows = await sql`
      SELECT 
        t.poly_id,
        COALESCE(mp.name, 'Lainnya') as name,
        COALESCE(SUM(t.paid_total), 0)::numeric as revenue
      FROM transactions t
      LEFT JOIN master_polies mp ON mp.id = t.poly_id
      WHERE t.clinic_id = ${clinicId} AND t.trx_date >= ${dateFrom} AND t.trx_date <= ${dateTo}
      GROUP BY t.poly_id, mp.name
      ORDER BY revenue DESC
    `

    const polyTargetRows = await sql`
      SELECT 
        cdt.master_poly_id as poly_id,
        COALESCE(mp.name, 'Lainnya') as name,
        COALESCE(SUM(cdt.target_revenue), 0)::numeric as target_revenue,
        COALESCE(SUM(cdt.target_visits), 0)::numeric as target_visits
      FROM clinic_daily_targets cdt
      LEFT JOIN master_polies mp ON mp.id = cdt.master_poly_id
      WHERE cdt.clinic_id = ${clinicId} AND cdt.target_year = ${year} AND cdt.source_id = 1
      GROUP BY cdt.master_poly_id, mp.name
    `

    const polyTargetMap = new Map<
      number,
      { targetRevenue: number; targetVisits: number }
    >()
    ;(polyTargetRows as any[]).forEach((r: any) => {
      const id = Number(r.poly_id || 0)
      const targetRevenue = Number(r.target_revenue || 0)
      const targetVisits = Number(r.target_visits || 0)
      polyTargetMap.set(id, { targetRevenue, targetVisits })
    })

    const poliTotal = (poliRows as any[]).reduce((s: number, r: any) => s + Number(r.revenue || 0), 0)
    const poliData = (poliRows as any[]).map((r: any) => {
      const polyId = Number(r.poly_id || 0)
      const rev = Number(r.revenue || 0)
      const percentage = poliTotal > 0 ? (rev / poliTotal) * 100 : 0
      const targets = polyTargetMap.get(polyId) || { targetRevenue: 0, targetVisits: 0 }
      const targetRevenue = targets.targetRevenue
      const progressPercent = targetRevenue > 0 ? (rev / targetRevenue) * 100 : 0
      return {
        name: String(r.name || 'Lainnya'),
        revenue: rev,
        percentage,
        targetRevenue,
        progressPercent,
      }
    })

    const visitsPoliRows = await sql`
      SELECT 
        t.poly_id,
        COALESCE(mp.name, 'Lainnya') as name,
        COUNT(t.id)::int as cnt
      FROM transactions t
      LEFT JOIN master_polies mp ON mp.id = t.poly_id
      WHERE t.clinic_id = ${clinicId} AND t.trx_date >= ${dateFrom} AND t.trx_date <= ${dateTo}
      GROUP BY t.poly_id, mp.name
      ORDER BY cnt DESC
    `
    const visitsTotal = (visitsPoliRows as any[]).reduce((s: number, r: any) => s + Number(r.cnt || 0), 0)
    const visitsPerPoli = (visitsPoliRows as any[]).map((r: any) => {
      const polyId = Number(r.poly_id || 0)
      const targets = polyTargetMap.get(polyId) || { targetRevenue: 0, targetVisits: 0 }
      const count = Number(r.cnt || 0)
      const percent = visitsTotal > 0 ? (count / visitsTotal) * 100 : 0
      const targetVisits = targets.targetVisits
      const progressPercent = targetVisits > 0 ? (count / targetVisits) * 100 : 0
      return {
        name: String(r.name || 'Lainnya'),
        count,
        percent,
        targetVisits,
        progressPercent,
      }
    })

    const visitsInsuranceRows = await sql`
      SELECT 
        COALESCE(mit.name, t.insurance_type, 'Lainnya') as name,
        COUNT(t.id)::int as cnt
      FROM transactions t
      LEFT JOIN master_insurance_types mit ON mit.id = t.insurance_type_id
      WHERE t.clinic_id = ${clinicId} AND t.trx_date >= ${dateFrom} AND t.trx_date <= ${dateTo}
      GROUP BY COALESCE(mit.name, t.insurance_type, 'Lainnya')
      ORDER BY cnt DESC
    `
    const visitsInsuranceTotal = (visitsInsuranceRows as any[]).reduce(
      (s: number, r: any) => s + Number(r.cnt || 0),
      0
    )
    const visitsPerInsurance = (visitsInsuranceRows as any[]).map((r: any) => {
      const count = Number(r.cnt || 0)
      const percent = visitsInsuranceTotal > 0 ? (count / visitsInsuranceTotal) * 100 : 0
      return { name: String(r.name || 'Lainnya'), count, percent }
    })

    const monthRows = await sql`
      SELECT 
        EXTRACT(MONTH FROM t.trx_date)::int as month,
        COALESCE(SUM(t.paid_total), 0)::numeric as revenue
      FROM transactions t
      WHERE t.clinic_id = ${clinicId}
        AND t.trx_date >= ${dateFrom}
        AND t.trx_date <= ${dateTo}
      GROUP BY EXTRACT(MONTH FROM t.trx_date)
    `
    const monthlyRevenue = Array(12).fill(0)
    ;(monthRows as any[]).forEach((r: any) => {
      const idx = Math.min(11, Math.max(0, Number(r.month) - 1))
      monthlyRevenue[idx] = Number(r.revenue || 0)
    })

    const monthVisitRows = await sql`
      SELECT 
        EXTRACT(MONTH FROM t.trx_date)::int as month,
        COUNT(t.id)::int as cnt
      FROM transactions t
      WHERE t.clinic_id = ${clinicId}
        AND t.trx_date >= ${dateFrom}
        AND t.trx_date <= ${dateTo}
      GROUP BY EXTRACT(MONTH FROM t.trx_date)
    `
    const monthlyVisits = Array(12).fill(0)
    ;(monthVisitRows as any[]).forEach((r: any) => {
      const idx = Math.min(11, Math.max(0, Number(r.month) - 1))
      monthlyVisits[idx] = Number(r.cnt || 0)
    })

    return {
      clinic,
      revenueInPeriod,
      revenueTarget,
      revenueYtd,
      totalTransactionsInPeriod,
      visitsTarget,
      avgTransaction,
      targetRealization,
      poliData,
      visitsPerPoli,
      visitsPerInsurance,
      monthlyRevenue,
      monthlyVisits,
    }
  } catch (error) {
    console.error('Error getClinicDashboardData:', error)
    return defaultData
  }
})
