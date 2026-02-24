'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
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
import { DollarSign, Users, TrendingUp, RefreshCw, Calendar } from 'lucide-react'
import { Line, Bar, Pie } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { getDashboardData, type DashboardData } from '@/lib/actions/dashboard'
import { getAllClinics } from '@/lib/actions/config'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

function getYearToDateRange(): { dateFrom: string; dateTo: string } {
  const now = new Date()
  const year = now.getFullYear()
  const dateFrom = `${year}-01-01`
  const dateTo = now.toISOString().split('T')[0]
  return { dateFrom, dateTo }
}

function formatRupiah(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}


export default function DashboardPage() {
  const { dateFrom: defaultFrom, dateTo: defaultTo } = getYearToDateRange()
  const [dateFrom, setDateFrom] = useState(defaultFrom)
  const [dateTo, setDateTo] = useState(defaultTo)
  const [clinicId, setClinicId] = useState<string>('all')
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [clinics, setClinics] = useState<{ id: number; name: string }[]>([])
  const [polyCompositionExpanded, setPolyCompositionExpanded] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getDashboardData({
        dateFrom,
        dateTo,
        clinicId: clinicId === 'all' ? undefined : parseInt(clinicId),
      })
      setData(result)
    } catch (err) {
      console.error('Error fetching dashboard:', err)
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [dateFrom, dateTo, clinicId])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    setPolyCompositionExpanded(false)
  }, [data?.polyComposition])

  useEffect(() => {
    getAllClinics().then((list) => {
      setClinics(Array.isArray(list) ? list : [])
    })
  }, [])

  const handleRefresh = () => {
    fetchData()
  }

  const handleYearToDate = () => {
    const { dateFrom: ytdFrom, dateTo: ytdTo } = getYearToDateRange()
    setDateFrom(ytdFrom)
    setDateTo(ytdTo)
  }

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
      },
    },
  }

  // Tren pendapatan per bulan per klinik: sumbu X = Jan–Des, satu garis per klinik
  const revenueTrendData = data?.revenueTrendByClinic
    ? {
        labels: data.revenueTrendByClinic.monthLabels,
        datasets: data.revenueTrendByClinic.clinics.map((clinic, i) => {
          const colors = ['#0d9488', '#2563eb', '#7c3aed', '#d97706', '#059669', '#dc2626', '#0891b2', '#4f46e5']
          const color = colors[i % colors.length]
          return {
            label: clinic.clinicName.replace(/^Klinik\s+/i, '') || clinic.clinicName,
            data: clinic.data,
            borderColor: color,
            backgroundColor: `${color}20`,
            tension: 0.4,
            fill: false,
          }
        }),
      }
    : null

  const revenueTrendChartOptions = {
    ...chartOptions,
    plugins: {
      ...chartOptions.plugins,
      tooltip: {
        callbacks: {
          title: (items: { dataIndex: number }[]) => {
            const idx = items[0]?.dataIndex ?? 0
            const monthLabel = data?.revenueTrendByClinic?.monthLabels?.[idx] ?? ''
            const year = dateTo ? new Date(dateTo).getFullYear() : new Date().getFullYear()
            return monthLabel ? `${monthLabel} ${year}` : ''
          },
          label: (ctx: { dataset: { label?: string }; raw: number }) => {
            const label = ctx.dataset?.label ?? ''
            const value = ctx.raw
            return `${label}: ${formatRupiah(value)}`
          },
        },
      },
    },
  }

  // Performa klinik cabang
  const branchData = data
    ? {
        labels: data.revenueByClinic.map((c) => c.clinicName.replace(/^Klinik\s+/i, '') || c.clinicName),
        datasets: [
          {
            label: 'Pendapatan (Juta Rp)',
            data: data.revenueByClinic.map((c) => Math.round(c.revenue / 1_000_000)),
            backgroundColor: ['#0d9488', '#14b8a6', '#2dd4bf', '#5eead4', '#99f6e4'],
          },
        ],
      }
    : null

  // Komposisi pasien
  const patientData = data
    ? {
        labels: data.patientComposition.map((p) => p.label),
        datasets: [
          {
            data: data.patientComposition.map((p) => p.percent),
            backgroundColor: ['#0d9488', '#3b82f6', '#8b5cf6', '#64748b'],
          },
        ],
      }
    : null

  // Komposisi poli: pie hanya top 5 + Lainnya, daftar rincian pakai load more
  const POLY_TOP_N = 5
  const polyColors = ['#0d9488', '#14b8a6', '#2dd4bf', '#5eead4', '#99f6e4', '#64748b']
  const polyTopFive = data?.polyComposition?.slice(0, POLY_TOP_N) ?? []
  const polyRest = data?.polyComposition?.slice(POLY_TOP_N) ?? []
  const polyRestPercent = polyRest.reduce((s, p) => s + p.percent, 0)
  const polyData = data?.polyComposition?.length
    ? {
        labels: polyRest.length > 0
          ? [...polyTopFive.map((p) => p.label), 'Lainnya']
          : polyTopFive.map((p) => p.label),
        datasets: [
          {
            data: polyRest.length > 0
              ? [...polyTopFive.map((p) => p.percent), polyRestPercent]
              : polyTopFive.map((p) => p.percent),
            backgroundColor: polyRest.length > 0 ? polyColors.slice(0, 6) : polyColors.slice(0, polyTopFive.length),
          },
        ],
      }
    : null

  // Gauge - pastikan tidak terpotong dengan viewBox yang cukup
  const gaugePercent = data ? Math.min(data.targetPercent, 100) : 0
  const gaugeValue = data?.targetPercent ?? 0

  return (
    <div>
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="pl-0">
            <h2 className="text-2xl font-bold text-slate-800">Executive Dashboard</h2>
            <p className="text-slate-500 text-sm">Selamat datang di Sistem Monitoring Klinik</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {/* Date Range Filter - default year to date */}
            <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-2">
              <Calendar className="w-4 h-4 text-slate-500" />
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="bg-transparent text-sm border-none p-0 h-auto focus-visible:ring-0 w-[130px]"
              />
              <span className="text-slate-400">-</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="bg-transparent text-sm border-none p-0 h-auto focus-visible:ring-0 w-[130px]"
              />
            </div>
            <Button variant="outline" size="sm" onClick={handleYearToDate}>
              Year to Date
            </Button>
            {/* Klinik Filter */}
            <Select value={clinicId} onValueChange={setClinicId}>
              <SelectTrigger className="w-[160px] bg-slate-100 border-none">
                <SelectValue placeholder="Pilih Klinik" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Klinik</SelectItem>
                {clinics.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button className="bg-teal-600 hover:bg-teal-700" onClick={handleRefresh} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      {/* Dashboard Content */}
      <div className="p-6">
        {loading && !data ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600"></div>
          </div>
        ) : (
          <>
            {/* KPI Cards - 3 cards (tanpa Sync Zains) */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {/* Total Pendapatan */}
              <Card className="hover:shadow-lg transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-slate-500 text-sm font-medium">Total Pendapatan</p>
                      <p className="text-2xl font-bold text-slate-800 mt-1">
                        {data ? formatRupiah(data.totalRevenue) : 'Rp 0'}
                      </p>
                      <div className="flex items-center gap-1 mt-2">
                        <span
                          className={`text-sm font-semibold ${
                            (data?.revenueChangePercent ?? 0) >= 0 ? 'text-green-500' : 'text-red-500'
                          }`}
                        >
                          {(data?.revenueChangePercent ?? 0) >= 0 ? '↑' : '↓'}{' '}
                          {Math.abs(data?.revenueChangePercent ?? 0).toFixed(1)}%
                        </span>
                        <span className="text-slate-400 text-xs">vs periode sebelumnya</span>
                      </div>
                    </div>
                    <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center">
                      <DollarSign className="w-6 h-6 text-teal-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Total Pasien */}
              <Card className="hover:shadow-lg transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-slate-500 text-sm font-medium">Total Pasien</p>
                      <p className="text-2xl font-bold text-slate-800 mt-1">
                        {data?.totalPatients?.toLocaleString('id-ID') ?? '0'}
                      </p>
                      <div className="flex items-center gap-1 mt-2">
                        <span
                          className={`text-sm font-semibold ${
                            (data?.patientsChangePercent ?? 0) >= 0 ? 'text-green-500' : 'text-red-500'
                          }`}
                        >
                          {(data?.patientsChangePercent ?? 0) >= 0 ? '↑' : '↓'}{' '}
                          {Math.abs(data?.patientsChangePercent ?? 0).toFixed(1)}%
                        </span>
                        <span className="text-slate-400 text-xs">vs periode sebelumnya</span>
                      </div>
                    </div>
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                      <Users className="w-6 h-6 text-blue-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Realisasi Target */}
              <Card className="hover:shadow-lg transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-slate-500 text-sm font-medium">Realisasi Target</p>
                      <p className="text-2xl font-bold text-slate-800 mt-1">
                        {data ? `${Math.min(data.targetPercent, 100).toFixed(1)}%` : '0%'}
                      </p>
                      <div className="flex items-center gap-1 mt-2">
                        <span className="text-amber-500 text-sm font-semibold">
                          {data ? `${Math.max(0, 100 - data.targetPercent).toFixed(1)}%` : '100%'}
                        </span>
                        <span className="text-slate-400 text-xs">remaining</span>
                      </div>
                    </div>
                    <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                      <TrendingUp className="w-6 h-6 text-amber-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts Row 1 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              {/* Gauge Chart - diperbaiki agar tidak terpotong */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Realisasi vs Target Harian</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col items-center justify-center py-6 min-h-[200px]">
                    <div className="relative w-full max-w-[240px]">
                      {/* Gauge dengan viewBox yang cukup - setengah lingkaran */}
                      <svg
                        className="w-full"
                        viewBox="0 0 200 120"
                        preserveAspectRatio="xMidYMid meet"
                        style={{ minHeight: 120 }}
                      >
                        {/* Background arc */}
                        <path
                          d="M 20 95 A 80 80 0 0 1 180 95"
                          fill="none"
                          stroke="#e2e8f0"
                          strokeWidth="16"
                          strokeLinecap="round"
                        />
                        {/* Progress arc */}
                        <path
                          d="M 20 95 A 80 80 0 0 1 180 95"
                          fill="none"
                          stroke="#0d9488"
                          strokeWidth="16"
                          strokeLinecap="round"
                          strokeDasharray={`${(gaugePercent / 100) * 251.2} 251.2`}
                        />
                      </svg>
                      <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 text-center -mb-2">
                        <p className="text-2xl font-bold text-teal-600">
                          {gaugeValue.toFixed(1)}%
                        </p>
                        <p className="text-xs text-slate-500">
                          dari target {data ? formatRupiah(data.targetRevenue) : 'Rp 0'}
                        </p>
                      </div>
                    </div>
                    <div className="mt-6 w-full flex justify-between text-sm px-2">
                      <div className="text-center">
                        <p className="text-slate-500 text-xs">Realisasi</p>
                        <p className="font-bold text-teal-600">
                          {data ? formatRupiah(data.actualRevenue) : 'Rp 0'}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-slate-500 text-xs">Target</p>
                        <p className="font-bold text-slate-800">
                          {data ? formatRupiah(data.targetRevenue) : 'Rp 0'}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-slate-500 text-xs">Gap</p>
                        <p className="font-bold text-amber-600">
                          {data ? formatRupiah(Math.max(0, data.gapRevenue)) : 'Rp 0'}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Line Chart - Tren Pendapatan Per Bulan (per klinik) */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">Tren Pendapatan Per Bulan</CardTitle>
                      <p className="text-slate-500 text-xs mt-0.5">
                        Pendapatan per klinik per bulan — tahun {dateTo ? new Date(dateTo).getFullYear() : new Date().getFullYear()}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="h-[250px]">
                    {revenueTrendData && revenueTrendData.datasets.length > 0 ? (
                      <Line data={revenueTrendData} options={revenueTrendChartOptions} />
                    ) : (
                      <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                        Tidak ada data untuk ditampilkan
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Baris ranking: progress pendapatan (kiri) & progress kunjungan (kanan) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Ranking Klinik by Pendapatan - progress menuju target (sama seperti gauge) */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Ranking Klinik by Pendapatan</CardTitle>
              
                </CardHeader>
                <CardContent>
                  {data && data.revenueByClinic.length > 0 ? (
                    <div className="space-y-4">
                      {data.revenueByClinic.map((c, i) => {
                        const target = c.targetRevenue > 0 ? c.targetRevenue : 1
                        const pct = Math.min(100, (c.revenue / target) * 100)
                        const isOverTarget = c.targetRevenue > 0 && c.revenue >= c.targetRevenue
                        return (
                          <div key={i} className="flex items-center gap-3">
                            <Link
                              href={`/dashboard/klinik/${c.clinicId}`}
                              className="text-sm text-slate-700 shrink-0 min-w-[180px] hover:text-teal-600 hover:underline"
                              title={c.clinicName}
                            >
                              {c.clinicName}
                            </Link>
                            <div className="flex-1 min-w-0 h-6 rounded-full bg-slate-200 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${isOverTarget ? 'bg-teal-600' : 'bg-teal-500'}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-sm font-semibold text-slate-800 shrink-0 text-right whitespace-nowrap" title={formatRupiah(c.revenue)}>
                              {formatRupiah(c.revenue)}
                              {c.targetRevenue > 0 && (
                                <span className="text-slate-400 font-normal text-xs ml-1">
                                  / {formatRupiah(c.targetRevenue)}
                                </span>
                              )}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="text-slate-400 text-sm py-8 text-center">Tidak ada data</div>
                  )}
                </CardContent>
              </Card>

              {/* Ranking Klinik by Visit - progress menuju target */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Ranking Klinik by Visit</CardTitle>
                 
                </CardHeader>
                <CardContent>
                  {data && data.clinicRankByVisits.length > 0 ? (
                    <div className="space-y-4">
                      {data.clinicRankByVisits.map((c, i) => {
                        const target = c.targetVisits > 0 ? c.targetVisits : 1
                        const pct = Math.min(100, (c.visits / target) * 100)
                        const isOverTarget = c.targetVisits > 0 && c.visits >= c.targetVisits
                        return (
                          <div key={i} className="flex items-center gap-3">
                            <Link
                              href={`/dashboard/klinik/${c.clinicId}`}
                              className="text-sm text-slate-700 shrink-0 min-w-[180px] hover:text-teal-600 hover:underline"
                              title={c.clinicName}
                            >
                              {c.clinicName}
                            </Link>
                            <div className="flex-1 min-w-0 h-6 rounded-full bg-slate-200 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${isOverTarget ? 'bg-teal-600' : 'bg-teal-500'}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-sm font-semibold text-slate-800 shrink-0 text-right whitespace-nowrap" title={`${c.visits.toLocaleString('id-ID')} visit`}>
                              {c.visits.toLocaleString('id-ID')} visit
                              {c.targetVisits > 0 && (
                                <span className="text-slate-400 font-normal text-xs ml-1">
                                  / {c.targetVisits.toLocaleString('id-ID')} target
                                </span>
                              )}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="text-slate-400 text-sm py-8 text-center">Tidak ada data</div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Charts Row 2 */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              {/* Bar Chart - Performa Klinik Cabang (ukuran disesuaikan) */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">Performa Klinik Cabang</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[250px]">
                    {branchData && branchData.labels.length > 0 ? (
                      <Bar data={branchData} options={chartOptions} />
                    ) : (
                      <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                        Tidak ada data untuk ditampilkan
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Pie Chart - Komposisi Pasien */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Komposisi Pasien</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[180px] flex items-center justify-center">
                    {patientData && patientData.labels.length > 0 ? (
                      <Pie
                        data={patientData}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: { legend: { display: false } },
                        }}
                      />
                    ) : (
                      <div className="text-slate-400 text-sm">Tidak ada data</div>
                    )}
                  </div>
                  {data && data.patientComposition.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {data.patientComposition.map((p, i) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{
                                backgroundColor:
                                  ['#0d9488', '#3b82f6', '#8b5cf6', '#64748b'][i % 4],
                              }}
                            />
                            <span className="text-slate-600">{p.label}</span>
                          </div>
                          <span className="font-semibold">{p.percent.toFixed(1)}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Pie Chart - Komposisi Poli (top 5 + Lainnya, daftar pakai load more) */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Komposisi Poli</CardTitle>
                  <p className="text-slate-500 text-xs mt-0.5">Top 5 poli + Lainnya</p>
                </CardHeader>
                <CardContent>
                  <div className="h-[180px] flex items-center justify-center">
                    {polyData && polyData.labels.length > 0 ? (
                      <Pie
                        data={polyData}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: { legend: { display: false } },
                        }}
                      />
                    ) : (
                      <div className="text-slate-400 text-sm">Tidak ada data</div>
                    )}
                  </div>
                  {data && data.polyComposition.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {polyTopFive.map((p, i) => (
                        <div key={i} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: polyColors[i % polyColors.length] }}
                            />
                            <span className="text-slate-600 truncate max-w-[120px]" title={p.label}>{p.label}</span>
                          </div>
                          <span className="font-semibold">{p.percent.toFixed(1)}%</span>
                        </div>
                      ))}
                      {polyRest.length > 0 && !polyCompositionExpanded && (
                        <button
                          type="button"
                          onClick={() => setPolyCompositionExpanded(true)}
                          className="w-full text-center py-1.5 text-sm text-teal-600 hover:text-teal-700 font-medium"
                        >
                          Tampilkan lebih banyak ({polyRest.length})
                        </button>
                      )}
                      {polyCompositionExpanded && polyRest.length > 0 && (
                        <>
                          {polyRest.map((p, i) => (
                            <div key={`rest-${i}`} className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-3 h-3 rounded-full shrink-0"
                                  style={{ backgroundColor: polyColors[(POLY_TOP_N + i) % polyColors.length] }}
                                />
                                <span className="text-slate-600 truncate max-w-[120px]" title={p.label}>{p.label}</span>
                              </div>
                              <span className="font-semibold">{p.percent.toFixed(1)}%</span>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => setPolyCompositionExpanded(false)}
                            className="w-full text-center py-1.5 text-sm text-slate-500 hover:text-slate-700 font-medium"
                          >
                            Tampilkan lebih sedikit
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
