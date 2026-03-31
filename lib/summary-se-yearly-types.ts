/** Tipe respons `GET /api/summary/se-yearly` — dipakai Summary Dashboard & Dashboard Finansial. */

export type PivotRow = {
  label: string
  monthly: {
    month: number
    sum: number
  }[]
}

export type PivotSection = {
  title: string
  groups: {
    title: string
    rows: PivotRow[]
  }[]
}

export type RollupMetric = {
  actual: number
  target: number
  achievement_pct: number | null
}

export type TargetsPayload = {
  bySourceId: Record<string, number>
  rollup: {
    total_se: RollupMetric
    total_fundraising: RollupMetric
    penerimaan_lainnya: RollupMetric
    grand_total: RollupMetric
  }
}

export type PivotResponse = {
  success: boolean
  year: number
  months: {
    month: number
    label: string
  }[]
  sections: PivotSection[]
  targets?: TargetsPayload
}

export function formatRupiah(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

export function formatAchievementPct(pct: number | null | undefined): string {
  if (pct == null || Number.isNaN(pct)) return '—'
  return `${pct}%`
}
