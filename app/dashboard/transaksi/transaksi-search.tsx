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
  // Default tanggal ke hari ini
  const getTodayDate = () => {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const search = searchParams.get('search') || ''
  const [searchInput, setSearchInput] = useState(search)
  const [dateFrom, setDateFrom] = useState(searchParams.get('dateFrom') || getTodayDate())
  const [dateTo, setDateTo] = useState(searchParams.get('dateTo') || getTodayDate())
  const [selectedClinic, setSelectedClinic] = useState(searchParams.get('clinic') || '')
  const [selectedPoly, setSelectedPoly] = useState(searchParams.get('poly') || '')
  const [selectedInsurance, setSelectedInsurance] = useState(searchParams.get('insurance') || '')

  useEffect(() => {
    const searchParam = searchParams.get('search') || ''
    const dateFromParam = searchParams.get('dateFrom')
    const dateToParam = searchParams.get('dateTo')
    
    setSearchInput(searchParam)
    setDateFrom(dateFromParam || getTodayDate())
    setDateTo(dateToParam || getTodayDate())
    setSelectedClinic(searchParams.get('clinic') || '')
    setSelectedPoly(searchParams.get('poly') || '')
    setSelectedInsurance(searchParams.get('insurance') || '')
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
      
      // Apply date filters (default ke hari ini jika kosong)
      const finalDateFrom = dateFrom || getTodayDate()
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
      
      params.set('page', '1')
      router.push(`/dashboard/transaksi?${params.toString()}`)
    })
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
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString())
      params.delete('dateFrom')
            params.delete('dateTo')
            params.delete('clinic')
            params.delete('poly')
            params.delete('insurance')
            params.set('page', '1')
      router.push(`/dashboard/transaksi?${params.toString()}`)
    })
  }

  const hasFilter = dateFrom || dateTo || selectedClinic || selectedPoly || selectedInsurance

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
    toast.loading('Memulai proses scraping...', { id: 'scrap' })

    try {
      const response = await fetch('/api/scrap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          clinic_id: parseInt(selectedClinic),
          tgl_awal: dateFrom,
          tgl_akhir: dateTo,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Gagal melakukan scraping')
      }

      toast.success(`Scraping berhasil! ${data.insertedCount || 0} transaksi ditambahkan`, { id: 'scrap' })
      
      // Refresh page setelah 2 detik
      setTimeout(() => {
        window.location.reload()
      }, 2000)
    } catch (error: any) {
      console.error('Error scraping:', error)
      toast.error(error.message || 'Gagal melakukan scraping', { id: 'scrap' })
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

      if (search) params.set('search', search)
      if (clinic) params.set('clinic', clinic)
      if (dateFrom) params.set('dateFrom', dateFrom)
      if (dateTo) params.set('dateTo', dateTo)
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
            placeholder="Cari berdasarkan No Transaksi, Nama Pasien, atau No RM..."
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
              className="h-9"
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
