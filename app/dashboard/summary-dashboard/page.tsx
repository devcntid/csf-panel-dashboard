'use client'

import { Fragment, useEffect, useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Clock, RefreshCw } from 'lucide-react'

const MAX_CLIENT_ATTEMPTS = 3
const CLIENT_RETRY_DELAY_MS = 5000
const CLIENT_FETCH_TIMEOUT_MS = 280_000

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms))
}

type PivotRow = {
  label: string
  monthly: {
    month: number
    sum: number
  }[]
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
  months: {
    month: number
    label: string
  }[]
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

export default function SummaryDashboardPage() {
  const now = new Date()
  const [year, setYear] = useState<number>(now.getFullYear())

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
      const params = new URLSearchParams({ year: String(y) })

      for (let attempt = 1; attempt <= MAX_CLIENT_ATTEMPTS; attempt++) {
        if (isCancelled?.()) return
        setLoadAttempt(attempt)

        const controller = new AbortController()
        const clientTimer = setTimeout(() => controller.abort(), CLIENT_FETCH_TIMEOUT_MS)

        try {
          const res = await fetch(`/api/summary/se-yearly?${params.toString()}`, {
            cache: 'no-store',
            signal: controller.signal,
          })
          clearTimeout(clientTimer)

          let json: PivotResponse & { message?: string }
          try {
            json = (await res.json()) as PivotResponse & { message?: string }
          } catch {
            json = { success: false, message: 'Respons tidak valid' } as PivotResponse & {
              message?: string
            }
          }

          if (isCancelled?.()) return

          if (res.ok && json.success) {
            setTableData(json)
            setLoadError(null)
            return
          }

          const serverMsg =
            typeof json?.message === 'string' && json.message.trim()
              ? json.message.trim()
              : `Permintaan gagal (${res.status})`

          const retryable =
            res.status === 502 ||
            res.status === 503 ||
            res.status === 504 ||
            res.status === 408 ||
            res.status === 429

          if (retryable && attempt < MAX_CLIENT_ATTEMPTS) {
            await sleep(CLIENT_RETRY_DELAY_MS)
            continue
          }

          if (!hadExistingTable) setTableData(null)
          setLoadError(
            retryable || res.status >= 500
              ? `${serverMsg} — Layanan Zains/Koyeb sedang lambat atau sibuk.`
              : serverMsg,
          )
          return
        } catch (err: unknown) {
          clearTimeout(clientTimer)
          if (isCancelled?.()) return

          const isAbort = err instanceof Error && err.name === 'AbortError'
          const msg = isAbort
            ? 'Waktu tunggu habis — server masih memproses banyak data dari Zains.'
            : err instanceof Error
              ? err.message
              : 'Gagal terhubung ke server.'

          if (attempt < MAX_CLIENT_ATTEMPTS) {
            await sleep(CLIENT_RETRY_DELAY_MS)
            continue
          }

          if (!hadExistingTable) setTableData(null)
          setLoadError(
            `${msg} Silakan tunggu sebentar lalu ketuk Muat ulang — kami sudah mencoba ${MAX_CLIENT_ATTEMPTS} kali.`,
          )
          return
        }
      }
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
            Rekap capaian SE Klinik, Ambulance, Fundraising dan grafik capaian SE per klinik langsung dari API Zains.
          </p>
          <p className="text-amber-800/90 text-xs mt-1.5 bg-amber-50 border border-amber-100 rounded-md px-2 py-1.5 inline-block max-w-xl">
            Memuat data bisa memakan waktu 1–3 menit karena banyak klinik memanggil API Zains (Koyeb). Mohon
            ditunggu; jika gagal, gunakan <strong>Muat ulang</strong> di bawah.
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
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">
                          Keterangan
                        </th>
                        {tableData.months.map((m) => (
                          <th
                            key={m.month}
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
                              colSpan={1 + tableData.months.length}
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
                                    colSpan={1 + tableData.months.length}
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
                                const valueByMonth = new Map<number, number>()
                                row.monthly.forEach((p) => {
                                  valueByMonth.set(p.month, p.sum)
                                })
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
                                    {tableData.months.map((m) => {
                                      const val = valueByMonth.get(m.month) || 0
                                      return (
                                        <td
                                          key={`cell-${section.title}-${group.title}-${row.label}-${m.month}`}
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
                                      )
                                    })}
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
                    Percobaan ke-{loadAttempt} dari {MAX_CLIENT_ATTEMPTS} (server otomatis mengulang jika lambat).
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
        {/* <div className="space-y-4">
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
                  ) : loadingChart ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400 text-sm">
                      <Spinner className="size-6 text-teal-600" />
                      <span>Memuat grafik...</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                      Tidak ada data grafik
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
                  ) : loadingChart ? (
                    <div className="flex flex-col items-center justify-center gap-3 py-6 text-slate-400 text-xs">
                      <Spinner className="size-5 text-teal-600" />
                      <span>Memuat ringkasan grafik...</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center py-6 text-slate-400 text-xs">
                      Belum ada data grafik yang bisa ditampilkan
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div> */}
      </div>
    </div>
  )
}

