import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getZainsSummaryConcurrency, runPool } from '@/lib/zains-fetch-retry'
import { buildBuckets, type TimePeriod } from '@/lib/financial-time-buckets'
import { fetchZainsRangeSum } from '@/lib/zains-series'
import { parseCommaSeparatedIds } from '@/lib/zains-fins-totals'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

function splitCoa(raw: unknown): string[] {
  if (typeof raw !== 'string') return []
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const yearParam = url.searchParams.get('year')
    const periodParam = url.searchParams.get('period') as TimePeriod | null
    const bucketIdxParam = url.searchParams.get('bucket_idx')

    const now = new Date()
    const year = yearParam ? Number(yearParam) || now.getFullYear() : now.getFullYear()
    const period: TimePeriod =
      periodParam === 'daily' || periodParam === 'weekly' || periodParam === 'monthly' || periodParam === 'quarterly'
        ? periodParam
        : 'monthly'

    const buckets = buildBuckets({ period, year })

    const defaultBucketIdx = (() => {
      // Jika tahun yang dipilih adalah tahun berjalan, pilih bucket yang relevan (bukan otomatis bucket terakhir = Des/Q4 yang sering 0).
      if (year === now.getFullYear()) {
        if (period === 'monthly') return Math.max(0, Math.min(11, now.getMonth()))
        if (period === 'quarterly') return Math.max(0, Math.min(3, Math.floor(now.getMonth() / 3)))
        // daily/weekly dari buildBuckets memang \"ending current\", jadi bucket terakhir ok.
      }
      return buckets.length - 1
    })()

    const bucketIdx = bucketIdxParam
      ? Math.max(0, Math.min(buckets.length - 1, Number(bucketIdxParam)))
      : defaultBucketIdx
    const curr = buckets[bucketIdx]
    const prev = buckets[Math.max(0, bucketIdx - 1)]

    // Untuk monthly, samakan skala dengan chart monthly/pivot: gunakan YTD (Jan -> akhir bucket).
    const currRange =
      period === 'monthly'
        ? { tgl_awal: `${year}-01-01`, tgl_akhir: curr.tgl_akhir }
        : { tgl_awal: curr.tgl_awal, tgl_akhir: curr.tgl_akhir }
    // NOTE: value_prev hanya untuk growth_pct; gunakan "bulan sebelumnya" untuk perbandingan yang stabil.
    const prevRange =
      period === 'monthly'
        ? { tgl_awal: prev.tgl_awal, tgl_akhir: prev.tgl_akhir }
        : { tgl_awal: prev.tgl_awal, tgl_akhir: prev.tgl_akhir }

    const sources = (await sql`
      SELECT id, name, slug, category, coa_debet, coa_kredit, only_id_contact, exclude_id_contact
      FROM sources
      ORDER BY COALESCE(summary_order, 9999), name
    `) as any[]
    const sourceRows = Array.isArray(sources) ? sources : []
    const seClinicSource = sourceRows.find((s: any) => String(s.slug || '').trim() === 'se_klinik' || String(s.name || '').trim() === 'SE Klinik')

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

    const defaultCoaKredit = splitCoa((seClinicSource as any).coa_kredit)
    const clinicOnlyIdContact = parseCommaSeparatedIds((seClinicSource as any).only_id_contact)
    const clinicExcludeIdContact = parseCommaSeparatedIds((seClinicSource as any).exclude_id_contact)

    type Row = {
      clinic_id: number
      clinic_name: string
      value_curr: number
      value_prev: number
      delta: number
      growth_pct: number | null
    }

    const concurrency = getZainsSummaryConcurrency()
    const rows = await runPool(clinicRows, concurrency, async (c: any) => {
      const clinicId = Number(c.id || 0)
      const clinicName = String(c.summary_alias || c.name || clinicId)

      const clinicDebetListRaw: string | null = c.se_receipt_coa_debet ?? null
      const onlyCoaDebet =
        clinicDebetListRaw && clinicDebetListRaw.trim().length > 0
          ? splitCoa(clinicDebetListRaw)
          : c.kode_coa
            ? [String(c.kode_coa)]
            : []

      const clinicKreditListRaw: string | null = c.se_receipt_coa_kredit ?? null
      const onlyCoaKredit =
        clinicKreditListRaw && clinicKreditListRaw.trim().length > 0 ? splitCoa(clinicKreditListRaw) : defaultCoaKredit

      const idKantor =
        c.id_kantor_zains != null && String(c.id_kantor_zains).trim() !== '' ? String(c.id_kantor_zains).trim() : undefined

      const filters = {
        onlyCoaDebet,
        onlyCoaKredit,
        onlyIdContact: clinicOnlyIdContact,
        excludeIdContact: clinicExcludeIdContact,
        idKantor,
      }

      const [value_curr, value_prev] = await Promise.all([
        fetchZainsRangeSum({ type: 'receipt', tgl_awal: currRange.tgl_awal, tgl_akhir: currRange.tgl_akhir, filters }),
        fetchZainsRangeSum({ type: 'receipt', tgl_awal: prevRange.tgl_awal, tgl_akhir: prevRange.tgl_akhir, filters }),
      ])

      const delta = value_curr - value_prev
      const denom = Math.abs(value_prev)
      const growth_pct = denom > 0 ? Math.round(((delta / denom) * 100) * 10) / 10 : null

      const r: Row = {
        clinic_id: clinicId,
        clinic_name: clinicName,
        value_curr,
        value_prev,
        delta,
        growth_pct,
      }
      return r
    })

    const valid = rows.filter((r) => Number.isFinite(r.value_curr))
    // Urutkan berdasarkan capaian revenue SE Klinik (value_curr) terbesar ke terkecil
    const sorted = [...valid].sort((a, b) => b.value_curr - a.value_curr)

    const top = sorted.slice(0, 10)
    const bottom: Row[] = []

    return NextResponse.json(
      {
        success: true,
        year,
        period,
        bucket: {
          idx: bucketIdx,
          label: curr.label,
          tgl_awal: curr.tgl_awal,
          tgl_akhir: curr.tgl_akhir,
        },
        compare_to: {
          idx: Math.max(0, bucketIdx - 1),
          label: prev.label,
          tgl_awal: prev.tgl_awal,
          tgl_akhir: prev.tgl_akhir,
        },
        top,
        bottom,
      },
      { status: 200 },
    )
  } catch (error: any) {
    console.error('Error financial clinic-ranking:', error)
    return NextResponse.json(
      { success: false, message: error?.message || 'Gagal mengambil clinic ranking' },
      { status: 500 },
    )
  }
}

