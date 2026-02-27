'use client'

import { useEffect, useState, useMemo } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import { getAllClinics } from '@/lib/actions/config'

type MonthlyItem = {
  month: number
  month_name: string
  sum: number
  count: number
}

type MonthlyResponse = {
  success: boolean
  year: number
  clinic: { id: number; name: string; alias: string }
  monthly: MonthlyItem[]
  grand_total: { sum: number; count: number }
}

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

function formatRupiah(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

const monthOptions = [
  { value: '1', label: 'Jan' },
  { value: '2', label: 'Feb' },
  { value: '3', label: 'Mar' },
  { value: '4', label: 'Apr' },
  { value: '5', label: 'Mei' },
  { value: '6', label: 'Jun' },
  { value: '7', label: 'Jul' },
  { value: '8', label: 'Agu' },
  { value: '9', label: 'Sep' },
  { value: '10', label: 'Okt' },
  { value: '11', label: 'Nov' },
  { value: '12', label: 'Des' },
]

export default function SummarySEChartPage() {
  const now = new Date()
  const [year, setYear] = useState<number>(now.getFullYear())
  const [clinicId, setClinicId] = useState<string>('')
  const [clinics, setClinics] = useState<{ id: number; name: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<MonthlyResponse | null>(null)

  useEffect(() => {
    getAllClinics()
      .then((list) => {
        const arr = Array.isArray(list) ? list : []
        setClinics(arr)
        if (!clinicId && arr.length > 0) {
          const defaultClinic =
            arr.find((c) => String(c.name).toLowerCase().includes('jakarta')) ?? arr[0]
          setClinicId(String(defaultClinic.id))
        }
      })
      .catch((error) => {
        console.error('Gagal memuat daftar klinik untuk chart SE:', error)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadData = async () => {
    if (!clinicId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ year: String(year), clinic_id: clinicId })
      const res = await fetch(`/api/summary/se-monthly?${params.toString()}`, { cache: 'no-store' })
      const json = (await res.json()) as MonthlyResponse
      if (!json.success) {
        console.error('Gagal mengambil summary SE monthly', json)
        setData(null)
        return
      }
      setData(json)
    } catch (error) {
      console.error('Error fetch summary SE monthly:', error)
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (clinicId) {
      loadData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicId])

  const yearOptions = []
  const baseYear = now.getFullYear()
  for (let offset = -1; offset <= 1; offset++) {
    yearOptions.push(baseYear + offset)
  }

  const monthSums = useMemo(() => {
    if (!data) return monthOptions.map(() => 0)
    const map = new Map<number, number>()
    for (const item of data.monthly) {
      const key = Number(item.month || 0)
      map.set(key, Number(item.sum || 0))
    }
    return monthOptions.map((_, idx) => map.get(idx + 1) ?? 0)
  }, [data])

  const clinicChartData = useMemo(() => {
    const values = monthSums
    if (!values.some((v) => v > 0)) return null
    const labels = monthOptions.map((m) => m.label)
    return {
      labels,
      datasets: [
        {
          label: 'Capaian SE per Bulan',
          data: values,
          backgroundColor: '#0d9488',
        },
      ],
    }
  }, [monthSums])

  const horizontalBarOptions = (title: string) => ({
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: false,
        text: title,
      },
      tooltip: {
        callbacks: {
          label: (ctx: any) => {
            const v = ctx.parsed.x ?? ctx.raw
            return formatRupiah(Number(v || 0))
          },
        },
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        ticks: {
          callback: (value: any) => formatRupiah(Number(value)),
        },
      },
      y: {
        ticks: {
          autoSkip: false,
        },
      },
    },
  })

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Grafik Capaian SE per Bulan</h1>
          <p className="text-slate-500 text-sm">
            Visualisasi agregat capaian SE per klinik per bulan langsung dari API Zains (group_by=monthly).
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
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
          <Select value={clinicId} onValueChange={(v) => setClinicId(v)}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Pilih Klinik" />
            </SelectTrigger>
            <SelectContent>
              {clinics.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={loadData}
            disabled={loading}
            className="bg-teal-600 hover:bg-teal-700"
          >
            {loading ? 'Memuat...' : 'Terapkan'}
          </Button>
        </div>
      </div>

      {data ? (
        <div className="grid grid-cols-1 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Capaian SE Bulanan -{' '}
                <span className="font-semibold">
                  {data.clinic.alias} ({data.year})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
                <div className="lg:col-span-3 h-[320px]">
                  {clinicChartData && clinicChartData.labels.length > 0 ? (
                    <Bar data={clinicChartData} options={horizontalBarOptions('Capaian SE per Klinik')} />
                  ) : (
                    <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                      Tidak ada data
                    </div>
                  )}
                </div>
                <div className="lg:col-span-2">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="py-2 px-3 text-left text-xs font-semibold text-slate-600">
                          Bulan
                        </th>
                        <th className="py-2 px-3 text-right text-xs font-semibold text-slate-600">
                          Capaian
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {!data.monthly.length ? (
                        <tr>
                          <td
                            colSpan={2}
                            className="py-4 px-3 text-center text-slate-400 text-xs"
                          >
                            Tidak ada data
                          </td>
                        </tr>
                      ) : (
                        monthOptions.map((m, idx) => {
                          const item = data.monthly.find((it) => Number(it.month) === idx + 1)
                          const value = item ? item.sum : 0
                          return (
                            <tr key={m.value} className="border-b border-slate-100">
                              <td className="py-1.5 px-3 text-xs text-slate-700">{m.label}</td>
                              <td className="py-1.5 px-3 text-xs text-right text-slate-800 tabular-nums">
                                {formatRupiah(value)}
                              </td>
                            </tr>
                          )
                        })
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-slate-300 bg-slate-50">
                        <td className="py-2 px-3 text-xs font-semibold text-slate-700">
                          Total Tahun {data.year}
                        </td>
                        <td className="py-2 px-3 text-xs font-semibold text-right text-slate-900 tabular-nums">
                          {formatRupiah(data.grand_total.sum)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="flex items-center justify-center py-12 text-slate-400 text-sm">
          {loading ? 'Memuat data summary...' : 'Belum ada data yang bisa ditampilkan'}
        </div>
      )}
    </div>
  )
}

