import { NextRequest, NextResponse } from 'next/server'
import { queryFinsTotals, type FinsTotalsFilters } from '@/lib/fins-totals'

export const dynamic = 'force-dynamic'

function pickFiltersFromUrl(url: URL): Partial<FinsTotalsFilters> {
  const sp = url.searchParams
  const group_by = sp.get('group_by')
  const type = sp.get('type')

  const yearRaw = sp.get('year')
  const year = yearRaw ? Number(yearRaw) : undefined

  return {
    type: (type as any) || undefined,
    group_by: (group_by === 'monthly' || group_by === 'yearly' ? group_by : null) as any,
    tgl_awal: sp.get('tgl_awal') || undefined,
    tgl_akhir: sp.get('tgl_akhir') || undefined,
    year: Number.isFinite(year as any) ? year : undefined,
    approve: sp.get('approve') || undefined,
    id_program: sp.get('id_program') || undefined,
    id_kantor: sp.get('id_kantor') || undefined,
    only_coa_debet: sp.get('only_coa_debet') || undefined,
    exclude_coa_debet: sp.get('exclude_coa_debet') || undefined,
    only_coa_kredit: sp.get('only_coa_kredit') || undefined,
    exclude_coa_kredit: sp.get('exclude_coa_kredit') || undefined,
    only_id_contact: sp.get('only_id_contact') || undefined,
    exclude_id_contact: sp.get('exclude_id_contact') || undefined,
  }
}

function validate(filters: Partial<FinsTotalsFilters>): { ok: true; filters: FinsTotalsFilters } | { ok: false; error: string } {
  const t = filters.type
  if (t !== 'expend' && t !== 'receipt') {
    return { ok: false, error: 'Parameter type wajib diisi (expend / receipt)' }
  }
  return { ok: true, filters: { ...(filters as any), type: t } }
}

async function handle(filters: Partial<FinsTotalsFilters>) {
  const v = validate(filters)
  if (!v.ok) {
    return NextResponse.json({ status: false, message: v.error }, { status: 400 })
  }

  const result = await queryFinsTotals(v.filters)
  return NextResponse.json(result, { status: 200 })
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    return await handle(pickFiltersFromUrl(url))
  } catch (error: any) {
    console.error('Error /api/fins/totals:', error)
    return NextResponse.json(
      { status: false, message: error?.message || 'Gagal mengambil fins totals' },
      { status: 500 },
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const body = await req.json().catch(() => ({}))
    const merged = {
      ...pickFiltersFromUrl(url),
      ...(body && typeof body === 'object' ? body : {}),
    }
    return await handle(merged)
  } catch (error: any) {
    console.error('Error /api/fins/totals (POST):', error)
    return NextResponse.json(
      { status: false, message: error?.message || 'Gagal mengambil fins totals' },
      { status: 500 },
    )
  }
}

