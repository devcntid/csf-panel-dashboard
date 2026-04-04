import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getZainsSummaryConcurrency, runPool } from '@/lib/zains-fetch-retry'
import {
  buildBuckets,
  buildDayBuckets,
  countDaysInclusive,
  FINANCIAL_RANGE_MAX_DAYS,
  type TimePeriod,
  type DateBucket,
} from '@/lib/financial-time-buckets'
import {
  fetchZainsRangeSum,
  fetchZainsGroupedTotals,
  type ZainsGroupedSeries,
  type ZainsSourceFilters,
} from '@/lib/zains-series'
import { parseCommaSeparatedIds } from '@/lib/zains-fins-totals'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

type Series = { key: string; label: string; values: number[] }

function splitCoa(raw: unknown): string[] {
  if (typeof raw !== 'string') return []
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function normSlug(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim() : ''
}

function normName(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim() : ''
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const yearParam = url.searchParams.get('year')
    const periodParam = url.searchParams.get('period') as TimePeriod | null
    const tglAwalQ = url.searchParams.get('tgl_awal')?.trim() ?? ''
    const tglAkhirQ = url.searchParams.get('tgl_akhir')?.trim() ?? ''

    const now = new Date()
    let year = yearParam ? Number(yearParam) || now.getFullYear() : now.getFullYear()
    let period: TimePeriod =
      periodParam === 'daily' || periodParam === 'weekly' || periodParam === 'monthly' || periodParam === 'quarterly' || periodParam === 'yearly'
        ? periodParam
        : 'monthly'

    let rangeDayBuckets: DateBucket[] | null = null
    let rangeTglAwal: string | null = null
    let rangeTglAkhir: string | null = null

    if (tglAwalQ && tglAkhirQ && ISO_DATE_RE.test(tglAwalQ) && ISO_DATE_RE.test(tglAkhirQ)) {
      const n = countDaysInclusive(tglAwalQ, tglAkhirQ)
      if (n <= 0) {
        return NextResponse.json(
          { success: false, message: 'Rentang tanggal tidak valid (tgl_awal harus ≤ tgl_akhir).' },
          { status: 400 },
        )
      }
      if (n > FINANCIAL_RANGE_MAX_DAYS) {
        return NextResponse.json(
          {
            success: false,
            message: `Rentang terlalu panjang (maksimal ${FINANCIAL_RANGE_MAX_DAYS} hari).`,
          },
          { status: 400 },
        )
      }
      rangeDayBuckets = buildDayBuckets(tglAwalQ, tglAkhirQ)
      rangeTglAwal = tglAwalQ
      rangeTglAkhir = tglAkhirQ
      period = 'daily'
      year = Number(tglAkhirQ.slice(0, 4)) || year
    }

    const sources = (await sql`
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
    `) as any[]

    const sourceRows = Array.isArray(sources) ? sources : []

    const seClinicSource = sourceRows.find((s: any) => normSlug(s.slug) === 'se_klinik' || normName(s.name) === 'SE Klinik')
    const seAmbulanceSource = sourceRows.find(
      (s: any) => normSlug(s.slug) === 'se_ambulance' || normName(s.name) === 'SE Ambulance',
    )
    const fundraisingProjectSource = sourceRows.find(
      (s: any) => normSlug(s.slug) === 'fundraising_project' || normName(s.name) === 'Fundraising Project',
    )
    const fundraisingDigitalSource = sourceRows.find(
      (s: any) => normSlug(s.slug) === 'fundraising_digital' || normName(s.name) === 'Fundraising Digital',
    )
    const penerimaanLainnyaSource = sourceRows.find(
      (s: any) => normSlug(s.slug) === 'penerimaan_lainnya' || normName(s.name) === 'Penerimaan Lainnya',
    )

    // Rentang kustom: agregasi per hari via fetchZainsRangeSum (sama seperti heatmap) —
    // group_by=daily + tgl_awal/akhir di API Zains sering kosong/salah format sehingga angka 0.
    const usePerDayBucketFetch = Boolean(rangeDayBuckets?.length)
    const useGrouped =
      !usePerDayBucketFetch &&
      (period === 'daily' || period === 'weekly' || period === 'quarterly' || period === 'yearly')
    const buckets: DateBucket[] = rangeDayBuckets ?? (useGrouped ? [] : buildBuckets({ period, year }))
    const labelsFromBuckets = useGrouped && !rangeDayBuckets ? [] : buckets.map((b) => b.label)

    type Task = {
      key: string
      label: string
      kind: 'receipt'
      filters: ZainsSourceFilters
    }

    const tasks: Task[] = []

    // SE Klinik (agregat semua klinik) HARUS mengikuti pivot: hitung per klinik lalu di-sum.
    // (Tidak pakai agregat COA source langsung karena akan mismatch vs Summary Dashboard)
    const clinicRows = seClinicSource
      ? ((await sql`
          SELECT id, name, summary_alias, include_in_se_summary, kode_coa, se_receipt_coa_debet, se_receipt_coa_kredit, id_kantor_zains
          FROM clinics
          WHERE is_active = true
          ORDER BY COALESCE(summary_order, 9999), name
        `) as any[])
      : []

    if (seAmbulanceSource) {
      tasks.push({
        key: 'se_ambulance',
        label: 'SE Ambulance',
        kind: 'receipt',
        filters: {
          onlyCoaDebet: splitCoa((seAmbulanceSource as any).coa_debet),
          onlyCoaKredit: splitCoa((seAmbulanceSource as any).coa_kredit),
          onlyIdContact: parseCommaSeparatedIds((seAmbulanceSource as any).only_id_contact),
          excludeIdContact: parseCommaSeparatedIds((seAmbulanceSource as any).exclude_id_contact),
        },
      })
    }

    if (fundraisingProjectSource) {
      tasks.push({
        key: 'fundraising_project',
        label: 'Fundraising Project',
        kind: 'receipt',
        filters: {
          onlyCoaDebet: splitCoa((fundraisingProjectSource as any).coa_debet),
          onlyCoaKredit: splitCoa((fundraisingProjectSource as any).coa_kredit),
          onlyIdContact: parseCommaSeparatedIds((fundraisingProjectSource as any).only_id_contact),
          excludeIdContact: parseCommaSeparatedIds((fundraisingProjectSource as any).exclude_id_contact),
        },
      })
    }

    if (fundraisingDigitalSource) {
      tasks.push({
        key: 'fundraising_digital',
        label: 'Fundraising Digital',
        kind: 'receipt',
        filters: {
          onlyCoaDebet: splitCoa((fundraisingDigitalSource as any).coa_debet),
          onlyCoaKredit: splitCoa((fundraisingDigitalSource as any).coa_kredit),
          onlyIdContact: parseCommaSeparatedIds((fundraisingDigitalSource as any).only_id_contact),
          excludeIdContact: parseCommaSeparatedIds((fundraisingDigitalSource as any).exclude_id_contact),
        },
      })
    }

    if (penerimaanLainnyaSource) {
      tasks.push({
        key: 'penerimaan_lainnya',
        label: 'Penerimaan Lainnya',
        kind: 'receipt',
        filters: {
          onlyCoaDebet: splitCoa((penerimaanLainnyaSource as any).coa_debet),
          onlyCoaKredit: splitCoa((penerimaanLainnyaSource as any).coa_kredit),
          onlyIdContact: parseCommaSeparatedIds((penerimaanLainnyaSource as any).only_id_contact),
          excludeIdContact: parseCommaSeparatedIds((penerimaanLainnyaSource as any).exclude_id_contact),
        },
      })
    }

    const concurrency = getZainsSummaryConcurrency()
    const otherSeriesResults = await runPool(tasks, concurrency, async (t) => {
      let grouped: ZainsGroupedSeries | null = null

      if (useGrouped) {
        grouped = await fetchZainsGroupedTotals({
          type: 'receipt',
          group_by: period,
          year: period === 'yearly' ? undefined : year,
          filters: t.filters,
        })
      }

      const values = useGrouped
        ? grouped?.values ?? []
        : await Promise.all(
            buckets.map(async (b) => {
              return await fetchZainsRangeSum({
                type: 'receipt',
                tgl_awal: b.tgl_awal,
                tgl_akhir: b.tgl_akhir,
                filters: t.filters,
              })
            }),
          )

      return {
        key: t.key,
        label: t.label,
        values,
        // hanya dikembalikan untuk path grouped; dipakai nanti untuk labels/buckets
        _groupedMeta: grouped,
      } as Series & { _groupedMeta?: ZainsGroupedSeries | null }
    })

    // Build SE Klinik series (sum per klinik)
    let seKlinikMeta: ZainsGroupedSeries | null = null
    let seKlinikValues: number[] = []

    if (seClinicSource) {
      const defaultCoaKredit = splitCoa((seClinicSource as any).coa_kredit)
      const clinicOnlyIdContact = parseCommaSeparatedIds((seClinicSource as any).only_id_contact)
      const clinicExcludeIdContact = parseCommaSeparatedIds((seClinicSource as any).exclude_id_contact)

      const clinics = (Array.isArray(clinicRows) ? clinicRows : []).filter((c: any) => c.include_in_se_summary !== false)

      type ClinicResult = { meta: ZainsGroupedSeries | null; values: number[] }
      const perClinic = await runPool(clinics, concurrency, async (c: any) => {
        const clinicDebetListRaw: string | null = c.se_receipt_coa_debet ?? null
        const onlyCoaDebet =
          clinicDebetListRaw && String(clinicDebetListRaw).trim().length > 0
            ? splitCoa(clinicDebetListRaw)
            : c.kode_coa
              ? [String(c.kode_coa)]
              : []

        const clinicKreditListRaw: string | null = c.se_receipt_coa_kredit ?? null
        const onlyCoaKredit =
          clinicKreditListRaw && String(clinicKreditListRaw).trim().length > 0 ? splitCoa(clinicKreditListRaw) : defaultCoaKredit

        const idKantor =
          c.id_kantor_zains != null && String(c.id_kantor_zains).trim() !== '' ? String(c.id_kantor_zains).trim() : undefined

        const filters: ZainsSourceFilters = {
          onlyCoaDebet,
          onlyCoaKredit,
          onlyIdContact: clinicOnlyIdContact,
          excludeIdContact: clinicExcludeIdContact,
          idKantor,
        }

        if (useGrouped) {
          const meta = await fetchZainsGroupedTotals({
            type: 'receipt',
            group_by: period,
            year: period === 'yearly' ? undefined : year,
            filters,
          })
          return { meta, values: meta.values } satisfies ClinicResult
        }

        const values = await Promise.all(
          buckets.map(async (b) => {
            return await fetchZainsRangeSum({ type: 'receipt', tgl_awal: b.tgl_awal, tgl_akhir: b.tgl_akhir, filters })
          }),
        )
        return { meta: null, values } satisfies ClinicResult
      })

      const firstWithMeta = perClinic.find((x) => x.meta && x.meta.labels.length > 0) ?? null
      seKlinikMeta = usePerDayBucketFetch ? null : firstWithMeta?.meta ?? null

      const baseLen = useGrouped ? seKlinikMeta?.values.length ?? 0 : buckets.length
      seKlinikValues = Array.from({ length: baseLen }, () => 0)
      for (const c of perClinic) {
        for (let i = 0; i < seKlinikValues.length; i++) {
          seKlinikValues[i] += Number(c.values[i] || 0)
        }
      }
    }

    const seriesResults = [
      ...(seKlinikValues.length > 0
        ? ([
            {
              key: 'se_klinik',
              label: 'SE Klinik',
              values: seKlinikValues,
              _groupedMeta: seKlinikMeta,
            },
          ] as Array<Series & { _groupedMeta?: ZainsGroupedSeries | null }>)
        : []),
      ...(otherSeriesResults as any[]),
    ] as Array<Series & { _groupedMeta?: ZainsGroupedSeries | null }>

    const totalsByIdx = (idx: number) => seriesResults.reduce((s, x) => s + Number(x.values[idx] || 0), 0)

    let labels = labelsFromBuckets
    let effectiveBuckets: DateBucket[] = buckets

    if (rangeDayBuckets) {
      labels = rangeDayBuckets.map((b) => b.label)
      effectiveBuckets = rangeDayBuckets
    } else if (useGrouped) {
      const withMeta = (seriesResults as any[]).find((s) => s._groupedMeta)
      const firstMeta = (withMeta ? withMeta._groupedMeta : null) as ZainsGroupedSeries | null
      labels = firstMeta?.labels ?? []
      effectiveBuckets =
        firstMeta?.buckets?.map((b) => ({
          key: b.key,
          label: b.label,
          tgl_awal: b.tgl_awal,
          tgl_akhir: b.tgl_akhir,
        })) ?? []
    }

    const baseLen = useGrouped ? labels.length : buckets.length
    const idxs = Array.from({ length: baseLen }, (_, i) => i)

    const totalSE = seriesResults
      .filter((s) => s.key === 'se_klinik' || s.key === 'se_ambulance')
      .map((s) => s.values)
    const totalFundraising = seriesResults
      .filter((s) => s.key === 'fundraising_project' || s.key === 'fundraising_digital')
      .map((s) => s.values)
    const penerimaanLainnya =
      seriesResults.find((s) => s.key === 'penerimaan_lainnya')?.values ?? idxs.map(() => 0)

    const sumVectors = (vectors: number[][]): number[] =>
      idxs.map((i) => vectors.reduce((acc, v) => acc + Number(v[i] || 0), 0))

    const totalSEValues = sumVectors(totalSE)
    const totalFundraisingValues = sumVectors(totalFundraising)
    const grandTotalValues = sumVectors([totalSEValues, totalFundraisingValues, penerimaanLainnya])

    const series: Series[] = [
      ...seriesResults,
      { key: 'total_se', label: 'TOTAL SE', values: totalSEValues },
      { key: 'total_fundraising', label: 'TOTAL FUNDRAISING', values: totalFundraisingValues },
      { key: 'grand_total', label: 'GRAND TOTAL', values: grandTotalValues },
    ]

    return NextResponse.json(
      {
        success: true,
        year,
        period,
        tgl_awal: rangeTglAwal,
        tgl_akhir: rangeTglAkhir,
        labels,
        buckets: effectiveBuckets,
        series,
        totals: {
          // total across all buckets
          total_se: totalSEValues.reduce((s, v) => s + v, 0),
          total_fundraising: totalFundraisingValues.reduce((s, v) => s + v, 0),
          penerimaan_lainnya: penerimaanLainnya.reduce((s, v) => s + v, 0),
          grand_total: grandTotalValues.reduce((s, v) => s + v, 0),
          raw_all_sources: idxs.map((i) => totalsByIdx(i)),
        },
      },
      { status: 200 },
    )
  } catch (error: any) {
    console.error('Error financial time-tracker:', error)
    return NextResponse.json(
      { success: false, message: error?.message || 'Gagal mengambil time tracker' },
      { status: 500 },
    )
  }
}

