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
import { DollarSign, Users, TrendingUp, CheckCircle, RefreshCw, Calendar } from 'lucide-react'
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

export default function DashboardPage() {
  // Static data for charts
  const hourlyData = {
    labels: ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'],
    datasets: [
      {
        label: 'Hari Ini',
        data: [8500000, 12300000, 15600000, 18900000, 22400000, 25100000, 27800000, 30500000, 32200000, 34500000],
        borderColor: '#0d9488',
        backgroundColor: 'rgba(13, 148, 136, 0.1)',
        tension: 0.4,
        fill: true,
      },
      {
        label: 'Kemarin',
        data: [7200000, 10500000, 13800000, 16200000, 19500000, 22100000, 24600000, 27200000, 29800000, 31500000],
        borderColor: '#cbd5e1',
        backgroundColor: 'rgba(203, 213, 225, 0.1)',
        tension: 0.4,
        fill: true,
      },
    ],
  }

  const branchData = {
    labels: ['Ciputat', 'Serpong', 'BSD', 'Pamulang'],
    datasets: [
      {
        label: 'Pendapatan (Juta Rp)',
        data: [45.2, 38.7, 28.5, 15.1],
        backgroundColor: ['#0d9488', '#14b8a6', '#2dd4bf', '#5eead4'],
      },
    ],
  }

  const patientData = {
    labels: ['BPJS', 'Umum', 'Asuransi'],
    datasets: [
      {
        data: [58, 32, 10],
        backgroundColor: ['#0d9488', '#3b82f6', '#8b5cf6'],
      },
    ],
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
            {/* Date Range Filter */}
            <div className="flex items-center gap-2 bg-slate-100 rounded-lg px-3 py-2">
              <Calendar className="w-4 h-4 text-slate-500" />
              <Input
                type="date"
                defaultValue="2025-01-15"
                className="bg-transparent text-sm border-none p-0 h-auto focus-visible:ring-0"
              />
              <span className="text-slate-400">-</span>
              <Input
                type="date"
                defaultValue="2025-01-15"
                className="bg-transparent text-sm border-none p-0 h-auto focus-visible:ring-0"
              />
            </div>
            {/* Branch Filter */}
            <Select defaultValue="all">
              <SelectTrigger className="w-[160px] bg-slate-100 border-none">
                <SelectValue placeholder="Pilih Cabang" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Cabang</SelectItem>
                <SelectItem value="ciputat">Klinik Ciputat</SelectItem>
                <SelectItem value="serpong">Klinik Serpong</SelectItem>
                <SelectItem value="bsd">Klinik BSD</SelectItem>
                <SelectItem value="pamulang">Klinik Pamulang</SelectItem>
              </SelectContent>
            </Select>
            {/* Poli Filter */}
            <Select defaultValue="all">
              <SelectTrigger className="w-[160px] bg-slate-100 border-none">
                <SelectValue placeholder="Pilih Poli" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Poli</SelectItem>
                <SelectItem value="umum">Poli Umum</SelectItem>
                <SelectItem value="gigi">Poli Gigi</SelectItem>
                <SelectItem value="kia">Poli KIA</SelectItem>
                <SelectItem value="lab">Laboratorium</SelectItem>
              </SelectContent>
            </Select>
            {/* Refresh Button */}
            <Button className="bg-teal-600 hover:bg-teal-700">
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </header>

      {/* Dashboard Content */}
      <div className="p-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Total Pendapatan */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-slate-500 text-sm font-medium">Total Pendapatan</p>
                  <p className="text-2xl font-bold text-slate-800 mt-1">Rp 127.450.000</p>
                  <div className="flex items-center gap-1 mt-2">
                    <span className="text-green-500 text-sm font-semibold">↑ 12.5%</span>
                    <span className="text-slate-400 text-xs">vs kemarin</span>
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
                  <p className="text-2xl font-bold text-slate-800 mt-1">1,247</p>
                  <div className="flex items-center gap-1 mt-2">
                    <span className="text-green-500 text-sm font-semibold">↑ 8.2%</span>
                    <span className="text-slate-400 text-xs">vs kemarin</span>
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
                  <p className="text-2xl font-bold text-slate-800 mt-1">84.7%</p>
                  <div className="flex items-center gap-1 mt-2">
                    <span className="text-amber-500 text-sm font-semibold">15.3%</span>
                    <span className="text-slate-400 text-xs">remaining</span>
                  </div>
                </div>
                <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-amber-600" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sync Status */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-slate-500 text-sm font-medium">Status Sync Zains</p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                    <p className="text-xl font-bold text-green-600">Connected</p>
                  </div>
                  <div className="flex items-center gap-1 mt-2">
                    <span className="text-slate-500 text-sm">1,198</span>
                    <span className="text-slate-400 text-xs">synced today</span>
                  </div>
                </div>
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Gauge Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Realisasi vs Target Harian</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-4">
                <div className="relative">
                  <svg className="w-48 h-24" viewBox="0 0 200 100">
                    <path
                      d="M 20 80 A 80 80 0 0 1 180 80"
                      fill="none"
                      stroke="#e2e8f0"
                      strokeWidth="20"
                      strokeLinecap="round"
                    />
                    <path
                      d="M 20 80 A 80 80 0 0 1 155 30"
                      fill="none"
                      stroke="#0d9488"
                      strokeWidth="20"
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 text-center">
                    <p className="text-3xl font-bold text-teal-600">84.7%</p>
                    <p className="text-xs text-slate-500">dari target Rp 150jt</p>
                  </div>
                </div>
                <div className="mt-6 w-full flex justify-between text-sm">
                  <div className="text-center">
                    <p className="text-slate-500 text-xs">Realisasi</p>
                    <p className="font-bold text-teal-600">Rp 127.4jt</p>
                  </div>
                  <div className="text-center">
                    <p className="text-slate-500 text-xs">Target</p>
                    <p className="font-bold text-slate-800">Rp 150jt</p>
                  </div>
                  <div className="text-center">
                    <p className="text-slate-500 text-xs">Gap</p>
                    <p className="font-bold text-amber-600">Rp 22.6jt</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Line Chart - Hourly Revenue */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Tren Pendapatan Per Jam</CardTitle>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-teal-500 rounded-full"></div>
                    <span className="text-slate-600">Hari Ini</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-slate-300 rounded-full"></div>
                    <span className="text-slate-600">Kemarin</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <Line data={hourlyData} options={chartOptions} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Bar Chart - Branch Comparison */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Performa Klinik Cabang</CardTitle>
                <Select defaultValue="today">
                  <SelectTrigger className="w-[140px] bg-slate-100 border-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Hari Ini</SelectItem>
                    <SelectItem value="week">Minggu Ini</SelectItem>
                    <SelectItem value="month">Bulan Ini</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <Bar data={branchData} options={chartOptions} />
              </div>
            </CardContent>
          </Card>

          {/* Pie Chart - Patient Composition */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Komposisi Pasien</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[200px] flex items-center justify-center">
                <Pie data={patientData} options={{ responsive: true, maintainAspectRatio: false }} />
              </div>
              <div className="mt-6 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-teal-500 rounded-full"></div>
                    <span className="text-slate-600">BPJS</span>
                  </div>
                  <span className="font-semibold">58%</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <span className="text-slate-600">Umum</span>
                  </div>
                  <span className="font-semibold">32%</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                    <span className="text-slate-600">Asuransi</span>
                  </div>
                  <span className="font-semibold">10%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
