import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import {
  applyZainsFinsTotalsContactFilters,
  parseCommaSeparatedIds,
} from '@/lib/zains-fins-totals'
import { queryFinsTotals } from '@/lib/fins-totals'

export const dynamic = 'force-dynamic'

type MonthlyItem = {
  month: number
  month_name: string
  sum: number
  count: number
}

async function fetchZainsMonthlyTotal(params: {
  type: string
  year: number
  onlyCoaDebet: string[]
  onlyCoaKredit: string[]
  onlyIdContact?: string[]
  excludeIdContact?: string[]
  idKantor?: string
}): Promise<{ monthly: MonthlyItem[]; grandTotal: { sum: number; count: number } }> {
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

  // Jika status=false dan tidak ada data array, anggap tidak ada data (semua nol)
  if (json.status === false && !Array.isArray(json.data)) {
    return {
      monthly: [],
      grandTotal: { sum: 0, count: 0 },
    }
  }

  if (!Array.isArray(json.data)) {
    throw new Error('Respons API Zains (monthly) tidak valid: data bukan array')
  }

  const monthly: MonthlyItem[] = json.data.map((item: any) => ({
    month: Number(item.month || 0),
    month_name: String(item.month_name || ''),
    sum: Number(item.sum || 0),
    count: Number(item.count || 0),
  }))

  const grandTotal = {
    sum: Number(json.grand_total?.sum || 0),
    count: Number(json.grand_total?.count || 0),
  }

  return { monthly, grandTotal }
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const yearParam = url.searchParams.get('year')
    const clinicIdParam = url.searchParams.get('clinic_id')

    if (!clinicIdParam) {
      return NextResponse.json(
        { success: false, message: 'clinic_id wajib diisi' },
        { status: 400 },
      )
    }

    const clinicId = Number(clinicIdParam)
    if (!Number.isFinite(clinicId) || clinicId <= 0) {
      return NextResponse.json(
        { success: false, message: 'clinic_id tidak valid' },
        { status: 400 },
      )
    }

    const now = new Date()
    const year = yearParam ? Number(yearParam) || now.getFullYear() : now.getFullYear()

    // Ambil data klinik (termasuk id_kantor_zains untuk filter API Zains)
    const clinicResult = await sql`
      SELECT 
        id,
        name,
        summary_alias,
        kode_coa,
        se_receipt_coa_debet,
        se_receipt_coa_kredit,
        id_kantor_zains
      FROM clinics
      WHERE id = ${clinicId} AND is_active = true
      LIMIT 1
    `
    const clinicRow = Array.isArray(clinicResult) ? clinicResult[0] : clinicResult
    if (!clinicRow) {
      return NextResponse.json(
        { success: false, message: 'Klinik tidak ditemukan atau tidak aktif' },
        { status: 404 },
      )
    }

    const clinic = {
      id: Number((clinicRow as any).id),
      name: String((clinicRow as any).name || ''),
      alias:
        (clinicRow as any).summary_alias != null
          ? String((clinicRow as any).summary_alias)
          : String((clinicRow as any).name || ''),
    }

    // Konfigurasi sumber SE Klinik
    const seSourceResult = await sql`
      SELECT 
        id,
        name,
        slug,
        coa_debet,
        coa_kredit,
        only_id_contact,
        exclude_id_contact
      FROM sources
      WHERE slug = 'se_klinik' OR name = 'SE Klinik'
      LIMIT 1
    `
    const seSource = Array.isArray(seSourceResult) ? seSourceResult[0] : seSourceResult
    if (!seSource) {
      return NextResponse.json(
        { success: false, message: 'Source SE Klinik belum dikonfigurasi' },
        { status: 400 },
      )
    }

    // Hitung COA untuk klinik ini:
    // Debet:
    // - Jika klinik punya se_receipt_coa_debet -> pakai persis.
    // - Jika tidak -> pakai klinik.kode_coa (single).
    const clinicDebetRaw = (clinicRow as any).se_receipt_coa_debet as string | null
    const clinicCoaDebet =
      clinicDebetRaw && clinicDebetRaw.trim().length > 0
        ? clinicDebetRaw
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : (clinicRow as any).kode_coa
          ? [String((clinicRow as any).kode_coa)]
          : []

    // Kredit:
    // - Jika klinik punya se_receipt_coa_kredit -> pakai persis.
    // - Jika tidak -> fallback ke default dari source (jika ada).
    const clinicKreditRaw = (clinicRow as any).se_receipt_coa_kredit as string | null
    const defaultCoaKreditRaw = (seSource as any).coa_kredit as string | null

    const clinicCoaKredit =
      clinicKreditRaw && clinicKreditRaw.trim().length > 0
        ? clinicKreditRaw
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : defaultCoaKreditRaw && defaultCoaKreditRaw.trim().length > 0
          ? defaultCoaKreditRaw
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean)
          : []

    const idKantorZains =
      (clinicRow as any).id_kantor_zains != null &&
      String((clinicRow as any).id_kantor_zains).trim() !== ''
        ? String((clinicRow as any).id_kantor_zains).trim()
        : undefined

    const onlyIdContact = parseCommaSeparatedIds((seSource as any).only_id_contact)
    const excludeIdContact = parseCommaSeparatedIds((seSource as any).exclude_id_contact)

    const { monthly, grandTotal } = await fetchZainsMonthlyTotal({
      type: 'receipt',
      year,
      onlyCoaDebet: clinicCoaDebet,
      onlyCoaKredit: clinicCoaKredit,
      onlyIdContact,
      excludeIdContact,
      idKantor: idKantorZains,
    })

    return NextResponse.json(
      {
        success: true,
        clinic,
        year,
        monthly,
        grand_total: grandTotal,
      },
      { status: 200 },
    )
  } catch (error: any) {
    console.error('Error summary SE monthly:', error)
    return NextResponse.json(
      {
        success: false,
        message: error?.message || 'Gagal mengambil summary SE monthly',
      },
      { status: 500 },
    )
  }
}

