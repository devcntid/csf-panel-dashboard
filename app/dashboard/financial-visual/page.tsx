'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import type { Plugin } from 'chart.js'
import {
  Chart as ChartJS,
  ArcElement,
  BarElement,
  CategoryScale,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
} from 'chart.js'
import { Doughnut, Line, Bar } from 'react-chartjs-2'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Building2, Clock, DollarSign, HandCoins, Layers3, RefreshCw, Table2, TrendingDown, TrendingUp } from 'lucide-react'
import type { PivotResponse } from '@/lib/summary-se-yearly-types'
import { formatAchievementPct, formatRupiah } from '@/lib/summary-se-yearly-types'
import { fetchSeYearlySummary, SE_YEARLY_MAX_ATTEMPTS } from '@/lib/fetch-se-yearly-summary'
import { findRowMonthly } from '@/lib/summary-pivot-helpers'
import { countDaysInclusive, FINANCIAL_RANGE_MAX_DAYS } from '@/lib/financial-time-buckets'

function formatCompactRpLabel(n: number): string {
  if (n == null || !Number.isFinite(n) || n <= 0) return ''
  const v = Math.abs(n)
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}M`
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}jt`
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}rb`
  return String(Math.round(v))
}

/** Label ringkas di atas tiap bar (dinonaktifkan jika terlalu banyak titik pada sumbu X). */
const trackerBarLabelsPlugin: Plugin = {
  id: 'trackerBarLabels',
  afterDatasetsDraw(chart) {
    const maxPts = (chart.options.plugins as any)?.trackerBarLabels?.maxLabelPoints ?? 48
    const n = chart.data.labels?.length ?? 0
    if (n > maxPts) return

    const ctx = chart.ctx
    const area = chart.chartArea
    if (!area) return

    ctx.save()
    ctx.beginPath()
    ctx.rect(area.left, area.top, area.right - area.left, area.bottom - area.top)
    ctx.clip()

    chart.data.datasets.forEach((dataset, di) => {
      if (dataset.type !== 'bar') return
      const meta = chart.getDatasetMeta(di)
      if (meta.hidden) return

      meta.data.forEach((el: any, i: number) => {
        if (!el) return
        const raw = dataset.data[i] as number
        const v = typeof raw === 'number' ? raw : Number(raw)
        const txt = formatCompactRpLabel(v)
        if (!txt) return
        const { x, y, base } = el.getProps(['x', 'y', 'base'], true)
        if (x == null || y == null) return
        const yTop = base != null ? Math.min(y, base) : y

        ctx.font = '600 8px system-ui,sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'bottom'
        ctx.fillStyle = '#475569'
        ctx.fillText(txt, x, yTop - 3)
      })
    })

    ctx.restore()
  },
}

ChartJS.register(
  ArcElement,
  BarElement,
  CategoryScale,
  Filler,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  trackerBarLabelsPlugin,
)

type TimePeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'

type TimeTrackerResponse = {
  success: boolean
  year: number
  period: TimePeriod
  tgl_awal?: string | null
  tgl_akhir?: string | null
  labels: string[]
  buckets?: { key: string; label: string; tgl_awal: string; tgl_akhir: string }[]
  series: { key: string; label: string; values: number[] }[]
  totals?: {
    total_se: number
    total_fundraising: number
    penerimaan_lainnya: number
    grand_total: number
  }
  message?: string
}

type ClinicRankingRow = {
  clinic_id: number
  clinic_name: string
  value_curr: number
  value_prev: number
  delta: number
  growth_pct: number | null
}

type ClinicRankingResponse = {
  success: boolean
  year: number
  period: TimePeriod
  bucket: { idx: number; label: string; tgl_awal: string; tgl_akhir: string }
  compare_to: { idx: number; label: string; tgl_awal: string; tgl_akhir: string }
  grand_total_curr?: number
  grand_total_prev?: number
  top: ClinicRankingRow[]
  bottom: ClinicRankingRow[]
  message?: string
}

type RevenueGrowthResponse = {
  success: boolean
  current_year: number
  years: { year: number; value: number }[]
  current: { year: number; value: number } | null
  previous: { year: number; value: number } | null
  growth_pct: number | null
  message?: string
}

type ClinicHeatmapResponse = {
  success: boolean
  year: number
  tgl_awal?: string
  tgl_akhir?: string
  granularity?: 'daily' | 'monthly'
  labels: string[]
  clinics: { id: number; name: string }[]
  matrix: number[][]
  message?: string
}

const CACHE_TTL_MS = 10 * 60 * 1000

function cacheGet<T>(key: string): T | null {
  try {
    const raw = sessionStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { t: number; v: T }
    if (!parsed || typeof parsed.t !== 'number') return null
    if (Date.now() - parsed.t > CACHE_TTL_MS) return null
    return parsed.v
  } catch {
    return null
  }
}

function cacheSet<T>(key: string, value: T) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), v: value }))
  } catch {
    // ignore quota / privacy mode
  }
}

async function fetchJsonCached<T>(key: string, url: string, opts?: { force?: boolean }): Promise<T> {
  if (!opts?.force) {
    const hit = cacheGet<T>(key)
    if (hit != null) return hit
  }
  const res = await fetch(url, { cache: 'no-store' })
  const json = (await res.json()) as T
  cacheSet(key, json)
  return json
}

function alignSeriesToMonths(
  months: { month: number }[],
  series: { month: number; sum: number }[] | null,
): number[] {
  const map = new Map<number, number>()
  for (const p of series ?? []) map.set(p.month, p.sum)
  return months.map((m) => map.get(m.month) ?? 0)
}

function toIsoLocalDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const TRACKER_BAR_KEYS = [
  'se_klinik',
  'se_ambulance',
  'fundraising_project',
  'fundraising_digital',
  'penerimaan_lainnya',
] as const

const TRACKER_BAR_META: Record<
  (typeof TRACKER_BAR_KEYS)[number],
  { label: string; color: string }
> = {
  se_klinik: { label: 'SE Klinik', color: '#0d9488' },
  se_ambulance: { label: 'SE Ambulance', color: '#10b981' },
  fundraising_project: { label: 'Fundraising Project', color: '#4f46e5' },
  fundraising_digital: { label: 'Fundraising Digital', color: '#6366f1' },
  penerimaan_lainnya: { label: 'Penerimaan Lainnya', color: '#f59e0b' },
}

/** Multi bar per kategori saja (tanpa GRAND TOTAL di chart). */
function buildTrackerComboChartData(params: {
  labels: string[]
  seriesList: { key: string; label: string; values: number[] }[]
}): { labels: string[]; datasets: any[] } | null {
  const { labels, seriesList } = params
  if (!labels.length) return null
  const byKey = new Map(seriesList.map((s) => [s.key, s] as const))
  const datasets: any[] = []
  const barOrder = 2

  for (const key of TRACKER_BAR_KEYS) {
    const meta = TRACKER_BAR_META[key]
    const s = byKey.get(key)
    if (!s) continue
    const data = labels.map((_, i) => Number(s.values[i] || 0))
    datasets.push({
      type: 'bar' as const,
      label: meta.label,
      data,
      backgroundColor: meta.color,
      borderColor: meta.color,
      borderWidth: 1,
      borderRadius: 3,
      order: barOrder,
    })
  }

  return { labels, datasets }
}

export default function FinancialVisualDashboardPage() {
  const now = new Date()
  const defaultRangeStart = toIsoLocalDate(new Date(now.getFullYear(), now.getMonth(), 1))

  const [filterMode, setFilterMode] = useState<'year' | 'range'>('year')
  const [appliedFilterMode, setAppliedFilterMode] = useState<'year' | 'range'>('year')
  const [appliedYear, setAppliedYear] = useState<number>(now.getFullYear())
  const [appliedRange, setAppliedRange] = useState<{ tgl_awal: string; tgl_akhir: string } | null>(null)

  const [year, setYear] = useState<number>(now.getFullYear())
  const [rangeStart, setRangeStart] = useState<string>(defaultRangeStart)
  const [rangeEnd, setRangeEnd] = useState<string>(toIsoLocalDate(now))
  const [applyHint, setApplyHint] = useState<string | null>(null)

  // Base (summary pivot + targets)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<PivotResponse | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [elapsedSec, setElapsedSec] = useState(0)
  const [forceRefresh, setForceRefresh] = useState(false)

  // Tracker + ranking
  const [period, setPeriod] = useState<TimePeriod>('monthly')
  const [periodDraft, setPeriodDraft] = useState<TimePeriod>('monthly')
  const rankingPeriod: TimePeriod = 'monthly'
  const [trackerLoading, setTrackerLoading] = useState(false)
  const [tracker, setTracker] = useState<TimeTrackerResponse | null>(null)
  const [trackerError, setTrackerError] = useState<string | null>(null)

  const [rankingLoading, setRankingLoading] = useState(false)
  const [ranking, setRanking] = useState<ClinicRankingResponse | null>(null)
  const [rankingError, setRankingError] = useState<string | null>(null)

  const [growth, setGrowth] = useState<RevenueGrowthResponse | null>(null)
  const [growthError, setGrowthError] = useState<string | null>(null)

  const [heatmapLoading, setHeatmapLoading] = useState(false)
  const [heatmap, setHeatmap] = useState<ClinicHeatmapResponse | null>(null)
  const [heatmapError, setHeatmapError] = useState<string | null>(null)

  useEffect(() => {
    if (!loading) return
    setElapsedSec(0)
    const t0 = Date.now()
    const id = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - t0) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [loading])

  const load = async (options?: { y?: number; isCancelled?: () => boolean; force?: boolean }) => {
    const y = options?.y ?? appliedYear
    const isCancelled = options?.isCancelled
    const hadExisting = data != null

    setLoading(true)
    setLoadError(null)
    setLoadAttempt(0)

    try {
      const cacheKey = `financial-visual:se-yearly:${y}`
      if (!options?.force) {
        const cached = cacheGet<PivotResponse>(cacheKey)
        if (cached) {
          setData(cached)
          setLoadError(null)
          return
        }
      }

      const result = await fetchSeYearlySummary(y, { isCancelled, onAttempt: (n) => setLoadAttempt(n) })

      if (isCancelled?.()) return

      if (result.ok) {
        setData(result.data)
        setLoadError(null)
        cacheSet(cacheKey, result.data)
        return
      }

      if (!hadExisting) setData(null)
      setLoadError(result.error)
    } finally {
      if (!isCancelled || !isCancelled()) setLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    load({ y: appliedYear, isCancelled: () => cancelled })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const growthYear =
    appliedFilterMode === 'range' && appliedRange
      ? Number(appliedRange.tgl_akhir.slice(0, 4)) || appliedYear
      : appliedYear

  const handleApplyMain = () => {
    setApplyHint(null)
    if (filterMode === 'range') {
      const n = countDaysInclusive(rangeStart, rangeEnd)
      if (n <= 0) {
        setApplyHint('Tanggal awal harus sebelum atau sama dengan tanggal akhir.')
        return
      }
      if (n > FINANCIAL_RANGE_MAX_DAYS) {
        setApplyHint(`Maksimal ${FINANCIAL_RANGE_MAX_DAYS} hari dalam satu rentang.`)
        return
      }
      setAppliedFilterMode('range')
      setAppliedRange({ tgl_awal: rangeStart, tgl_akhir: rangeEnd })
      setData(null)
      setLoadError(null)
      return
    }
    setAppliedFilterMode('year')
    setAppliedYear(year)
    setAppliedRange(null)
    load({ y: year })
  }

  useEffect(() => {
    let cancelled = false
    const isCancelled = () => cancelled

    async function loadTracker() {
      setTrackerLoading(true)
      setTrackerError(null)
      try {
        const sp =
          appliedFilterMode === 'range' && appliedRange
            ? new URLSearchParams({
                year: String(growthYear),
                period: 'daily',
                tgl_awal: appliedRange.tgl_awal,
                tgl_akhir: appliedRange.tgl_akhir,
              })
            : new URLSearchParams({ year: String(appliedYear), period })
        const key = `financial-visual:v3:time-tracker:${sp.toString()}`
        const json = await fetchJsonCached<TimeTrackerResponse>(key, `/api/financial/time-tracker?${sp.toString()}`, {
          force: forceRefresh,
        })
        if (isCancelled()) return
        if (json.success) {
          setTracker(json)
        } else {
          setTracker(null)
          setTrackerError(json?.message || 'Gagal memuat time tracker')
        }
      } catch (e: unknown) {
        if (!isCancelled()) {
          setTracker(null)
          setTrackerError(e instanceof Error ? e.message : 'Gagal memuat time tracker')
        }
      } finally {
        if (!isCancelled()) setTrackerLoading(false)
      }
    }

    async function loadRanking() {
      setRankingLoading(true)
      setRankingError(null)
      try {
        const sp =
          appliedFilterMode === 'range' && appliedRange
            ? new URLSearchParams({
                tgl_awal: appliedRange.tgl_awal,
                tgl_akhir: appliedRange.tgl_akhir,
              })
            : new URLSearchParams({ year: String(appliedYear), period: rankingPeriod })
        const key = `financial-visual:v2:clinic-ranking:${sp.toString()}`
        const json = await fetchJsonCached<ClinicRankingResponse>(key, `/api/financial/clinic-ranking?${sp.toString()}`, {
          force: forceRefresh,
        })
        if (isCancelled()) return
        if (json.success) {
          setRanking(json)
        } else {
          setRanking(null)
          setRankingError(json?.message || 'Gagal memuat ranking klinik')
        }
      } catch (e: unknown) {
        if (!isCancelled()) {
          setRanking(null)
          setRankingError(e instanceof Error ? e.message : 'Gagal memuat ranking klinik')
        }
      } finally {
        if (!isCancelled()) setRankingLoading(false)
      }
    }

    loadTracker()
    loadRanking()
    ;(async () => {
      try {
        setGrowthError(null)
        const sp = new URLSearchParams({ year: String(growthYear) })
        const key = `financial-visual:v2:revenue-growth:${sp.toString()}`
        const json = await fetchJsonCached<RevenueGrowthResponse>(key, `/api/financial/revenue-growth?${sp.toString()}`, {
          force: forceRefresh,
        })
        if (isCancelled()) return
        if (json.success) {
          setGrowth(json)
        } else {
          setGrowth(null)
          setGrowthError((json as any)?.message || 'Gagal memuat growth revenue')
        }
      } catch (e: unknown) {
        if (!isCancelled()) {
          setGrowth(null)
          setGrowthError(e instanceof Error ? e.message : 'Gagal memuat growth revenue')
        }
      }
    })()

    ;(async () => {
      try {
        setHeatmapLoading(true)
        setHeatmapError(null)
        const sp =
          appliedFilterMode === 'range' && appliedRange
            ? new URLSearchParams({
                tgl_awal: appliedRange.tgl_awal,
                tgl_akhir: appliedRange.tgl_akhir,
              })
            : new URLSearchParams({ year: String(appliedYear) })
        const key = `financial-visual:v2:clinic-heatmap:${sp.toString()}`
        const json = await fetchJsonCached<ClinicHeatmapResponse>(key, `/api/financial/clinic-heatmap?${sp.toString()}`, {
          force: forceRefresh,
        })
        if (isCancelled()) return
        if (json.success) {
          setHeatmap(json)
        } else {
          setHeatmap(null)
          setHeatmapError(json?.message || 'Gagal memuat heatmap klinik')
        }
      } catch (e: unknown) {
        if (!isCancelled()) {
          setHeatmap(null)
          setHeatmapError(e instanceof Error ? e.message : 'Gagal memuat heatmap klinik')
        }
      } finally {
        if (!isCancelled()) setHeatmapLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
    if (forceRefresh) setForceRefresh(false)
  }, [appliedFilterMode, appliedYear, appliedRange?.tgl_awal, appliedRange?.tgl_akhir, period, growthYear, forceRefresh])

  useEffect(() => {
    setPeriodDraft(period)
  }, [period])

  const yearOptions = []
  const baseYear = now.getFullYear()
  for (let offset = -1; offset <= 1; offset++) {
    yearOptions.push(baseYear + offset)
  }

  const lineChartData = useMemo(() => {
    if (!data) return null
    const se = findRowMonthly(data.sections, (s, g, l) => s === 'SE' && g === 'TOTAL SE' && l === 'TOTAL SE')
    const fr = findRowMonthly(
      data.sections,
      (s, g, l) => s === 'FUNDRAISING' && g === 'FUNDRAISING' && l === 'TOTAL FUNDRAISING',
    )
    const labels = data.months.map((m) => m.label)
    const seVals = alignSeriesToMonths(data.months, se)
    const frVals = alignSeriesToMonths(data.months, fr)
    if (!labels.length) return null
    return {
      labels,
      datasets: [
        {
          label: 'TOTAL SE',
          data: seVals,
          borderColor: '#0d9488',
          backgroundColor: 'rgba(13, 148, 136, 0.12)',
          fill: true,
          tension: 0.25,
        },
        {
          label: 'TOTAL FUNDRAISING',
          data: frVals,
          borderColor: '#4f46e5',
          backgroundColor: 'rgba(79, 70, 229, 0.08)',
          fill: true,
          tension: 0.25,
        },
      ],
    }
  }, [data])

  const displayRollup = useMemo(() => {
    if (appliedFilterMode === 'year' && data?.targets?.rollup) return data.targets.rollup
    if (appliedFilterMode === 'range' && tracker?.success) {
      const t = tracker.totals
      if (t) {
        return {
          total_se: { actual: t.total_se, target: 0, achievement_pct: null },
          total_fundraising: { actual: t.total_fundraising, target: 0, achievement_pct: null },
          penerimaan_lainnya: { actual: t.penerimaan_lainnya, target: 0, achievement_pct: null },
          grand_total: { actual: t.grand_total, target: 0, achievement_pct: null },
        }
      }
      const byKey = new Map(tracker.series.map((s) => [s.key, s]))
      const sumVals = (k: string) =>
        (byKey.get(k)?.values ?? []).reduce((a, b) => a + Number(b || 0), 0)
      const total_se = sumVals('total_se')
      const total_fundraising = sumVals('total_fundraising')
      const penerimaan_lainnya = sumVals('penerimaan_lainnya')
      const grand_total = sumVals('grand_total')
      return {
        total_se: { actual: total_se, target: 0, achievement_pct: null },
        total_fundraising: { actual: total_fundraising, target: 0, achievement_pct: null },
        penerimaan_lainnya: { actual: penerimaan_lainnya, target: 0, achievement_pct: null },
        grand_total: { actual: grand_total, target: 0, achievement_pct: null },
      }
    }
    return null
  }, [appliedFilterMode, data, tracker])

  const doughnutData = useMemo(() => {
    const r = displayRollup
    if (!r) return null
    const a = r.total_se.actual
    const b = r.total_fundraising.actual
    const c = r.penerimaan_lainnya.actual
    const sum = a + b + c
    if (sum <= 0) return null
    return {
      labels: ['SE', 'Fundraising', 'Penerimaan lainnya'],
      datasets: [
        {
          data: [a, b, c],
          backgroundColor: ['#0d9488', '#4f46e5', '#f59e0b'],
          borderWidth: 0,
        },
      ],
    }
  }, [displayRollup])

  const lineOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'top' as const },
        tooltip: {
          callbacks: {
            label: (ctx: any) => {
              const v = ctx.parsed?.y ?? ctx.raw ?? 0
              const lbl = ctx.dataset?.label ? `${ctx.dataset.label}: ` : ''
              return `${lbl}${formatRupiah(Number(v))}`
            },
          },
        },
      },
      scales: {
        y: {
          ticks: {
            callback: (v: any) => formatRupiah(Number(v)),
          },
        },
      },
    }),
    [],
  )

  const doughnutOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' as const },
        tooltip: {
          callbacks: {
            label: (ctx: { label?: string; parsed: number }) => {
              const v = ctx.parsed ?? 0
              return `${ctx.label ?? ''}: ${formatRupiah(Number(v))}`
            },
          },
        },
      },
    }),
    [],
  )

  const rollup = displayRollup
  const growthKpi = useMemo(() => {
    if (!growth || !growth.success) return null
    const g = growth.growth_pct
    if (g == null) return null
    return g
  }, [growth])
  const composition = useMemo(() => {
    const r = displayRollup
    if (!r) return null
    const items = [
      { key: 'total_se', label: 'SE', value: r.total_se.actual },
      { key: 'total_fundraising', label: 'Fundraising', value: r.total_fundraising.actual },
      { key: 'penerimaan_lainnya', label: 'Penerimaan lainnya', value: r.penerimaan_lainnya.actual },
    ]
    const sumParts = items.reduce((s, it) => s + it.value, 0)
    const rows = items.map((it) => ({
      ...it,
      percent: sumParts > 0 ? (it.value / sumParts) * 100 : 0,
    }))
    return {
      rows,
      sumParts,
      grandTotal: r.grand_total.actual,
    }
  }, [displayRollup])

  const groupedTrackerChartData = useMemo(() => {
    if (appliedFilterMode === 'year' && period === 'monthly' && data) {
      const labels = data.months.map((m) => m.label)
      if (!labels.length) return null

      const seKlinik = findRowMonthly(data.sections, (s, g, l) => s === 'SE' && g === 'KLINIK' && l === 'TOTAL KLINIK')
      const seAmbulance = findRowMonthly(data.sections, (s, g, l) => s === 'SE' && g === 'AMBULAN' && l === 'TOTAL AMBULAN')
      const fundraisingProject = findRowMonthly(data.sections, (s, g, l) => s === 'FUNDRAISING' && g === 'FUNDRAISING' && l === 'Funding')
      const fundraisingDigital = findRowMonthly(data.sections, (s, g, l) => s === 'FUNDRAISING' && g === 'FUNDRAISING' && l === 'DM')
      const penerimaanLainnya = findRowMonthly(data.sections, (s, g, l) => s === 'FUNDRAISING' && g === 'LAINNYA' && l === 'PENERIMAAN LAINNYA')
      const seriesList = [
        { key: 'se_klinik', label: 'SE Klinik', values: alignSeriesToMonths(data.months, seKlinik) },
        { key: 'se_ambulance', label: 'SE Ambulance', values: alignSeriesToMonths(data.months, seAmbulance) },
        { key: 'fundraising_project', label: 'Fundraising Project', values: alignSeriesToMonths(data.months, fundraisingProject) },
        { key: 'fundraising_digital', label: 'Fundraising Digital', values: alignSeriesToMonths(data.months, fundraisingDigital) },
        { key: 'penerimaan_lainnya', label: 'Penerimaan Lainnya', values: alignSeriesToMonths(data.months, penerimaanLainnya) },
      ]
      return buildTrackerComboChartData({ labels, seriesList })
    }

    if (!tracker?.success) return null
    const labels = tracker.labels || []
    if (labels.length === 0) return null
    const seriesList = tracker.series
      .filter((s) => s.key !== 'grand_total')
      .map((s) => ({
        key: s.key,
        label: s.label,
        values: Array.isArray(s.values) ? s.values : [],
      }))
    return buildTrackerComboChartData({ labels, seriesList })
  }, [tracker, data, period, appliedFilterMode])

  const groupedTrackerOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      datasets: {
        bar: { categoryPercentage: 0.58, barPercentage: 0.82 },
      },
      plugins: {
        legend: { position: 'top' as const },
        trackerBarLabels: { maxLabelPoints: 48 },
        tooltip: {
          callbacks: {
            label: (ctx: any) => {
              const v = ctx.parsed?.y ?? ctx.raw ?? 0
              const lbl = ctx.dataset?.label ? `${ctx.dataset.label}: ` : ''
              return `${lbl}${formatRupiah(Number(v))}`
            },
          },
        },
      },
      scales: {
        x: { stacked: false },
        y: {
          stacked: false,
          beginAtZero: true,
          ticks: {
            callback: (v: any) => formatRupiah(Number(v)),
          },
          grace: '10%',
        },
      },
    }),
    [],
  )

  const showTrackerSpinner = useMemo(() => {
    if (appliedFilterMode === 'range') {
      if (trackerLoading) return true
      if (!tracker?.success) return true
      if (!Array.isArray(tracker.labels) || tracker.labels.length === 0) return true
      return false
    }
    if (period === 'monthly') return false
    if (trackerLoading) return true
    if (!tracker?.success) return true
    if (tracker.period !== period) return true
    if (!Array.isArray(tracker.labels) || tracker.labels.length === 0) return true
    return false
  }, [appliedFilterMode, period, trackerLoading, tracker])

  const stackedMonthlyData = useMemo(() => {
    // Untuk monthly stacked, pakai seri dari pivot (se-yearly) agar inline dengan Summary Dashboard.
    if (!data) return null
    const labels = data.months.map((m) => m.label)
    if (!labels?.length) return null

    const seKlinik = findRowMonthly(data.sections, (s, g, l) => s === 'SE' && g === 'KLINIK' && l === 'TOTAL KLINIK')
    const seAmbulance = findRowMonthly(data.sections, (s, g, l) => s === 'SE' && g === 'AMBULAN' && l === 'TOTAL AMBULAN')
    const fundraisingProject = findRowMonthly(data.sections, (s, g, l) => s === 'FUNDRAISING' && g === 'FUNDRAISING' && l === 'Funding')
    const fundraisingDigital = findRowMonthly(data.sections, (s, g, l) => s === 'FUNDRAISING' && g === 'FUNDRAISING' && l === 'DM')
    const penerimaanLainnya = findRowMonthly(data.sections, (s, g, l) => s === 'FUNDRAISING' && g === 'LAINNYA' && l === 'PENERIMAAN LAINNYA')
    const grandTotal = findRowMonthly(data.sections, (s, g, l) => s === 'FUNDRAISING' && g === 'LAINNYA' && l === 'GRAND TOTAL')

    const byKey = new Map<string, number[]>([
      ['se_klinik', alignSeriesToMonths(data.months, seKlinik)],
      ['se_ambulance', alignSeriesToMonths(data.months, seAmbulance)],
      ['fundraising_project', alignSeriesToMonths(data.months, fundraisingProject)],
      ['fundraising_digital', alignSeriesToMonths(data.months, fundraisingDigital)],
      ['penerimaan_lainnya', alignSeriesToMonths(data.months, penerimaanLainnya)],
      ['grand_total', alignSeriesToMonths(data.months, grandTotal)],
    ])
    const catKeys = ['se_klinik', 'se_ambulance', 'fundraising_project', 'fundraising_digital', 'penerimaan_lainnya'] as const
    const colors: Record<string, string> = {
      se_klinik: '#0d9488',
      se_ambulance: '#10b981',
      fundraising_project: '#4f46e5',
      fundraising_digital: '#6366f1',
      penerimaan_lainnya: '#f59e0b',
    }
    const barDatasets = catKeys
      .map((key) => {
        const vals = byKey.get(key)
        if (!vals) return null
        return {
          type: 'bar' as const,
          label:
            key === 'se_klinik'
              ? 'SE Klinik'
              : key === 'se_ambulance'
                ? 'SE Ambulance'
                : key === 'fundraising_project'
                  ? 'Fundraising Project'
                  : key === 'fundraising_digital'
                    ? 'Fundraising Digital'
                    : 'Penerimaan Lainnya',
          data: labels.map((_, i) => Number(vals[i] || 0)),
          backgroundColor: colors[key],
          stack: 'revenue',
        }
      })
      .filter(Boolean) as any[]

    const gt = byKey.get('grand_total')
    const lineDataset = gt
      ? [
          {
            type: 'line' as const,
            label: 'GRAND TOTAL',
            data: labels.map((_, i) => Number(gt[i] || 0)),
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37, 99, 235, 0.12)',
            tension: 0.25,
            yAxisID: 'y',
          },
        ]
      : []

    return { labels, datasets: [...barDatasets, ...lineDataset] }
  }, [data])

  const stackedOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          stacked: true,
        },
        y: {
          stacked: true,
          ticks: {
            callback: (v: any) => formatRupiah(Number(v)),
          },
        },
      },
      plugins: {
        legend: { position: 'top' as const },
        tooltip: {
          callbacks: {
            label: (ctx: any) => {
              const v = ctx.parsed?.y ?? ctx.raw ?? 0
              const lbl = ctx.dataset?.label ? `${ctx.dataset.label}: ` : ''
              return `${lbl}${formatRupiah(Number(v))}`
            },
          },
        },
      },
    }),
    [],
  )

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Dashboard Finansial</h1>
          <p className="text-slate-500 text-sm max-w-2xl">
            Visualisasi capaian dari API Zains dan target{' '}
            <code className="text-xs bg-slate-100 px-1 rounded">target_revenue</code> (Neon{' '}
            <code className="text-xs bg-slate-100 px-1 rounded">clinic_daily_targets</code>) — angka sama dengan{' '}
            <Link href="/dashboard/summary-dashboard" className="text-teal-700 font-medium hover:underline inline-flex items-center gap-1">
              <Table2 className="size-3.5" />
              Summary Dashboard
            </Link>
            .
          </p>
          <p className="text-amber-800/90 text-xs mt-1.5 bg-amber-50 border border-amber-100 rounded-md px-2 py-1.5 inline-block max-w-xl">
            Memuat data bisa memakan waktu 1–3 menit (banyak klinik). Jangan tutup halaman saat memuat.
          </p>
        </div>
        <div className="flex flex-col gap-1 shrink-0 min-w-0 w-full lg:w-auto lg:max-w-[min(100%,56rem)]">
          <div className="flex flex-nowrap items-center gap-2 sm:gap-3 overflow-x-auto py-1 -mx-1 px-1 [scrollbar-width:thin]">
            <RadioGroup
              value={filterMode}
              onValueChange={(v) => setFilterMode(v as 'year' | 'range')}
              className="flex flex-row flex-nowrap items-center gap-3 sm:gap-4 shrink-0"
            >
              <div className="flex items-center gap-1.5 shrink-0">
                <RadioGroupItem value="year" id="financial-filter-year" />
                <Label htmlFor="financial-filter-year" className="text-sm font-normal cursor-pointer whitespace-nowrap">
                  Tahun (pivot + target)
                </Label>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <RadioGroupItem value="range" id="financial-filter-range" />
                <Label htmlFor="financial-filter-range" className="text-sm font-normal cursor-pointer whitespace-nowrap">
                  Rentang tanggal
                </Label>
              </div>
            </RadioGroup>

            <div className="h-6 w-px bg-slate-200 shrink-0 hidden sm:block" aria-hidden />

            {filterMode === 'year' ? (
              <>
                <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
                  <SelectTrigger className="w-[100px] sm:w-[110px] shrink-0 h-9">
                    <SelectValue placeholder="Tahun" />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  onClick={handleApplyMain}
                  disabled={loading}
                  className="bg-teal-600 hover:bg-teal-700 flex items-center gap-2 shrink-0 h-9"
                >
                  {loading ? (
                    <>
                      <Spinner className="size-5 text-white" />
                      <span>Memuat...</span>
                    </>
                  ) : (
                    'Terapkan'
                  )}
                </Button>
              </>
            ) : (
              <>
                <Label htmlFor="financial-range-start" className="text-xs text-slate-600 shrink-0 hidden md:inline">
                  Awal
                </Label>
                <input
                  id="financial-range-start"
                  type="date"
                  value={rangeStart}
                  onChange={(e) => setRangeStart(e.target.value)}
                  aria-label="Tanggal awal rentang"
                  className="border border-slate-200 rounded-md px-2 py-1.5 text-sm bg-white w-[132px] sm:w-[140px] shrink-0 h-9"
                />
                <Label htmlFor="financial-range-end" className="text-xs text-slate-600 shrink-0 hidden md:inline">
                  Akhir
                </Label>
                <input
                  id="financial-range-end"
                  type="date"
                  value={rangeEnd}
                  onChange={(e) => setRangeEnd(e.target.value)}
                  aria-label="Tanggal akhir rentang"
                  className="border border-slate-200 rounded-md px-2 py-1.5 text-sm bg-white w-[132px] sm:w-[140px] shrink-0 h-9"
                />
                <Button type="button" onClick={handleApplyMain} className="bg-teal-600 hover:bg-teal-700 shrink-0 h-9">
                  Terapkan
                </Button>
              </>
            )}

            <Button
              type="button"
              variant="outline"
              className="border-slate-200 bg-white hover:bg-slate-50 shrink-0 whitespace-nowrap h-9 text-xs sm:text-sm px-2 sm:px-3"
              disabled={loading && appliedFilterMode === 'year'}
              onClick={() => {
                setForceRefresh(true)
                if (appliedFilterMode === 'year') load({ y: appliedYear, force: true })
              }}
            >
              Refresh (tanpa cache)
            </Button>
          </div>
          {applyHint && <p className="text-xs text-amber-800 text-right lg:text-end">{applyHint}</p>}
        </div>
      </div>

      {loadError && appliedFilterMode === 'year' && (
        <Alert className="border-amber-200 bg-amber-50 text-amber-950 [&>svg]:text-amber-700">
          <RefreshCw className="size-4" />
          <AlertTitle>Belum berhasil memuat data</AlertTitle>
          <AlertDescription className="text-amber-900/90 space-y-3">
            <p>{loadError}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-amber-300 bg-white hover:bg-amber-100"
              onClick={() => load({ y: appliedYear })}
              disabled={loading}
            >
              <RefreshCw className="size-4 mr-2" />
              Muat ulang
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {appliedFilterMode === 'range' && trackerError && !rollup && (
        <Alert className="border-amber-200 bg-amber-50 text-amber-950 [&>svg]:text-amber-700">
          <RefreshCw className="size-4" />
          <AlertTitle>Time tracker (rentang)</AlertTitle>
          <AlertDescription>{trackerError}</AlertDescription>
        </Alert>
      )}

      {appliedFilterMode === 'range' && trackerLoading && !rollup && (
        <div className="flex flex-col items-center justify-center gap-3 py-10 px-4 text-center rounded-lg border border-teal-100 bg-teal-50/40">
          <Spinner className="size-8 text-teal-600" />
          <p className="text-slate-700 text-sm font-medium">Memuat agregasi rentang tanggal…</p>
        </div>
      )}

      {loading && !data && appliedFilterMode === 'year' && (
        <div className="flex flex-col items-center justify-center gap-4 py-14 px-4 text-center rounded-lg border border-teal-100 bg-teal-50/40">
          <Spinner className="size-8 text-teal-600" />
          <div className="space-y-1 text-slate-700 text-sm max-w-md">
            <p className="font-medium text-slate-800">Mengambil data dari API Zains…</p>
            {loadAttempt > 1 && (
              <p className="text-amber-800 text-xs">
                Percobaan ke-{loadAttempt} dari {SE_YEARLY_MAX_ATTEMPTS}
              </p>
            )}
            <p className="flex items-center justify-center gap-1.5 text-slate-500 text-xs">
              <Clock className="size-3.5 shrink-0" />
              Terhubung: {elapsedSec}s
            </p>
          </div>
        </div>
      )}

      {rollup && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
            {(
              [
                {
                  key: 'total_se',
                  title: 'TOTAL SE',
                  m: rollup.total_se,
                  gradient: 'from-teal-600 to-emerald-500',
                  Icon: Building2,
                },
                {
                  key: 'total_fundraising',
                  title: 'TOTAL FUNDRAISING',
                  m: rollup.total_fundraising,
                  gradient: 'from-indigo-600 to-blue-500',
                  Icon: HandCoins,
                },
                {
                  key: 'penerimaan_lainnya',
                  title: 'PENERIMAAN LAINNYA',
                  m: rollup.penerimaan_lainnya,
                  gradient: 'from-violet-600 to-fuchsia-600',
                  Icon: Layers3,
                },
                {
                  key: 'grand_total',
                  title: 'GRAND TOTAL',
                  m: rollup.grand_total,
                  gradient: 'from-amber-600 to-orange-500',
                  Icon: DollarSign,
                },
              ] as const
            ).map(({ key, title, m, gradient, Icon }) => (
              <div
                key={key}
                className={`relative overflow-hidden rounded-2xl p-4 shadow-sm border border-white/10 bg-gradient-to-br ${gradient} text-white`}
              >
                <div className="pointer-events-none absolute inset-0 bg-black/5" />
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-medium tracking-wide text-white/85 relative">{title}</p>
                    <p className="mt-2 text-2xl font-semibold tabular-nums text-white/95 truncate relative">
                      {formatRupiah(m.actual)}
                    </p>
                  </div>
                  <div className="shrink-0 rounded-xl bg-white/15 p-2 ring-1 ring-white/15 relative">
                    <Icon className="size-5 text-white/90" />
                  </div>
                </div>

                {appliedFilterMode === 'year' ? (
                  <div className="mt-2 text-[11px] text-white/80 flex flex-wrap items-center gap-x-2 gap-y-1 relative">
                    <span className="opacity-90">Target {formatRupiah(m.target)}</span>
                    <span className="opacity-70">•</span>
                    <span className="font-semibold">Capaian {formatAchievementPct(m.achievement_pct)}</span>
                  </div>
                ) : (
                  <div className="mt-2 text-[11px] text-white/75 relative">
                    Rentang kustom — target tahunan tidak diterapkan
                  </div>
                )}

                {key === 'grand_total' && appliedFilterMode === 'year' && m.achievement_pct != null && (
                  <div className="mt-3 relative">
                    <div className="h-2 bg-black/25 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-white/85 rounded-full transition-all"
                        style={{ width: `${Math.min(100, m.achievement_pct)}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-white/8 blur-2xl" />
              </div>
            ))}

            <div className="relative overflow-hidden rounded-2xl p-4 shadow-sm border border-white/10 bg-gradient-to-br from-slate-800 to-slate-950 text-white">
              <div className="pointer-events-none absolute inset-0 bg-black/5" />
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium tracking-wide text-white/85 relative">GROWTH REVENUE (YoY)</p>
                  {growthKpi != null ? (
                    <p className="mt-2 text-2xl font-semibold tabular-nums flex items-center gap-1.5 relative text-white/95">
                      {growthKpi >= 0 ? (
                        <TrendingUp className="size-5 text-emerald-300" />
                      ) : (
                        <TrendingDown className="size-5 text-rose-300" />
                      )}
                      {growthKpi.toFixed(1)}%
                    </p>
                  ) : (
                    <p className="mt-2 text-2xl font-semibold tabular-nums text-white/70 relative">—</p>
                  )}
                </div>
                <div className="shrink-0 rounded-xl bg-white/10 p-2 ring-1 ring-white/10 relative">
                  <TrendingUp className="size-5 text-white/85" />
                </div>
              </div>

              <div className="mt-2 text-[11px] text-white/75 relative">
                {growthKpi != null ? (
                  <span>
                    vs tahun {growthYear - 1} (total receipt Zains) {growthError && <span className="text-amber-200">— {growthError}</span>}
                  </span>
                ) : (
                  <span>
                    Belum ada data growth (Zains fins/total yearly){' '}
                    {growthError && <span className="text-amber-200">— {growthError}</span>}
                  </span>
                )}
              </div>

              <div className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-white/8 blur-2xl" />
            </div>
          </div>

          <Card className="border-slate-200">
            <CardHeader className="space-y-2">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Time Performance Tracker</CardTitle>
                  <p className="text-xs text-slate-500 font-normal">
                    {appliedFilterMode === 'range'
                      ? 'Harian per tanggal dalam rentang — multi bar per kategori + garis GRAND TOTAL.'
                      : 'Mode tahun: pilih group-by lalu Terapkan — multi bar per kategori + garis GRAND TOTAL (bulanan memakai pivot).'}
                  </p>
                </div>
                {appliedFilterMode === 'year' && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Select value={periodDraft} onValueChange={(v) => setPeriodDraft(v as TimePeriod)}>
                      <SelectTrigger className="w-[160px]">
                        <SelectValue placeholder="Pilih periode" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      className="border-slate-200 bg-white hover:bg-slate-50"
                      onClick={() => {
                        if (periodDraft !== period) setTracker(null)
                        setPeriod(periodDraft)
                      }}
                      disabled={trackerLoading || periodDraft === period}
                    >
                      Terapkan
                    </Button>
                  </div>
                )}
              </div>
              {trackerError && (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-md px-2 py-1">{trackerError}</p>
              )}
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                {showTrackerSpinner ? (
                  <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                    <Spinner className="size-5 text-teal-600 mr-2" />
                    Memuat tracker...
                  </div>
                ) : groupedTrackerChartData ? (
                  <Bar
                    key={`${appliedYear}-${period}-${appliedRange?.tgl_awal ?? ''}-${appliedRange?.tgl_akhir ?? ''}`}
                    data={groupedTrackerChartData}
                    options={groupedTrackerOptions as any}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-400 text-sm">Tidak ada data tracker untuk ditampilkan</div>
                )}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="text-base">Clinic Performance Ranking</CardTitle>
                <p className="text-xs text-slate-500 font-normal">
                  {appliedFilterMode === 'range'
                    ? 'Rentang tanggal terpilih — revenue (receipt) SE Klinik per klinik'
                    : 'Default: Monthly — ranking revenue (receipt) SE Klinik per klinik'}
                </p>
                {rankingError && (
                  <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-md px-2 py-1 mt-2">
                    {rankingError}
                  </p>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                {rankingLoading && !ranking ? (
                  <div className="flex items-center justify-center py-6 text-slate-400 text-sm">
                    <Spinner className="size-5 text-teal-600 mr-2" />
                    Memuat ranking...
                  </div>
                ) : ranking ? (
                  <div className="overflow-auto rounded-md border border-slate-100">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 w-[56px]">#</th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Klinik</th>
                          <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ranking.top.map((r, i) => (
                          <tr key={r.clinic_id} className="border-t border-slate-100">
                            <td className="px-3 py-2 text-slate-500 tabular-nums">{i + 1}</td>
                            <td className="px-3 py-2 text-slate-800">{r.clinic_name}</td>
                            <td className="px-3 py-2 text-right text-slate-800 tabular-nums">{formatRupiah(r.value_curr)}</td>
                          </tr>
                        ))}
                      </tbody>
                      {typeof ranking.grand_total_curr === 'number' && (
                        <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                          <tr>
                            <td className="px-3 py-2 text-xs font-semibold text-slate-700" colSpan={2}>
                              Grand total (semua klinik)
                            </td>
                            <td className="px-3 py-2 text-right text-sm font-bold text-slate-900 tabular-nums">
                              {formatRupiah(ranking.grand_total_curr)}
                            </td>
                          </tr>
                          {typeof ranking.grand_total_prev === 'number' && ranking.grand_total_prev > 0 && (
                            <tr>
                              <td className="px-3 py-1 text-xs text-slate-500" colSpan={2}>
                                Periode pembanding ({ranking.compare_to?.label ?? 'sebelumnya'})
                              </td>
                              <td className="px-3 py-1 text-right text-xs text-slate-500 tabular-nums">
                                {formatRupiah(ranking.grand_total_prev)}
                              </td>
                            </tr>
                          )}
                        </tfoot>
                      )}
                    </table>
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-6 text-slate-400 text-sm">
                    Belum ada ranking untuk ditampilkan
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="text-base">
                  Komposisi aktual{appliedFilterMode === 'year' ? ' (tahun)' : ' (rentang)'}
                </CardTitle>
                <p className="text-xs text-slate-500 font-normal">SE, Fundraising, Penerimaan lainnya</p>
              </CardHeader>
              <CardContent>
                <div className="h-[230px] flex items-center justify-center">
                  {doughnutData ? (
                    <Doughnut data={doughnutData} options={doughnutOptions} />
                  ) : (
                    <div className="text-slate-400 text-sm text-center px-2">
                      Tidak ada komposisi untuk ditampilkan
                    </div>
                  )}
                </div>
                {composition && composition.rows.length > 0 && (
                  <div className="mt-4 border-t border-slate-100 pt-3">
                    <table className="w-full text-xs">
                      <tbody>
                        {composition.rows.map((row) => (
                          <tr key={row.key} className="border-b border-slate-100">
                            <td className="py-1 pr-2 text-slate-700">{row.label}</td>
                            <td className="py-1 px-2 text-right tabular-nums text-slate-800">
                              {formatRupiah(row.value)}
                            </td>
                            <td className="py-1 pl-2 text-right tabular-nums text-slate-500">
                              {row.percent.toFixed(1)}%
                            </td>
                          </tr>
                        ))}
                        <tr className="border-t border-slate-200 font-semibold text-slate-900">
                          <td className="py-2 pr-2">GRAND TOTAL</td>
                          <td className="py-2 px-2 text-right tabular-nums">{formatRupiah(composition.grandTotal)}</td>
                          <td className="py-2 pl-2 text-right tabular-nums text-slate-400">—</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="text-base">Growth Heatmap (per Klinik)</CardTitle>
                <p className="text-xs text-slate-500 font-normal">
                  Total revenue (receipt) SE Klinik —{' '}
                  {heatmap?.granularity === 'daily'
                    ? 'per hari dalam rentang (klinik utama)'
                    : 'per bulan untuk beberapa klinik utama'}
                </p>
                {heatmapError && (
                  <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-md px-2 py-1 mt-2">
                    {heatmapError}
                  </p>
                )}
              </CardHeader>
              <CardContent className="pt-0">
                {heatmapLoading && !heatmap ? (
                  <div className="h-[380px] flex items-center justify-center text-slate-400 text-sm rounded-md border border-slate-100">
                    <Spinner className="size-5 text-teal-600 mr-2" />
                    Memuat heatmap...
                  </div>
                ) : heatmap && heatmap.clinics.length > 0 ? (
                  <div className="h-[380px] overflow-auto rounded-md border border-slate-100">
                    <table className="w-max min-w-full text-sm border-collapse table-fixed">
                      <thead>
                        <tr>
                          <th className="sticky left-0 top-0 bg-white z-20 px-3 py-3 text-left text-slate-600 font-semibold min-w-[160px]">
                            Klinik
                          </th>
                          {heatmap.labels.map((lbl) => (
                            <th
                              key={lbl}
                              className="sticky top-0 bg-white z-10 px-3 py-3 text-center text-slate-500 font-medium min-w-[92px]"
                            >
                              {lbl}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {heatmap.clinics.map((c, rowIdx) => (
                          <tr key={c.id} className="border-t border-slate-100">
                            <td className="sticky left-0 bg-white z-10 px-3 py-3 pr-3 text-slate-700 whitespace-nowrap min-w-[160px]">
                              {c.name}
                            </td>
                            {heatmap.labels.map((lbl, colIdx) => {
                              const v = heatmap.matrix[rowIdx]?.[colIdx] ?? 0
                              const abs = Math.abs(v)
                              const intensity =
                                abs === 0 ? 0 : abs < 5000000 ? 0.2 : abs < 15000000 ? 0.4 : abs < 30000000 ? 0.6 : 0.8
                              const bg =
                                v >= 0
                                  ? `rgba(16, 185, 129, ${intensity})`
                                  : `rgba(248, 113, 113, ${intensity})`
                              const color = abs === 0 ? '#64748b' : '#0f172a'
                              return (
                                <td
                                  key={`${c.id}-${lbl}`}
                                  className="px-3 py-3 text-right tabular-nums align-middle"
                                  style={{ backgroundColor: bg, color }}
                                >
                                  {abs === 0 ? '-' : formatRupiah(v)}
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-slate-400 text-xs">Belum ada data heatmap untuk ditampilkan</div>
                )}
              </CardContent>
            </Card>
          </div>

          {appliedFilterMode === 'year' && stackedMonthlyData && (
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="text-base">Monthly Performance (Stacked)</CardTitle>
                <p className="text-xs text-slate-500 font-normal">
                  Bar stacked per kategori + line GRAND TOTAL — sumber sama dengan Time Performance Tracker (mode Monthly)
                </p>
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <Bar data={stackedMonthlyData} options={stackedOptions as any} />
                </div>
              </CardContent>
            </Card>
          )}

          {appliedFilterMode === 'year' && data && (
            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="text-base">Kinerja bulanan (pivot tahunan)</CardTitle>
                <p className="text-xs text-slate-500 font-normal">
                  TOTAL SE vs TOTAL FUNDRAISING — konsisten dengan baris pivot tahun {data.year}
                </p>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {lineChartData ? (
                    <Line data={lineChartData} options={lineOptions} />
                  ) : (
                    <div className="flex items-center justify-center h-full text-slate-400 text-sm">Tidak ada data seri untuk grafik</div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
