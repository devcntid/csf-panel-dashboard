'use server'

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getZainsApiConfig } from '@/lib/zains-api-config'

type MonthlyPoint = {
  month: number
  sum: number
}

type PivotRow = {
  label: string
  monthly: MonthlyPoint[]
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
  idKantor?: string
}): Promise<MonthlyPoint[]> {
  const { url } = getZainsApiConfig()
  const apiKey = process.env.API_KEY_ZAINS
  if (!url) {
    throw new Error('URL_API_ZAINS belum dikonfigurasi')
  }
  if (!apiKey) {
    throw new Error('API_KEY_ZAINS tidak dikonfigurasi')
  }

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

  const res = await fetch(`${url}/fins/totals?${searchParams.toString()}`, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      'Content-Type': 'application/json',
      Authorization: apiKey,
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Gagal call API Zains (yearly monthly): ${res.status} ${text}`)
  }

  const json: any = await res.json()
  if (!json || typeof json !== 'object') {
    throw new Error('Respons API Zains (yearly monthly) tidak valid (bukan JSON)')
  }

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

    type Task = {
      key: string
      label: string
      section: 'SE' | 'FUNDRAISING'
      group: 'KLINIK' | 'AMBULAN' | 'FUNDRAISING'
      params: {
        type: string
        onlyCoaDebet: string[]
        onlyCoaKredit: string[]
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
          params: {
            type: 'receipt',
            onlyCoaDebet: clinicCoaDebet,
            onlyCoaKredit: clinicCoaKredit,
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

      tasks.push({
        key: 'ambulance',
        label: 'TOTAL AMBULAN',
        section: 'SE',
        group: 'AMBULAN',
        params: {
          type: 'receipt',
          onlyCoaDebet: debet,
          onlyCoaKredit: kredit,
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

      tasks.push({
        key: 'funding',
        label: 'Funding',
        section: 'FUNDRAISING',
        group: 'FUNDRAISING',
        params: {
          type: 'receipt',
          onlyCoaDebet: debet,
          onlyCoaKredit: kredit,
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

      tasks.push({
        key: 'dm',
        label: 'DM',
        section: 'FUNDRAISING',
        group: 'FUNDRAISING',
        params: {
          type: 'receipt',
          onlyCoaDebet: debet,
          onlyCoaKredit: kredit,
        },
      })
    }

    // Jalankan semua call ke Zains secara paralel
    const taskResults = await Promise.all(
      tasks.map(async (t) => {
        const monthly = await fetchZainsMonthlySeries({
          type: t.params.type,
          year,
          onlyCoaDebet: t.params.onlyCoaDebet,
          onlyCoaKredit: t.params.onlyCoaKredit,
          idKantor: t.params.idKantorZains,
        })
        return { ...t, monthly }
      }),
    )

    // Kumpulkan semua bulan unik yang punya data di salah satu row
    const monthSet = new Set<number>()
    for (const r of taskResults) {
      for (const p of r.monthly) {
        if (p.month && p.sum) {
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

    // Bangun rows per task
    const klinikRows: { label: string; monthly: MonthlyPoint[] }[] = []
    const ambulanRows: { label: string; monthly: MonthlyPoint[] }[] = []
    const fundraisingRows: { label: string; monthly: MonthlyPoint[] }[] = []

    for (const r of taskResults) {
      const vector = toMonthlyVector(r.monthly)
      if (r.section === 'SE' && r.group === 'KLINIK') {
        klinikRows.push({ label: r.label, monthly: vector })
      } else if (r.section === 'SE' && r.group === 'AMBULAN') {
        ambulanRows.push({ label: r.label, monthly: vector })
      } else if (r.section === 'FUNDRAISING') {
        fundraisingRows.push({ label: r.label, monthly: vector })
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
    const penerimaanLainnyaVector = months.map((m) => ({ month: m, sum: 0 }))
    const grandTotalVector = sumVectors([totalSEVector, totalFundraisingVector, penerimaanLainnyaVector])

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
              })),
              {
                label: 'TOTAL KLINIK',
                monthly: totalKlinikVector,
              },
            ],
          },
          {
            title: 'AMBULAN',
            rows: [
              ...ambulanRows.map((r) => ({
                label: r.label,
                monthly: r.monthly,
              })),
              {
                label: 'TOTAL AMBULAN',
                monthly: totalAmbulanVector,
              },
            ],
          },
          {
            title: 'TOTAL SE',
            rows: [
              {
                label: 'TOTAL SE',
                monthly: totalSEVector,
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
              })),
              {
                label: 'TOTAL FUNDRAISING',
                monthly: totalFundraisingVector,
              },
            ],
          },
          {
            title: 'LAINNYA',
            rows: [
              {
                label: 'PENERIMAAN LAINNYA',
                monthly: penerimaanLainnyaVector,
              },
              {
                label: 'GRAND TOTAL',
                monthly: grandTotalVector,
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

    return NextResponse.json(
      {
        success: true,
        year,
        months: monthMeta,
        sections,
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

