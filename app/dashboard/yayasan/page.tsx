'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import {
  Users,
  Heart,
  TrendingUp,
  DollarSign,
  Search,
  Calendar,
  Download,
  ArrowRight,
} from 'lucide-react'
import { Bar, Doughnut } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Title, Tooltip, Legend)

type Period = 'month' | 'quarter' | 'year'

type YayasanStatsResponse = {
  success: boolean
  message?: string
  kpi_period: Period
  summary_period: Period
  kpis: {
    transaction_count: number
    transaction_count_delta_pct: number | null
    paid_total: number
    paid_total_delta_pct: number | null
    distinct_patients: number
    distinct_patients_delta_pct: number | null
  }
  top_clinics: { clinic_id: number; name: string; count: number }[]
  top_polies: { name: string; count: number }[]
  chart: { labels: string[]; transaction_counts: number[]; paid_totals_millions: number[] }
  ringkasan_pendapatan_klinik: number
  recent_transactions: {
    id: string
    trx_date: string
    trx_no: string
    clinic_name: string
    patient_name: string
    paid_total: number
  }[]
  clinics_filter: { id: number; name: string }[]
}

const BAR_COLORS = ['bg-teal-500', 'bg-blue-500', 'bg-purple-500', 'bg-amber-500', 'bg-pink-500']

export default function YayasanPage() {
  const [kpiPeriod, setKpiPeriod] = useState<Period>('month')
  const [summaryPeriod, setSummaryPeriod] = useState<Period>('month')
  const [chartClinicId, setChartClinicId] = useState<string>('all')
  const [stats, setStats] = useState<YayasanStatsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  /** Memaksa remount Chart.js saat data / filter berubah (Line tidak selalu update `data`). */
  const [lineChartKey, setLineChartKey] = useState(0)

  const loadStats = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const sp = new URLSearchParams()
      sp.set('kpi_period', kpiPeriod)
      sp.set('summary_period', summaryPeriod)
      if (chartClinicId && chartClinicId !== 'all') sp.set('chart_clinic_id', chartClinicId)
      sp.set('chart_months', '6')
      const res = await fetch(`/api/dashboard/yayasan-stats?${sp.toString()}`)
      const json = (await res.json()) as YayasanStatsResponse
      if (!json.success) {
        setStats(null)
        setError(json.message || 'Gagal memuat data')
        return
      }
      setStats(json)
      setLineChartKey((k) => k + 1)
    } catch (e) {
      setStats(null)
      setError(e instanceof Error ? e.message : 'Gagal memuat data')
    } finally {
      setLoading(false)
    }
  }, [kpiPeriod, summaryPeriod, chartClinicId])

  useEffect(() => {
    void loadStats()
  }, [loadStats])

  const dualChartData = useMemo(() => {
    const labels = stats?.chart?.labels
    if (!labels?.length) {
      return {
        labels: ['—'],
        datasets: [
          {
            type: 'bar' as const,
            label: 'Jumlah transaksi',
            data: [0],
            backgroundColor: 'rgba(13, 148, 136, 0.7)',
            borderColor: '#0d9488',
            borderWidth: 1,
            borderRadius: 6,
            maxBarThickness: 36,
            yAxisID: 'y',
          },
          {
            type: 'bar' as const,
            label: 'Pendapatan klinik (Juta Rp)',
            data: [0],
            backgroundColor: 'rgba(59, 130, 246, 0.7)',
            borderColor: '#3b82f6',
            borderWidth: 1,
            borderRadius: 6,
            maxBarThickness: 36,
            yAxisID: 'y1',
          },
        ],
      }
    }
    const n = labels.length
    const tc = [...(stats.chart.transaction_counts ?? [])]
    const pm = [...(stats.chart.paid_totals_millions ?? [])]
    while (tc.length < n) tc.push(0)
    while (pm.length < n) pm.push(0)
    tc.length = n
    pm.length = n
    return {
      labels,
      datasets: [
        {
          type: 'bar' as const,
          label: 'Jumlah transaksi',
          data: tc,
          backgroundColor: 'rgba(13, 148, 136, 0.7)',
          borderColor: '#0d9488',
          borderWidth: 1,
          borderRadius: 6,
          maxBarThickness: 36,
          yAxisID: 'y',
        },
        {
          type: 'bar' as const,
          label: 'Pendapatan klinik (Juta Rp)',
          data: pm,
          backgroundColor: 'rgba(59, 130, 246, 0.7)',
          borderColor: '#3b82f6',
          borderWidth: 1,
          borderRadius: 6,
          maxBarThickness: 36,
          yAxisID: 'y1',
        },
      ],
    }
  }, [stats])

  const dualChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          padding: 15,
          font: { size: 12 },
          usePointStyle: true,
          pointStyle: 'rect' as const,
        },
      },
      tooltip: {
        enabled: true,
      },
    },
    scales: {
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        beginAtZero: true,
        grid: {
          color: '#f1f5f9',
        },
        ticks: {
          callback: (value: any) => value.toLocaleString(),
          font: { size: 11 },
        },
        title: {
          display: true,
          text: 'Jumlah transaksi',
          font: { size: 11, weight: 'bold' as const },
        },
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        beginAtZero: true,
        grid: {
          drawOnChartArea: false,
        },
        ticks: {
          callback: (value: any) => String(value) + ' Jt',
          font: { size: 11 },
        },
        title: {
          display: true,
          text: 'Pendapatan (Juta Rp)',
          font: { size: 11, weight: 'bold' as const },
        },
      },
      x: {
        grid: {
          display: false,
        },
        ticks: {
          font: { size: 11 },
        },
        offset: true,
      },
    },
  }

  // Data untuk gauge chart
  const gaugeChartData = {
    datasets: [
      {
        data: [93.3, 6.7],
        backgroundColor: ['#3b82f6', '#e2e8f0'],
        borderWidth: 0,
      },
    ],
  }

  const gaugeChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { enabled: false },
    },
    cutout: '75%',
    circumference: 180,
    rotation: 270,
  }

  const topCabang = useMemo(() => {
    const rows = stats?.top_clinics ?? []
    const max = rows[0]?.count ?? 1
    return rows.map((r, i) => ({
      name: r.name,
      visits: r.count,
      percentage: max > 0 ? Math.round((r.count / max) * 100) : 0,
      color: BAR_COLORS[i % BAR_COLORS.length],
    }))
  }, [stats])

  const topPoli = useMemo(() => {
    const rows = stats?.top_polies ?? []
    const max = rows[0]?.count ?? 1
    return rows.map((r, i) => ({
      name: r.name,
      patients: r.count,
      percentage: max > 0 ? Math.round((r.count / max) * 100) : 0,
      color: BAR_COLORS[i % BAR_COLORS.length],
    }))
  }, [stats])

  // Data kampanye (contoh — tidak dari tabel transactions)
  const campaigns = [
    {
      name: 'Bantu Pasien BPJS',
      target: 50000000,
      collected: 43500000,
      percentage: 87,
      status: 'Aktif',
      color: 'bg-blue-500',
    },
    {
      name: 'Obat Gratis Lansia',
      target: 30000000,
      collected: 18600000,
      percentage: 62,
      status: 'Aktif',
      color: 'bg-teal-500',
    },
    {
      name: 'Peralatan Medis Baru',
      target: 100000000,
      collected: 23000000,
      percentage: 23,
      status: 'Baru',
      color: 'bg-purple-500',
    },
  ]

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `Rp ${(amount / 1000000).toFixed(1)}M`
    }
    return `Rp ${amount.toLocaleString('id-ID')}`
  }

  const formatDelta = (pct: number | null) => {
    if (pct == null) return { text: '—', up: null as boolean | null }
    const up = pct >= 0
    return { text: `${up ? '↑' : '↓'} ${Math.abs(pct)}%`, up }
  }

  const formatCompact = (n: number) => {
    if (n >= 1_000_000_000) return `Rp ${(n / 1_000_000_000).toFixed(1)}M` // miliar
    if (n >= 1_000_000) return `Rp ${(n / 1_000_000).toFixed(1)} jt`
    if (n >= 1_000) return `Rp ${(n / 1_000).toFixed(0)} rb`
    return `Rp ${n.toLocaleString('id-ID')}`
  }

  const txDelta = formatDelta(stats?.kpis.transaction_count_delta_pct ?? null)
  const paidDelta = formatDelta(stats?.kpis.paid_total_delta_pct ?? null)
  const patDelta = formatDelta(stats?.kpis.distinct_patients_delta_pct ?? null)

  return (
    <div>
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 sticky top-0 z-10">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Dashboard Yayasan Cita Sehat</h2>
            <p className="text-slate-500 text-sm">
              Overview Gabungan: Operasional Klinik & Program Crowdfunding
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {/* Global Search Bar */}
            <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-4 py-2 min-w-[300px]">
              <Search className="w-4 h-4 text-slate-400" />
              <Input
                type="text"
                placeholder="Cari cabang, kode pasien, atau kampanye donasi..."
                className="bg-transparent border-none outline-none flex-1 text-sm"
              />
            </div>
            {/* Date Filter */}
            <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-2">
              <Calendar className="w-4 h-4 text-slate-500" />
              <Select
                value={kpiPeriod}
                onValueChange={(v) => setKpiPeriod(v as Period)}
              >
                <SelectTrigger className="bg-transparent border-none outline-none text-sm w-[160px]">
                  <SelectValue placeholder="Periode KPI" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="month">Bulan ini</SelectItem>
                  <SelectItem value="quarter">Kuartal ini</SelectItem>
                  <SelectItem value="year">Tahun ini</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {/* Export Button */}
            <Button className="bg-teal-600 hover:bg-teal-700 text-white">
              <Download className="w-4 h-4 mr-2" />
              Laporan Yayasan
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="p-6">
        {error && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {error}
          </div>
        )}
        {/* Key Metrics - 4 Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Total transaksi (dari transactions) */}
          <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl p-5 shadow-sm text-white">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-teal-100 text-sm font-medium">Jumlah transaksi</p>
                <p className="text-3xl font-bold mt-1">
                  {loading ? '…' : (stats?.kpis.transaction_count ?? 0).toLocaleString('id-ID')}
                </p>
                <div className="flex items-center gap-1 mt-2">
                  <span
                    className={`text-sm font-semibold ${
                      txDelta.up === true ? 'text-teal-100' : txDelta.up === false ? 'text-teal-200' : 'text-teal-200'
                    }`}
                  >
                    {txDelta.text}
                  </span>
                  <span className="text-teal-200 text-xs">vs periode sebelumnya</span>
                </div>
              </div>
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Donasi — contoh (bukan dari transactions) */}
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-5 shadow-sm text-white relative">
            <p className="absolute top-2 right-2 text-[10px] uppercase tracking-wide text-blue-200/90">Contoh</p>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-blue-100 text-sm font-medium">Total Donasi Terkumpul</p>
                <p className="text-3xl font-bold mt-1">Rp 2.8M</p>
                <div className="flex items-center gap-1 mt-2">
                  <span className="text-blue-100 text-sm font-semibold">↑ 15.4%</span>
                  <span className="text-blue-200 text-xs">(mock)</span>
                </div>
              </div>
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <Heart className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Pasien unik (patient_id) */}
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-5 shadow-sm text-white">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-purple-100 text-sm font-medium">Pasien (unik)</p>
                <p className="text-3xl font-bold mt-1">
                  {loading ? '…' : (stats?.kpis.distinct_patients ?? 0).toLocaleString('id-ID')}
                </p>
                <div className="flex items-center gap-1 mt-2">
                  <span
                    className={`text-sm font-semibold ${
                      patDelta.up === true ? 'text-purple-100' : patDelta.up === false ? 'text-purple-200' : 'text-purple-200'
                    }`}
                  >
                    {patDelta.text}
                  </span>
                  <span className="text-purple-200 text-xs">COUNT DISTINCT patient_id</span>
                </div>
              </div>
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Pendapatan Klinik */}
          <div className="bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl p-5 shadow-sm text-white">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-amber-100 text-sm font-medium">Pendapatan Klinik</p>
                <p className="text-3xl font-bold mt-1">
                  {loading ? '…' : formatCompact(stats?.kpis.paid_total ?? 0)}
                </p>
                <div className="flex items-center gap-1 mt-2">
                  <span
                    className={`text-sm font-semibold ${
                      paidDelta.up === true ? 'text-amber-100' : paidDelta.up === false ? 'text-amber-200' : 'text-amber-200'
                    }`}
                  >
                    {paidDelta.text}
                  </span>
                  <span className="text-amber-200 text-xs">SUM paid_total</span>
                </div>
              </div>
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <DollarSign className="w-6 h-6" />
              </div>
            </div>
          </div>
        </div>

        {/* Main Chart - Dual Axis */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 lg:col-span-2">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <div>
                <h3 className="font-semibold text-slate-800">Tren transaksi & pendapatan klinik</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Sumber: tabel transactions (6 bulan terakhir)
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Select value={chartClinicId} onValueChange={setChartClinicId}>
                  <SelectTrigger className="text-sm bg-slate-100 rounded-lg px-3 py-1.5 border-none w-[180px]">
                    <SelectValue placeholder="Cabang" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua cabang</SelectItem>
                    {(stats?.clinics_filter ?? []).map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <span className="text-xs text-slate-500 whitespace-nowrap">6 bulan</span>
              </div>
            </div>
            <div className="h-[300px]">
              <Bar key={lineChartKey} data={dualChartData} options={dualChartOptions} />
            </div>
          </div>

          {/* Target Donasi Card — contoh */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100 relative">
            <p className="absolute top-3 right-3 text-[10px] uppercase text-slate-400">Contoh</p>
            <h3 className="font-semibold text-slate-800 mb-4">Target Donasi Bulanan</h3>
            <div className="flex items-center justify-center mb-4">
              <div className="relative w-48 h-32">
                <Doughnut data={gaugeChartData} options={gaugeChartOptions} />
                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 text-center">
                  <p className="text-3xl font-bold text-blue-600">93.3%</p>
                  <p className="text-xs text-slate-500">dari target Rp 3M</p>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Terkumpul</span>
                <span className="font-bold text-blue-600">Rp 2.8M</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Target</span>
                <span className="font-bold text-slate-800">Rp 3.0M</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Sisa</span>
                <span className="font-bold text-amber-600">Rp 200K</span>
              </div>
              <div className="pt-3 border-t border-slate-100">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-slate-500">Total Donatur</span>
                  <span className="font-semibold text-slate-800">1,234 orang</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Avg. Donasi</span>
                  <span className="font-semibold text-slate-800">Rp 227K</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Top 5 Performance Tables */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Top 5 Cabang Teramai */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle>Top 5 Cabang Teramai</CardTitle>
                <span className="text-xs px-2 py-1 bg-teal-100 text-teal-700 rounded-full font-medium">
                  Transaksi
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {loading ? (
                  <p className="text-sm text-slate-500 py-4 text-center">Memuat…</p>
                ) : topCabang.length === 0 ? (
                  <p className="text-sm text-slate-500 py-4 text-center">Belum ada data transaksi di periode ini</p>
                ) : (
                  topCabang.map((cabang, index) => (
                  <div key={`${cabang.name}-${index}`} className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                        index === 0
                          ? 'bg-teal-100 text-teal-600'
                          : index === 1
                            ? 'bg-blue-100 text-blue-600'
                            : index === 2
                              ? 'bg-purple-100 text-purple-600'
                              : 'bg-amber-100 text-amber-600'
                      }`}
                    >
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-slate-800">{cabang.name}</p>
                      <div className="w-full h-2 bg-slate-200 rounded-full mt-1">
                        {/* eslint-disable-next-line react/forbid-dom-props */}
                        <div
                          className={`h-full ${cabang.color} rounded-full`}
                          // eslint-disable-next-line react/forbid-dom-props
                          style={{ width: `${cabang.percentage}%` }}
                        />
                      </div>
                    </div>
                    <span className="font-bold text-slate-800">{cabang.visits.toLocaleString()}</span>
                  </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          {/* Top 5 Poli Paling Aktif */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle>Top 5 Poli Paling Aktif</CardTitle>
                <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full font-medium">
                  Transaksi
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {loading ? (
                  <p className="text-sm text-slate-500 py-4 text-center">Memuat…</p>
                ) : topPoli.length === 0 ? (
                  <p className="text-sm text-slate-500 py-4 text-center">Belum ada data transaksi di periode ini</p>
                ) : (
                  topPoli.map((poli, index) => (
                  <div key={`${poli.name}-${index}`} className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm ${
                        index === 0
                          ? 'bg-teal-100 text-teal-600'
                          : index === 1
                            ? 'bg-blue-100 text-blue-600'
                            : index === 2
                              ? 'bg-pink-100 text-pink-600'
                              : index === 3
                                ? 'bg-purple-100 text-purple-600'
                                : 'bg-indigo-100 text-indigo-600'
                      }`}
                    >
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-slate-800">{poli.name}</p>
                      <div className="w-full h-2 bg-slate-200 rounded-full mt-1">
                        {/* eslint-disable-next-line react/forbid-dom-props */}
                        <div
                          className={`h-full ${poli.color} rounded-full`}
                          // eslint-disable-next-line react/forbid-dom-props
                          style={{ width: `${poli.percentage}%` }}
                        />
                      </div>
                    </div>
                    <span className="font-bold text-slate-800">{poli.patients.toLocaleString()}</span>
                  </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Campaign & Financial Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Active Campaigns — contoh */}
          <Card className="relative">
            <p className="absolute top-4 right-4 text-[10px] uppercase text-slate-400 z-10">Contoh</p>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle>Kampanye Donasi Aktif</CardTitle>
                <Button variant="ghost" className="text-blue-600 hover:text-blue-700 text-sm font-medium h-auto p-0">
                  Lihat Semua <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {campaigns.map((campaign, index) => (
                  <div key={index} className="border border-slate-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="font-semibold text-slate-800">{campaign.name}</h4>
                        <p className="text-xs text-slate-500 mt-1">
                          Target: {formatCurrency(campaign.target)}
                        </p>
                      </div>
                      <span
                        className={`text-xs px-2 py-1 rounded-full font-medium ${
                          campaign.status === 'Aktif'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {campaign.status}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-slate-200 rounded-full mb-2">
                      {/* eslint-disable-next-line react/forbid-dom-props */}
                      <div
                        className={`h-full ${campaign.color} rounded-full`}
                        // eslint-disable-next-line react/forbid-dom-props
                        style={{ width: `${campaign.percentage}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-600">
                        Terkumpul: <strong>{formatCurrency(campaign.collected)}</strong>
                      </span>
                      <span className="font-semibold text-blue-600">{campaign.percentage}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Financial Summary */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle>Ringkasan Keuangan</CardTitle>
                <Select
                  value={summaryPeriod}
                  onValueChange={(v) => setSummaryPeriod(v as Period)}
                >
                  <SelectTrigger className="text-sm bg-slate-100 rounded-lg px-3 py-1.5 border-none w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="month">Bulan ini</SelectItem>
                    <SelectItem value="quarter">Kuartal ini</SelectItem>
                    <SelectItem value="year">Tahun ini</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {/* Income Section */}
              <div className="mb-6">
                <p className="text-xs font-semibold text-slate-500 uppercase mb-3">Pemasukan</p>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-teal-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-teal-500 rounded-full" />
                      <span className="text-sm text-slate-700">Pendapatan Klinik</span>
                    </div>
                    <span className="font-bold text-slate-800">
                      {loading ? '…' : formatCompact(stats?.ringkasan_pendapatan_klinik ?? 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-blue-500 rounded-full" />
                      <span className="text-sm text-slate-700">Dana Donasi</span>
                    </div>
                    <span className="text-xs font-medium text-slate-500">— (bukan dari transaksi)</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-purple-500 rounded-full" />
                      <span className="text-sm text-slate-700">Subsidi Pemerintah</span>
                    </div>
                    <span className="text-xs font-medium text-slate-500">— (bukan dari transaksi)</span>
                  </div>
                </div>
              </div>
              {/* Expense Section */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-3">Pengeluaran</p>
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-red-500 rounded-full" />
                      <span className="text-sm text-slate-700">Operasional Klinik</span>
                    </div>
                    <span className="text-xs font-medium text-slate-500">— (bukan dari transaksi)</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-amber-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-amber-500 rounded-full" />
                      <span className="text-sm text-slate-700">Program Sosial</span>
                    </div>
                    <span className="text-xs font-medium text-slate-500">— (bukan dari transaksi)</span>
                  </div>
                </div>
              </div>
              {/* Net Balance */}
              <div className="mt-6 pt-4 border-t-2 border-slate-200">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-slate-700">Saldo Bersih</span>
                  <span className="text-sm font-medium text-slate-500">— (hitung manual jika perlu)</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Transaksi klinik terbaru */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle>Transaksi klinik terbaru</CardTitle>
              <span className="text-xs text-slate-500">Sumber: PostgreSQL `transactions`</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">
                      Tanggal
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">
                      No. transaksi
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">
                      Klinik
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">
                      Pasien
                    </th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase">
                      Paid total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-slate-500 text-sm">
                        Memuat…
                      </td>
                    </tr>
                  ) : (stats?.recent_transactions?.length ?? 0) === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-5 py-8 text-center text-slate-500 text-sm">
                        Belum ada transaksi
                      </td>
                    </tr>
                  ) : (
                    stats!.recent_transactions.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50">
                        <td className="px-5 py-4 text-sm text-slate-600">{row.trx_date}</td>
                        <td className="px-5 py-4 text-sm font-mono text-slate-800">{row.trx_no || '—'}</td>
                        <td className="px-5 py-4 text-sm text-slate-800">{row.clinic_name}</td>
                        <td className="px-5 py-4 text-sm text-slate-800">{row.patient_name || '—'}</td>
                        <td className="px-5 py-4 text-right font-semibold text-slate-800">
                          {formatCurrency(row.paid_total)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
