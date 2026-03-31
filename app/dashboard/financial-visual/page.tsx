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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Clock, RefreshCw, Table2, TrendingDown, TrendingUp } from 'lucide-react'
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
}

type ClinicHeatmapResponse = {
  success: boolean
  year: number
  labels: string[]
  clinics: { id: number; name: string }[]
  matrix: number[][]
  message?: string
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

  // Tracker + ranking
  const [period, setPeriod] = useState<TimePeriod>('monthly')
  const [trackerLoading, setTrackerLoading] = useState(false)
  const [tracker, setTracker] = useState<TimeTrackerResponse | null>(null)
  const [trackerError, setTrackerError] = useState<string | null>(null)

  const [rankingLoading, setRankingLoading] = useState(false)
  const [ranking, setRanking] = useState<ClinicRankingResponse | null>(null)
  const [rankingError, setRankingError] = useState<string | null>(null)

  const [growth, setGrowth] = useState<RevenueGrowthResponse | null>(null)
  const [growthError, setGrowthError] = useState<string | null>(null)

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

  const load = async (options?: { y?: number; isCancelled?: () => boolean }) => {
    const y = options?.y ?? year
    const isCancelled = options?.isCancelled
    const hadExisting = data != null

    setLoading(true)
    setLoadError(null)
    setLoadAttempt(0)

    try {
      const result = await fetchSeYearlySummary(y, {
        isCancelled,
        onAttempt: (n) => setLoadAttempt(n),
      })

      if (isCancelled?.()) return

      if (result.ok) {
        setData(result.data)
        setLoadError(null)
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
        const res = await fetch(`/api/financial/time-tracker?${sp.toString()}`, { cache: 'no-store' })
        const json = (await res.json()) as TimeTrackerResponse
        if (isCancelled()) return
        if (res.ok && json.success) {
          setTracker(json)
        } else {
          setTracker(null)
          setTrackerError(json?.message || `Gagal memuat time tracker (${res.status})`)
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
        const sp = new URLSearchParams({ year: String(year), period })
        const res = await fetch(`/api/financial/clinic-ranking?${sp.toString()}`, { cache: 'no-store' })
        const json = (await res.json()) as ClinicRankingResponse
        if (isCancelled()) return
        if (res.ok && json.success) {
          setRanking(json)
        } else {
          setRanking(null)
          setRankingError(json?.message || `Gagal memuat ranking klinik (${res.status})`)
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
        const res = await fetch(`/api/financial/revenue-growth?${sp.toString()}`, { cache: 'no-store' })
        const json = (await res.json()) as RevenueGrowthResponse
        if (isCancelled()) return
        if (res.ok && json.success) {
          setGrowth(json)
        } else {
          setGrowth(null)
          setGrowthError(json?.message || `Gagal memuat growth revenue (${res.status})`)
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
        setHeatmapError(null)
        const sp = new URLSearchParams({ year: String(year) })
        const res = await fetch(`/api/financial/clinic-heatmap?${sp.toString()}`, { cache: 'no-store' })
        const json = (await res.json()) as ClinicHeatmapResponse
        if (isCancelled()) return
        if (res.ok && json.success) {
          setHeatmap(json)
        } else {
          setHeatmap(null)
          setHeatmapError(json?.message || `Gagal memuat heatmap klinik (${res.status})`)
        }
      } catch (e: unknown) {
        if (!isCancelled()) {
          setHeatmap(null)
          setHeatmapError(e instanceof Error ? e.message : 'Gagal memuat heatmap klinik')
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [year, period])

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
      { key: 'grand_total', label: 'GRAND TOTAL', color: '#0f172a' },
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
            backgroundColor: p.key === 'grand_total' ? 'rgba(15, 23, 42, 0.08)' : `${p.color}22`,
            fill: false,
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
          backgroundColor: p.key === 'grand_total' ? 'rgba(15, 23, 42, 0.08)' : `${p.color}22`,
          fill: false,
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
            borderColor: '#0f172a',
            backgroundColor: 'rgba(15, 23, 42, 0.12)',
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
            borderColor: '#0f172a',
            backgroundColor: 'rgba(15, 23, 42, 0.12)',
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {(
              [
                { key: 'total_se', title: 'TOTAL SE', m: rollup.total_se },
                { key: 'total_fundraising', title: 'TOTAL FUNDRAISING', m: rollup.total_fundraising },
                { key: 'penerimaan_lainnya', title: 'PENERIMAAN LAINNYA', m: rollup.penerimaan_lainnya },
                { key: 'grand_total', title: 'GRAND TOTAL', m: rollup.grand_total },
              ] as const
            ).map(({ key, title, m }) => (
              <Card key={key} className="border-slate-200 shadow-sm">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm font-medium text-slate-600">{title}</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2">
                  <p className="text-xl font-semibold tabular-nums text-slate-900">{formatRupiah(m.actual)}</p>
                  <div className="text-xs text-slate-500 space-y-0.5">
                    <p>
                      Target: <span className="text-slate-700 font-medium">{formatRupiah(m.target)}</span>
                    </p>
                    <p>
                      Capaian: <span className="font-semibold text-teal-700">{formatAchievementPct(m.achievement_pct)}</span>
                    </p>
                    {key === 'grand_total' && m.achievement_pct != null && (
                      <div className="pt-2">
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-teal-600 rounded-full transition-all" style={{ width: `${Math.min(100, m.achievement_pct)}%` }} />
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-medium text-slate-600">GROWTH REVENUE (YoY)</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 space-y-2">
                {growthKpi != null ? (
                  <>
                    <p
                      className={`text-xl font-semibold tabular-nums ${
                        growthKpi >= 0 ? 'text-emerald-700' : 'text-rose-700'
                      } flex items-center gap-1.5`}
                    >
                      {growthKpi >= 0 ? (
                        <TrendingUp className="size-4 text-emerald-600" />
                      ) : (
                        <TrendingDown className="size-4 text-rose-600" />
                      )}
                      {growthKpi.toFixed(1)}%
                    </p>
                    <div className="text-xs text-slate-500 space-y-0.5">
                      <p>
                        vs tahun {year - 1} (total receipt Zains){' '}
                        {growthError && <span className="text-amber-700">— {growthError}</span>}
                      </p>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-slate-400">
                    Belum ada data growth (cek konfigurasi Zains fins/total yearly){' '}
                    {growthError && <span className="text-amber-700">— {growthError}</span>}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="border-slate-200">
            <CardHeader className="space-y-2">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Time Performance Tracker</CardTitle>
                  <p className="text-xs text-slate-500 font-normal">Daily / Weekly / Monthly / Quarterly / Yearly — receipt per kategori (konsisten pivot)</p>
                </div>
                <Tabs value={period} onValueChange={(v) => setPeriod(v as TimePeriod)}>
                  <TabsList>
                    <TabsTrigger value="daily">Daily</TabsTrigger>
                    <TabsTrigger value="weekly">Weekly</TabsTrigger>
                    <TabsTrigger value="monthly">Monthly</TabsTrigger>
                    <TabsTrigger value="quarterly">Quarterly</TabsTrigger>
                    <TabsTrigger value="yearly">Yearly</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              {trackerError && (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-md px-2 py-1">{trackerError}</p>
              )}
            </CardHeader>
            <CardContent>
              <div className="h-[320px]">
                {trackerLoading && !tracker ? (
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
                <p className="text-xs text-slate-500 font-normal">Ranking revenue (receipt) SE Klinik per klinik (bucket saat ini)</p>
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
                  <ol className="space-y-2">
                    {ranking.top.map((r, i) => (
                      <li key={r.clinic_id} className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm text-slate-800 truncate">
                            {i + 1}. {r.clinic_name}
                          </p>
                          <p className="text-xs text-slate-500 tabular-nums">
                            {formatRupiah(r.value_curr)}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
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
              <CardContent>
                {heatmap && heatmap.clinics.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-[11px] border-collapse">
                      <thead>
                        <tr>
                          <th className="sticky left-0 bg-white z-10 px-2 py-1 text-left text-slate-600 font-semibold">
                            Klinik
                          </th>
                          {heatmap.labels.map((lbl) => (
                            <th key={lbl} className="px-1 py-1 text-center text-slate-500 font-medium">
                              {lbl}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {heatmap.clinics.map((c, rowIdx) => (
                          <tr key={c.id} className="border-t border-slate-100">
                            <td className="sticky left-0 bg-white z-10 px-2 py-1 pr-3 text-slate-700 whitespace-nowrap">
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
                                  className="px-1 py-1 text-right tabular-nums align-middle"
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
