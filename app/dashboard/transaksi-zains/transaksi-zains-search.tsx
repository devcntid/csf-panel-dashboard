'use client'

import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Search, X, Loader2, FileSpreadsheet } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition, useState, useEffect } from 'react'
import { toast } from 'sonner'

const BASE_PATH = '/dashboard/transaksi-zains'

function getTodayDate() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getFirstDateOfMonth() {
  const today = new Date()
  const year = today.getFullYear()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}-01`
}

export function TransaksiZainsSearch({
  clinics,
  readonlyClinicId,
}: {
  clinics: any[]
  readonlyClinicId?: number
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [isExporting, setIsExporting] = useState(false)

  const search = searchParams.get('search') || ''
  const [searchInput, setSearchInput] = useState(search)
  const [dateFrom, setDateFrom] = useState(searchParams.get('dateFrom') || getFirstDateOfMonth())
  const [dateTo, setDateTo] = useState(searchParams.get('dateTo') || getTodayDate())
  const [selectedClinic, setSelectedClinic] = useState(
    readonlyClinicId ? String(readonlyClinicId) : searchParams.get('clinic') || ''
  )
  const [selectedZainsSync, setSelectedZainsSync] = useState(searchParams.get('zainsSync') || 'all')
  const [selectedMethod, setSelectedMethod] = useState(searchParams.get('method') || 'all')

  useEffect(() => {
    setSearchInput(searchParams.get('search') || '')
    setDateFrom(searchParams.get('dateFrom') || getFirstDateOfMonth())
    setDateTo(searchParams.get('dateTo') || getTodayDate())
    setSelectedClinic(readonlyClinicId ? String(readonlyClinicId) : searchParams.get('clinic') || '')
    setSelectedZainsSync(searchParams.get('zainsSync') || 'all')
    setSelectedMethod(searchParams.get('method') || 'all')
  }, [searchParams, readonlyClinicId])

  const applyFilter = () => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (searchInput?.trim()) params.set('search', searchInput.trim())
      else params.delete('search')
      params.set('dateFrom', dateFrom || getFirstDateOfMonth())
      params.set('dateTo', dateTo || getTodayDate())
      if (readonlyClinicId) {
        params.set('clinic', String(readonlyClinicId))
      } else if (selectedClinic && selectedClinic !== 'all') {
        params.set('clinic', selectedClinic)
      } else {
        params.delete('clinic')
      }
      if (selectedZainsSync && selectedZainsSync !== 'all') {
        params.set('zainsSync', selectedZainsSync)
      } else {
        params.delete('zainsSync')
      }
      if (selectedMethod && selectedMethod !== 'all') {
        params.set('method', selectedMethod)
      } else {
        params.delete('method')
      }
      params.set('page', '1')
      router.push(`${BASE_PATH}?${params.toString()}`)
    })
  }

  const handleResetFilter = () => {
    setDateFrom(getFirstDateOfMonth())
    setDateTo(getTodayDate())
    setSelectedClinic(readonlyClinicId ? String(readonlyClinicId) : '')
    setSelectedZainsSync('all')
    setSelectedMethod('all')
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString())
      params.delete('dateFrom')
      params.delete('dateTo')
      params.delete('search')
      if (readonlyClinicId) params.set('clinic', String(readonlyClinicId))
      else params.delete('clinic')
      params.delete('zainsSync')
      params.delete('method')
      params.set('page', '1')
      router.push(`${BASE_PATH}?${params.toString()}`)
    })
  }

  const hasFilter =
    dateFrom ||
    dateTo ||
    (!readonlyClinicId && selectedClinic) ||
    (selectedZainsSync && selectedZainsSync !== 'all') ||
    (selectedMethod && selectedMethod !== 'all') ||
    searchInput?.trim()

  const handleExport = async () => {
    try {
      setIsExporting(true)
      toast.loading('Mengekspor data...', { id: 'export-zains' })
      const params = new URLSearchParams()
      const search = searchParams.get('search')
      const clinic = readonlyClinicId ? String(readonlyClinicId) : searchParams.get('clinic')
      const dateFromParam = searchParams.get('dateFrom')
      const dateToParam = searchParams.get('dateTo')
      const zainsSyncParam = searchParams.get('zainsSync')
      const methodParam = searchParams.get('method')
      if (search) params.set('search', search)
      if (clinic) params.set('clinic', clinic)
      if (dateFromParam) params.set('dateFrom', dateFromParam)
      if (dateToParam) params.set('dateTo', dateToParam)
      if (zainsSyncParam) params.set('zainsSync', zainsSyncParam)
      if (methodParam) params.set('method', methodParam)
      const response = await fetch(`/api/transactions-to-zains/export?${params.toString()}`)
      if (!response.ok) throw new Error('Gagal mengekspor data')
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const contentDisposition = response.headers.get('content-disposition')
      const filename = contentDisposition
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '')
        : `transaksi-ke-zains-export-${new Date().toISOString().split('T')[0]}.xlsx`
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success('Data berhasil diekspor', { id: 'export-zains' })
    } catch (err: any) {
      console.error('Export error:', err)
      toast.error(err?.message || 'Gagal mengekspor data', { id: 'export-zains' })
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Card className="mb-6">
      <CardContent className="p-4 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
          <Input
            type="text"
            placeholder="Cari semua kolom: No. Transaksi, ID Transaksi, ID Program, Program, ID Kantor, Klinik, ID Donatur, Nama Pasien, No. RM, ID Rekening, Kode COA, Nominal..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && applyFilter()}
            className="pl-10"
            disabled={isPending}
          />
        </div>
        <div className="flex flex-wrap items-end gap-2">
          {!readonlyClinicId && (
            <div className="space-y-1 min-w-[140px]">
              <Label className="text-xs">Klinik</Label>
              <Select
                value={selectedClinic || 'all'}
                onValueChange={setSelectedClinic}
                disabled={isPending}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Semua Klinik" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Klinik</SelectItem>
                  {clinics.map((clinic) => (
                    <SelectItem key={clinic.id} value={clinic.id.toString()}>
                      {clinic.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1 min-w-[140px]">
            <Label className="text-xs">Sync Zains</Label>
            <Select
              value={selectedZainsSync || 'all'}
              onValueChange={setSelectedZainsSync}
              disabled={isPending}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Semua" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua</SelectItem>
                <SelectItem value="synced">Synced</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 min-w-[140px]">
            <Label className="text-xs">Metode</Label>
            <Select
              value={selectedMethod || 'all'}
              onValueChange={setSelectedMethod}
              disabled={isPending}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Semua Metode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Metode</SelectItem>
                <SelectItem value="TUNAI">Tunai</SelectItem>
                <SelectItem value="QRIS">QRIS</SelectItem>
                <SelectItem value="TRANSFER">Transfer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 min-w-[140px]">
            <Label className="text-xs">Tanggal Awal</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              disabled={isPending}
              className="h-9"
            />
          </div>
          <div className="space-y-1 min-w-[140px]">
            <Label className="text-xs">Tanggal Akhir</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              disabled={isPending}
              className="h-9"
            />
          </div>
          <Button
            onClick={applyFilter}
            disabled={isPending}
            className="bg-teal-600 hover:bg-teal-700 h-9"
          >
            <Search className="w-4 h-4 mr-2" />
            Filter
          </Button>
          <Button
            onClick={handleExport}
            disabled={isPending || isExporting}
            className="bg-green-600 hover:bg-green-700 h-9"
          >
            {isExporting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Ekspor...
              </>
            ) : (
              <>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Export Excel
              </>
            )}
          </Button>
          {hasFilter && (
            <Button
              variant="outline"
              onClick={handleResetFilter}
              disabled={isPending}
              className="h-9 bg-transparent"
            >
              <X className="w-4 h-4 mr-2" />
              Reset
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
