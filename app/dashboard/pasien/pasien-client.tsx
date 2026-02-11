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
import { Search, X } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTransition, useState, useEffect } from 'react'

export function PasienClient({
  clinics,
}: {
  clinics: any[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const search = searchParams.get('search') || ''
  const [searchInput, setSearchInput] = useState(search)
  const [selectedClinic, setSelectedClinic] = useState(searchParams.get('clinic') || '')

  useEffect(() => {
    const searchParam = searchParams.get('search') || ''
    setSearchInput(searchParam)
    setSelectedClinic(searchParams.get('clinic') || '')
  }, [searchParams])

  const handleSearch = () => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString())
      
      // Apply search filter
      if (searchInput && searchInput.trim()) {
        params.set('search', searchInput.trim())
      } else {
        params.delete('search')
      }
      
      // Apply clinic filter
      if (selectedClinic && selectedClinic !== 'all') {
        params.set('clinic', selectedClinic)
      } else {
        params.delete('clinic')
      }
      
      params.set('page', '1')
      router.push(`/dashboard/pasien?${params.toString()}`)
    })
  }

  const handleSearchKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  const handleClinicChange = (value: string) => {
    setSelectedClinic(value)
    // Hanya update state lokal, tidak langsung update URL
  }

  const handleResetFilter = () => {
    setSearchInput('')
    setSelectedClinic('')
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString())
      params.delete('search')
      params.delete('clinic')
      params.set('page', '1')
      router.push(`/dashboard/pasien?${params.toString()}`)
    })
  }

  const hasFilter = searchInput || (selectedClinic && selectedClinic !== 'all')

  return (
    <Card className="mb-6">
      <CardContent className="p-4 space-y-4">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <Input
              type="text"
              placeholder="Cari berdasarkan Nama Pasien atau No. RM..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyPress={handleSearchKeyPress}
              className="pl-10"
              disabled={isPending}
            />
          </div>
          <Button 
            onClick={handleSearch} 
            disabled={isPending}
            className="bg-teal-600 hover:bg-teal-700"
          >
            <Search className="w-4 h-4 mr-2" />
            Cari
          </Button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t">
          <div className="space-y-2">
            <Label>Klinik</Label>
            <Select
              value={selectedClinic || 'all'}
              onValueChange={handleClinicChange}
              disabled={isPending}
            >
              <SelectTrigger>
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
          <div className="flex items-end justify-end gap-2">
            {hasFilter && (
              <Button 
                variant="outline" 
                onClick={handleResetFilter}
                disabled={isPending}
              >
                <X className="w-4 h-4 mr-2" />
                Reset
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
