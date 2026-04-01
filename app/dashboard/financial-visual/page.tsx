'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
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
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Building2, Clock, DollarSign, HandCoins, Layers3, RefreshCw, Table2, TrendingDown, TrendingUp } from 'lucide-react'
import type { PivotResponse } from '@/lib/summary-se-yearly-types'
import { formatAchievementPct, formatRupiah } from '@/lib/summary-se-yearly-types'
import { fetchSeYearlySummary, SE_YEARLY_MAX_ATTEMPTS } from '@/lib/fetch-se-yearly-summary'
import { findRowMonthly } from '@/lib/summary-pivot-helpers'

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
)

type TimePeriod = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'

type TimeTrackerResponse = {
  success: boolean
  year: number
  period: TimePeriod
  labels: string[]
  buckets?: { key: string; label: string; tgl_awal: string; tgl_akhir: string }[]
  series: { key: string; label: string; values: number[] }[]
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

export default function FinancialVisualDashboardPage() {
  const now = new Date()
  const [year, setYear] = useState<number>(now.getFullYear())

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
    const y = options?.y ?? year
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
    load({ isCancelled: () => cancelled })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let cancelled = false
    const isCancelled = () => cancelled

    async function loadTracker() {
      setTrackerLoading(true)
      setTrackerError(null)
      try {
        const sp = new URLSearchParams({ year: String(year), period })
        const key = `financial-visual:time-tracker:${sp.toString()}`
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
        // Ranking default & konsisten dengan chart monthly.
        const sp = new URLSearchParams({ year: String(year), period: rankingPeriod })
        const key = `financial-visual:clinic-ranking:${sp.toString()}`
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
        const sp = new URLSearchParams({ year: String(year) })
        const key = `financial-visual:revenue-growth:${sp.toString()}`
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
        const sp = new URLSearchParams({ year: String(year) })
        const key = `financial-visual:clinic-heatmap:${sp.toString()}`
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
    // Reset refresh flag setelah satu siklus fetch.
    if (forceRefresh) setForceRefresh(false)
  }, [year, period, forceRefresh])

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

  const doughnutData = useMemo(() => {
    const r = data?.targets?.rollup
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
  }, [data])

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

  const rollup = data?.targets?.rollup
  const growthKpi = useMemo(() => {
    if (!growth || !growth.success) return null
    const g = growth.growth_pct
    if (g == null) return null
    return g
  }, [growth])
  const composition = useMemo(() => {
    const r = data?.targets?.rollup
    if (!r) return []
    const items = [
      { key: 'total_se', label: 'SE', value: r.total_se.actual },
      { key: 'total_fundraising', label: 'Fundraising', value: r.total_fundraising.actual },
      { key: 'penerimaan_lainnya', label: 'Penerimaan lainnya', value: r.penerimaan_lainnya.actual },
    ]
    const sum = items.reduce((s, it) => s + it.value, 0)
    return items.map((it) => ({
      ...it,
      percent: sum > 0 ? (it.value / sum) * 100 : 0,
    }))
  }, [data])

  const trackerChartData = useMemo(() => {
    const palette: Array<{ key: string; label: string; color: string }> = [
      { key: 'se_klinik', label: 'SE Klinik', color: '#0d9488' },
      { key: 'se_ambulance', label: 'SE Ambulance', color: '#10b981' },
      { key: 'fundraising_project', label: 'Fundraising Project', color: '#4f46e5' },
      { key: 'fundraising_digital', label: 'Fundraising Digital', color: '#6366f1' },
      { key: 'penerimaan_lainnya', label: 'Penerimaan Lainnya', color: '#f59e0b' },
      { key: 'grand_total', label: 'GRAND TOTAL', color: '#2563eb' },
    ]

    // Untuk monthly, gunakan sumber kebenaran pivot `se-yearly` yang sama dengan Summary Dashboard.
    if (period === 'monthly' && data) {
      const labels = data.months.map((m) => m.label)
      if (!labels.length) return null

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

      const datasets = palette
        .map((p) => {
          const vals = byKey.get(p.key)
          if (!vals) return null
          return {
            label: p.label,
            data: labels.map((_, i) => Number(vals[i] || 0)),
            borderColor: p.color,
            backgroundColor: p.key === 'grand_total' ? 'rgba(37, 99, 235, 0.12)' : `${p.color}22`,
            fill: true,
            tension: 0.25,
            borderWidth: p.key === 'grand_total' ? 2 : 1.5,
            pointRadius: p.key === 'grand_total' ? 2 : 1.5,
          }
        })
        .filter(Boolean) as any[]

      return { labels, datasets }
    }

    // Selain monthly, pakai API time-tracker.
    if (!tracker?.success) return null
    const labels = tracker.labels || []
    if (labels.length === 0) return null

    const byKey = new Map(tracker.series.map((s) => [s.key, s] as const))
    const datasets = palette
      .map((p) => {
        const s = byKey.get(p.key)
        if (!s) return null
        const vals = Array.isArray(s.values) ? s.values : []
        return {
          label: p.label,
          data: labels.map((_, i) => Number(vals[i] || 0)),
          borderColor: p.color,
          backgroundColor: p.key === 'grand_total' ? 'rgba(37, 99, 235, 0.12)' : `${p.color}22`,
          fill: true,
          tension: 0.25,
          borderWidth: p.key === 'grand_total' ? 2 : 1.5,
          pointRadius: p.key === 'grand_total' ? 2 : 1.5,
        }
      })
      .filter(Boolean) as any[]

    return { labels, datasets }
  }, [tracker, data, period])

  const trackerOptions = useMemo(
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
          grace: '10%',
        },
      },
    }),
    [],
  )

  const showTrackerSpinner = useMemo(() => {
    if (period === 'monthly') return false // monthly pakai pivot, instan
    if (trackerLoading) return true
    if (!tracker?.success) return true
    if (tracker.period !== period) return true
    if (!Array.isArray(tracker.labels) || tracker.labels.length === 0) return true
    return false
  }, [period, trackerLoading, tracker])

  const stackedWeeklyData = useMemo(() => {
    if (!tracker || tracker.period !== 'weekly') return null
    const labels = tracker.labels
    if (!labels?.length) return null
    const byKey = new Map(tracker.series.map((s) => [s.key, s] as const))
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
        const s = byKey.get(key)
        if (!s) return null
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
          data: labels.map((_, i) => Number(s.values[i] || 0)),
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
            data: labels.map((_, i) => Number(gt.values[i] || 0)),
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37, 99, 235, 0.12)',
            tension: 0.25,
            yAxisID: 'y',
          },
        ]
      : []

    return { labels, datasets: [...barDatasets, ...lineDataset] }
  }, [tracker])

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
      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
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
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-[110px]">
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
          <Button onClick={() => load({ y: year })} disabled={loading} className="bg-teal-600 hover:bg-teal-700 flex items-center gap-2">
            {loading ? (
              <>
                <Spinner className="size-5 text-white" />
                <span>Memuat...</span>
              </>
            ) : (
              'Terapkan'
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-slate-200 bg-white hover:bg-slate-50"
            disabled={loading}
            onClick={() => {
              setForceRefresh(true)
              load({ y: year, force: true })
            }}
          >
            Refresh (tanpa cache)
          </Button>
        </div>
      </div>

      {loadError && (
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
              onClick={() => load({ y: year })}
              disabled={loading}
            >
              <RefreshCw className="size-4 mr-2" />
              Muat ulang
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {loading && !data && (
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

      {data && rollup && (
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

                <div className="mt-2 text-[11px] text-white/80 flex flex-wrap items-center gap-x-2 gap-y-1 relative">
                  <span className="opacity-90">Target {formatRupiah(m.target)}</span>
                  <span className="opacity-70">•</span>
                  <span className="font-semibold">Capaian {formatAchievementPct(m.achievement_pct)}</span>
                </div>

                {key === 'grand_total' && m.achievement_pct != null && (
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
                    vs tahun {year - 1} (total receipt Zains) {growthError && <span className="text-amber-200">— {growthError}</span>}
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
                    Pilih group-by lalu tekan <span className="font-medium text-slate-700">Terapkan</span> — line area chart receipt per kategori (konsisten pivot)
                  </p>
                </div>
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
                      // Agar sumbu X tidak “nyangkut” periode sebelumnya:
                      // kosongkan chart dulu, lalu tampilkan spinner sampai data baru siap.
                      if (periodDraft !== period) setTracker(null)
                      setPeriod(periodDraft)
                    }}
                    disabled={trackerLoading || periodDraft === period}
                  >
                    Terapkan
                  </Button>
                </div>
              </div>
              {trackerError && (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-md px-2 py-1">{trackerError}</p>
              )}
            </CardHeader>
            <CardContent>
              <div className="h-[260px]">
                {showTrackerSpinner ? (
                  <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                    <Spinner className="size-5 text-teal-600 mr-2" />
                    Memuat tracker...
                  </div>
                ) : trackerChartData ? (
                  <Line key={`${year}-${period}`} data={trackerChartData} options={trackerOptions} />
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
                <p className="text-xs text-slate-500 font-normal">Default: Monthly — ranking revenue (receipt) SE Klinik per klinik</p>
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
                <CardTitle className="text-base">Komposisi aktual (tahun)</CardTitle>
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
                {composition.length > 0 && (
                  <div className="mt-4 border-t border-slate-100 pt-3">
                    <table className="w-full text-xs">
                      <tbody>
                        {composition.map((row) => (
                          <tr key={row.key} className="border-b border-slate-100 last:border-0">
                            <td className="py-1 pr-2 text-slate-700">{row.label}</td>
                            <td className="py-1 px-2 text-right tabular-nums text-slate-800">
                              {formatRupiah(row.value)}
                            </td>
                            <td className="py-1 pl-2 text-right tabular-nums text-slate-500">
                              {row.percent.toFixed(1)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-slate-200">
              <CardHeader>
                <CardTitle className="text-base">Growth Heatmap (per Klinik)</CardTitle>
                <p className="text-xs text-slate-500 font-normal">Total revenue (receipt) SE Klinik per bulan untuk beberapa klinik utama</p>
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

          {stackedMonthlyData && (
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

          <Card className="border-slate-200">
            <CardHeader>
              <CardTitle className="text-base">Kinerja bulanan (pivot tahunan)</CardTitle>
              <p className="text-xs text-slate-500 font-normal">TOTAL SE vs TOTAL FUNDRAISING — konsisten dengan baris pivot tahun {data.year}</p>
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
        </>
      )}
    </div>
  )
}
