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
import { Search, X, Download, Loader2, FileSpreadsheet } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition, useState, useEffect } from 'react'
import { toast } from 'sonner'

export function TransaksiSearch({
  clinics,
  polies,
  insuranceTypes,
}: {
  clinics: any[]
  polies: any[]
  insuranceTypes: any[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [isScraping, setIsScraping] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  // Default tanggal awal ke tanggal 1 bulan ini, tanggal akhir ke hari ini
  const getTodayDate = () => {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  const getFirstDateOfMonth = () => {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    return `${year}-${month}-01`
  }

  const search = searchParams.get('search') || ''
  const [searchInput, setSearchInput] = useState(search)
  const [dateFrom, setDateFrom] = useState(searchParams.get('dateFrom') || getFirstDateOfMonth())
  const [dateTo, setDateTo] = useState(searchParams.get('dateTo') || getTodayDate())
  const [selectedClinic, setSelectedClinic] = useState(searchParams.get('clinic') || '')
  const [selectedPoly, setSelectedPoly] = useState(searchParams.get('poly') || '')
  const [selectedInsurance, setSelectedInsurance] = useState(searchParams.get('insurance') || '')
  const [selectedZainsSync, setSelectedZainsSync] = useState(searchParams.get('zainsSync') || 'all')

  useEffect(() => {
    const searchParam = searchParams.get('search') || ''
    const dateFromParam = searchParams.get('dateFrom')
    const dateToParam = searchParams.get('dateTo')
    
    setSearchInput(searchParam)
    setDateFrom(dateFromParam || getFirstDateOfMonth())
    setDateTo(dateToParam || getTodayDate())
    setSelectedClinic(searchParams.get('clinic') || '')
    setSelectedPoly(searchParams.get('poly') || '')
    setSelectedInsurance(searchParams.get('insurance') || '')
    setSelectedZainsSync(searchParams.get('zainsSync') || 'all')
  }, [searchParams])

  const handleSearch = () => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (searchInput && searchInput.trim()) {
        params.set('search', searchInput.trim())
      } else {
        params.delete('search')
      }
      params.set('page', '1')
      router.push(`/dashboard/transaksi?${params.toString()}`)
    })
  }

  const handleDateFilter = () => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString())
      
      // Apply search filter
      if (searchInput && searchInput.trim()) {
        params.set('search', searchInput.trim())
      } else {
        params.delete('search')
      }
      
      // Apply date filters (default: tanggal awal = 1 bulan ini, tanggal akhir = hari ini)
      const finalDateFrom = dateFrom || getFirstDateOfMonth()
      const finalDateTo = dateTo || getTodayDate()
      params.set('dateFrom', finalDateFrom)
      params.set('dateTo', finalDateTo)
      
      // Apply clinic filter
      if (selectedClinic && selectedClinic !== 'all') {
        params.set('clinic', selectedClinic)
      } else {
        params.delete('clinic')
      }
      
      // Apply poly filter
      if (selectedPoly && selectedPoly !== 'all') {
        params.set('poly', selectedPoly)
      } else {
        params.delete('poly')
      }
      
      // Apply insurance filter
      if (selectedInsurance && selectedInsurance !== 'all') {
        params.set('insurance', selectedInsurance)
      } else {
        params.delete('insurance')
      }
      
      // Apply Sync Zains filter
      if (selectedZainsSync && selectedZainsSync !== 'all') {
        params.set('zainsSync', selectedZainsSync)
      } else {
        params.delete('zainsSync')
      }
      
      params.set('page', '1')
      router.push(`/dashboard/transaksi?${params.toString()}`)
    })
  }

  const handleZainsSyncChange = (value: string) => {
    setSelectedZainsSync(value)
  }

  const handleClinicChange = (value: string) => {
    setSelectedClinic(value)
    // Hanya update state lokal, tidak langsung update URL
  }

  const handlePolyChange = (value: string) => {
    setSelectedPoly(value)
    // Hanya update state lokal, tidak langsung update URL
  }

  const handleInsuranceChange = (value: string) => {
    setSelectedInsurance(value)
    // Hanya update state lokal, tidak langsung update URL
  }

  const handleResetFilter = () => {
          setDateFrom('')
          setDateTo('')
          setSelectedClinic('')
          setSelectedPoly('')
          setSelectedInsurance('')
          setSelectedZainsSync('all')
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString())
      params.delete('dateFrom')
            params.delete('dateTo')
            params.delete('clinic')
            params.delete('poly')
            params.delete('insurance')
            params.delete('zainsSync')
            params.set('page', '1')
      router.push(`/dashboard/transaksi?${params.toString()}`)
    })
  }

  const hasFilter = dateFrom || dateTo || selectedClinic || selectedPoly || selectedInsurance || (selectedZainsSync && selectedZainsSync !== 'all')

  const handleScrap = async () => {
    if (!selectedClinic || selectedClinic === 'all') {
      toast.error('Pilih klinik terlebih dahulu')
      return
    }
    if (!dateFrom || !dateTo) {
      toast.error('Pilih tanggal awal dan tanggal akhir terlebih dahulu')
      return
    }

    setIsScraping(true)
    toast.loading('Menambahkan request ke queue...', { id: 'scrap' })

    try {
      const response = await fetch('/api/scrap/queue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clinic_id: parseInt(selectedClinic),
          tgl_awal: dateFrom,
          tgl_akhir: dateTo,
          requested_by: 'UI',
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Gagal menambahkan request')
      }

      toast.success(
        'Scraping request telah ditambahkan ke queue. Data akan diupdate segera melalui GitHub Actions.',
        { id: 'scrap', duration: 4000 }
      )
      
      // Refresh page setelah 3 detik
      setTimeout(() => {
        window.location.reload()
      }, 3000)
    } catch (error: any) {
      console.error('Error queueing scrape:', error)
      toast.error(error.message || 'Gagal menambahkan request ke queue', { id: 'scrap' })
    } finally {
      setIsScraping(false)
    }
  }

  const handleExport = async () => {
    try {
      setIsExporting(true)
      toast.loading('Mengekspor data...', { id: 'export' })

      // Build query params dari filter yang aktif
      const params = new URLSearchParams()
      const search = searchParams.get('search')
      const clinic = searchParams.get('clinic')
      const dateFrom = searchParams.get('dateFrom')
      const dateTo = searchParams.get('dateTo')
      const poly = searchParams.get('poly')
      const insurance = searchParams.get('insurance')
      const zainsSync = searchParams.get('zainsSync')

      if (search) params.set('search', search)
      if (clinic) params.set('clinic', clinic)
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo)
      if (zainsSync) params.set('zainsSync', zainsSync)
      if (poly) params.set('poly', poly)
      if (insurance) params.set('insurance', insurance)

      const response = await fetch(`/api/transactions/export?${params.toString()}`)
      
      if (!response.ok) {
        throw new Error('Gagal mengekspor data')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      
      const contentDisposition = response.headers.get('content-disposition')
      const filename = contentDisposition
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '')
        : `transaksi-export-${new Date().toISOString().split('T')[0]}.xlsx`
      
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast.success('Data berhasil diekspor', { id: 'export' })
    } catch (error: any) {
      console.error('Error exporting:', error)
      toast.error(error.message || 'Gagal mengekspor data', { id: 'export' })
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Card className="mb-6">
      <CardContent className="p-4 space-y-4">
        {/* Search Input - Separate di atas */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
          <Input
            type="text"
            placeholder="Cari berdasarkan No Transaksi, Nama Pasien, No RM, ID Transaksi Zains, atau ID Donatur Zains..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleDateFilter()
              }
            }}
            className="pl-10"
            disabled={isPending}
          />
        </div>
        
        {/* Filter dan Tombol - Sebaris di bawah */}
        <div className="flex flex-wrap items-end gap-2">
          {/* Filter Dropdowns */}
          <div className="space-y-1 min-w-[140px]">
            <Label className="text-xs">Klinik</Label>
            <Select
              value={selectedClinic || 'all'}
              onValueChange={handleClinicChange}
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
          <div className="space-y-1 min-w-[140px]">
            <Label className="text-xs">Poli</Label>
            <Select
              value={selectedPoly || 'all'}
              onValueChange={handlePolyChange}
              disabled={isPending}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Semua Poli" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Poli</SelectItem>
                {polies.map((poly) => (
                  <SelectItem key={poly.id} value={poly.id.toString()}>
                    {poly.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 min-w-[140px]">
            <Label className="text-xs">Jenis Asuransi</Label>
            <Select
              value={selectedInsurance || 'all'}
              onValueChange={handleInsuranceChange}
              disabled={isPending}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Semua Jenis" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Jenis</SelectItem>
                {insuranceTypes.map((insurance) => (
                  <SelectItem key={insurance.id} value={insurance.id.toString()}>
                    {insurance.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 min-w-[140px]">
            <Label className="text-xs">Sync Zains</Label>
            <Select
              value={selectedZainsSync || 'all'}
              onValueChange={handleZainsSyncChange}
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

          {/* Action Buttons */}
          <Button 
            onClick={handleDateFilter} 
            disabled={isPending}
            className="bg-teal-600 hover:bg-teal-700 h-9"
          >
            <Search className="w-4 h-4 mr-2" />
            Filter
          </Button>
          <Button 
            onClick={handleScrap} 
            disabled={isPending || isScraping || !selectedClinic || selectedClinic === 'all' || !dateFrom || !dateTo}
            className="bg-blue-600 hover:bg-blue-700 h-9"
          >
            {isScraping ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Scraping...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Scrap
              </>
            )}
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
              disabled={isPending || isScraping}
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
