'use client'

import { useEffect, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Spinner } from '@/components/ui/spinner'
import { Pagination } from '@/components/ui/pagination'
import { formatCurrency } from '@/lib/db'
import * as XLSX from 'xlsx'

type KantorItem = {
  id_kantor: string
  kantor: string
  coa?: string
}

type CoaItem = {
  coa: string
  nama_coa: string
  id_kantor: string | number
  group: string
}

type CashbookRow = {
  id_trans: string | null
  tgl_exre: string
  coa_debet: string | null
  coa_kredit: string | null
  debet: number
  kredit: number
  mutasi: string | null
  coa: string
  approve: string | null
  nik_input: string | null
  nik_approve: string | null
  id_via_bayar: number | null
  noresi: string
  note: string
  nama_coa: string | null
  nama_coa_debet?: string | null
  nama_coa_kredit?: string | null
  kantor: string | null
  id_kantor: number | null
  id_program: number | null
  program: string | null
  id_contact: string | null
  referensi: string | null
  alamat_referensi: string
  id_exre: string | null
  jenis: string | null
  keterangan: string
  user_input: string | null
  user_approve: string | null
  fdt: string | null
  saldo: number
  is_saldo_awal?: boolean
}

type CashbookFooter = {
  ShowSaldo: boolean
  SaldoAwal: number
  keterangan: string
  debet: number
  kredit: number
  cdebet: number
  ckredit: number
  saldo: number
  sdebetkredit: number
}

type CashbookResponse = {
  status: boolean
  message: string
  total: number
  rows: CashbookRow[]
  footer: CashbookFooter[]
  time: number
}

type KantorResponse = {
  status: boolean
  message: string
  data: KantorItem[]
}

type CoaResponse = {
  status: boolean
  message: string
  data: CoaItem[]
}

function formatDateShort(value: string): string {
  if (!value) return '-'
  try {
    const d = new Date(value)
    if (Number.isNaN(d.getTime())) return value
    return d.toISOString().slice(0, 10)
  } catch {
    return value
  }
}

function getTodayStr(): string {
  const today = new Date()
  const y = today.getFullYear()
  const m = String(today.getMonth() + 1).padStart(2, '0')
  const d = String(today.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function extractTag(note: string | null | undefined): string {
  if (!note) return '-'
  try {
    const match = note.match(/<id_tag>(.*?)<\/id_tag>/i)
    const inside = match ? match[1]?.trim() : ''
    return inside || '-'
  } catch {
    return '-'
  }
}

export default function FinsCashbookPage() {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()

  const [kantors, setKantors] = useState<KantorItem[]>([])
  const [selectedKantorId, setSelectedKantorId] = useState<string | null>(null)
  const [coas, setCoas] = useState<CoaItem[]>([])
  const [selectedCoa, setSelectedCoa] = useState<string | null>('101.01.001.000')

  const [startDate, setStartDate] = useState<string>(() => getTodayStr())
  const [endDate, setEndDate] = useState<string>(() => getTodayStr())
  const [page, setPage] = useState<number>(1)
  const [perPage, setPerPage] = useState<number>(10)
  const [keyword, setKeyword] = useState<string>('')

  const [items, setItems] = useState<CashbookRow[]>([])
  const [totalData, setTotalData] = useState<number>(0)
  const [footer, setFooter] = useState<CashbookFooter | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [loadingMeta, setLoadingMeta] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [exportingExcel, setExportingExcel] = useState<boolean>(false)
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  const isClinicManager =
    sessionStatus === 'authenticated' && (session?.user as any)?.role === 'clinic_manager'

  useEffect(() => {
    if (sessionStatus !== 'authenticated') return
    const role = (session?.user as any)?.role || ''
    if (role === 'clinic_manager') {
      router.replace('/dashboard')
    }
  }, [session, sessionStatus, router])

  const loadKantors = async () => {
    setLoadingMeta(true)
    try {
      const res = await fetch('/api/fins/kantor?page=1&per_page=100&aktif=y', {
        cache: 'no-store',
      })
      const json = (await res.json()) as KantorResponse
      if (!res.ok || !json.status) {
        setError(json.message || 'Gagal mengambil data kantor dari Zains')
        setKantors([])
        return
      }
      const data = Array.isArray(json.data) ? json.data : []
      setKantors(data)

      let defaultId: string | null = null
      const kantorPusat = data.find((k) => String(k.id_kantor) === '87')
      if (kantorPusat) {
        defaultId = String(kantorPusat.id_kantor)
      } else if (data.length > 0) {
        defaultId = String(data[0].id_kantor)
      }
      setSelectedKantorId((prev) => prev ?? defaultId)
    } catch (err: any) {
      console.error('Error fetch /api/fins/kantor:', err)
      setError(err?.message || 'Terjadi kesalahan saat mengambil data kantor')
      setKantors([])
    } finally {
      setLoadingMeta(false)
    }
  }

  const loadCoas = async (idKantor: string) => {
    setLoadingMeta(true)
    try {
      const params = new URLSearchParams()
      if (idKantor) params.set('id_kantor', idKantor)

      const res = await fetch(`/api/fins/coa?${params.toString()}`, { cache: 'no-store' })
      const json = (await res.json()) as CoaResponse
      if (!res.ok || !json.status) {
        setError(json.message || 'Gagal mengambil data COA dari Zains')
        setCoas([])
        return
      }
      const data = Array.isArray(json.data) ? json.data : []
      setCoas(data)

      if (data.length === 0) {
        setSelectedCoa(null)
        return
      }

      const explicitKasPusat = data.find((c) => c.coa === '101.01.001.000')
      if (explicitKasPusat) {
        setSelectedCoa('101.01.001.000')
      } else if (!selectedCoa || !data.some((c) => c.coa === selectedCoa)) {
        setSelectedCoa(data[0].coa)
      }
    } catch (err: any) {
      console.error('Error fetch /api/fins/coa:', err)
      setError(err?.message || 'Terjadi kesalahan saat mengambil data COA')
      setCoas([])
    } finally {
      setLoadingMeta(false)
    }
  }

  useEffect(() => {
    if (sessionStatus === 'authenticated') {
      loadKantors()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStatus])

  useEffect(() => {
    if (!selectedKantorId) return
    loadCoas(selectedKantorId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKantorId])

  const fetchData = async (opts?: { page?: number; perPage?: number }) => {
    const targetPage = opts?.page ?? page
    const targetPerPage = opts?.perPage ?? perPage

    if (!selectedCoa) {
      setError('COA wajib dipilih')
      return
    }
    if (!startDate || !endDate) {
      setError('Periode tanggal wajib diisi')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      params.set('coa', selectedCoa)
      params.set('tanggal_awal', startDate)
      params.set('tanggal_akhir', endDate)
      params.set('page', String(targetPage))
      params.set('per_page', String(targetPerPage))
      if (keyword.trim()) params.set('keyword', keyword.trim())

      const res = await fetch(`/api/fins/cashbook?${params.toString()}`, {
        cache: 'no-store',
      })

      const json = (await res.json()) as CashbookResponse & { status?: boolean; message?: string }

      if (!res.ok || json.status === false) {
        setError(json.message || 'Gagal mengambil data cashbook dari Zains')
        setItems([])
        setFooter(null)
        setTotalData(0)
        return
      }

      const rows: CashbookRow[] = Array.isArray((json as any).rows)
        ? ((json as any).rows as CashbookRow[])
        : []
      const footerArr: CashbookFooter[] = Array.isArray((json as any).footer)
        ? ((json as any).footer as CashbookFooter[])
        : []

      setItems(rows)
      setFooter(footerArr[0] ?? null)
      setTotalData((json as any).total ?? rows.length)
      setPage(targetPage)
      setPerPage(targetPerPage)
    } catch (err: any) {
      console.error('Error fetch /api/fins/cashbook:', err)
      setError(err?.message || 'Terjadi kesalahan saat mengambil data cashbook')
      setItems([])
      setFooter(null)
      setTotalData(0)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (sessionStatus === 'authenticated' && selectedCoa) {
      fetchData({ page: 1, perPage })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStatus, selectedCoa])

  const handleApplyFilter = () => {
    setPage(1)
    fetchData({ page: 1, perPage })
  }

  const handlePageChange = (newPage: number) => {
    setPage(newPage)
    fetchData({ page: newPage })
  }

  const handleLimitChange = (limit: number) => {
    setPerPage(limit)
    setPage(1)
    fetchData({ page: 1, perPage: limit })
  }

  const handleKeywordKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      setPage(1)
      fetchData({ page: 1, perPage })
    }
  }

  const handleToggleSortDate = () => {
    setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
  }

  const handleExportExcel = async () => {
    if (!selectedCoa || !startDate || !endDate) return

    setExportingExcel(true)
    try {
      const perPageExport = 200
      const params = new URLSearchParams()
      params.set('coa', selectedCoa)
      params.set('tanggal_awal', startDate)
      params.set('tanggal_akhir', endDate)
      params.set('per_page', String(perPageExport))
      if (keyword.trim()) params.set('keyword', keyword.trim())

      const allRows: CashbookRow[] = []
      let currentPage = 1

      while (true) {
        params.set('page', String(currentPage))
        const res = await fetch(`/api/fins/cashbook?${params.toString()}`, { cache: 'no-store' })
        const json = (await res.json()) as CashbookResponse & {
          status?: boolean
          message?: string
        }

        if (!res.ok || json.status === false) {
          break
        }

        const rows: CashbookRow[] = Array.isArray((json as any).rows)
          ? ((json as any).rows as CashbookRow[])
          : []

        if (rows.length === 0) {
          break
        }

        allRows.push(...rows)

        if (rows.length < perPageExport) {
          break
        }

        currentPage += 1
      }

      if (allRows.length === 0) return

      const exportRows = allRows.map((row) => ({
        Tanggal: formatDateShort(row.tgl_exre),
        COA: row.coa_kredit || row.coa || '-',
        'Jenis Transaksi': row.nama_coa_kredit || row.program || row.nama_coa || '-',
        Keterangan: row.keterangan || '-',
        Debet: row.debet || 0,
        Kredit: row.kredit || 0,
        Saldo: row.saldo || 0,
        Note: row.note || '-',
        Tag: extractTag(row.note),
        'No Resi': row.noresi || '-',
        'ID Exre': row.id_exre || '-',
        Referensi: row.referensi || '-',
        Program: row.program || '-',
        'COA Debet': row.coa_debet || '-',
        'Ket. Sumber Dana': row.nama_coa_debet || '-',
        'User Input': row.user_input || '-',
        'User Approve': row.user_approve || '-',
      }))

      const ws = XLSX.utils.json_to_sheet(exportRows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Cashbook')
      const filename = `fins-cashbook_${startDate}_${endDate}_${new Date()
        .toISOString()
        .slice(0, 10)}.xlsx`
      XLSX.writeFile(wb, filename)
    } finally {
      setExportingExcel(false)
    }
  }

  const sortedItems = [...items].sort((a, b) => {
    const da = a.tgl_exre || ''
    const db = b.tgl_exre || ''
    if (da === db) return 0
    if (sortDirection === 'asc') {
      return da < db ? -1 : 1
    }
    return da > db ? -1 : 1
  })

  if (isClinicManager) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>FINS Cashbook</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600">
              Halaman ini hanya dapat diakses oleh pengguna dengan peran superadmin / non clinic
              manager.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardHeader className="border-b bg-emerald-50/60">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <CardTitle className="text-lg font-semibold text-slate-800">
                FINS Cashbook (Zains)
              </CardTitle>
              <p className="text-xs md:text-sm text-slate-600 mt-1">
                Data buku kas diambil langsung dari Zains melalui endpoint{' '}
                <span className="font-mono text-[11px] bg-white/70 px-2 py-1 rounded border border-emerald-100">
                  /fins/cashbook
                </span>
                .
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">Kantor</p>
              <Select
                value={selectedKantorId ?? undefined}
                onValueChange={(v) => setSelectedKantorId(v)}
                disabled={loadingMeta || sessionStatus !== 'authenticated'}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder={loadingMeta ? 'Memuat kantor...' : 'Pilih kantor'} />
                </SelectTrigger>
                <SelectContent>
                  {kantors.map((k) => (
                    <SelectItem key={k.id_kantor} value={String(k.id_kantor)}>
                      {k.kantor}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">COA</p>
              <Select
                value={selectedCoa ?? undefined}
                onValueChange={(v) => setSelectedCoa(v)}
                disabled={loadingMeta || sessionStatus !== 'authenticated' || coas.length === 0}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder={loadingMeta ? 'Memuat COA...' : 'Pilih COA'} />
                </SelectTrigger>
                <SelectContent>
                  {coas.map((c) => (
                    <SelectItem key={c.coa} value={c.coa}>
                      {c.coa} - {c.nama_coa}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">
                Periode Mulai
              </p>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">
                Periode Selesai
              </p>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="space-y-1 md:col-span-2">
              <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">
                Keyword (opsional)
              </p>
              <Input
                type="search"
                placeholder="Cari pada keterangan, program, dll..."
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={handleKeywordKeyDown}
                className="h-9"
              />
            </div>
            <div className="flex items-end md:justify-end md:col-span-2">
              <Button
                onClick={handleApplyFilter}
                className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-700"
                disabled={loading || sessionStatus !== 'authenticated'}
              >
                {loading ? (
                  <>
                    <Spinner className="size-4 mr-2 text-white" />
                    Memuat...
                  </>
                ) : (
                  'Terapkan Filter'
                )}
              </Button>
            </div>
          </div>

          {footer && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 border-t pt-4">
              <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                  Saldo Awal
                </p>
                <p className="mt-1 text-base md:text-lg font-semibold text-emerald-900">
                  {formatCurrency(footer.SaldoAwal || 0)}
                </p>
              </div>
              <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                  ∑ Debet
                </p>
                <p className="mt-1 text-base md:text-lg font-semibold text-emerald-900">
                  {formatCurrency(footer.debet || 0)}
                  {typeof footer.cdebet === 'number' && footer.cdebet > 0
                    ? ` | ${footer.cdebet}`
                    : ''}
                </p>
              </div>
              <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                  ∑ Kredit
                </p>
                <p className="mt-1 text-base md:text-lg font-semibold text-emerald-900">
                  {formatCurrency(footer.kredit || 0)}
                  {typeof footer.ckredit === 'number' && footer.ckredit > 0
                    ? ` | ${footer.ckredit}`
                    : ''}
                </p>
              </div>
              <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
                  Saldo Akhir
                </p>
                <p className="mt-1 text-base md:text-lg font-semibold text-emerald-900">
                  {formatCurrency(footer.saldo || 0)}
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-4 text-xs md:text-sm text-slate-600 pt-2">
            <div>
              <span className="font-semibold">Total Data:</span>{' '}
              <span>{totalData.toLocaleString('id-ID')} baris</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-base md:text-lg">Buku Kas</CardTitle>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 whitespace-nowrap"
              onClick={handleExportExcel}
              disabled={loading || exportingExcel || items.length === 0}
            >
              {exportingExcel ? (
                <>
                  <Spinner className="size-4 mr-2" />
                  Export...
                </>
              ) : (
                'Export Excel'
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {error && (
            <div className="px-4 py-3 text-sm text-red-700 bg-red-50 border-b border-red-100">
              {error}
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full text-xs md:text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th
                    className="px-3 py-2 text-left font-semibold text-slate-600 cursor-pointer select-none"
                    onClick={handleToggleSortDate}
                  >
                    Tanggal {sortDirection === 'asc' ? '▲' : '▼'}
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">COA</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">
                    Jenis Transaksi
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">Keterangan</th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-600">Debet</th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-600">Kredit</th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-600">Saldo</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">Note</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">Tag</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">No Resi</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">ID EXRE</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">Referensi</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">Program</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">COA Debet</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">
                    Ket. Sumber Dana
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">User Input</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">User Approve</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={17} className="px-4 py-6 text-center text-slate-500">
                      <div className="flex items-center justify-center gap-2">
                        <Spinner className="size-5 text-emerald-600" />
                        <span>Memuat data cashbook dari Zains...</span>
                      </div>
                    </td>
                  </tr>
                )}

                {!loading && items.length === 0 && !error && (
                  <tr>
                    <td colSpan={17} className="px-4 py-6 text-center text-slate-500">
                      Tidak ada data cashbook untuk filter yang dipilih.
                    </td>
                  </tr>
                )}

                {!loading &&
                  items.length > 0 &&
                  sortedItems.map((row, idx) => (
                    <tr key={`${row.id_trans ?? 'saldo-awal'}-${idx}`} className="border-b border-slate-100">
                      <td className="px-3 py-2 whitespace-nowrap text-slate-700">
                        {formatDateShort(row.tgl_exre)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-slate-700">
                        <div className="text-[11px] md:text-xs">
                          {row.coa_kredit || row.coa || '-'}
                        </div>
                      </td>
                      <td className="px-3 py-2 min-w-[260px]">
                        <div className="text-slate-700 whitespace-normal">
                          {row.nama_coa_kredit || row.program || row.nama_coa || '-'}
                        </div>
                      </td>
                      <td className="px-3 py-2 min-w-[420px]">
                        <div className="text-slate-700 whitespace-normal" title={row.keterangan}>
                          {row.keterangan || '-'}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-emerald-700 whitespace-nowrap">
                        {row.debet ? formatCurrency(row.debet) : '-'}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-sky-700 whitespace-nowrap">
                        {row.kredit ? formatCurrency(row.kredit) : '-'}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-slate-800 whitespace-nowrap">
                        {formatCurrency(row.saldo || 0)}
                      </td>
                      <td className="px-3 py-2 max-w-[220px]">
                        <div className="text-[11px] text-slate-600 truncate" title={row.note}>
                          {row.note || '-'}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-[11px] md:text-xs text-slate-700 whitespace-nowrap">
                        {extractTag(row.note)}
                      </td>
                      <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
                        {row.noresi || '-'}
                      </td>
                      <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
                        {row.id_exre || '-'}
                      </td>
                      <td className="px-3 py-2 max-w-[220px]">
                        <div className="text-slate-700 truncate" title={row.referensi || undefined}>
                          {row.referensi || '-'}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
                        {row.program || '-'}
                      </td>
                      <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
                        {row.coa_debet || '-'}
                      </td>
                      <td className="px-3 py-2 max-w-[220px]">
                        <div className="text-slate-700 whitespace-normal">
                          {row.nama_coa_debet || '-'}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
                        {row.user_input || '-'}
                      </td>
                      <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
                        {row.user_approve || '-'}
                      </td>
                    </tr>
                  ))}
              </tbody>
              {footer && (
                <tfoot>
                  <tr className="bg-slate-50 border-t border-slate-200">
                    <td className="px-3 py-2 font-semibold text-slate-700" colSpan={6}>
                      {footer.keterangan || '∑ Total'}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-emerald-700 whitespace-nowrap">
                      {formatCurrency(footer.debet || 0)}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-sky-700 whitespace-nowrap">
                      {formatCurrency(footer.kredit || 0)}
                    </td>
                    <td className="px-3 py-2 text-right font-semibold text-slate-800 whitespace-nowrap">
                      {formatCurrency(footer.saldo || 0)}
                    </td>
                    <td className="px-3 py-2" colSpan={8} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {totalData > 0 && (
            <Pagination
              page={page}
              limit={perPage}
              total={totalData}
              onPageChange={handlePageChange}
              onLimitChange={handleLimitChange}
              currentPageCount={items.length}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

