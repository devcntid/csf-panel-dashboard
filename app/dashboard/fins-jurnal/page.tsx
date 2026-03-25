'use client'

import { useEffect, useRef, useState } from 'react'
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

type FinsJurnalItem = {
  id_jurnal: string
  id_transaksi: string
  id_exre: string
  coa: string
  debet: number
  kredit: number
  keterangan: string
  nik_input: string
  tgl_exre: string
  tgl: string
  nominal: number
  id_kantor: number
  id_via_bayar: number
  jenis_jurnal: string
  via_jurnal: number
  id_trans: string
  note: string
  fdt: string
  coa_buku: string
  noresi: string
  id_program: number
  dtu: string
  nama_kantor: string | null
  nama_program: string
  nama_karyawan: string | null
  nama_coa: string
  nama_coa_buku: string
  nama_parent_coa: string
  jenis: string
  keterangan_sumber_dana: string
}

type FinsJurnalPaging = {
  per_page: number
  current_page: number
  total_data: number
  total_page: number
  next_page: number | null
  previous_page: number | null
}

type FinsJurnalResponse = {
  status: boolean
  message: string
  data: FinsJurnalItem[]
  count: number
  sum: number
  paging: FinsJurnalPaging
}

type FinsJurnalDisplayRow = FinsJurnalItem & {
  lineSide: 'DEBET' | 'KREDIT'
  coa_display: string
  nama_coa_display: string
  nama_parent_coa_display: string
  debet_display: number
  kredit_display: number
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

function formatViaJurnal(via: number): string {
  if (via === 1) return 'Manual'
  if (via === 3) return 'Otomatis'
  if (via === 2) return 'Import'
  return `Via ${via}`
}

export default function FinsJurnalPage() {
  const { data: session, status: sessionStatus } = useSession()
  const router = useRouter()

  // Gunakan 'all' sebagai nilai default di Select (tidak boleh string kosong),
  // dan mapping ke query param kosong saat call API.
  const [type, setType] = useState<string>('all')
  const getTodayStr = () => {
    const today = new Date()
    const y = today.getFullYear()
    const m = String(today.getMonth() + 1).padStart(2, '0')
    const d = String(today.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  const [startDate, setStartDate] = useState<string>(() => getTodayStr())
  const [endDate, setEndDate] = useState<string>(() => getTodayStr())

  const [page, setPage] = useState<number>(1)
  const [perPage, setPerPage] = useState<number>(10)
  const [items, setItems] = useState<FinsJurnalDisplayRow[]>([])
  const [totalData, setTotalData] = useState<number>(0)
  const [totalNominal, setTotalNominal] = useState<number>(0)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [exportingExcel, setExportingExcel] = useState<boolean>(false)

  const jurnalFetchReqRef = useRef(0)

  // Pencarian by terms dikirim ke API Zains (server-side). Tabel menampilkan items dari response.

  // Proteksi: clinic_manager tidak boleh mengakses halaman ini
  useEffect(() => {
    if (sessionStatus !== 'authenticated') return
    const role = (session?.user as any)?.role || ''
    if (role === 'clinic_manager') {
      router.replace('/dashboard')
    }
  }, [session, sessionStatus, router])

  const fetchData = async (opts?: { page?: number; perPage?: number }) => {
    const targetPage = opts?.page ?? page
    const targetPerPage = opts?.perPage ?? perPage

    if (!startDate || !endDate) {
      setError('Periode tanggal wajib diisi')
      return
    }

    const reqId = ++jurnalFetchReqRef.current
    const stale = () => reqId !== jurnalFetchReqRef.current

    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams()
      if (type && type !== 'all') params.set('type', type)
      params.set('tgl_awal', startDate)
      params.set('tgl_akhir', endDate)
      params.set('page', String(targetPage))
      params.set('per_page', String(targetPerPage))
      if (searchTerm.trim()) params.set('terms', searchTerm.trim())

      const res = await fetch(`/api/fins/jurnal?${params.toString()}`, {
        cache: 'no-store',
      })

      const json = (await res.json()) as FinsJurnalResponse

      if (stale()) return
      if (!res.ok || !json.status) {
        setError(json.message || 'Gagal mengambil data jurnal dari Zains')
        setItems([])
        setTotalData(0)
        setTotalNominal(0)
        return
      }

      const rawRows: FinsJurnalItem[] = Array.isArray(json.data) ? json.data : []

      // Data dari API backend sudah dalam "bentuk tabel":
      // satu baris = satu sisi jurnal dengan kolom utama: coa, debet, kredit, dll.
      // Di sini kita hanya menentukan sisi (DEBET/KREDIT) dan field tampilan COA.
      const displayRows: FinsJurnalDisplayRow[] = rawRows.map((row) => {
        const debetVal = Number(row.debet || 0)
        const kreditVal = Number(row.kredit || 0)

        const lineSide: 'DEBET' | 'KREDIT' = debetVal !== 0 ? 'DEBET' : 'KREDIT'

        return {
          ...row,
          lineSide,
          coa_display: row.coa,
          nama_coa_display: row.nama_coa,
          nama_parent_coa_display: row.nama_parent_coa,
          debet_display: debetVal,
          kredit_display: kreditVal,
        }
      })

      setItems(displayRows)
      setTotalData(json.paging?.total_data ?? json.count ?? 0)
      setTotalNominal(typeof json.sum === 'number' ? json.sum : 0)
      setPage(json.paging?.current_page ?? targetPage)
      setPerPage(json.paging?.per_page ?? targetPerPage)
    } catch (err: any) {
      console.error('Error fetch /api/fins/jurnal:', err)
      if (!stale()) {
        setError(err?.message || 'Terjadi kesalahan saat mengambil data jurnal')
        setItems([])
        setTotalData(0)
        setTotalNominal(0)
      }
    } finally {
      if (!stale()) setLoading(false)
    }
  }

  // Load awal
  useEffect(() => {
    if (sessionStatus === 'authenticated') {
      fetchData({ page: 1, perPage })
    }
    return () => {
      jurnalFetchReqRef.current++
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionStatus])

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

  const handleSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      setPage(1)
      fetchData({ page: 1, perPage })
    }
  }

  const handleExportExcel = async () => {
    if (!startDate || !endDate) return
    setExportingExcel(true)
    try {
      const perPageExport = 100
      const params = new URLSearchParams()
      if (type && type !== 'all') params.set('type', type)
      params.set('tgl_awal', startDate)
      params.set('tgl_akhir', endDate)
      params.set('per_page', String(perPageExport))
      if (searchTerm.trim()) params.set('terms', searchTerm.trim())

      const allRows: FinsJurnalDisplayRow[] = []
      let currentPage = 1
      let totalPage = 1

      do {
        params.set('page', String(currentPage))
        const res = await fetch(`/api/fins/jurnal?${params.toString()}`, { cache: 'no-store' })
        const json = (await res.json()) as FinsJurnalResponse
        if (!res.ok || !json.status || !Array.isArray(json.data)) break
        const rawRows: FinsJurnalItem[] = json.data
        const pageRows: FinsJurnalDisplayRow[] = rawRows.map((row) => {
          const debetVal = Number(row.debet || 0)
          const kreditVal = Number(row.kredit || 0)
          return {
            ...row,
            lineSide: (debetVal !== 0 ? 'DEBET' : 'KREDIT') as 'DEBET' | 'KREDIT',
            coa_display: row.coa,
            nama_coa_display: row.nama_coa,
            nama_parent_coa_display: row.nama_parent_coa,
            debet_display: debetVal,
            kredit_display: kreditVal,
          }
        })
        allRows.push(...pageRows)
        totalPage = json.paging?.total_page ?? 1
        currentPage += 1
      } while (currentPage <= totalPage)

      const rows = allRows.map((row) => ({
        Tanggal: formatDateShort(row.tgl),
        COA: (row.coa ?? row.coa_display) || '-',
        'Jenis Transaksi': (row.nama_coa ?? row.nama_coa_display ?? row.nama_program) || '-',
        'Ket. Sumber Dana': row.keterangan_sumber_dana || '-',
        Debet: row.debet_display ?? 0,
        Kredit: row.kredit_display ?? 0,
        Keterangan: row.keterangan || '-',
        'Via Jurnal': formatViaJurnal(row.via_jurnal),
        'User Input': row.nama_karyawan || row.nik_input || '-',
        Kantor: row.nama_kantor || '-',
        Program: row.nama_program || '-',
        'ID Buku': row.coa_buku ?? '-',
        'Nama COA Buku': row.nama_coa_buku ?? '-',
        Note: row.note || '-',
        Tag: extractTag(row.note),
        'ID Exre': row.id_exre ?? '-',
        'ID Jurnal': row.id_jurnal,
      }))
      const ws = XLSX.utils.json_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Jurnal')
      const filename = `fins-jurnal_${startDate}_${endDate}_${new Date().toISOString().slice(0, 10)}.xlsx`
      XLSX.writeFile(wb, filename)
    } finally {
      setExportingExcel(false)
    }
  }

  const isClinicManager =
    sessionStatus === 'authenticated' && (session?.user as any)?.role === 'clinic_manager'

  if (isClinicManager) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>FINS Jurnal</CardTitle>
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
      {/* Header & Filter */}
      <Card>
        <CardHeader className="border-b bg-emerald-50/60">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <CardTitle className="text-lg font-semibold text-slate-800">
                FINS Jurnal (Zains)
              </CardTitle>
              <p className="text-xs md:text-sm text-slate-600 mt-1">
                Data jurnal keuangan diambil langsung dari Zains melalui endpoint{' '}
                <span className="font-mono text-[11px] bg-white/70 px-2 py-1 rounded border border-emerald-100">
                  /fins/jurnal
                </span>
                .
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-600 uppercase tracking-wide">
                Jenis (type)
              </p>
              <Select value={type} onValueChange={(v) => setType(v)}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Semua jenis" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua</SelectItem>
                  <SelectItem value="receipt">Receipt / Penerimaan</SelectItem>
                  <SelectItem value="expense">Expense / Pengeluaran</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
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

          <div className="flex flex-wrap items-center gap-4 text-xs md:text-sm text-slate-600 border-t pt-3">
            <div>
              <span className="font-semibold">Total Data:</span>{' '}
              <span>{totalData.toLocaleString('id-ID')} jurnal</span>
            </div>
            <div>
              <span className="font-semibold">Total Nominal (sum dari API):</span>{' '}
              <span className="text-emerald-700 font-semibold">
                {formatCurrency(totalNominal || 0)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="border-b">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <CardTitle className="text-base md:text-lg">Daftar Jurnal</CardTitle>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <Input
                type="search"
                placeholder="Cari (keterangan, COA, program, sumber dana...)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                className="h-9 min-w-[200px] max-w-full sm:max-w-xs"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 whitespace-nowrap"
                onClick={handleExportExcel}
                disabled={loading || exportingExcel}
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
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">Tanggal</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">COA</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">
                    Jenis Transaksi
                  </th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">
                    Ket. Sumber Dana
                  </th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-600">Debet</th>
                  <th className="px-3 py-2 text-right font-semibold text-slate-600">Kredit</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">Keterangan</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">Via Jurnal</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">User Input</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">Kantor</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">Program</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">ID Buku</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">Nama COA Buku</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">Note</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">Tag</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">ID Exre</th>
                  <th className="px-3 py-2 text-left font-semibold text-slate-600">ID Jurnal</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={17} className="px-4 py-6 text-center text-slate-500">
                      <div className="flex items-center justify-center gap-2">
                        <Spinner className="size-5 text-emerald-600" />
                        <span>Memuat data jurnal dari Zains...</span>
                      </div>
                    </td>
                  </tr>
                )}

                {!loading && items.length === 0 && !error && !searchTerm && (
                  <tr>
                    <td colSpan={17} className="px-4 py-6 text-center text-slate-500">
                      Tidak ada data jurnal untuk periode dan filter yang dipilih.
                    </td>
                  </tr>
                )}

                {!loading && items.length === 0 && searchTerm && !error && (
                  <tr>
                    <td colSpan={17} className="px-4 py-6 text-center text-slate-500">
                      Tidak ada data yang cocok dengan pencarian &quot;{searchTerm}&quot;.
                    </td>
                  </tr>
                )}

                {!loading && items.length > 0 &&
                  items.map((row) => (
                    <tr
                      key={`${row.id_jurnal}-${row.lineSide}-${row.coa_display}-${row.debet_display}-${row.kredit_display}`}
                      className="border-b border-slate-100"
                    >
                      <td className="px-3 py-2 whitespace-nowrap text-slate-700">
                        {formatDateShort(row.tgl)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-slate-700">
                        {/* COA = kode akun saja; nama sudah di kolom Jenis Transaksi */}
                        <div className="text-[11px] md:text-xs">
                          {(row.coa ?? row.coa_display) || '-'}
                        </div>
                      </td>
                      <td className="px-3 py-2 max-w-[220px]">
                        <div className="text-slate-700 truncate">
                          {/* Jenis Transaksi = nama_coa (Faspay / Program Luar Negeri), bukan nama_coa_buku */}
                          {(row.nama_coa ?? row.nama_coa_display ?? row.nama_program) || '-'}
                        </div>
                      </td>
                      <td className="px-3 py-2 max-w-[220px]">
                        <div className="text-slate-700 truncate">
                          {row.keterangan_sumber_dana || '-'}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-emerald-700 whitespace-nowrap">
                        {row.debet_display ? formatCurrency(row.debet_display) : '-'}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-sky-700 whitespace-nowrap">
                        {row.kredit_display ? formatCurrency(row.kredit_display) : '-'}
                      </td>
                      <td className="px-3 py-2 max-w-[260px]">
                        <div className="text-slate-700 truncate" title={row.keterangan}>
                          {row.keterangan || '-'}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
                        {formatViaJurnal(row.via_jurnal)}
                      </td>
                      <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
                        {row.nama_karyawan || row.nik_input || '-'}
                      </td>
                      <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
                        {row.nama_kantor || '-'}
                      </td>
                      <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
                        {row.nama_program || '-'}
                      </td>
                      <td className="px-3 py-2 text-slate-700 whitespace-nowrap">
                        <div className="text-[11px] md:text-xs">{(row.coa_buku ?? '-')}</div>
                      </td>
                      <td className="px-3 py-2 max-w-[200px]">
                        <div className="text-slate-700 truncate" title={row.nama_coa_buku}>
                          {(row.nama_coa_buku ?? '-')}
                        </div>
                      </td>
                      <td className="px-3 py-2 max-w-[220px]">
                        <div className="text-[11px] text-slate-600 truncate" title={row.note}>
                          {row.note || '-'}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-[11px] md:text-xs text-slate-700 whitespace-nowrap">
                        {extractTag(row.note)}
                      </td>
                      <td className="px-3 py-2 text-[11px] md:text-xs text-slate-700 whitespace-nowrap">
                        {row.id_exre ?? '-'}
                      </td>
                      <td className="px-3 py-2 text-[11px] md:text-xs text-slate-700 whitespace-nowrap">
                        {row.id_jurnal}
                      </td>
                    </tr>
                  ))}
              </tbody>
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

