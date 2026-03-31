import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getZainsSummaryConcurrency, runPool } from '@/lib/zains-fetch-retry'
import { buildBuckets } from '@/lib/financial-time-buckets'
import { fetchZainsRangeSum } from '@/lib/zains-series'
import { parseCommaSeparatedIds } from '@/lib/zains-fins-totals'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const yearParam = url.searchParams.get('year')
    const now = new Date()
    const year = yearParam ? Number(yearParam) || now.getFullYear() : now.getFullYear()

    const buckets = buildBuckets({ period: 'monthly', year })
    const labels = buckets.map((b) => b.label)

    const sources = (await sql`
      SELECT id, name, slug, category, coa_debet, coa_kredit, only_id_contact, exclude_id_contact
      FROM sources
      ORDER BY COALESCE(summary_order, 9999), name
    `) as any[]
    const sourceRows = Array.isArray(sources) ? sources : []
    const seClinicSource = sourceRows.find(
      (s: any) => String(s.slug || '').trim() === 'se_klinik' || String(s.name || '').trim() === 'SE Klinik',
    )

    if (!seClinicSource) {
      return NextResponse.json({ success: false, message: 'Source SE Klinik belum terkonfigurasi' }, { status: 400 })
    }

    const clinics = (await sql`
      SELECT id, name, summary_alias, include_in_se_summary, kode_coa, se_receipt_coa_debet, se_receipt_coa_kredit, id_kantor_zains
      FROM clinics
      WHERE is_active = true
      ORDER BY COALESCE(summary_order, 9999), name
    `) as any[]
    const clinicRows = (Array.isArray(clinics) ? clinics : []).filter((c: any) => c.include_in_se_summary !== false)

    const defaultCoaKredit = String((seClinicSource as any).coa_kredit || '')
    const clinicOnlyIdContact = parseCommaSeparatedIds((seClinicSource as any).only_id_contact)
    const clinicExcludeIdContact = parseCommaSeparatedIds((seClinicSource as any).exclude_id_contact)

    const concurrency = getZainsSummaryConcurrency()

    const topClinics = await runPool(clinicRows, concurrency, async (c: any) => {
      const clinicId = Number(c.id || 0)
      const clinicName = String(c.summary_alias || c.name || clinicId)

      const clinicDebetListRaw: string | null = c.se_receipt_coa_debet ?? null
      const onlyCoaDebet =
        clinicDebetListRaw && clinicDebetListRaw.trim().length > 0
          ? clinicDebetListRaw.split(',').map((s) => s.trim()).filter(Boolean)
          : c.kode_coa
            ? [String(c.kode_coa)]
            : []

      const clinicKreditListRaw: string | null = c.se_receipt_coa_kredit ?? null
      const onlyCoaKredit =
        clinicKreditListRaw && clinicKreditListRaw.trim().length > 0
          ? clinicKreditListRaw.split(',').map((s: string) => s.trim()).filter(Boolean)
          : defaultCoaKredit
            ? String(defaultCoaKredit)
                .split(',')
                .map((s: string) => s.trim())
                .filter(Boolean)
            : []

      const idKantor =
        c.id_kantor_zains != null && String(c.id_kantor_zains).trim() !== '' ? String(c.id_kantor_zains).trim() : undefined

      const filters = {
        onlyCoaDebet,
        onlyCoaKredit,
        onlyIdContact: clinicOnlyIdContact,
        excludeIdContact: clinicExcludeIdContact,
        idKantor,
      }

      const values: number[] = []
      for (const b of buckets) {
        const v = await fetchZainsRangeSum({ type: 'receipt', tgl_awal: b.tgl_awal, tgl_akhir: b.tgl_akhir, filters })
        values.push(v)
      }

      const total = values.reduce((s, v) => s + v, 0)

      return { clinic_id: clinicId, clinic_name: clinicName, values, total }
    })

    const sorted = [...topClinics].sort((a, b) => b.total - a.total)
    const selected = sorted.slice(0, 7)

    const matrix: number[][] = selected.map((c) => c.values)

    return NextResponse.json(
      {
        success: true,
        year,
        labels,
        clinics: selected.map((c) => ({ id: c.clinic_id, name: c.clinic_name })),
        matrix,
      },
      { status: 200 },
    )
  } catch (error: any) {
    console.error('Error financial clinic-heatmap:', error)
    return NextResponse.json(
      { success: false, message: error?.message || 'Gagal mengambil growth heatmap klinik' },
      { status: 500 },
    )
  }
}

