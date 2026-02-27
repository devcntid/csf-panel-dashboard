'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
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

type SummaryRow = {
  label: string
  value: number
}

type SectionSummary = {
  title: string
  groups: {
    title: string
    rows: SummaryRow[]
  }[]
}

type SummaryResponse = {
  success: boolean
  year: number
  period: { tgl_awal: string; tgl_akhir: string }
  sections: SectionSummary[]
}

type PivotRow = {
  sectionTitle: string
  groupTitle: string
  label: string
  values: number[] // index 0 = Jan, 11 = Des
}

type PivotSection = {
  title: string
  groups: {
    title: string
    rows: PivotRow[]
  }[]
}

type PivotResponse = {
  success: boolean
  year: number
  sections: PivotSection[]
}

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

export default function SummaryDashboardPage() {
  const now = new Date()
  const [year, setYear] = useState<number>(now.getFullYear())

  // State untuk tabel pivot SE & Fundraising
  const [loadingTable, setLoadingTable] = useState(false)
  const [tableProgress, setTableProgress] = useState(0)
  const [tableData, setTableData] = useState<PivotResponse | null>(null)

  // State untuk chart SE per klinik per bulan
  const [clinicId, setClinicId] = useState<string>('')
  const [clinics, setClinics] = useState<{ id: number; name: string }[]>([])
  const [loadingChart, setLoadingChart] = useState(false)
  const [chartData, setChartData] = useState<MonthlyResponse | null>(null)

  // Ambil daftar klinik untuk dropdown chart
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

  const buildPivotData = (responses: Array<SummaryResponse | null>, targetYear: number): PivotResponse | null => {
    const monthCount = monthOptions.length
    const rowMap = new Map<string, PivotRow>()
    const sectionOrder: string[] = []
    const groupOrderBySection = new Map<string, string[]>()
    const rowOrderByGroup = new Map<string, string[]>()

    const getGroupKey = (sectionTitle: string, groupTitle: string) => `${sectionTitle}||${groupTitle}`

    responses.forEach((res, monthIndex) => {
      if (!res || !res.success || !Array.isArray(res.sections)) return

      res.sections.forEach((section) => {
        if (!sectionOrder.includes(section.title)) {
          sectionOrder.push(section.title)
        }

        const groupOrderKey = section.title
        if (!groupOrderBySection.has(groupOrderKey)) {
          groupOrderBySection.set(groupOrderKey, [])
        }
        const groupsOrder = groupOrderBySection.get(groupOrderKey)!

        section.groups.forEach((group) => {
          const gKey = getGroupKey(section.title, group.title)
          if (!groupsOrder.includes(group.title)) {
            groupsOrder.push(group.title)
          }

          if (!rowOrderByGroup.has(gKey)) {
            rowOrderByGroup.set(gKey, [])
          }
          const rowsOrder = rowOrderByGroup.get(gKey)!

          group.rows.forEach((row) => {
            const key = `${section.title}||${group.title}||${row.label}`
            if (!rowMap.has(key)) {
              rowMap.set(key, {
                sectionTitle: section.title,
                groupTitle: group.title,
                label: row.label,
                values: Array(monthCount).fill(0),
              })
              rowsOrder.push(row.label)
            }
            const pivotRow = rowMap.get(key)!
            pivotRow.values[monthIndex] = row.value
          })
        })
      })
    })

    if (rowMap.size === 0) {
      return null
    }

    const sections: PivotSection[] = sectionOrder.map((sectionTitle) => {
      const groupTitles = groupOrderBySection.get(sectionTitle) ?? []
      const groups = groupTitles.map((groupTitle) => {
        const gKey = getGroupKey(sectionTitle, groupTitle)
        const rowLabels = rowOrderByGroup.get(gKey) ?? []
        const rows = rowLabels.map((label) => {
          const key = `${sectionTitle}||${groupTitle}||${label}`
          return rowMap.get(key)!
        })
        return { title: groupTitle, rows }
      })
      return { title: sectionTitle, groups }
    })

    return {
      success: true,
      year: targetYear,
      sections,
    }
  }

  const loadTableData = async (options?: { year?: number }) => {
    const y = options?.year ?? year
    setLoadingTable(true)
    setTableProgress(0)
    try {
      const monthNumbers = monthOptions.map((m) => Number(m.value))
      const totalMonths = monthNumbers.length || 1
      const responses = await Promise.all(
        monthNumbers.map(async (m) => {
          try {
            const params = new URLSearchParams({ year: String(y), month: String(m) })
            const res = await fetch(`/api/summary/se?${params.toString()}`, { cache: 'no-store' })
            const json = (await res.json()) as SummaryResponse
            if (!json.success) {
              console.error(`Gagal mengambil summary SE untuk bulan ${m}`, json)
              setTableProgress((prev) => Math.min(prev + 100 / totalMonths, 100))
              return null
            }
            setTableProgress((prev) => Math.min(prev + 100 / totalMonths, 100))
            return json
          } catch (error) {
            console.error(`Error fetch summary SE untuk bulan ${m}:`, error)
            setTableProgress((prev) => Math.min(prev + 100 / totalMonths, 100))
            return null
          }
        }),
      )

      const pivot = buildPivotData(responses, y)
      setTableData(pivot)
    } catch (error) {
      console.error('Error fetch summary SE:', error)
      setTableData(null)
    } finally {
      setTableProgress(100)
      setLoadingTable(false)
    }
  }

  const loadChartData = async (options?: { year?: number; clinicId?: string }) => {
    const y = options?.year ?? year
    const cId = options?.clinicId ?? clinicId
    if (!cId) return
    setLoadingChart(true)
    try {
      const params = new URLSearchParams({ year: String(y), clinic_id: cId })
      const res = await fetch(`/api/summary/se-monthly?${params.toString()}`, { cache: 'no-store' })
      const json = (await res.json()) as MonthlyResponse
      if (!json.success) {
        console.error('Gagal mengambil summary SE monthly', json)
        setChartData(null)
        return
      }
      setChartData(json)
    } catch (error) {
      console.error('Error fetch summary SE monthly:', error)
      setChartData(null)
    } finally {
      setLoadingChart(false)
    }
  }

  useEffect(() => {
    loadTableData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (clinicId) {
      loadChartData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clinicId])

  const handleApply = () => {
    const y = year
    loadTableData({ year: y })
    loadChartData({ year: y })
  }

  const yearOptions = []
  const baseYear = now.getFullYear()
  for (let offset = -1; offset <= 1; offset++) {
    yearOptions.push(baseYear + offset)
  }

  const monthSums = useMemo(() => {
    if (!chartData) return monthOptions.map(() => 0)
    const map = new Map<number, number>()
    for (const item of chartData.monthly) {
      const key = Number(item.month || 0)
      map.set(key, Number(item.sum || 0))
    }
    return monthOptions.map((_, idx) => map.get(idx + 1) ?? 0)
  }, [chartData])

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
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Summary Dashboard</h1>
          <p className="text-slate-500 text-sm">
            Rekap capaian SE Klinik, Ambulance, Fundraising dan grafik capaian SE per klinik langsung dari API Zains.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={String(year)}
            onValueChange={(v) => setYear(Number(v))}
          >
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
            onClick={handleApply}
            disabled={loadingTable || loadingChart}
            className="bg-teal-600 hover:bg-teal-700"
          >
            {loadingTable || loadingChart ? 'Memuat...' : 'Terapkan'}
          </Button>
        </div>
      </div>

      {loadingTable && (
        <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-teal-500 transition-all duration-300"
            style={{ width: `${Math.round(tableProgress)}%` }}
          />
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-4">
          {tableData ? (
            <Card>
              <CardHeader className="bg-emerald-50 border-b border-emerald-100">
                <CardTitle className="text-lg font-semibold">
                  Summary SE &amp; Fundraising{' '}
                  <span className="text-sm font-normal text-slate-500">
                    (Tahun {tableData.year})
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[720px]">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">
                          Keterangan
                        </th>
                        {monthOptions.map((m) => (
                          <th
                            key={m.value}
                            className="px-2 py-2 text-right text-xs font-semibold text-slate-600"
                          >
                            {m.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tableData.sections.map((section) => (
                        <Fragment key={`section-${section.title}`}>
                          <tr>
                            <td
                              className="px-4 py-2 text-xs font-semibold text-slate-700 uppercase tracking-wide bg-emerald-50 border-t border-emerald-100"
                              colSpan={1 + monthOptions.length}
                            >
                              {section.title}
                            </td>
                          </tr>
                          {section.groups.map((group) => (
                            <Fragment key={`group-${section.title}-${group.title || 'default'}`}>
                              {group.title && (
                                <tr>
                                  <td
                                    className="px-4 py-2 text-xs font-semibold text-slate-600 uppercase tracking-wide bg-slate-50 border-t border-slate-200"
                                    colSpan={1 + monthOptions.length}
                                  >
                                    {group.title}
                                  </td>
                                </tr>
                              )}
                              {group.rows.map((row) => {
                                const isTotal =
                                  row.label.toUpperCase().startsWith('TOTAL') ||
                                  row.label.toUpperCase().includes('GRAND TOTAL')
                                const isGrandTotal = row.label
                                  .toUpperCase()
                                  .includes('GRAND TOTAL')
                                return (
                                  <tr
                                    key={`row-${section.title}-${group.title}-${row.label}`}
                                    className="border-t border-slate-100"
                                  >
                                    <td
                                      className={`px-4 py-2 ${
                                        isTotal ? 'font-semibold text-slate-800' : 'text-slate-700'
                                      }`}
                                    >
                                      {row.label}
                                    </td>
                                    {row.values.map((val, idx) => (
                                      <td
                                        key={`cell-${section.title}-${group.title}-${row.label}-${idx}`}
                                        className={`px-2 py-2 text-right tabular-nums ${
                                          isGrandTotal
                                            ? 'font-bold text-emerald-700'
                                            : isTotal
                                              ? 'font-semibold text-slate-800'
                                              : 'text-slate-800'
                                        }`}
                                      >
                                        {formatRupiah(val)}
                                      </td>
                                    ))}
                                  </tr>
                                )
                              })}
                            </Fragment>
                          ))}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="flex items-center justify-center py-12 text-slate-400 text-sm">
              {loadingTable ? 'Memuat data summary...' : 'Belum ada data summary yang bisa ditampilkan'}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Grafik Capaian SE per Bulan
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4">
                <div className="h-[280px]">
                  {clinicChartData && clinicChartData.labels.length > 0 ? (
                    <Bar data={clinicChartData} options={horizontalBarOptions('Capaian SE per Klinik')} />
                  ) : (
                    <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                      {loadingChart ? 'Memuat grafik...' : 'Tidak ada data grafik'}
                    </div>
                  )}
                </div>
                <div>
                  {chartData ? (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50">
                          <th className="py-2 px-3 text-left font-semibold text-slate-600">
                            Bulan
                          </th>
                          <th className="py-2 px-3 text-right font-semibold text-slate-600">
                            Capaian
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {!chartData.monthly.length ? (
                          <tr>
                            <td
                              colSpan={2}
                              className="py-4 px-3 text-center text-slate-400"
                            >
                              Tidak ada data
                            </td>
                          </tr>
                        ) : (
                          monthOptions.map((m, idx) => {
                            const item = chartData.monthly.find((it) => Number(it.month) === idx + 1)
                            const value = item ? item.sum : 0
                            return (
                              <tr key={m.value} className="border-b border-slate-100">
                                <td className="py-1.5 px-3 text-slate-700">{m.label}</td>
                                <td className="py-1.5 px-3 text-right text-slate-800 tabular-nums">
                                  {formatRupiah(value)}
                                </td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-slate-300 bg-slate-50">
                          <td className="py-2 px-3 font-semibold text-slate-700">
                            Total Tahun {chartData.year}
                          </td>
                          <td className="py-2 px-3 font-semibold text-right text-slate-900 tabular-nums">
                            {formatRupiah(chartData.grand_total.sum)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  ) : (
                    <div className="flex items-center justify-center py-6 text-slate-400 text-xs">
                      {loadingChart ? 'Memuat ringkasan grafik...' : 'Belum ada data grafik yang bisa ditampilkan'}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

