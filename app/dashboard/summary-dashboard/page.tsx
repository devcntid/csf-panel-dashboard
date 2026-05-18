'use client'

import { Fragment, useEffect, useState, useCallback } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import Link from 'next/link'
import { Clock, Download, RefreshCw } from 'lucide-react'
import type { PivotResponse, RowFilterParams } from '@/lib/summary-se-yearly-types'
import { formatRupiah, formatAchievementPct } from '@/lib/summary-se-yearly-types'
import {
  fetchSeYearlySummary,
  SE_YEARLY_MAX_ATTEMPTS,
} from '@/lib/fetch-se-yearly-summary'
import {
  TransactionDetailModal,
  type TransactionModalState,
} from './transaction-detail-modal'

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

  // State untuk modal detail transaksi
  const [txModal, setTxModal] = useState<TransactionModalState>(null)

  const openTransactionModal = useCallback((label: string, filterParams: RowFilterParams, y: number, month: number) => {
    setTxModal({ open: true, label, filterParams, year: y, month })
  }, [])

  // State untuk tabel pivot SE & Fundraising
  const [loadingTable, setLoadingTable] = useState(false)
  const [tableData, setTableData] = useState<PivotResponse | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [elapsedSec, setElapsedSec] = useState(0)

  useEffect(() => {
    if (!loadingTable) return
    setElapsedSec(0)
    const t0 = Date.now()
    const id = setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - t0) / 1000))
    }, 1000)
    return () => clearInterval(id)
  }, [loadingTable])

  const loadTableData = async (options?: { year?: number; isCancelled?: () => boolean }) => {
    const y = options?.year ?? year
    const isCancelled = options?.isCancelled
    const hadExistingTable = tableData != null

    setLoadingTable(true)
    setLoadError(null)
    setLoadAttempt(0)

    try {
      const result = await fetchSeYearlySummary(y, {
        isCancelled,
        onAttempt: (n) => setLoadAttempt(n),
      })
      if (isCancelled?.()) return
      if (result.ok) {
        setTableData(result.data)
        setLoadError(null)
        return
      }
      if (!hadExistingTable) setTableData(null)
      setLoadError(result.error)
    } finally {
      if (!isCancelled || !isCancelled()) setLoadingTable(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    loadTableData({ isCancelled: () => cancelled })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleApply = () => {
    const y = year
    loadTableData({ year: y })
  }

  const handleExportExcel = async () => {
    if (!tableData) return
    const XLSX = await import('xlsx')

    const months = tableData.months
    const totalCols = 1 + months.length * 3 + 3

    const rows: (string | number | null)[][] = []
    const merges: { s: { r: number; c: number }; e: { r: number; c: number } }[] = []

    // Row 0: month headers
    const headerRow1: (string | number | null)[] = ['Keterangan']
    for (const m of months) {
      headerRow1.push(m.label, null, null)
    }
    headerRow1.push('TOTAL', null, null)
    rows.push(headerRow1)

    // Merges for month headers: each spans 3 columns
    for (let i = 0; i < months.length; i++) {
      const startCol = 1 + i * 3
      merges.push({ s: { r: 0, c: startCol }, e: { r: 0, c: startCol + 2 } })
    }
    const totalStartCol = 1 + months.length * 3
    merges.push({ s: { r: 0, c: totalStartCol }, e: { r: 0, c: totalStartCol + 2 } })

    // Row 1: sub-headers
    const headerRow2: (string | number | null)[] = ['']
    for (let i = 0; i < months.length; i++) {
      headerRow2.push('Target', 'Realisasi', '%')
    }
    headerRow2.push('Target', 'Realisasi', '%')
    rows.push(headerRow2)

    // Data rows
    for (const section of tableData.sections) {
      // Section header
      const sectionRow: (string | number | null)[] = [section.title]
      for (let i = 1; i < totalCols; i++) sectionRow.push(null)
      rows.push(sectionRow)
      const sectionRowIdx = rows.length - 1
      merges.push({ s: { r: sectionRowIdx, c: 0 }, e: { r: sectionRowIdx, c: totalCols - 1 } })

      for (const group of section.groups) {
        if (group.title) {
          const groupRow: (string | number | null)[] = [group.title]
          for (let i = 1; i < totalCols; i++) groupRow.push(null)
          rows.push(groupRow)
          const groupRowIdx = rows.length - 1
          merges.push({ s: { r: groupRowIdx, c: 0 }, e: { r: groupRowIdx, c: totalCols - 1 } })
        }

        for (const row of group.rows) {
          const valueByMonth = new Map<number, number>()
          row.monthly.forEach((p) => valueByMonth.set(p.month, p.sum))
          const targetByMonth = new Map<number, number>()
          if (row.monthlyTargets) {
            row.monthlyTargets.forEach((p) => targetByMonth.set(p.month, p.sum))
          }

          const dataRow: (string | number | null)[] = [row.label]
          let totalTarget = 0
          let totalRealisasi = 0

          for (const m of months) {
            const val = valueByMonth.get(m.month) || 0
            const target = targetByMonth.get(m.month) || 0
            const pct = target > 0 ? Math.round((val / target) * 100) : null
            totalTarget += target
            totalRealisasi += val
            dataRow.push(target || null, val || null, pct !== null ? `${pct}%` : null)
          }

          const aggPct = totalTarget > 0 ? Math.round((totalRealisasi / totalTarget) * 100) : null
          dataRow.push(totalTarget || null, totalRealisasi || null, aggPct !== null ? `${aggPct}%` : null)
          rows.push(dataRow)
        }
      }
    }

    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!merges'] = merges

    // Set column widths
    const colWidths: { wch: number }[] = [{ wch: 22 }]
    for (let i = 0; i < months.length + 1; i++) {
      colWidths.push({ wch: 16 }, { wch: 16 }, { wch: 7 })
    }
    ws['!cols'] = colWidths

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Summary')
    XLSX.writeFile(wb, `Summary_SE_Fundraising_${tableData.year}.xlsx`)
  }

  const yearOptions = []
  const baseYear = now.getFullYear()
  for (let offset = -1; offset <= 1; offset++) {
    yearOptions.push(baseYear + offset)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Summary Dashboard</h1>
          <p className="text-slate-500 text-sm">
            Rekap capaian SE Klinik, Ambulance, Fundraising langsung dari database Zains (via API Next).{' '}
            <Link href="/dashboard/financial-visual" className="text-teal-700 hover:underline font-medium">
              Buka dashboard visual &amp; capaian target
            </Link>
            .
          </p>
          <p className="text-amber-800/90 text-xs mt-1.5 bg-amber-50 border border-amber-100 rounded-md px-2 py-1.5 inline-block max-w-xl">
            Memuat data bisa memakan waktu 1–3 menit karena banyak klinik dan filter agregasi. Mohon ditunggu; jika gagal,
            gunakan <strong>Muat ulang</strong> di bawah.
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
            disabled={loadingTable}
            className="bg-teal-600 hover:bg-teal-700 flex items-center gap-2"
          >
            {loadingTable ? (
              <>
                <Spinner className="size-5 text-white" />
                <span>Memuat...</span>
              </>
            ) : (
              'Terapkan'
            )}
          </Button>
          <Button
            onClick={handleExportExcel}
            disabled={!tableData}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Download className="size-4" />
            Export Excel
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <div className="space-y-4">
          {loadError && (
            <Alert className="border-amber-200 bg-amber-50 text-amber-950 [&>svg]:text-amber-700">
              <RefreshCw className="size-4" />
              <AlertTitle>Belum berhasil memuat data terbaru</AlertTitle>
              <AlertDescription className="text-amber-900/90 space-y-3">
                <p>{loadError}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-amber-300 bg-white hover:bg-amber-100"
                  onClick={() => loadTableData({ year })}
                  disabled={loadingTable}
                >
                  <RefreshCw className="size-4 mr-2" />
                  Muat ulang
                </Button>
              </AlertDescription>
            </Alert>
          )}
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
                      <tr className="border-b border-slate-100 bg-slate-50">
                        <th rowSpan={2} className="px-4 py-2 text-left text-xs font-semibold text-slate-600 border-r border-slate-200">
                          Keterangan
                        </th>
                        {tableData.months.map((m) => (
                          <th
                            key={m.month}
                            colSpan={3}
                            className="px-1 py-1.5 text-center text-xs font-semibold text-slate-700 border-l border-slate-200"
                          >
                            {m.label}
                          </th>
                        ))}
                        <th
                          colSpan={3}
                          className="px-1 py-1.5 text-center text-xs font-bold text-slate-800 border-l-2 border-slate-300 bg-slate-100"
                        >
                          TOTAL
                        </th>
                      </tr>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        {tableData.months.map((m) => (
                          <Fragment key={`sub-${m.month}`}>
                            <th className="px-1.5 py-1 text-right text-[10px] font-medium text-slate-500 border-l border-slate-200">Target</th>
                            <th className="px-1.5 py-1 text-right text-[10px] font-medium text-slate-500">Realisasi</th>
                            <th className="px-1.5 py-1 text-right text-[10px] font-medium text-slate-500">%</th>
                          </Fragment>
                        ))}
                        <th className="px-1.5 py-1 text-right text-[10px] font-medium text-slate-600 border-l-2 border-slate-300 bg-slate-100">Target</th>
                        <th className="px-1.5 py-1 text-right text-[10px] font-medium text-slate-600 bg-slate-100">Realisasi</th>
                        <th className="px-1.5 py-1 text-right text-[10px] font-medium text-slate-600 bg-slate-100">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableData.sections.map((section) => (
                        <Fragment key={`section-${section.title}`}>
                          <tr>
                            <td
                              className="px-4 py-2 text-xs font-semibold text-slate-700 uppercase tracking-wide bg-emerald-50 border-t border-emerald-100"
                              colSpan={1 + tableData.months.length * 3 + 3}
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
                                    colSpan={1 + tableData.months.length * 3 + 3}
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
                                const canDrillDown = !!row.filterParams && !isGrandTotal
                                const valueByMonth = new Map<number, number>()
                                row.monthly.forEach((p) => {
                                  valueByMonth.set(p.month, p.sum)
                                })
                                const targetByMonth = new Map<number, number>()
                                if (row.monthlyTargets) {
                                  row.monthlyTargets.forEach((p) => {
                                    targetByMonth.set(p.month, p.sum)
                                  })
                                }
                                return (
                                  <tr
                                    key={`row-${section.title}-${group.title}-${row.label}`}
                                    className="border-t border-slate-100"
                                  >
                                    <td
                                      className={`px-4 py-2 border-r border-slate-200 whitespace-nowrap ${
                                        isTotal ? 'font-semibold text-slate-800' : 'text-slate-700'
                                      }`}
                                    >
                                      {row.label}
                                    </td>
                                    {tableData.months.map((m) => {
                                      const val = valueByMonth.get(m.month) || 0
                                      const target = targetByMonth.get(m.month) || 0
                                      const pct = target > 0 ? Math.round((val / target) * 100) : null
                                      const cellClickable = canDrillDown && val !== 0
                                      const pctColor = pct === null
                                        ? 'text-slate-400'
                                        : pct >= 100
                                          ? 'text-emerald-700 font-semibold'
                                          : pct >= 50
                                            ? 'text-amber-700'
                                            : 'text-red-600'
                                      return (
                                        <Fragment key={`cells-${section.title}-${group.title}-${row.label}-${m.month}`}>
                                          <td
                                            className={`px-1.5 py-2 text-right tabular-nums border-l border-slate-200 ${
                                              isGrandTotal
                                                ? 'font-bold text-slate-600'
                                                : isTotal
                                                  ? 'font-semibold text-slate-600'
                                                  : 'text-slate-500'
                                            }`}
                                          >
                                            {target ? formatRupiah(target) : '—'}
                                          </td>
                                          <td
                                            className={`px-1.5 py-2 text-right tabular-nums ${
                                              isGrandTotal
                                                ? 'font-bold text-emerald-700'
                                                : isTotal
                                                  ? 'font-semibold text-slate-800'
                                                  : cellClickable
                                                    ? 'text-teal-700 cursor-pointer hover:underline hover:text-teal-900'
                                                    : 'text-slate-800'
                                            }`}
                                            onClick={cellClickable
                                              ? () => openTransactionModal(row.label, row.filterParams!, tableData.year, m.month)
                                              : undefined}
                                          >
                                            {formatRupiah(val)}
                                          </td>
                                          <td
                                            className={`px-1.5 py-2 text-right tabular-nums text-xs ${pctColor}`}
                                          >
                                            {formatAchievementPct(pct)}
                                          </td>
                                        </Fragment>
                                      )
                                    })}
                                    {(() => {
                                      let totalTarget = 0
                                      let totalRealisasi = 0
                                      tableData.months.forEach((m) => {
                                        totalTarget += targetByMonth.get(m.month) || 0
                                        totalRealisasi += valueByMonth.get(m.month) || 0
                                      })
                                      const totalPct = totalTarget > 0 ? Math.round((totalRealisasi / totalTarget) * 100) : null
                                      const totalPctColor = totalPct === null
                                        ? 'text-slate-400'
                                        : totalPct >= 100
                                          ? 'text-emerald-700 font-bold'
                                          : totalPct >= 50
                                            ? 'text-amber-700 font-semibold'
                                            : 'text-red-600 font-semibold'
                                      return (
                                        <>
                                          <td className={`px-1.5 py-2 text-right tabular-nums border-l-2 border-slate-300 bg-slate-50 ${isGrandTotal ? 'font-bold' : isTotal ? 'font-semibold' : ''} text-slate-600`}>
                                            {totalTarget ? formatRupiah(totalTarget) : '—'}
                                          </td>
                                          <td className={`px-1.5 py-2 text-right tabular-nums bg-slate-50 ${isGrandTotal ? 'font-bold text-emerald-700' : isTotal ? 'font-semibold text-slate-800' : 'text-slate-800'}`}>
                                            {formatRupiah(totalRealisasi)}
                                          </td>
                                          <td className={`px-1.5 py-2 text-right tabular-nums text-xs bg-slate-50 ${totalPctColor}`}>
                                            {formatAchievementPct(totalPct)}
                                          </td>
                                        </>
                                      )
                                    })()}
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
          ) : loadingTable ? (
            <div className="flex flex-col items-center justify-center gap-4 py-14 px-4 text-center rounded-lg border border-teal-100 bg-teal-50/40">
              <Spinner className="size-8 text-teal-600" />
              <div className="space-y-1 text-slate-700 text-sm max-w-md">
                <p className="font-medium text-slate-800">Mengambil data dari API Zains…</p>
                {loadAttempt > 1 && (
                  <p className="text-amber-800 text-xs">
                    Percobaan ke-{loadAttempt} dari {SE_YEARLY_MAX_ATTEMPTS} (server otomatis mengulang jika lambat).
                  </p>
                )}
                <p className="flex items-center justify-center gap-1.5 text-slate-500 text-xs">
                  <Clock className="size-3.5 shrink-0" />
                  Terhubung: {elapsedSec}s — ini normal untuk banyak klinik; jangan tutup halaman.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-slate-400 text-sm">
              <p>Belum ada data summary yang bisa ditampilkan.</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => loadTableData({ year })}
                disabled={loadingTable}
              >
                Muat data
              </Button>
            </div>
          )}
        </div>

        {/* Chart SE per bulan disembunyikan sementara */}
      </div>

      <TransactionDetailModal
        state={txModal}
        onClose={() => setTxModal(null)}
      />
    </div>
  )
}

