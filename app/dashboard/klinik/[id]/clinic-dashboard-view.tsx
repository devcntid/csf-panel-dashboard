'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { AlertCircle, ArrowLeft, Calendar, DollarSign, Users, TrendingUp } from 'lucide-react'
import { Line, Pie } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import type { ClinicDashboardData } from '@/lib/actions/clinics'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

function formatRupiah(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

function getYearToDateRange(): { dateFrom: string; dateTo: string } {
  const now = new Date()
  const year = now.getFullYear()
  const dateFrom = `${year}-01-01`
  const dateTo = now.toISOString().split('T')[0]
  return { dateFrom, dateTo }
}

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

const POLI_COLORS = ['#0d9488', '#2563eb', '#7c3aed', '#ea580c', '#059669', '#dc2626']
const PIE_COLORS = ['#0d9488', '#14b8a6', '#2dd4bf', '#5eead4', '#99f6e4', '#64748b']
const POLY_TOP_N = 5

const performanceConfig = {
  poor: {
    title: 'Perlu Peningkatan',
    message:
      'Realisasi target masih di bawah 60%. Ini saatnya evaluasi operasional dan strategi layanan. Fokus pada peningkatan kunjungan dan kepuasan pasien—setiap langkah kecil membawa kita lebih dekat ke target.',
    className: 'border-red-200 bg-red-50',
    iconClass: 'text-red-600',
    titleClass: 'text-red-800',
    textClass: 'text-red-700',
    progressColor: 'bg-red-500',
  },
  average: {
    title: 'Cukup Baik, Bisa Lebih',
    message:
      'Realisasi target antara 60–80%. Kinerja sudah on track. Pertahankan konsistensi dan cari peluang kecil untuk meningkatkan layanan agar mendekati target bulanan.',
    className: 'border-amber-200 bg-amber-50',
    iconClass: 'text-amber-600',
    titleClass: 'text-amber-800',
    textClass: 'text-amber-700',
    progressColor: 'bg-amber-500',
  },
  good: {
    title: 'Kinerja Baik',
    message:
      'Realisasi target 80–99%. Apresiasi untuk tim yang telah menjaga kualitas layanan. Tinggal sedikit lagi untuk mencapai target—tetap semangat dan jaga momentum.',
    className: 'border-teal-200 bg-teal-50',
    iconClass: 'text-teal-600',
    titleClass: 'text-teal-800',
    textClass: 'text-teal-700',
    progressColor: 'bg-teal-500',
  },
  excellent: {
    title: 'Luar Biasa! Target Tercapai',
    message:
      'Realisasi target ≥100%. Apresiasi setinggi-tingginya untuk dedikasi dan kerja keras tim. Pertahankan standar ini dan jadikan sebagai baseline untuk periode berikutnya.',
    className: 'border-green-200 bg-green-50',
    iconClass: 'text-green-600',
    titleClass: 'text-green-800',
    textClass: 'text-green-700',
    progressColor: 'bg-green-500',
  },
} as const

type ViewProps = {
  data: ClinicDashboardData
  clinicId: number
  dateFrom: string
  dateTo: string
}

export function ClinicDashboardView({ data, clinicId, dateFrom, dateTo }: ViewProps) {
  const router = useRouter()
  const [polyRevenueExpanded, setPolyRevenueExpanded] = useState(false)
  const [polyVisitsExpanded, setPolyVisitsExpanded] = useState(false)
  const [piePoliExpanded, setPiePoliExpanded] = useState(false)
  const [pieInsuranceExpanded, setPieInsuranceExpanded] = useState(false)
  const {
    clinic,
    revenueInPeriod,
    revenueTarget,
    revenueYtd,
    totalTransactionsInPeriod,
    visitsTarget,
    avgTransaction,
    targetRealization,
    poliData,
    visitsPerPoli,
    visitsPerInsurance,
    monthlyRevenue,
    monthlyVisits,
  } = data
  if (!clinic) return null

  const performanceLevel =
    targetRealization >= 100 ? 'excellent' : targetRealization >= 80 ? 'good' : targetRealization >= 60 ? 'average' : 'poor'
  const perf = performanceConfig[performanceLevel]
  const gapRevenue = Math.max(0, revenueTarget - revenueYtd)
  const gaugePercent = Math.min(targetRealization, 100)

  const poliTopFive = poliData.slice(0, POLY_TOP_N)
  const poliRest = poliData.slice(POLY_TOP_N)

  const piePoliTop = visitsPerPoli.slice(0, 3)
  const piePoliRest = visitsPerPoli.slice(3)

  const pieInsuranceTop = visitsPerInsurance.slice(0, 3)
  const pieInsuranceRest = visitsPerInsurance.slice(3)

  const visitsTopFive = visitsPerPoli.slice(0, POLY_TOP_N)
  const visitsRest = visitsPerPoli.slice(POLY_TOP_N)

  const visitsPieDataPoli = visitsPerPoli.length > 0
    ? {
        labels: visitsPerPoli.map((p) => p.name),
        datasets: [
          {
            data: visitsPerPoli.map((p) => p.percent),
            backgroundColor: PIE_COLORS.slice(0, Math.max(visitsPerPoli.length, 1)),
          },
        ],
      }
    : null

  const visitsPieDataInsurance = visitsPerInsurance.length > 0
    ? {
        labels: visitsPerInsurance.map((p) => p.name),
        datasets: [
          {
            data: visitsPerInsurance.map((p) => p.percent),
            backgroundColor: PIE_COLORS.slice(0, Math.max(visitsPerInsurance.length, 1)),
          },
        ],
      }
    : null

  const monthlyChartData = {
    labels: monthNames,
    datasets: [
      {
        label: 'Pendapatan (Rp)',
        data: monthlyRevenue,
        borderColor: '#0d9488',
        backgroundColor: 'rgba(13, 148, 136, 0.25)',
        tension: 0.4,
        fill: true,
      },
    ],
  }

  const monthlyVisitsChartData = {
    labels: monthNames,
    datasets: [
      {
        label: 'Kunjungan',
        data: monthlyVisits,
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37, 99, 235, 0.25)',
        tension: 0.4,
        fill: true,
      },
    ],
  }

  const handleDateChange = (newFrom: string, newTo: string) => {
    const params = new URLSearchParams({ dateFrom: newFrom, dateTo: newTo })
    router.push(`/dashboard/klinik/${clinicId}?${params.toString()}`)
  }

  const handleYearToDate = () => {
    const { dateFrom: f, dateTo: t } = getYearToDateRange()
    handleDateChange(f, t)
  }

  const initial = clinic.name.replace(/^Klinik\s+/i, '').charAt(0) || 'K'

  return (
    <div>
      <header className="bg-gradient-to-r from-teal-600 to-teal-700 text-white px-6 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="hover:bg-white/20 text-white"
              onClick={() => router.back()}
              aria-label="Kembali"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
              <span className="text-2xl font-bold">{initial}</span>
            </div>
            <div>
              <h2 className="text-2xl font-bold">{clinic.name}</h2>
              <p className="text-white/80 text-sm">
                {clinic.location || '—'} • ID: CLN-{clinic.id}
              </p>
            </div>
          </div>
          <Badge className="bg-white/20 text-white border-0">Connected</Badge>
        </div>
      </header>

      <div className="p-6">
        {/* Date filter - sama seperti dashboard utama */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-2">
            <Calendar className="w-4 h-4 text-slate-500" />
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => handleDateChange(e.target.value, dateTo)}
              className="bg-transparent text-sm border-none p-0 h-auto focus-visible:ring-0 w-[130px]"
            />
            <span className="text-slate-400">-</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => handleDateChange(dateFrom, e.target.value)}
              className="bg-transparent text-sm border-none p-0 h-auto focus-visible:ring-0 w-[130px]"
            />
          </div>
          <Button variant="outline" size="sm" onClick={handleYearToDate}>
            Year to Date
          </Button>
        </div>

        {/* KPI Cards - berwarna (teal, blue, purple, orange) */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="border-0 bg-teal-500 text-white shadow-md">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-teal-100 text-sm font-medium">Pendapatan (Periode)</p>
                  <p className="text-2xl font-bold mt-1">{formatRupiah(revenueInPeriod)}</p>
                </div>
                <DollarSign className="w-8 h-8 text-white/70" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 bg-blue-500 text-white shadow-md">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-blue-100 text-sm font-medium">Jml Transaksi (Periode)</p>
                  <p className="text-2xl font-bold mt-1">{totalTransactionsInPeriod.toLocaleString('id-ID')}</p>
                </div>
                <Users className="w-8 h-8 text-white/70" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 bg-violet-500 text-white shadow-md">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-violet-100 text-sm font-medium">Realisasi Target (YTD)</p>
                  <p className="text-2xl font-bold mt-1">{targetRealization.toFixed(1)}%</p>
                  <div className="w-full h-2 bg-white/30 rounded-full mt-2">
                    <div
                      className="h-full bg-white rounded-full transition-all"
                      style={{ width: `${Math.min(targetRealization, 100)}%` }}
                    />
                  </div>
                </div>
                <TrendingUp className="w-8 h-8 text-white/70" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-0 bg-amber-500 text-white shadow-md">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-amber-100 text-sm font-medium">Rata-rata Transaksi</p>
                  <p className="text-2xl font-bold mt-1">{formatRupiah(avgTransaction)}</p>
                  <p className="text-amber-100 text-xs mt-2">per transaksi</p>
                </div>
                <DollarSign className="w-8 h-8 text-white/70" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Gauge + pie kunjungan per poli & per insurance - tiga chart side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Progress Menuju Target (Tahun Ini)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-4 min-h-[200px]">
                <div className="relative w-full max-w-[240px]">
                  <svg
                    className="w-full"
                    viewBox="0 0 200 120"
                    preserveAspectRatio="xMidYMid meet"
                    style={{ minHeight: 120 }}
                  >
                    <path d="M 20 95 A 80 80 0 0 1 180 95" fill="none" stroke="#e2e8f0" strokeWidth="16" strokeLinecap="round" />
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
                    <p className="text-2xl font-bold text-teal-600">{targetRealization.toFixed(1)}%</p>
                    <p className="text-xs text-slate-500">dari target {formatRupiah(revenueTarget)}</p>
                  </div>
                </div>
                <div className="mt-6 w-full flex justify-between text-sm px-2">
                  <div className="text-center">
                    <p className="text-slate-500 text-xs">Realisasi (YTD)</p>
                    <p className="font-bold text-teal-600">{formatRupiah(revenueYtd)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-slate-500 text-xs">Target</p>
                    <p className="font-bold text-slate-800">{formatRupiah(revenueTarget)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-slate-500 text-xs">Sisa</p>
                    <p className="font-bold text-amber-600">{formatRupiah(gapRevenue)}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Kunjungan per Poli (Periode)</CardTitle>
              <p className="text-slate-500 text-xs">Distribusi kunjungan berdasarkan poli</p>
            </CardHeader>
            <CardContent>
              <div className="h-[180px] flex items-center justify-center">
                {visitsPieDataPoli && visitsPieDataPoli.labels.length > 0 ? (
                  <Pie
                    data={visitsPieDataPoli}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { display: false } },
                    }}
                  />
                ) : (
                  <p className="text-slate-400 text-sm">Belum ada data kunjungan per poli</p>
                )}
              </div>
              {visitsPerPoli.length > 0 && (
                <div className="mt-4 space-y-2">
                  {(piePoliExpanded ? visitsPerPoli : piePoliTop).map((p, i) => (
                    <div key={p.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                        />
                        <span className="text-slate-600 truncate max-w-[140px]" title={p.name}>
                          {p.name}
                        </span>
                      </div>
                      <span className="font-semibold">
                        {p.count.toLocaleString('id-ID')}{' '}
                        <span className="text-xs text-slate-500">({p.percent.toFixed(1)}%)</span>
                      </span>
                    </div>
                  ))}
                  {piePoliRest.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setPiePoliExpanded((prev) => !prev)}
                      className="w-full text-center py-2 text-sm text-teal-600 hover:text-teal-700 font-medium"
                    >
                      {piePoliExpanded
                        ? 'Tampilkan lebih sedikit'
                        : `Tampilkan lebih banyak (${piePoliRest.length})`}
                    </button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Kunjungan per Insurance (Periode)</CardTitle>
              <p className="text-slate-500 text-xs">Distribusi kunjungan berdasarkan jenis insurance</p>
            </CardHeader>
            <CardContent>
              <div className="h-[180px] flex items-center justify-center">
                {visitsPieDataInsurance && visitsPieDataInsurance.labels.length > 0 ? (
                  <Pie
                    data={visitsPieDataInsurance}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { display: false } },
                    }}
                  />
                ) : (
                  <p className="text-slate-400 text-sm">Belum ada data kunjungan per insurance</p>
                )}
              </div>
              {visitsPerInsurance.length > 0 && (
                <div className="mt-4 space-y-2">
                  {(pieInsuranceExpanded ? visitsPerInsurance : pieInsuranceTop).map((p, i) => (
                    <div key={p.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                        />
                        <span className="text-slate-600 truncate max-w-[140px]" title={p.name}>
                          {p.name}
                        </span>
                      </div>
                      <span className="font-semibold">
                        {p.count.toLocaleString('id-ID')}{' '}
                        <span className="text-xs text-slate-500">({p.percent.toFixed(1)}%)</span>
                      </span>
                    </div>
                  ))}
                  {pieInsuranceRest.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setPieInsuranceExpanded((prev) => !prev)}
                      className="w-full text-center py-2 text-sm text-teal-600 hover:text-teal-700 font-medium"
                    >
                      {pieInsuranceExpanded
                        ? 'Tampilkan lebih sedikit'
                        : `Tampilkan lebih banyak (${pieInsuranceRest.length})`}
                    </button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Suggestion */}
        <Card className={`mb-6 border-2 ${perf.className}`}>
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <AlertCircle className={`w-6 h-6 flex-shrink-0 ${perf.iconClass}`} />
              <div className="flex-1">
                <h4 className={`font-bold ${perf.titleClass}`}>{perf.title}</h4>
                <p className={`text-sm mt-1 ${perf.textClass}`}>{perf.message}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Charts - Pendapatan Per Poli (top 5 + load more) & Tren Bulanan */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="border-slate-200 shadow-md overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-teal-50 to-cyan-50 border-b">
              <CardTitle className="text-base">Pendapatan Per Poli (Periode)</CardTitle>
              <p className="text-slate-500 text-xs">Top 5 + load more. Data sesuai filter tanggal</p>
              <p className="text-sm mt-1">
                <span className="font-semibold text-slate-900">{formatRupiah(revenueInPeriod)}</span>
                <span className="text-slate-400"> / {formatRupiah(revenueTarget)}</span>
              </p>
            </CardHeader>
            <CardContent className="pt-4">
              {poliData.length > 0 ? (
                <div className="space-y-4">
                  {poliTopFive.map((poli, i) => (
                    <div key={poli.name}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-slate-700">{poli.name}</span>
                        <span className="text-sm font-semibold text-slate-800">
                          {formatRupiah(poli.revenue)}
                          {poli.targetRevenue > 0 && (
                            <span className="text-slate-400 font-normal">
                              {' '}
                              / {formatRupiah(poli.targetRevenue)}
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${
                              poli.targetRevenue && poli.targetRevenue > 0
                                ? Math.min((poli.revenue / poli.targetRevenue) * 100, 100)
                                : 0
                            }%`,
                            backgroundColor: POLI_COLORS[i % POLI_COLORS.length],
                          }}
                        />
                      </div>
                    </div>
                  ))}
                  {poliRest.length > 0 && !polyRevenueExpanded && (
                    <button
                      type="button"
                      onClick={() => setPolyRevenueExpanded(true)}
                      className="w-full text-center py-2 text-sm text-teal-600 hover:text-teal-700 font-medium"
                    >
                      Tampilkan lebih banyak ({poliRest.length})
                    </button>
                  )}
                  {polyRevenueExpanded && poliRest.length > 0 && (
                    <>
                      {poliRest.map((poli, i) => (
                        <div key={poli.name}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-slate-700">{poli.name}</span>
                            <span className="text-sm font-semibold text-slate-800">
                              {formatRupiah(poli.revenue)}
                              {poli.targetRevenue > 0 && (
                                <span className="text-slate-400 font-normal">
                                  {' '}
                                  / {formatRupiah(poli.targetRevenue)}
                                </span>
                              )}
                            </span>
                          </div>
                          <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${
                                  poli.targetRevenue && poli.targetRevenue > 0
                                    ? Math.min((poli.revenue / poli.targetRevenue) * 100, 100)
                                    : 0
                                }%`,
                                backgroundColor: POLI_COLORS[(POLY_TOP_N + i) % POLI_COLORS.length],
                              }}
                            />
                          </div>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => setPolyRevenueExpanded(false)}
                        className="w-full text-center py-2 text-sm text-slate-500 hover:text-slate-700 font-medium"
                      >
                        Tampilkan lebih sedikit
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <p className="text-slate-400 text-sm py-4">Belum ada data transaksi untuk periode ini</p>
              )}
            </CardContent>
          </Card>

          {/* Kunjungan Per Poli - top 5 + load more */}
          <Card className="border-slate-200 shadow-md overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
              <CardTitle className="text-base">Kunjungan Per Poli (Periode)</CardTitle>
              <p className="text-slate-500 text-xs">Top 5 + load more. Data sesuai filter tanggal</p>
              <p className="text-sm mt-1">
                <span className="font-semibold text-slate-900">
                  {totalTransactionsInPeriod.toLocaleString('id-ID')} visit
                </span>
                <span className="text-slate-400">
                  {' '}
                  / {visitsTarget.toLocaleString('id-ID')} target
                </span>
              </p>
            </CardHeader>
            <CardContent className="pt-4">
              {visitsPerPoli.length > 0 ? (
                <div className="space-y-4">
                  {visitsTopFive.map((p, i) => (
                    <div key={p.name}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-slate-700">{p.name}</span>
                        <span className="text-sm font-semibold text-slate-800">
                          {p.count.toLocaleString('id-ID')} kunjungan
                          {p.targetVisits > 0 && (
                            <span className="text-slate-400 font-normal">
                              {' '}
                              / {p.targetVisits.toLocaleString('id-ID')} target
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${
                              p.targetVisits && p.targetVisits > 0
                                ? Math.min((p.count / p.targetVisits) * 100, 100)
                                : 0
                            }%`,
                            backgroundColor: POLI_COLORS[i % POLI_COLORS.length],
                          }}
                        />
                      </div>
                    </div>
                  ))}
                  {visitsRest.length > 0 && !polyVisitsExpanded && (
                    <button
                      type="button"
                      onClick={() => setPolyVisitsExpanded(true)}
                      className="w-full text-center py-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Tampilkan lebih banyak ({visitsRest.length})
                    </button>
                  )}
                  {polyVisitsExpanded && visitsRest.length > 0 && (
                    <>
                      {visitsRest.map((p, i) => (
                        <div key={p.name}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-slate-700">{p.name}</span>
                            <span className="text-sm font-semibold text-slate-800">
                              {p.count.toLocaleString('id-ID')} kunjungan
                              {p.targetVisits > 0 && (
                                <span className="text-slate-400 font-normal">
                                  {' '}
                                  / {p.targetVisits.toLocaleString('id-ID')} target
                                </span>
                              )}
                            </span>
                          </div>
                          <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${
                                  p.targetVisits && p.targetVisits > 0
                                    ? Math.min((p.count / p.targetVisits) * 100, 100)
                                    : 0
                                }%`,
                                backgroundColor: POLI_COLORS[(POLY_TOP_N + i) % POLI_COLORS.length],
                              }}
                            />
                          </div>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() => setPolyVisitsExpanded(false)}
                        className="w-full text-center py-2 text-sm text-slate-500 hover:text-slate-700 font-medium"
                      >
                        Tampilkan lebih sedikit
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <p className="text-slate-400 text-sm py-4">Belum ada data kunjungan untuk periode ini</p>
              )}
            </CardContent>
          </Card>

          {/* Tren Pendapatan Per Bulan */}
          <Card className="border-slate-200 shadow-md overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-teal-50 to-emerald-50 border-b">
              <CardTitle className="text-base">Tren Pendapatan Per Bulan</CardTitle>
              <p className="text-slate-500 text-xs">Data sesuai filter tanggal</p>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="h-[300px]">
                <Line
                  data={monthlyChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                      y: {
                        beginAtZero: true,
                        ticks: {
                          callback(value: unknown) {
                            const v = Number(value)
                            if (v >= 1e6) return 'Rp ' + (v / 1e6).toFixed(0) + ' jt'
                            return 'Rp ' + (v / 1000).toFixed(0) + ' rb'
                          },
                        },
                      },
                    },
                  }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Tren Kunjungan Per Bulan */}
          <Card className="border-slate-200 shadow-md overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
              <CardTitle className="text-base">Tren Kunjungan Per Bulan</CardTitle>
              <p className="text-slate-500 text-xs">Data sesuai filter tanggal</p>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="h-[300px]">
                <Line
                  data={monthlyVisitsChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                      y: {
                        beginAtZero: true,
                        ticks: {
                          callback(value: unknown) {
                            return String(Number(value))
                          },
                        },
                      },
                    },
                  }}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
