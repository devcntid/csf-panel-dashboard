'use client'

import { use } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AlertCircle, ArrowLeft, Building2, DollarSign, TrendingUp, Users } from 'lucide-react'
import Link from 'next/link'
import { Line, Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

export default function ClinicDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  const clinicData: { [key: string]: any } = {
    ciputat: {
      name: 'Klinik Ciputat',
      revenueToday: 42350000,
      revenueTarget: 45000000,
      totalPatients: 412,
      targetRealization: 94.1,
      avgTransaction: 102800,
      status: 'Connected & Stable',
      statusColor: 'green',
      headerColor: 'from-teal-600 to-teal-700',
      progressColor: 'bg-teal-500',
      operationalHours: '08:00 - 20:00',
      address: 'Jl. Pondok Ranji, Ciputat, Tangerang Selatan 15419',
      phone: '(021) 7490-9999',
      poliData: [
        { name: 'Poli Umum', revenue: 18500000, percentage: 44 },
        { name: 'Poli Gigi', revenue: 12800000, percentage: 30 },
        { name: 'Poli KIA', revenue: 8900000, percentage: 21 },
        { name: 'Laboratorium', revenue: 2150000, percentage: 5 },
      ],
    },
    serpong: {
      name: 'Klinik Serpong',
      revenueToday: 38750000,
      revenueTarget: 40000000,
      totalPatients: 387,
      targetRealization: 96.9,
      avgTransaction: 100100,
      status: 'Connected & Stable',
      statusColor: 'green',
      headerColor: 'from-blue-600 to-blue-700',
      progressColor: 'bg-blue-500',
      operationalHours: '08:00 - 20:00',
      address: 'Jl. Serpong, Tangerang Selatan 15310',
      phone: '(021) 7490-8888',
      poliData: [
        { name: 'Poli Umum', revenue: 16200000, percentage: 42 },
        { name: 'Poli Gigi', revenue: 14500000, percentage: 37 },
        { name: 'Poli KIA', revenue: 6400000, percentage: 17 },
        { name: 'Laboratorium', revenue: 1650000, percentage: 4 },
      ],
    },
    bsd: {
      name: 'Klinik BSD',
      revenueToday: 28100000,
      revenueTarget: 35000000,
      totalPatients: 265,
      targetRealization: 80.3,
      avgTransaction: 106000,
      status: 'Slow Performance',
      statusColor: 'amber',
      headerColor: 'from-purple-600 to-purple-700',
      progressColor: 'bg-amber-500',
      operationalHours: '09:00 - 18:00',
      address: 'Jl. BSD City, Serpong, Tangerang Selatan 15320',
      phone: '(021) 7490-7777',
      poliData: [
        { name: 'Poli Umum', revenue: 14200000, percentage: 51 },
        { name: 'Poli Gigi', revenue: 9800000, percentage: 35 },
        { name: 'Poli KIA', revenue: 3500000, percentage: 12 },
        { name: 'Laboratorium', revenue: 600000, percentage: 2 },
      ],
      alert: true,
      alertTitle: 'Performa di Bawah Target',
      alertMessage: 'Klinik BSD saat ini berkinerja 19.7% di bawah target harian. Perlu evaluasi strategi operasional dan marketing untuk meningkatkan jumlah pasien.',
    },
    pamulang: {
      name: 'Klinik Pamulang',
      revenueToday: 18250000,
      revenueTarget: 30000000,
      totalPatients: 183,
      targetRealization: 60.8,
      avgTransaction: 99700,
      status: 'System Down',
      statusColor: 'red',
      headerColor: 'from-red-600 to-rose-600',
      progressColor: 'bg-red-500',
      operationalHours: '08:00 - 19:00',
      address: 'Jl. Pamulang, Tangerang Selatan 15417',
      phone: '(021) 7490-6666',
      poliData: [
        { name: 'Poli Umum', revenue: 10500000, percentage: 58 },
        { name: 'Poli Gigi', revenue: 5800000, percentage: 32 },
        { name: 'Poli KIA', revenue: 1650000, percentage: 9 },
        { name: 'Laboratorium', revenue: 300000, percentage: 1 },
      ],
      alert: true,
      alertType: 'critical',
      alertTitle: 'Sistem Disconnected - Butuh Perhatian Segera!',
      alertMessage: 'Koneksi ke sistem eClinic Pamulang terputus. Data scraping tidak berhasil sejak 5 menit yang lalu. Periksa kredensial login dan konektivitas jaringan.',
    },
  }

  const clinic = clinicData[id] || clinicData.ciputat

  const hourlyData = {
    labels: ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'],
    datasets: [
      {
        label: 'Pendapatan (Rp)',
        data: [
          2500000, 4200000, 6800000, 9100000, 11500000, 13200000, 15800000, 18200000, 19500000, 20100000, 18500000,
          12300000,
        ],
        borderColor: '#0d9488',
        backgroundColor: 'rgba(13, 148, 136, 0.1)',
        tension: 0.4,
        fill: true,
      },
    ],
  }

  const poliChartData = {
    labels: clinic.poliData.map((p) => p.name),
    datasets: [
      {
        label: 'Pendapatan',
        data: clinic.poliData.map((p) => p.revenue / 1000000),
        backgroundColor: ['#0d9488', '#14b8a6', '#2dd4bf', '#5eead4'],
      },
    ],
  }

  const statusBadgeColors = {
    green: 'bg-green-100 text-green-700',
    amber: 'bg-amber-100 text-amber-700',
    red: 'bg-red-100 text-red-700',
  }

  const statusDotColors = {
    green: 'bg-green-500 animate-pulse',
    amber: 'bg-amber-500',
    red: 'bg-red-500',
  }

  return (
    <div>
      {/* Header */}
      <header className={`bg-gradient-to-r ${clinic.headerColor} text-white px-6 py-6`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/klinik">
              <Button
                variant="ghost"
                size="icon"
                className="hover:bg-white/20 text-white"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center">
              <span className="text-2xl font-bold">
                {clinic.name.charAt(clinic.name.indexOf('K') + 7)}
              </span>
            </div>
            <div>
              <h2 className="text-2xl font-bold">{clinic.name}</h2>
              <p className="text-white/80 text-sm">{clinic.address.split(',')[0]} • ID: CLN-{Object.keys(clinicData).indexOf(id) + 1}</p>
            </div>
          </div>
          <Badge className={`${statusBadgeColors[clinic.statusColor as keyof typeof statusBadgeColors]}`}>
            <div
              className={`w-2 h-2 rounded-full mr-2 ${statusDotColors[clinic.statusColor as keyof typeof statusDotColors]}`}
            />
            {clinic.status}
          </Badge>
        </div>
      </header>

      {/* Content */}
      <div className="p-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="p-5">
              <p className="text-slate-500 text-sm font-medium">Pendapatan Hari Ini</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">
                Rp {(clinic.revenueToday / 1000000).toFixed(1)}jt
              </p>
              <div className="flex items-center gap-1 mt-2">
                <span className="text-green-500 text-sm font-semibold">↑ 14%</span>
                <span className="text-slate-400 text-xs">vs kemarin</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <p className="text-slate-500 text-sm font-medium">Total Pasien</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{clinic.totalPatients}</p>
              <div className="flex items-center gap-1 mt-2">
                <span className="text-green-500 text-sm font-semibold">↑ 9%</span>
                <span className="text-slate-400 text-xs">vs kemarin</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <p className="text-slate-500 text-sm font-medium">Realisasi Target</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{clinic.targetRealization}%</p>
              <div className="w-full h-2 bg-slate-200 rounded-full mt-2">
                <div
                  className={`h-full ${clinic.progressColor} rounded-full`}
                  style={{ width: `${clinic.targetRealization}%` }}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <p className="text-slate-500 text-sm font-medium">Avg. Transaction</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">Rp {(clinic.avgTransaction / 1000).toFixed(0)}K</p>
              <p className="text-slate-400 text-xs mt-2">per pasien</p>
            </CardContent>
          </Card>
        </div>

        {/* Alert if exists */}
        {clinic.alert && (
          <Card
            className={`mb-6 border-2 ${
              clinic.alertType === 'critical' ? 'border-red-300 bg-red-50' : 'border-amber-200 bg-amber-50'
            }`}
          >
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <AlertCircle
                  className={`w-6 h-6 flex-shrink-0 ${
                    clinic.alertType === 'critical' ? 'text-red-600' : 'text-amber-500'
                  }`}
                />
                <div className="flex-1">
                  <h4
                    className={`font-bold ${
                      clinic.alertType === 'critical' ? 'text-red-800' : 'text-amber-800'
                    }`}
                  >
                    {clinic.alertTitle}
                  </h4>
                  <p
                    className={`text-sm mt-1 ${
                      clinic.alertType === 'critical' ? 'text-red-700' : 'text-amber-700'
                    }`}
                  >
                    {clinic.alertMessage}
                  </p>
                  {clinic.alertType === 'critical' && (
                    <div className="flex gap-3 mt-4">
                      <Button className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 text-sm font-semibold">
                        Retry Connection
                      </Button>
                      <Button
                        variant="outline"
                        className="border-red-300 text-red-700 hover:bg-red-50 px-4 py-2 text-sm font-semibold bg-transparent"
                      >
                        Check Credentials
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pendapatan Per Poli - Hari Ini</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {clinic.poliData.map((poli) => (
                  <div key={poli.name}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-slate-600">{poli.name}</span>
                      <span className="text-sm font-semibold text-slate-800">Rp {(poli.revenue / 1000000).toFixed(1)}jt</span>
                    </div>
                    <div className="w-full h-3 bg-slate-200 rounded-full">
                      <div
                        className={`h-full ${clinic.progressColor} rounded-full`}
                        style={{ width: `${poli.percentage}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tren Pendapatan Per Jam</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <Line
                  data={hourlyData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                      y: {
                        ticks: {
                          callback: function (value) {
                            return 'Rp ' + (value / 1000000).toFixed(0) + 'jt'
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

        {/* Recent Transactions */}
        <Card>
          <CardHeader>
            <CardTitle>Transaksi Terbaru</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="flex items-center justify-between p-3 border border-slate-200 rounded-lg hover:bg-slate-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-teal-100 rounded-full flex items-center justify-center">
                      <Users className="w-5 h-5 text-teal-600" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-800">Pasien #{String(i).padStart(3, '0')}</p>
                      <p className="text-xs text-slate-500">14:3{i}:00 - {clinic.poliData[0].name}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-slate-800">
                      Rp {((clinic.avgTransaction + i * 5000) / 1000).toFixed(0)}K
                    </p>
                    <Badge className="bg-green-100 text-green-700 text-xs">Lunas</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
