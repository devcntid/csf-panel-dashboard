import { applyZainsFinsTotalsContactFilters } from '@/lib/zains-fins-totals'
import { queryFinsTotals, type FinsTotalsGroupBy } from '@/lib/fins-totals'

export type ZainsSourceFilters = {
  onlyCoaDebet: string[]
  onlyCoaKredit: string[]
  onlyIdContact?: string[]
  excludeIdContact?: string[]
  idKantor?: string
}

function buildSearchParamsFromFilters(base: {
  type: 'receipt' | 'expend'
  tgl_awal?: string
  tgl_akhir?: string
  group_by?: FinsTotalsGroupBy
  year?: number
  filters: ZainsSourceFilters
}): URLSearchParams {
  const searchParams = new URLSearchParams()
  searchParams.set('type', base.type)
  if (base.tgl_awal) searchParams.set('tgl_awal', base.tgl_awal)
  if (base.tgl_akhir) searchParams.set('tgl_akhir', base.tgl_akhir)
  if (base.group_by) searchParams.set('group_by', base.group_by)
  if (base.year != null && Number.isFinite(base.year)) {
    searchParams.set('year', String(base.year))
  }

  if (base.filters.onlyCoaDebet.length > 0) {
    searchParams.set('only_coa_debet', base.filters.onlyCoaDebet.join(','))
  }
  if (base.filters.onlyCoaKredit.length > 0) {
    searchParams.set('only_coa_kredit', base.filters.onlyCoaKredit.join(','))
  }
  if (base.filters.idKantor && base.filters.idKantor.trim()) {
    searchParams.set('id_kantor', base.filters.idKantor.trim())
  }

  applyZainsFinsTotalsContactFilters(
    searchParams,
    base.filters.onlyIdContact ?? [],
    base.filters.excludeIdContact ?? [],
  )

  return searchParams
}

export async function fetchZainsRangeSum(params: {
  type: 'receipt' | 'expend'
  tgl_awal: string
  tgl_akhir: string
  filters: ZainsSourceFilters
}): Promise<number> {
  const searchParams = buildSearchParamsFromFilters({
    type: params.type,
    tgl_awal: params.tgl_awal,
    tgl_akhir: params.tgl_akhir,
    filters: params.filters,
  })

  const json: any = await queryFinsTotals({
    type: params.type,
    group_by: null,
    tgl_awal: params.tgl_awal,
    tgl_akhir: params.tgl_akhir,
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

  const data = json?.data
  if (
    json?.status === false &&
    !(data && typeof data.sum === 'number') &&
    !(json?.grand_total && typeof json.grand_total.sum === 'number')
  ) {
    return 0
  }

  if (data && typeof data.sum === 'number') return Number(data.sum)
  if (json?.grand_total && typeof json.grand_total.sum === 'number') return Number(json.grand_total.sum)
  return 0
}

export async function fetchZainsRangeNetSum(params: {
  // receipt - expend (swap COA lists for expend similar to se-yearly)
  tgl_awal: string
  tgl_akhir: string
  filters: ZainsSourceFilters
}): Promise<number> {
  const [receipt, expend] = await Promise.all([
    fetchZainsRangeSum({ type: 'receipt', tgl_awal: params.tgl_awal, tgl_akhir: params.tgl_akhir, filters: params.filters }),
    fetchZainsRangeSum({
      type: 'expend',
      tgl_awal: params.tgl_awal,
      tgl_akhir: params.tgl_akhir,
      filters: {
        ...params.filters,
        onlyCoaDebet: params.filters.onlyCoaKredit,
        onlyCoaKredit: params.filters.onlyCoaDebet,
      },
    }),
  ])
  return receipt - expend
}

export type ZainsGroupedSeries = {
  labels: string[]
  buckets: { key: string; label: string; tgl_awal: string; tgl_akhir: string }[]
  values: number[]
}

export async function fetchZainsGroupedTotals(params: {
  type: 'receipt' | 'expend'
  group_by: Exclude<FinsTotalsGroupBy, null>
  year?: number
  /** Jika keduanya diisi (mis. daily dalam rentang), `year` tidak dikirim ke Zains agar tidak bentrok filter. */
  tgl_awal?: string
  tgl_akhir?: string
  filters: ZainsSourceFilters
}): Promise<ZainsGroupedSeries> {
  const rangeMode = Boolean(params.tgl_awal?.trim() && params.tgl_akhir?.trim())
  const yearForQuery = rangeMode ? undefined : params.year

  const searchParams = buildSearchParamsFromFilters({
    type: params.type,
    group_by: params.group_by,
    year: yearForQuery,
    tgl_awal: params.tgl_awal,
    tgl_akhir: params.tgl_akhir,
    filters: params.filters,
  })

  const json: any = await queryFinsTotals({
    type: params.type,
    group_by: params.group_by,
    year: yearForQuery,
    tgl_awal: rangeMode ? params.tgl_awal : undefined,
    tgl_akhir: rangeMode ? params.tgl_akhir : undefined,
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

  const rows: any[] = Array.isArray(json?.data) ? json.data : []

  const labels: string[] = []
  const buckets: { key: string; label: string; tgl_awal: string; tgl_akhir: string }[] = []
  const values: number[] = []

  for (const row of rows) {
    if (params.group_by === 'daily') {
      const date = String(row.date ?? row.tanggal ?? row.tgl ?? row.tgl_trans ?? '')
      const sum = Number(row.sum ?? 0)
      labels.push(date)
      buckets.push({
        key: date,
        label: date,
        tgl_awal: date,
        tgl_akhir: date,
      })
      values.push(sum)
    } else if (params.group_by === 'weekly') {
      const label = String(row.week_label ?? `W${row.week ?? ''}`)
      const start = String(row.start_date ?? '')
      const end = String(row.end_date ?? '')
      const sum = Number(row.sum ?? 0)
      labels.push(label)
      buckets.push({
        key: label,
        label,
        tgl_awal: start,
        tgl_akhir: end,
      })
      values.push(sum)
    } else if (params.group_by === 'quarterly') {
      const label = String(row.quarter_label ?? `Q${row.quarter ?? ''}`)
      const start = String(row.start_date ?? '')
      const end = String(row.end_date ?? '')
      const sum = Number(row.sum ?? 0)
      labels.push(label)
      buckets.push({
        key: label,
        label,
        tgl_awal: start,
        tgl_akhir: end,
      })
      values.push(sum)
    } else if (params.group_by === 'monthly') {
      // fallback jika suatu saat dipakai untuk monthly
      const monthName = row.month_name ?? row.label ?? row.month
      const label = String(monthName)
      const sum = Number(row.sum ?? 0)
      labels.push(label)
      buckets.push({
        key: label,
        label,
        tgl_awal: '', // tidak tersedia dari response sekarang
        tgl_akhir: '',
      })
      values.push(sum)
    } else if (params.group_by === 'yearly') {
      const y = Number(row.year ?? 0)
      const sum = Number(row.sum ?? 0)
      const label = String(y)
      labels.push(label)
      buckets.push({
        key: label,
        label,
        tgl_awal: '',
        tgl_akhir: '',
      })
      values.push(sum)
    }
  }

  return { labels, buckets, values }
}

export function normalizeFinsDailyDateKey(raw: string): string {
  const s = String(raw ?? '').trim()
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(s)
  return m ? m[1] : s.slice(0, 10)
}

/** Samakan seri daily dari API (mungkin sparse) ke daftar tanggal ISO penuh. */
export function alignGroupedDailyToDates(grouped: ZainsGroupedSeries, isoDates: string[]): number[] {
  const map = new Map<string, number>()
  for (let i = 0; i < grouped.labels.length; i++) {
    const k = normalizeFinsDailyDateKey(String(grouped.labels[i]))
    map.set(k, (map.get(k) ?? 0) + Number(grouped.values[i] || 0))
  }
  return isoDates.map((iso) => map.get(iso) ?? 0)
}
