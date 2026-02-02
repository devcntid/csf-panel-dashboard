'use client'

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
import { Line, Doughnut } from 'react-chartjs-2'
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

export default function YayasanPage() {
  // Data untuk chart dual axis
  const dualChartData = {
    labels: ['Agu', 'Sep', 'Okt', 'Nov', 'Des', 'Jan'],
    datasets: [
      {
        label: 'Kunjungan Pasien',
        data: [9800, 10200, 10800, 11500, 11900, 12458],
        borderColor: '#0d9488',
        backgroundColor: 'rgba(13, 148, 136, 0.1)',
        fill: true,
        tension: 0.4,
        borderWidth: 3,
        pointRadius: 5,
        pointBackgroundColor: '#0d9488',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        yAxisID: 'y',
      },
      {
        label: 'Dana Donasi (Juta Rp)',
        data: [1.8, 2.1, 2.3, 2.5, 2.6, 2.8],
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
        borderWidth: 3,
        pointRadius: 5,
        pointBackgroundColor: '#3b82f6',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        yAxisID: 'y1',
      },
    ],
  }

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
          pointStyle: 'circle' as const,
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
          text: 'Kunjungan Pasien',
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
          callback: (value: any) => 'Rp ' + value + 'M',
          font: { size: 11 },
        },
        title: {
          display: true,
          text: 'Dana Donasi',
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

  // Data top cabang
  const topCabang = [
    { name: 'Klinik Ciputat', visits: 4125, percentage: 100, color: 'bg-teal-500' },
    { name: 'Klinik Serpong', visits: 3798, percentage: 92, color: 'bg-blue-500' },
    { name: 'Klinik BSD', visits: 2805, percentage: 68, color: 'bg-purple-500' },
    { name: 'Klinik Pamulang', visits: 1730, percentage: 44, color: 'bg-amber-500' },
  ]

  // Data top poli
  const topPoli = [
    { name: 'Poli Umum', patients: 5524, percentage: 100, color: 'bg-teal-500' },
    { name: 'Poli Gigi', patients: 4312, percentage: 78, color: 'bg-blue-500' },
    { name: 'Poli KIA', patients: 2378, percentage: 43, color: 'bg-pink-500' },
    { name: 'Laboratorium', patients: 994, percentage: 18, color: 'bg-purple-500' },
    { name: 'Poli Mata', patients: 250, percentage: 11, color: 'bg-indigo-500' },
  ]

  // Data kampanye
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

  // Data transaksi donasi
  const donations = [
    {
      time: '15 Jan 2025, 14:23',
      name: 'Ahmad Budiman',
      email: 'ahmad.b@email.com',
      campaign: 'Bantu Pasien BPJS',
      amount: 500000,
      status: 'Berhasil',
    },
    {
      time: '15 Jan 2025, 13:45',
      name: 'Siti Nurhaliza',
      email: 'siti.n@email.com',
      campaign: 'Obat Gratis Lansia',
      amount: 250000,
      status: 'Berhasil',
    },
    {
      time: '15 Jan 2025, 12:10',
      name: 'Budi Santoso',
      email: 'budi.s@email.com',
      campaign: 'Peralatan Medis Baru',
      amount: 1000000,
      status: 'Berhasil',
    },
    {
      time: '15 Jan 2025, 11:30',
      name: 'Dewi Lestari',
      email: 'dewi.l@email.com',
      campaign: 'Bantu Pasien BPJS',
      amount: 300000,
      status: 'Berhasil',
    },
  ]

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `Rp ${(amount / 1000000).toFixed(1)}M`
    }
    return `Rp ${amount.toLocaleString('id-ID')}`
  }

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
              <Select defaultValue="bulan-ini">
                <SelectTrigger className="bg-transparent border-none outline-none text-sm w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bulan-ini">Bulan Ini</SelectItem>
                  <SelectItem value="3-bulan">3 Bulan Terakhir</SelectItem>
                  <SelectItem value="tahun-ini">Tahun Ini</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
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
        {/* Key Metrics - 4 Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Total Kunjungan Pasien */}
          <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl p-5 shadow-sm text-white">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-teal-100 text-sm font-medium">Total Kunjungan Pasien</p>
                <p className="text-3xl font-bold mt-1">12,458</p>
                <div className="flex items-center gap-1 mt-2">
                  <span className="text-teal-100 text-sm font-semibold">↑ 8.2%</span>
                  <span className="text-teal-200 text-xs">vs bulan lalu</span>
                </div>
              </div>
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Total Donasi Terkumpul */}
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-5 shadow-sm text-white">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-blue-100 text-sm font-medium">Total Donasi Terkumpul</p>
                <p className="text-3xl font-bold mt-1">Rp 2.8M</p>
                <div className="flex items-center gap-1 mt-2">
                  <span className="text-blue-100 text-sm font-semibold">↑ 15.4%</span>
                  <span className="text-blue-200 text-xs">vs bulan lalu</span>
                </div>
              </div>
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <Heart className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Penerima Manfaat */}
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-5 shadow-sm text-white">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-purple-100 text-sm font-medium">Penerima Manfaat</p>
                <p className="text-3xl font-bold mt-1">1,847</p>
                <div className="flex items-center gap-1 mt-2">
                  <span className="text-purple-100 text-sm font-semibold">↑ 12.1%</span>
                  <span className="text-purple-200 text-xs">Pasien Gratis/Subsidi</span>
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
                <p className="text-3xl font-bold mt-1">Rp 3.8M</p>
                <div className="flex items-center gap-1 mt-2">
                  <span className="text-amber-100 text-sm font-semibold">↑ 9.7%</span>
                  <span className="text-amber-200 text-xs">Non-donasi</span>
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
                <h3 className="font-semibold text-slate-800">Tren Operasional vs Sosial</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Perbandingan Kunjungan Pasien & Dana Donasi
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Select defaultValue="semua-cabang">
                  <SelectTrigger className="text-sm bg-slate-100 rounded-lg px-3 py-1.5 border-none w-[150px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="semua-cabang">Semua Cabang</SelectItem>
                    <SelectItem value="ciputat">Klinik Ciputat</SelectItem>
                    <SelectItem value="serpong">Klinik Serpong</SelectItem>
                    <SelectItem value="bsd">Klinik BSD</SelectItem>
                    <SelectItem value="pamulang">Klinik Pamulang</SelectItem>
                  </SelectContent>
                </Select>
                <Select defaultValue="6-bulan">
                  <SelectTrigger className="text-sm bg-slate-100 rounded-lg px-3 py-1.5 border-none w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="6-bulan">6 Bulan</SelectItem>
                    <SelectItem value="3-bulan">3 Bulan</SelectItem>
                    <SelectItem value="1-tahun">1 Tahun</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="h-[300px]">
              <Line data={dualChartData} options={dualChartOptions} />
            </div>
          </div>

          {/* Target Donasi Card */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
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
                  Kunjungan
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {topCabang.map((cabang, index) => (
                  <div key={index} className="flex items-center gap-3">
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
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Top 5 Poli Paling Aktif */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle>Top 5 Poli Paling Aktif</CardTitle>
                <span className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full font-medium">
                  Pasien
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {topPoli.map((poli, index) => (
                  <div key={index} className="flex items-center gap-3">
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
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Campaign & Financial Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Active Campaigns */}
          <Card>
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
                <Select defaultValue="bulan-ini">
                  <SelectTrigger className="text-sm bg-slate-100 rounded-lg px-3 py-1.5 border-none w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bulan-ini">Bulan Ini</SelectItem>
                    <SelectItem value="kuartal">Kuartal Ini</SelectItem>
                    <SelectItem value="tahun">Tahun Ini</SelectItem>
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
                    <span className="font-bold text-slate-800">Rp 3.8M</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-blue-500 rounded-full" />
                      <span className="text-sm text-slate-700">Dana Donasi</span>
                    </div>
                    <span className="font-bold text-slate-800">Rp 2.8M</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-purple-500 rounded-full" />
                      <span className="text-sm text-slate-700">Subsidi Pemerintah</span>
                    </div>
                    <span className="font-bold text-slate-800">Rp 1.2M</span>
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
                    <span className="font-bold text-slate-800">Rp 2.5M</span>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-amber-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 bg-amber-500 rounded-full" />
                      <span className="text-sm text-slate-700">Program Sosial</span>
                    </div>
                    <span className="font-bold text-slate-800">Rp 1.8M</span>
                  </div>
                </div>
              </div>
              {/* Net Balance */}
              <div className="mt-6 pt-4 border-t-2 border-slate-200">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-slate-700">Saldo Bersih</span>
                  <span className="text-2xl font-bold text-teal-600">+ Rp 3.5M</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Donations Table */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle>Transaksi Donasi Terbaru</CardTitle>
              <Button variant="ghost" className="text-blue-600 hover:text-blue-700 text-sm font-medium h-auto p-0">
                Lihat Semua <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">
                      Waktu
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">
                      Nama Donatur
                    </th>
                    <th className="text-left px-5 py-3 text-xs font-semibold text-slate-500 uppercase">
                      Kampanye
                    </th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-slate-500 uppercase">
                      Nominal
                    </th>
                    <th className="text-center px-5 py-3 text-xs font-semibold text-slate-500 uppercase">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {donations.map((donation, index) => (
                    <tr key={index} className="hover:bg-slate-50">
                      <td className="px-5 py-4 text-sm text-slate-600">{donation.time}</td>
                      <td className="px-5 py-4">
                        <p className="font-medium text-slate-800">{donation.name}</p>
                        <p className="text-xs text-slate-500">{donation.email}</p>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                            donation.campaign === 'Bantu Pasien BPJS'
                              ? 'bg-blue-100 text-blue-700'
                              : donation.campaign === 'Obat Gratis Lansia'
                                ? 'bg-teal-100 text-teal-700'
                                : 'bg-purple-100 text-purple-700'
                          }`}
                        >
                          {donation.campaign}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right font-bold text-slate-800">
                        {formatCurrency(donation.amount)}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className="inline-flex px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          {donation.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
