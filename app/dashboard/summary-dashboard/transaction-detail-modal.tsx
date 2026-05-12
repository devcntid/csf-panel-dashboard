'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { Pagination } from '@/components/ui/pagination'
import { FileSpreadsheet, AlertCircle, Search, ArrowUpDown, ArrowUp, ArrowDown, X } from 'lucide-react'
import { toast } from 'sonner'
import type { RowFilterParams } from '@/lib/summary-se-yearly-types'
import { formatRupiah } from '@/lib/summary-se-yearly-types'

type TransactionRow = {
  id_trans: string
  id_transaksi: string
  id_exre: string
  tgl_exre: string
  keterangan: string
  nominal: number
  coa_debet: string
  coa_kredit: string
  id_kantor: number
  id_program: number
  id_via_bayar: number
  approve: string
  jenis: string
  mutasi: string
  id_contact: string
}

type PagingInfo = {
  per_page: number
  current_page: number
  total_data: number
  total_page: number
  next_page: number
  previous_page: number
}

type SummaryInfo = {
  total_nominal?: number
  [key: string]: unknown
}

type TransactionResponse = {
  status: boolean
  message: string
  data: TransactionRow[]
  paging: PagingInfo
  summary?: SummaryInfo
}

type DateSort = 'asc' | 'desc' | null

const MONTH_NAMES: Record<number, string> = {
  1: 'Januari', 2: 'Februari', 3: 'Maret', 4: 'April',
  5: 'Mei', 6: 'Juni', 7: 'Juli', 8: 'Agustus',
  9: 'September', 10: 'Oktober', 11: 'November', 12: 'Desember',
}

export type TransactionModalState = {
  open: boolean
  label: string
  filterParams: RowFilterParams
  year: number
  month: number
} | null

interface TransactionDetailModalProps {
  state: TransactionModalState
  onClose: () => void
}

function monthDateRange(year: number, month: number): { tgl_awal: string; tgl_akhir: string } {
  const mm = String(month).padStart(2, '0')
  const lastDay = new Date(year, month, 0).getDate()
  return {
    tgl_awal: `${year}-${mm}-01`,
    tgl_akhir: `${year}-${mm}-${String(lastDay).padStart(2, '0')}`,
  }
}

function buildQueryString(fp: RowFilterParams, year: number, month: number, page: number, perPage: number): string {
  const sp = new URLSearchParams()
  const { tgl_awal, tgl_akhir } = monthDateRange(year, month)
  sp.set('type', fp.type)
  sp.set('tgl_awal', tgl_awal)
  sp.set('tgl_akhir', tgl_akhir)
  sp.set('page', String(page))
  sp.set('per_page', String(perPage))
  if (fp.approve) sp.set('approve', fp.approve)
  if (fp.only_coa_debet) sp.set('only_coa_debet', fp.only_coa_debet)
  if (fp.only_coa_kredit) sp.set('only_coa_kredit', fp.only_coa_kredit)
  if (fp.id_kantor) sp.set('id_kantor', fp.id_kantor)
  if (fp.only_id_contact) sp.set('only_id_contact', fp.only_id_contact)
  if (fp.exclude_id_contact) sp.set('exclude_id_contact', fp.exclude_id_contact)
  return sp.toString()
}

function formatDate(raw: string): string {
  if (!raw) return '-'
  try {
    const d = new Date(raw)
    if (isNaN(d.getTime())) return raw
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return raw
  }
}

function toDateStr(raw: string): string {
  if (!raw) return ''
  try {
    const d = new Date(raw)
    if (isNaN(d.getTime())) return ''
    return d.toISOString().slice(0, 10)
  } catch {
    return ''
  }
}

export function TransactionDetailModal({ state, onClose }: TransactionDetailModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<TransactionRow[]>([])
  const [paging, setPaging] = useState<PagingInfo | null>(null)
  const [summary, setSummary] = useState<SummaryInfo | null>(null)
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(20)
  const [exporting, setExporting] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [dateSort, setDateSort] = useState<DateSort>(null)

  const isOpen = state?.open === true

  const filteredData = useMemo(() => {
    let rows = data

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase()
      rows = rows.filter(
        (r) =>
          r.keterangan?.toLowerCase().includes(q) ||
          r.id_transaksi?.toLowerCase().includes(q) ||
          r.coa_debet?.toLowerCase().includes(q) ||
          r.coa_kredit?.toLowerCase().includes(q) ||
          String(r.nominal).includes(q),
      )
    }

    if (dateFrom || dateTo) {
      rows = rows.filter((r) => {
        const d = toDateStr(r.tgl_exre)
        if (!d) return false
        if (dateFrom && d < dateFrom) return false
        if (dateTo && d > dateTo) return false
        return true
      })
    }

    if (dateSort) {
      rows = [...rows].sort((a, b) => {
        const da = toDateStr(a.tgl_exre)
        const db = toDateStr(b.tgl_exre)
        if (da === db) return 0
        const cmp = da < db ? -1 : 1
        return dateSort === 'asc' ? cmp : -cmp
      })
    }

    return rows
  }, [data, searchTerm, dateFrom, dateTo, dateSort])

  const pageSubtotal = useMemo(
    () => filteredData.reduce((sum, r) => sum + (r.nominal || 0), 0),
    [filteredData],
  )

  const allDataTotal = useMemo(() => {
    if (summary?.total_nominal != null) return summary.total_nominal
    return null
  }, [summary])

  const hasActiveFilters = searchTerm.trim() || dateFrom || dateTo

  const fetchData = useCallback(async (fp: RowFilterParams, year: number, month: number, pg: number, pp: number) => {
    setLoading(true)
    setError(null)
    try {
      const qs = buildQueryString(fp, year, month, pg, pp)
      const res = await fetch(`/api/fins/transactions?${qs}`, { cache: 'no-store' })
      const json: TransactionResponse = await res.json()
      if (!res.ok || !json.status) {
        setError(json.message || `Gagal memuat data (HTTP ${res.status})`)
        setData([])
        setPaging(null)
        setSummary(null)
        return
      }
      setData(json.data || [])
      setPaging(json.paging || null)
      setSummary(json.summary || null)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memuat data'
      setError(msg)
      setData([])
      setPaging(null)
      setSummary(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!state?.open || !state.filterParams) return
    setPage(1)
    setPerPage(20)
    setSearchTerm('')
    setDateFrom('')
    setDateTo('')
    setDateSort(null)
    fetchData(state.filterParams, state.year, state.month, 1, 20)
  }, [state?.open, state?.filterParams, state?.year, state?.month, fetchData])

  const handlePageChange = (newPage: number) => {
    if (!state?.filterParams) return
    setPage(newPage)
    fetchData(state.filterParams, state.year, state.month, newPage, perPage)
  }

  const handleLimitChange = (newLimit: number) => {
    if (!state?.filterParams) return
    setPerPage(newLimit)
    setPage(1)
    fetchData(state.filterParams, state.year, state.month, 1, newLimit)
  }

  const toggleDateSort = () => {
    setDateSort((prev) => {
      if (prev === null) return 'asc'
      if (prev === 'asc') return 'desc'
      return null
    })
  }

  const clearDateRange = () => {
    setDateFrom('')
    setDateTo('')
  }

  const handleExport = async () => {
    if (!state?.filterParams) return
    setExporting(true)
    try {
      const { tgl_awal, tgl_akhir } = monthDateRange(state.year, state.month)
      const sp = new URLSearchParams()
      sp.set('type', state.filterParams.type)
      sp.set('tgl_awal', tgl_awal)
      sp.set('tgl_akhir', tgl_akhir)
      if (state.filterParams.approve) sp.set('approve', state.filterParams.approve)
      if (state.filterParams.only_coa_debet) sp.set('only_coa_debet', state.filterParams.only_coa_debet)
      if (state.filterParams.only_coa_kredit) sp.set('only_coa_kredit', state.filterParams.only_coa_kredit)
      if (state.filterParams.id_kantor) sp.set('id_kantor', state.filterParams.id_kantor)
      if (state.filterParams.only_id_contact) sp.set('only_id_contact', state.filterParams.only_id_contact)
      if (state.filterParams.exclude_id_contact) sp.set('exclude_id_contact', state.filterParams.exclude_id_contact)
      sp.set('label', state.label)

      const res = await fetch(`/api/fins/transactions/export?${sp.toString()}`)
      if (!res.ok) {
        const errJson = await res.json().catch(() => null)
        throw new Error(errJson?.message || `Export gagal (HTTP ${res.status})`)
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const disposition = res.headers.get('Content-Disposition')
      const filenameMatch = disposition?.match(/filename="(.+)"/)
      a.download = filenameMatch?.[1] || `fins-export-${state.label}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success('File Excel berhasil diunduh')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal export'
      toast.error(msg)
    } finally {
      setExporting(false)
    }
  }

  const DateSortIcon = dateSort === 'asc' ? ArrowUp : dateSort === 'desc' ? ArrowDown : ArrowUpDown

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-6xl max-h-[90vh] flex flex-col font-sans">
        <DialogHeader>
          <DialogTitle className="text-lg">
            Detail Transaksi — {state?.label || ''} &middot; {state?.month ? MONTH_NAMES[state.month] : ''} {state?.year || ''}
          </DialogTitle>
          <DialogDescription className="text-sm text-slate-500">
            Data transaksi FINS bulan {state?.month ? MONTH_NAMES[state.month] : ''} {state?.year || ''} &middot; Tipe: {state?.filterParams?.type || ''}
            {paging && !loading && (
              <span className="ml-2 font-medium text-slate-700">
                &middot; Total: {paging.total_data.toLocaleString('id-ID')} transaksi
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Toolbar: search + date range + export */}
        <div className="flex flex-wrap items-center gap-2 -mt-2">
          <div className="relative w-60">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none" />
            <Input
              placeholder="Cari keterangan, ID, COA..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-9 text-sm font-sans"
            />
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="whitespace-nowrap">Tgl:</span>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-9 w-[140px] text-xs font-sans"
            />
            <span>—</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-9 w-[140px] text-xs font-sans"
            />
            {(dateFrom || dateTo) && (
              <Button variant="ghost" size="sm" onClick={clearDateRange} className="h-7 w-7 p-0">
                <X className="size-3.5" />
              </Button>
            )}
          </div>
          <div className="ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              disabled={exporting || loading}
              className="flex items-center gap-2"
            >
              {exporting ? (
                <Spinner className="size-4" />
              ) : (
                <FileSpreadsheet className="size-4" />
              )}
              {exporting ? 'Mengunduh...' : 'Export Excel'}
            </Button>
          </div>
        </div>

        <div className="flex-1 overflow-auto border rounded-md min-h-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-500">
              <Spinner className="size-6 text-teal-600" />
              <span className="text-sm">Memuat transaksi...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-red-600">
              <AlertCircle className="size-6" />
              <span className="text-sm max-w-md text-center">{error}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => state?.filterParams && fetchData(state.filterParams, state.year, state.month, page, perPage)}
              >
                Coba lagi
              </Button>
            </div>
          ) : data.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-slate-400 text-sm font-sans">
              Tidak ada transaksi ditemukan
            </div>
          ) : filteredData.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-slate-400 text-sm font-sans">
              Tidak ada transaksi cocok dengan filter aktif
            </div>
          ) : (
            <table className="w-full text-sm min-w-[900px] font-sans">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 w-10">#</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600">
                    <button
                      type="button"
                      onClick={toggleDateSort}
                      className="inline-flex items-center gap-1 hover:text-teal-700 transition-colors"
                    >
                      Tanggal
                      <DateSortIcon className={`size-3.5 ${dateSort ? 'text-teal-600' : 'text-slate-400'}`} />
                    </button>
                  </th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600">ID Transaksi</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 min-w-[250px]">Keterangan</th>
                  <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-600">Nominal</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600">COA Debet</th>
                  <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600">COA Kredit</th>
                  <th className="px-3 py-2.5 text-center text-xs font-semibold text-slate-600">Kantor</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((row, idx) => (
                  <tr key={row.id_trans || idx} className="border-b border-slate-100 hover:bg-slate-50/70">
                    <td className="px-3 py-2 text-slate-500 text-xs tabular-nums">
                      {(page - 1) * perPage + idx + 1}
                    </td>
                    <td className="px-3 py-2 text-slate-700 whitespace-nowrap text-xs">
                      {formatDate(row.tgl_exre)}
                    </td>
                    <td className="px-3 py-2 text-slate-600 text-xs">
                      {row.id_transaksi || '-'}
                    </td>
                    <td className="px-3 py-2 text-slate-800">
                      {row.keterangan || '-'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium text-slate-800">
                      {formatRupiah(row.nominal)}
                    </td>
                    <td className="px-3 py-2 text-slate-600 text-xs">
                      {row.coa_debet || '-'}
                    </td>
                    <td className="px-3 py-2 text-slate-600 text-xs">
                      {row.coa_kredit || '-'}
                    </td>
                    <td className="px-3 py-2 text-center text-slate-600 text-xs">
                      {row.id_kantor || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="sticky bottom-0 z-10">
                <tr className="bg-teal-50 border-t-2 border-teal-200">
                  <td colSpan={4} className="px-3 py-2 text-right text-xs font-bold text-teal-800">
                    Subtotal halaman ini{hasActiveFilters ? ' (filtered)' : ''}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-xs font-bold text-teal-900">
                    {formatRupiah(pageSubtotal)}
                  </td>
                  <td colSpan={3} />
                </tr>
                {allDataTotal != null && (
                  <tr className="bg-teal-100/80 border-t border-teal-200">
                    <td colSpan={4} className="px-3 py-2.5 text-right text-sm font-bold text-teal-900">
                      Grand Total (semua data)
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-sm font-bold text-teal-950">
                      {formatRupiah(allDataTotal)}
                    </td>
                    <td colSpan={3} />
                  </tr>
                )}
              </tfoot>
            </table>
          )}
        </div>

        {paging && !loading && !error && data.length > 0 && (
          <Pagination
            page={page}
            limit={perPage}
            total={paging.total_data}
            onPageChange={handlePageChange}
            onLimitChange={handleLimitChange}
            currentPageCount={data.length}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
