'use client'

import { Fragment, useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'

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

export default function SummarySEPage() {
  const now = new Date()
  const [year, setYear] = useState<number>(now.getFullYear())
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [data, setData] = useState<PivotResponse | null>(null)

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

  const loadData = async (options?: { year?: number }) => {
    const y = options?.year ?? year
    setLoading(true)
    setProgress(0)
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
              setProgress((prev) => Math.min(prev + 100 / totalMonths, 100))
              return null
            }
            setProgress((prev) => Math.min(prev + 100 / totalMonths, 100))
            return json
          } catch (error) {
            console.error(`Error fetch summary SE untuk bulan ${m}:`, error)
            setProgress((prev) => Math.min(prev + 100 / totalMonths, 100))
            return null
          }
        }),
      )

      const pivot = buildPivotData(responses, y)
      setData(pivot)
    } catch (error) {
      console.error('Error fetch summary SE:', error)
      setData(null)
    } finally {
      setProgress(100)
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleApply = () => {
    loadData({ year })
  }

  const yearOptions = []
  const baseYear = now.getFullYear()
  for (let offset = -1; offset <= 1; offset++) {
    yearOptions.push(baseYear + offset)
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Summary Capaian SE & Fundraising</h1>
          <p className="text-slate-500 text-sm">
            Rekap capaian penerimaan per sumber (SE Klinik, Ambulance, Fundraising) langsung dari API Zains.
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
          <Button
            onClick={handleApply}
            disabled={loading}
            className="bg-teal-600 hover:bg-teal-700"
          >
            {loading ? 'Memuat...' : 'Terapkan'}
          </Button>
        </div>
      </div>

      {loading && (
        <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-teal-500 transition-all duration-300"
            style={{ width: `${Math.round(progress)}%` }}
          />
        </div>
      )}

      {data ? (
        <Card>
          <CardHeader className="bg-emerald-50 border-b border-emerald-100">
            <CardTitle className="text-lg font-semibold">
              Summary SE &amp; Fundraising{' '}
              <span className="text-sm font-normal text-slate-500">
                (Tahun {data.year})
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
                  {data.sections.map((section) => (
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
                              <tr key={`row-${section.title}-${group.title}-${row.label}`} className="border-t border-slate-100">
                                <td
                                  className={`px-4 py-2 ${
                                    isTotal
                                      ? 'font-semibold text-slate-800'
                                      : 'text-slate-700'
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
          {loading ? 'Memuat data summary...' : 'Belum ada data yang bisa ditampilkan'}
        </div>
      )}
    </div>
  )
}

