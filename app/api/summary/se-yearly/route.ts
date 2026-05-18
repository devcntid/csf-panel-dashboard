import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import {
  applyZainsFinsTotalsContactFilters,
  parseCommaSeparatedIds,
} from '@/lib/zains-fins-totals'
import {
  getZainsSummaryConcurrency,
  runPool,
} from '@/lib/zains-fetch-retry'
import { queryFinsTotals } from '@/lib/fins-totals'
import type { RowFilterParams } from '@/lib/summary-se-yearly-types'

export const dynamic = 'force-dynamic'
/** Banyak call paralel ke Zains; naikkan batas agar tidak putus di 60s (Vercel / hosting). */
export const maxDuration = 300

type MonthlyPoint = {
  month: number
  sum: number
}

type PivotRow = {
  label: string
  monthly: MonthlyPoint[]
  monthlyTargets?: MonthlyPoint[]
  filterParams?: RowFilterParams
}

type PivotGroup = {
  title: string
  rows: PivotRow[]
}

type PivotSection = {
  title: string
  groups: PivotGroup[]
}

const MONTH_LABELS: Record<number, string> = {
  1: 'Jan',
  2: 'Feb',
  3: 'Mar',
  4: 'Apr',
  5: 'Mei',
  6: 'Jun',
  7: 'Jul',
  8: 'Agu',
  9: 'Sep',
  10: 'Okt',
  11: 'Nov',
  12: 'Des',
}

async function fetchZainsMonthlySeries(params: {
  type: string
  year: number
  onlyCoaDebet: string[]
  onlyCoaKredit: string[]
  onlyIdContact?: string[]
  excludeIdContact?: string[]
  idKantor?: string
}): Promise<MonthlyPoint[]> {
  const searchParams = new URLSearchParams({
    type: params.type,
    group_by: 'monthly',
    year: String(params.year),
  })

  if (params.onlyCoaDebet.length > 0) {
    searchParams.set('only_coa_debet', params.onlyCoaDebet.join(','))
  }

  if (params.onlyCoaKredit.length > 0) {
    searchParams.set('only_coa_kredit', params.onlyCoaKredit.join(','))
  }

  if (params.idKantor && params.idKantor.trim()) {
    searchParams.set('id_kantor', params.idKantor.trim())
  }

  applyZainsFinsTotalsContactFilters(
    searchParams,
    params.onlyIdContact ?? [],
    params.excludeIdContact ?? [],
  )

  const json: any = await queryFinsTotals({
    type: params.type === 'expend' ? 'expend' : 'receipt',
    group_by: 'monthly',
    year: params.year,
    approve: searchParams.get('approve') || undefined,
    id_kantor: searchParams.get('id_kantor') || undefined,
    id_program: searchParams.get('id_program') || undefined,
    only_coa_debet: searchParams.get('only_coa_debet') || undefined,
    only_coa_kredit: searchParams.get('only_coa_kredit') || undefined,
    exclude_coa_debet: searchParams.get('exclude_coa_debet') || undefined,
    exclude_coa_kredit: searchParams.get('exclude_coa_kredit') || undefined,
    only_id_contact: searchParams.get('only_id_contact') || undefined,
    exclude_id_contact: searchParams.get('exclude_id_contact') || undefined,
  })

  if (json.status === false && !Array.isArray(json.data)) {
    return []
  }

  if (!Array.isArray(json.data)) {
    throw new Error('Respons API Zains (yearly monthly) tidak valid: data bukan array')
  }

  return json.data.map((item: any) => ({
    month: Number(item.month || 0),
    sum: Number(item.sum || 0),
  }))
}

function sumYearVector(vec: MonthlyPoint[]): number {
  return vec.reduce((s, p) => s + p.sum, 0)
}

function achievementPct(actual: number, target: number): number | null {
  if (target <= 0 || !Number.isFinite(target)) return null
  return Math.round((actual / target) * 1000) / 10
}

function netMonthlySeries(receipt: MonthlyPoint[], expend: MonthlyPoint[]): MonthlyPoint[] {
  const rMap = new Map<number, number>()
  for (const p of receipt) {
    if (!p.month) continue
    rMap.set(p.month, (rMap.get(p.month) || 0) + p.sum)
  }
  const eMap = new Map<number, number>()
  for (const p of expend) {
    if (!p.month) continue
    eMap.set(p.month, (eMap.get(p.month) || 0) + p.sum)
  }
  const monthNums = new Set<number>([...rMap.keys(), ...eMap.keys()])
  return Array.from(monthNums)
    .sort((a, b) => a - b)
    .map((m) => ({
      month: m,
      sum: (rMap.get(m) || 0) - (eMap.get(m) || 0),
    }))
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const yearParam = url.searchParams.get('year')
    const now = new Date()
    const year = yearParam ? Number(yearParam) || now.getFullYear() : now.getFullYear()

    // Ambil konfigurasi sources
    const sources = await sql`
      SELECT 
        id,
        name,
        slug,
        category,
        mode,
        coa_debet,
        coa_kredit,
        only_id_contact,
        exclude_id_contact,
        summary_order
      FROM sources
      ORDER BY COALESCE(summary_order, 9999), name
    `

    // Ambil daftar klinik yang ikut di summary SE (termasuk id_kantor_zains untuk filter API Zains)
    const clinics = await sql`
      SELECT 
        id,
        name,
        summary_alias,
        summary_order,
        kode_coa,
        include_in_se_summary,
        se_receipt_coa_debet,
        se_receipt_coa_kredit,
        id_kantor_zains
      FROM clinics
      WHERE is_active = true
      ORDER BY COALESCE(summary_order, 9999), name
    `

    const clinicRows = Array.isArray(clinics) ? clinics : []
    const sourceRows = Array.isArray(sources) ? sources : []

    const seClinicSource = sourceRows.find((s: any) => s.slug === 'se_klinik' || s.name === 'SE Klinik') as any
    const seAmbulanceSource = sourceRows.find(
      (s: any) => s.slug === 'se_ambulance' || s.name === 'SE Ambulance',
    ) as any
    const fundraisingProjectSource = sourceRows.find(
      (s: any) => s.slug === 'fundraising_project' || s.name === 'Fundraising Project',
    ) as any
    const fundraisingDigitalSource = sourceRows.find(
      (s: any) => s.slug === 'fundraising_digital' || s.name === 'Fundraising Digital',
    ) as any
    const penerimaanLainnyaSource = sourceRows.find(
      (s: any) => s.slug === 'penerimaan_lainnya' || s.name === 'Penerimaan Lainnya',
    ) as any

    type Task = {
      key: string
      label: string
      section: 'SE' | 'FUNDRAISING'
      group: 'KLINIK' | 'AMBULAN' | 'FUNDRAISING' | 'PENERIMAAN_LAINNYA'
      clinicId?: number
      sourceId?: number
      params: {
        type: string
        subtractType?: string
        onlyCoaDebet: string[]
        onlyCoaKredit: string[]
        onlyIdContact: string[]
        excludeIdContact: string[]
        idKantorZains?: string
      }
    }

    const tasks: Task[] = []

    // === SE KLINIK: per klinik ===
    if (seClinicSource) {
      const defaultCoaKredit =
        typeof seClinicSource.coa_kredit === 'string' && seClinicSource.coa_kredit.trim().length > 0
          ? String(seClinicSource.coa_kredit)
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : []

      const clinicOnlyIdContact = parseCommaSeparatedIds(seClinicSource.only_id_contact)
      const clinicExcludeIdContact = parseCommaSeparatedIds(seClinicSource.exclude_id_contact)

      for (const c of clinicRows as any[]) {
        if (c.include_in_se_summary === false) continue

        const alias = c.summary_alias || c.name

        const clinicDebetListRaw: string | null = c.se_receipt_coa_debet ?? null
        const clinicCoaDebet =
          clinicDebetListRaw && clinicDebetListRaw.trim().length > 0
            ? String(clinicDebetListRaw)
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            : c.kode_coa
              ? [String(c.kode_coa)]
              : []

        const clinicKreditListRaw: string | null = c.se_receipt_coa_kredit ?? null
        const clinicCoaKredit =
          clinicKreditListRaw && clinicKreditListRaw.trim().length > 0
            ? String(clinicKreditListRaw)
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            : defaultCoaKredit

        const idKantorZains =
          c.id_kantor_zains != null && String(c.id_kantor_zains).trim() !== ''
            ? String(c.id_kantor_zains).trim()
            : undefined

        tasks.push({
          key: `klinik-${c.id}`,
          label: alias,
          section: 'SE',
          group: 'KLINIK',
          clinicId: Number(c.id),
          sourceId: Number(seClinicSource.id),
          params: {
            type: 'receipt',
            subtractType: 'expend',
            onlyCoaDebet: clinicCoaDebet,
            onlyCoaKredit: clinicCoaKredit,
            onlyIdContact: clinicOnlyIdContact,
            excludeIdContact: clinicExcludeIdContact,
            idKantorZains,
          },
        })
      }
    }

    // === SE AMBULAN ===
    if (seAmbulanceSource) {
      const debet =
        typeof seAmbulanceSource.coa_debet === 'string' && seAmbulanceSource.coa_debet.trim().length > 0
          ? String(seAmbulanceSource.coa_debet)
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : []

      const kredit =
        typeof seAmbulanceSource.coa_kredit === 'string' && seAmbulanceSource.coa_kredit.trim().length > 0
          ? String(seAmbulanceSource.coa_kredit)
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : []

      const ambOnlyId = parseCommaSeparatedIds(seAmbulanceSource.only_id_contact)
      const ambExcludeId = parseCommaSeparatedIds(seAmbulanceSource.exclude_id_contact)

      tasks.push({
        key: 'ambulance',
        label: 'Ambulan',
        section: 'SE',
        group: 'AMBULAN',
        sourceId: Number(seAmbulanceSource.id),
        params: {
          type: 'receipt',
          onlyCoaDebet: debet,
          onlyCoaKredit: kredit,
          onlyIdContact: ambOnlyId,
          excludeIdContact: ambExcludeId,
        },
      })
    }

    // === FUNDRAISING: Project & Digital ===
    if (fundraisingProjectSource) {
      const debet =
        typeof fundraisingProjectSource.coa_debet === 'string' &&
        fundraisingProjectSource.coa_debet.trim().length > 0
          ? String(fundraisingProjectSource.coa_debet)
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : []

      const kredit =
        typeof fundraisingProjectSource.coa_kredit === 'string' &&
        fundraisingProjectSource.coa_kredit.trim().length > 0
          ? String(fundraisingProjectSource.coa_kredit)
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : []

      const fpOnlyId = parseCommaSeparatedIds(fundraisingProjectSource.only_id_contact)
      const fpExcludeId = parseCommaSeparatedIds(fundraisingProjectSource.exclude_id_contact)

      tasks.push({
        key: 'funding',
        label: 'Funding',
        section: 'FUNDRAISING',
        group: 'FUNDRAISING',
        sourceId: Number(fundraisingProjectSource.id),
        params: {
          type: 'receipt',
          onlyCoaDebet: debet,
          onlyCoaKredit: kredit,
          onlyIdContact: fpOnlyId,
          excludeIdContact: fpExcludeId,
        },
      })
    }

    if (fundraisingDigitalSource) {
      const debet =
        typeof fundraisingDigitalSource.coa_debet === 'string' &&
        fundraisingDigitalSource.coa_debet.trim().length > 0
          ? String(fundraisingDigitalSource.coa_debet)
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : []

      const kredit =
        typeof fundraisingDigitalSource.coa_kredit === 'string' &&
        fundraisingDigitalSource.coa_kredit.trim().length > 0
          ? String(fundraisingDigitalSource.coa_kredit)
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : []

      const fdOnlyId = parseCommaSeparatedIds(fundraisingDigitalSource.only_id_contact)
      const fdExcludeId = parseCommaSeparatedIds(fundraisingDigitalSource.exclude_id_contact)

      tasks.push({
        key: 'dm',
        label: 'DM',
        section: 'FUNDRAISING',
        group: 'FUNDRAISING',
        sourceId: Number(fundraisingDigitalSource.id),
        params: {
          type: 'receipt',
          onlyCoaDebet: debet,
          onlyCoaKredit: kredit,
          onlyIdContact: fdOnlyId,
          excludeIdContact: fdExcludeId,
        },
      })
    }

    // === PENERIMAAN LAINNYA (konfigurasi dari sources) ===
    if (penerimaanLainnyaSource) {
      const debet =
        typeof penerimaanLainnyaSource.coa_debet === 'string' &&
        penerimaanLainnyaSource.coa_debet.trim().length > 0
          ? String(penerimaanLainnyaSource.coa_debet)
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : []

      const kredit =
        typeof penerimaanLainnyaSource.coa_kredit === 'string' &&
        penerimaanLainnyaSource.coa_kredit.trim().length > 0
          ? String(penerimaanLainnyaSource.coa_kredit)
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : []

      const plOnlyId = parseCommaSeparatedIds(penerimaanLainnyaSource.only_id_contact)
      const plExcludeId = parseCommaSeparatedIds(penerimaanLainnyaSource.exclude_id_contact)

      tasks.push({
        key: 'penerimaan_lainnya',
        label: 'PENERIMAAN LAINNYA',
        section: 'FUNDRAISING',
        group: 'PENERIMAAN_LAINNYA',
        sourceId: Number(penerimaanLainnyaSource.id),
        params: {
          type: 'receipt',
          onlyCoaDebet: debet,
          onlyCoaKredit: kredit,
          onlyIdContact: plOnlyId,
          excludeIdContact: plExcludeId,
        },
      })
    }

    // Fetch monthly targets from Postgres AND Zains data in parallel
    const concurrency = getZainsSummaryConcurrency()

    type MonthlyTarget = { clinic_id: number | null; source_id: number; target_month: number; target_revenue: number }
    const monthlyTargetsPromise = sql`
      SELECT
        cdt.clinic_id,
        cdt.source_id,
        cdt.target_month,
        COALESCE(SUM(cdt.target_revenue), 0)::numeric AS target_revenue
      FROM clinic_daily_targets cdt
      WHERE (
        (cdt.target_type = 'cumulative' AND cdt.target_year = ${year})
        OR (
          cdt.target_type = 'daily'
          AND cdt.target_date IS NOT NULL
          AND EXTRACT(YEAR FROM cdt.target_date::date) = ${year}
          AND EXTRACT(MONTH FROM cdt.target_date::date) = cdt.target_month
        )
      )
      GROUP BY cdt.clinic_id, cdt.source_id, cdt.target_month
    `.then((rows) => (Array.isArray(rows) ? rows : []) as unknown as MonthlyTarget[])
      .catch((err) => {
        console.error('summary se-yearly: gagal fetch monthly targets:', err)
        return [] as MonthlyTarget[]
      })

    const [taskResults, monthlyTargetRows] = await Promise.all([
      runPool(tasks, concurrency, async (t) => {
        const base = {
          year,
          onlyCoaDebet: t.params.onlyCoaDebet,
          onlyCoaKredit: t.params.onlyCoaKredit,
          onlyIdContact: t.params.onlyIdContact,
          excludeIdContact: t.params.excludeIdContact,
          idKantor: t.params.idKantorZains,
        }
        let monthly: MonthlyPoint[]
        if (t.params.subtractType) {
          const [receiptPts, expendPts] = await Promise.all([
            fetchZainsMonthlySeries({ ...base, type: t.params.type }),
            fetchZainsMonthlySeries({
              year,
              onlyCoaDebet: t.params.onlyCoaKredit,
              onlyCoaKredit: t.params.onlyCoaDebet,
              onlyIdContact: t.params.onlyIdContact,
              excludeIdContact: t.params.excludeIdContact,
              idKantor: t.params.idKantorZains,
              type: t.params.subtractType,
            }),
          ])
          monthly = netMonthlySeries(receiptPts, expendPts)
        } else {
          monthly = await fetchZainsMonthlySeries({
            ...base,
            type: t.params.type,
          })
        }
        return { ...t, monthly }
      }),
      monthlyTargetsPromise,
    ])

    // Build monthly target lookup: "clinicId-sourceId-month" → target_revenue
    // Also "source-sourceId-month" → sum of all clinic targets for that source+month
    const targetLookup = new Map<string, number>()
    for (const row of monthlyTargetRows) {
      const cid = Number(row.clinic_id || 0)
      const sid = Number(row.source_id || 0)
      const m = Number(row.target_month || 0)
      const rev = Number(row.target_revenue || 0)
      if (!sid || !m) continue
      if (cid) {
        const key = `${cid}-${sid}-${m}`
        targetLookup.set(key, (targetLookup.get(key) || 0) + rev)
      }
      const sourceKey = `source-${sid}-${m}`
      targetLookup.set(sourceKey, (targetLookup.get(sourceKey) || 0) + rev)
    }

    // Kumpulkan semua bulan unik yang punya data di salah satu row
    const monthSet = new Set<number>()
    for (const r of taskResults) {
      for (const p of r.monthly) {
        if (!p.month) continue
        if (p.sum !== 0 || r.params.subtractType || r.group === 'PENERIMAAN_LAINNYA') {
          monthSet.add(p.month)
        }
      }
    }
    const months = Array.from(monthSet).sort((a, b) => a - b)

    // Helper untuk membuat vector nilai per bulan (sesuai daftar months)
    const toMonthlyVector = (points: MonthlyPoint[]): MonthlyPoint[] => {
      const map = new Map<number, number>()
      for (const p of points) {
        if (!p.month) continue
        map.set(p.month, (map.get(p.month) || 0) + p.sum)
      }
      return months.map((m) => ({
        month: m,
        sum: map.get(m) || 0,
      }))
    }

    function taskToFilterParams(t: Task): RowFilterParams {
      const fp: RowFilterParams = { type: t.params.type, approve: 'a' }
      if (t.params.onlyCoaDebet.length > 0) fp.only_coa_debet = t.params.onlyCoaDebet.join(',')
      if (t.params.onlyCoaKredit.length > 0) fp.only_coa_kredit = t.params.onlyCoaKredit.join(',')
      if (t.params.idKantorZains) fp.id_kantor = t.params.idKantorZains
      if (t.params.onlyIdContact.length > 0) fp.only_id_contact = t.params.onlyIdContact.join(',')
      if (t.params.excludeIdContact.length > 0) fp.exclude_id_contact = t.params.excludeIdContact.join(',')
      return fp
    }

    // Helper to build monthly target vector for a task
    const buildMonthlyTargets = (t: typeof taskResults[0]): MonthlyPoint[] => {
      return months.map((m) => {
        let target = 0
        if (t.clinicId && t.sourceId) {
          target = targetLookup.get(`${t.clinicId}-${t.sourceId}-${m}`) || 0
        } else if (t.sourceId) {
          target = targetLookup.get(`source-${t.sourceId}-${m}`) || 0
        }
        return { month: m, sum: target }
      })
    }

    // Bangun rows per task
    type RowWithParams = { label: string; monthly: MonthlyPoint[]; monthlyTargets: MonthlyPoint[]; filterParams?: RowFilterParams }
    const klinikRows: RowWithParams[] = []
    const ambulanRows: RowWithParams[] = []
    const fundraisingRows: RowWithParams[] = []
    let penerimaanLainnyaRow: RowWithParams | null = null

    for (const r of taskResults) {
      const vector = toMonthlyVector(r.monthly)
      const fp = taskToFilterParams(r)
      const targets = buildMonthlyTargets(r)
      if (r.section === 'SE' && r.group === 'KLINIK') {
        klinikRows.push({ label: r.label, monthly: vector, monthlyTargets: targets, filterParams: fp })
      } else if (r.section === 'SE' && r.group === 'AMBULAN') {
        ambulanRows.push({ label: r.label, monthly: vector, monthlyTargets: targets, filterParams: fp })
      } else if (r.section === 'FUNDRAISING' && r.group === 'FUNDRAISING') {
        fundraisingRows.push({ label: r.label, monthly: vector, monthlyTargets: targets, filterParams: fp })
      } else if (r.section === 'FUNDRAISING' && r.group === 'PENERIMAAN_LAINNYA') {
        penerimaanLainnyaRow = { label: r.label, monthly: vector, monthlyTargets: targets, filterParams: fp }
      }
    }

    const sumVectors = (vectors: MonthlyPoint[][]): MonthlyPoint[] => {
      return months.map((m) => {
        let total = 0
        for (const v of vectors) {
          const p = v.find((x) => x.month === m)
          if (p) total += p.sum
        }
        return { month: m, sum: total }
      })
    }

    const totalKlinikVector = sumVectors(klinikRows.map((r) => r.monthly))
    const totalAmbulanVector = sumVectors(ambulanRows.map((r) => r.monthly))
    const totalSEVector = sumVectors([totalKlinikVector, totalAmbulanVector])
    const totalFundraisingVector = sumVectors(fundraisingRows.map((r) => r.monthly))
    const penerimaanLainnyaVector = penerimaanLainnyaRow
      ? penerimaanLainnyaRow.monthly
      : months.map((m) => ({ month: m, sum: 0 }))
    const grandTotalVector = sumVectors([totalSEVector, totalFundraisingVector, penerimaanLainnyaVector])

    const totalKlinikTargetVector = sumVectors(klinikRows.map((r) => r.monthlyTargets))
    const totalAmbulanTargetVector = sumVectors(ambulanRows.map((r) => r.monthlyTargets))
    const totalSETargetVector = sumVectors([totalKlinikTargetVector, totalAmbulanTargetVector])
    const totalFundraisingTargetVector = sumVectors(fundraisingRows.map((r) => r.monthlyTargets))
    const penerimaanLainnyaTargetVector = penerimaanLainnyaRow
      ? penerimaanLainnyaRow.monthlyTargets
      : months.map((m) => ({ month: m, sum: 0 }))
    const grandTotalTargetVector = sumVectors([totalSETargetVector, totalFundraisingTargetVector, penerimaanLainnyaTargetVector])

    const sections: PivotSection[] = [
      {
        title: 'SE',
        groups: [
          {
            title: 'KLINIK',
            rows: [
              ...klinikRows.map((r) => ({
                label: r.label,
                monthly: r.monthly,
                monthlyTargets: r.monthlyTargets,
                filterParams: r.filterParams,
              })),
              {
                label: 'TOTAL KLINIK',
                monthly: totalKlinikVector,
                monthlyTargets: totalKlinikTargetVector,
              },
            ],
          },
          {
            title: 'AMBULAN',
            rows: [
              ...ambulanRows.map((r) => ({
                label: r.label,
                monthly: r.monthly,
                monthlyTargets: r.monthlyTargets,
                filterParams: r.filterParams,
              })),
              {
                label: 'TOTAL AMBULAN',
                monthly: totalAmbulanVector,
                monthlyTargets: totalAmbulanTargetVector,
              },
            ],
          },
          {
            title: 'TOTAL SE',
            rows: [
              {
                label: 'TOTAL SE',
                monthly: totalSEVector,
                monthlyTargets: totalSETargetVector,
              },
            ],
          },
        ],
      },
      {
        title: 'FUNDRAISING',
        groups: [
          {
            title: 'FUNDRAISING',
            rows: [
              ...fundraisingRows.map((r) => ({
                label: r.label,
                monthly: r.monthly,
                monthlyTargets: r.monthlyTargets,
                filterParams: r.filterParams,
              })),
              {
                label: 'TOTAL FUNDRAISING',
                monthly: totalFundraisingVector,
                monthlyTargets: totalFundraisingTargetVector,
              },
            ],
          },
          {
            title: 'LAINNYA',
            rows: [
              {
                label: 'PENERIMAAN LAINNYA',
                monthly: penerimaanLainnyaVector,
                monthlyTargets: penerimaanLainnyaTargetVector,
                filterParams: penerimaanLainnyaRow?.filterParams,
              },
              {
                label: 'GRAND TOTAL',
                monthly: grandTotalVector,
                monthlyTargets: grandTotalTargetVector,
              },
            ],
          },
        ],
      },
    ]

    const monthMeta = months.map((m) => ({
      month: m,
      label: MONTH_LABELS[m] || String(m),
    }))

    const actualRollup = {
      total_se: sumYearVector(totalSEVector),
      total_fundraising: sumYearVector(totalFundraisingVector),
      penerimaan_lainnya: sumYearVector(penerimaanLainnyaVector),
      grand_total: sumYearVector(grandTotalVector),
    }

    type TargetBySource = Record<string, number>
    const targetsBySourceId: TargetBySource = {}
    const bySourceId = new Map<number, number>()

    for (const row of monthlyTargetRows) {
      const sid = Number(row.source_id || 0)
      const rev = Number(row.target_revenue || 0)
      if (!sid) continue
      bySourceId.set(sid, (bySourceId.get(sid) || 0) + rev)
    }
    for (const [sid, total] of bySourceId.entries()) {
      targetsBySourceId[String(sid)] = total
    }

    const sumTargetForIds = (ids: number[]) =>
      ids.reduce((s, id) => s + (bySourceId.get(id) || 0), 0)

    const seSourceIds = (sourceRows as { id: unknown; category?: string }[])
      .filter((s) => String(s.category || '').toUpperCase() === 'SE')
      .map((s) => Number(s.id))
    const fundraisingSourceIds = (sourceRows as { id: unknown; category?: string }[])
      .filter((s) => String(s.category || '').toUpperCase() === 'FUNDRAISING')
      .map((s) => Number(s.id))
    const penerimaanSourceIds = (sourceRows as { id: unknown; slug?: string }[])
      .filter((s) => String(s.slug || '') === 'penerimaan_lainnya')
      .map((s) => Number(s.id))
    const allConfiguredSourceIds = (sourceRows as { id: unknown }[])
      .map((s) => Number(s.id))
      .filter(Boolean)

    const targetRollup = {
      total_se: sumTargetForIds(seSourceIds),
      total_fundraising: sumTargetForIds(fundraisingSourceIds),
      penerimaan_lainnya: sumTargetForIds(penerimaanSourceIds),
      grand_total: sumTargetForIds(allConfiguredSourceIds),
    }

    const rollupWithAchievement = {
      total_se: {
        actual: actualRollup.total_se,
        target: targetRollup.total_se,
        achievement_pct: achievementPct(actualRollup.total_se, targetRollup.total_se),
      },
      total_fundraising: {
        actual: actualRollup.total_fundraising,
        target: targetRollup.total_fundraising,
        achievement_pct: achievementPct(actualRollup.total_fundraising, targetRollup.total_fundraising),
      },
      penerimaan_lainnya: {
        actual: actualRollup.penerimaan_lainnya,
        target: targetRollup.penerimaan_lainnya,
        achievement_pct: achievementPct(actualRollup.penerimaan_lainnya, targetRollup.penerimaan_lainnya),
      },
      grand_total: {
        actual: actualRollup.grand_total,
        target: targetRollup.grand_total,
        achievement_pct: achievementPct(actualRollup.grand_total, targetRollup.grand_total),
      },
    }

    return NextResponse.json(
      {
        success: true,
        year,
        months: monthMeta,
        sections,
        targets: {
          bySourceId: targetsBySourceId,
          rollup: rollupWithAchievement,
        },
      },
      { status: 200 },
    )
  } catch (error: any) {
    console.error('Error summary SE yearly:', error)
    return NextResponse.json(
      {
        success: false,
        message: error?.message || 'Gagal mengambil summary SE yearly',
      },
      { status: 500 },
    )
  }
}

