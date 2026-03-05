'use server'

import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getZainsApiConfig } from '@/lib/zains-api-config'

type SummaryRow = {
  label: string
  value: number
}

type SectionSummary = {
  title: string
  groups: {
    title: string
    rows: SummaryRow[]
  }[]
}

function parseDateRange(req: NextRequest): {
  tgl_awal: string
  tgl_akhir: string
  year: number
  month: number | null
} {
  const url = new URL(req.url)
  const yearParam = url.searchParams.get('year')
  const monthParam = url.searchParams.get('month')
  const tglAwalParam = url.searchParams.get('tgl_awal')
  const tglAkhirParam = url.searchParams.get('tgl_akhir')

  if (tglAwalParam && tglAkhirParam) {
    const year = new Date(tglAwalParam).getFullYear()
    return { tgl_awal: tglAwalParam, tgl_akhir: tglAkhirParam, year, month: null }
  }

  const now = new Date()
  const year = yearParam ? Number(yearParam) || now.getFullYear() : now.getFullYear()
  const month = monthParam ? Number(monthParam) || now.getMonth() + 1 : now.getMonth() + 1

  const start = new Date(Date.UTC(year, month - 1, 1))
  const end = new Date(Date.UTC(year, month, 0))

  const format = (d: Date) => d.toISOString().slice(0, 10)

  return {
    tgl_awal: format(start),
    tgl_akhir: format(end),
    year,
    month,
  }
}

async function fetchZainsTotal(params: {
  type: string
  tgl_awal: string
  tgl_akhir: string
  onlyCoaDebet: string[]
  onlyCoaKredit: string[]
  year?: number
  month?: number | null
  idKantor?: string
}): Promise<number> {
  const { url } = getZainsApiConfig()
  const apiKey = process.env.API_KEY_ZAINS
  if (!url) {
    throw new Error('URL_API_ZAINS belum dikonfigurasi')
  }
  if (!apiKey) {
    throw new Error('API_KEY_ZAINS tidak dikonfigurasi')
  }

  const useMonthlyGrouping = params.year != null && params.month != null

  const searchParams = new URLSearchParams()
  searchParams.set('type', params.type)

  if (useMonthlyGrouping) {
    // Ikuti pola endpoint yang Anda pakai:
    // type=receipt&group_by=monthly&year=2026&only_coa_...
    searchParams.set('group_by', 'monthly')
    searchParams.set('year', String(params.year))
  } else {
    searchParams.set('tgl_awal', params.tgl_awal)
    searchParams.set('tgl_akhir', params.tgl_akhir)
  }

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
    throw new Error(`Gagal call API Zains: ${res.status} ${text}`)
  }

  const json: any = await res.json()
  if (!json || typeof json !== 'object') {
    throw new Error('Respons API Zains tidak valid (bukan JSON)')
  }

  // Jika kita pakai group_by=monthly untuk satu tahun,
  // ambil sum khusus untuk bulan yang diminta.
  if (useMonthlyGrouping) {
    if (!Array.isArray(json.data)) {
      throw new Error('Respons API Zains (monthly) tidak valid: data bukan array')
    }
    const targetMonth = Number(params.month)
    const item = json.data.find((row: any) => Number(row.month || 0) === targetMonth)
    if (!item) {
      return 0
    }
    return Number(item.sum || 0)
  }

  const data = json.data
  const hasDirectSum = data && typeof data.sum === 'number'
  const hasGrandSum = json.grand_total && typeof json.grand_total.sum === 'number'
  // Jika status=false dan tidak ada field sum yang bisa dibaca,
  // anggap saja tidak ada data (return 0) agar summary tetap jalan.
  if (json.status === false && !hasDirectSum && !hasGrandSum) {
    return 0
  }

  // Versi tanpa group_by: data.sum
  if (hasDirectSum) {
    return Number(data.sum)
  }

  // Versi dengan group_by monthly: grand_total.sum
  if (hasGrandSum) {
    return Number(json.grand_total.sum)
  }

  throw new Error('Field sum tidak ditemukan di respons API Zains')
}

export async function GET(req: NextRequest) {
  try {
    const { tgl_awal, tgl_akhir, year, month } = parseDateRange(req)

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

    const seClinicSource = sourceRows.find((s: any) => s.slug === 'se_klinik' || s.name === 'SE Klinik')
    const seAmbulanceSource = sourceRows.find((s: any) => s.slug === 'se_ambulance' || s.name === 'SE Ambulance')
    const fundraisingProjectSource = sourceRows.find(
      (s: any) => s.slug === 'fundraising_project' || s.name === 'Fundraising Project',
    )
    const fundraisingDigitalSource = sourceRows.find(
      (s: any) => s.slug === 'fundraising_digital' || s.name === 'Fundraising Digital',
    )

    const tasks: Array<{
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
    }> = []

    // === SE KLINIK: per klinik ===
    if (seClinicSource) {
      const defaultCoaKredit =
        typeof seClinicSource.coa_kredit === 'string' && seClinicSource.coa_kredit.trim().length > 0
          ? String(seClinicSource.coa_kredit)
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : []

      for (const c of clinicRows) {
        if (c.include_in_se_summary === false) continue

        const alias = c.summary_alias || c.name
        // COA debet per klinik:
        // - Jika se_receipt_coa_debet diisi: gunakan persis daftar tersebut (dinamis per klinik).
        // - Jika tidak, fallback ke kode_coa klinik (single debet).
        const clinicDebetListRaw: string | null = (c as any).se_receipt_coa_debet ?? null
        const clinicCoaDebet =
          clinicDebetListRaw && clinicDebetListRaw.trim().length > 0
            ? String(clinicDebetListRaw)
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            : c.kode_coa
              ? [String(c.kode_coa)]
              : []

        // COA kredit per klinik:
        // - Jika se_receipt_coa_kredit diisi: gunakan persis daftar tersebut.
        // - Jika tidak, fallback ke default dari source (jika ada).
        const clinicKreditListRaw: string | null = (c as any).se_receipt_coa_kredit ?? null
        const clinicCoaKredit =
          clinicKreditListRaw && clinicKreditListRaw.trim().length > 0
            ? String(clinicKreditListRaw)
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            : defaultCoaKredit

        const idKantorZains =
          (c as any).id_kantor_zains != null && String((c as any).id_kantor_zains).trim() !== ''
            ? String((c as any).id_kantor_zains).trim()
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
    const results = await Promise.all(
      tasks.map(async (t) => {
        const sum = await fetchZainsTotal({
          type: t.params.type,
          tgl_awal,
          tgl_akhir,
          onlyCoaDebet: t.params.onlyCoaDebet,
          onlyCoaKredit: t.params.onlyCoaKredit,
          year,
          month,
          idKantor: t.params.idKantorZains,
        })
        return { ...t, sum }
      }),
    )

    // Bangun struktur summary
    const klinikRows: SummaryRow[] = results
      .filter((r) => r.section === 'SE' && r.group === 'KLINIK')
      .map((r) => ({ label: r.label, value: r.sum }))

    const totalKlinik = klinikRows.reduce((acc, r) => acc + r.value, 0)

    const ambulanRows = results.filter((r) => r.section === 'SE' && r.group === 'AMBULAN')
    const totalAmbulan = ambulanRows.reduce((acc, r) => acc + r.sum, 0)

    const fundraisingRows: SummaryRow[] = results
      .filter((r) => r.section === 'FUNDRAISING' && r.group === 'FUNDRAISING')
      .map((r) => ({ label: r.label, value: r.sum }))

    const totalFundraising = fundraisingRows.reduce((acc, r) => acc + r.value, 0)

    const totalSE = totalKlinik + totalAmbulan

    // Placeholder: penerimaan lainnya bisa diisi nanti
    const penerimaanLainnya = 0
    const grandTotal = totalSE + totalFundraising + penerimaanLainnya

    const sections: SectionSummary[] = [
      {
        title: 'SE',
        groups: [
          {
            title: 'KLINIK',
            rows: [
              ...klinikRows,
              { label: 'TOTAL KLINIK', value: totalKlinik },
            ],
          },
          {
            title: 'AMBULAN',
            rows: [
              { label: 'TOTAL AMBULAN', value: totalAmbulan },
            ],
          },
          {
            title: 'TOTAL SE',
            rows: [{ label: 'TOTAL SE', value: totalSE }],
          },
        ],
      },
      {
        title: 'FUNDRAISING',
        groups: [
          {
            title: 'FUNDRAISING',
            rows: [
              ...fundraisingRows,
              { label: 'TOTAL FUNDRAISING', value: totalFundraising },
            ],
          },
          {
            title: 'LAINNYA',
            rows: [
              { label: 'PENERIMAAN LAINNYA', value: penerimaanLainnya },
              { label: 'GRAND TOTAL', value: grandTotal },
            ],
          },
        ],
      },
    ]

    return NextResponse.json(
      {
        success: true,
        year,
        period: { tgl_awal, tgl_akhir },
        sections,
      },
      { status: 200 },
    )
  } catch (error: any) {
    console.error('Error summary SE:', error)
    return NextResponse.json(
      {
        success: false,
        message: error?.message || 'Gagal mengambil summary SE',
      },
      { status: 500 },
    )
  }
}

