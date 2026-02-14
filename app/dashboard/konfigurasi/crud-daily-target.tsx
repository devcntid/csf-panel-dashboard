'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, Edit, X, Save, Filter, XCircle, Download, Upload } from 'lucide-react'
import {
  createDailyTarget,
  updateDailyTarget,
  deleteDailyTarget,
  getTargetConfigByClinicPolyYear,
} from '@/lib/actions/crud'
import { getAllClinics, getMasterPolies, getSources } from '@/lib/actions/config'
import { getDailyTargetsPaginated } from '@/lib/actions/pagination'
import { formatCurrency, formatDate } from '@/lib/db'
import { Pagination } from '@/components/ui/pagination'
import { toast } from 'sonner'

export function CRUDDailyTarget({ 
  onRefresh,
  initialData,
  initialPolies,
  initialClinics,
  initialSources
}: { 
  onRefresh: () => void
  initialData?: { targets: any[]; total: number; page: number; limit: number }
  initialPolies?: any[]
  initialClinics?: any[]
  initialSources?: any[]
}) {
  const [targets, setTargets] = useState<any[]>(initialData?.targets || [])
  const [polies, setPolies] = useState<any[]>(initialPolies || [])
  const [clinics, setClinics] = useState<any[]>(initialClinics || [])
  const [sources, setSources] = useState<any[]>(initialSources || [])
  const [isOpen, setIsOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [page, setPage] = useState(initialData?.page || 1)
  const [limit, setLimit] = useState(initialData?.limit || 10)
  const [total, setTotal] = useState(initialData?.total || 0)
  const [loading, setLoading] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [filters, setFilters] = useState({
    clinic_id: '',
    poly_id: '',
    source_id: '',
    start_date: '',
    end_date: '',
  })
  const [formData, setFormData] = useState({
    clinic_id: '',
    master_poly_id: '',
    source_id: '',
    target_type: 'daily' as 'daily' | 'cumulative',
    target_date: new Date().toISOString().split('T')[0],
    target_month: new Date().getMonth() + 1,
    target_year: new Date().getFullYear(),
    target_visits: 0,
    target_revenue: 0,
    base_rate: 0,
    tipe_donatur: 'retail' as 'retail' | 'corporate' | 'community',
  })

  const loadData = async () => {
    setLoading(true)
    try {
      const [targetsResult, poliesData, clinicsData, sourcesData] = await Promise.all([
        getDailyTargetsPaginated(
          filters.clinic_id ? parseInt(filters.clinic_id) : undefined,
          filters.poly_id ? parseInt(filters.poly_id) : undefined,
          filters.start_date || undefined,
          filters.end_date || undefined,
          page,
          limit
        ),
        getMasterPolies(),
        getAllClinics(),
        getSources(),
      ])
      setTargets(targetsResult.targets)
      setTotal(targetsResult.total)
      setPolies(poliesData)
      setClinics(clinicsData)
      setSources(sourcesData)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Always fetch when page, limit, or filters change
    loadData()
    // Set initial data for dropdowns if available
    if (initialPolies) setPolies(initialPolies)
    if (initialClinics) setClinics(initialClinics)
    if (initialSources) setSources(initialSources)
  }, [page, limit, filters.clinic_id, filters.poly_id, filters.source_id, filters.start_date, filters.end_date])

  // Load base rate when clinic, poly, or year changes
  useEffect(() => {
    if (formData.clinic_id && formData.master_poly_id && isOpen && formData.target_year) {
      const loadBaseRate = async () => {
        const rate = await getTargetConfigByClinicPolyYear(
          parseInt(formData.clinic_id),
          parseInt(formData.master_poly_id),
          formData.target_year
        )
        
        setFormData(prev => {
          const visits = prev.target_visits || 0
          const revenue = rate * visits
          return {
            ...prev,
            base_rate: rate,
            target_revenue: revenue,
          }
        })
      }
      loadBaseRate()
    }
  }, [formData.clinic_id, formData.master_poly_id, formData.target_year, isOpen])

  // Recalculate revenue when visits or base_rate changes
  useEffect(() => {
    if (formData.base_rate > 0 && formData.target_visits > 0) {
      const revenue = formData.base_rate * formData.target_visits
      setFormData(prev => {
        if (prev.target_revenue !== revenue) {
          return { ...prev, target_revenue: revenue }
        }
        return prev
      })
    }
  }, [formData.base_rate, formData.target_visits])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validasi: target_month dan target_year harus diisi
    if (!formData.target_month || !formData.target_year) {
      toast.error('Bulan dan Tahun wajib diisi')
      return
    }
    
    // Validasi: jika target_date diisi, pastikan bulan dan tahun sesuai
    if (formData.target_date) {
      const date = new Date(formData.target_date)
      const dateMonth = date.getMonth() + 1
      const dateYear = date.getFullYear()
      
      if (dateMonth !== formData.target_month || dateYear !== formData.target_year) {
        toast.error('Tanggal, Bulan, dan Tahun harus konsisten. Bulan dan Tahun akan disesuaikan dengan Tanggal.')
        setFormData(prev => ({
          ...prev,
          target_month: dateMonth,
          target_year: dateYear,
        }))
        return
      }
    }
    
    const result = editingId
      ? await updateDailyTarget(editingId, {
          target_type: formData.target_type,
          target_date: formData.target_date || null,
          target_month: formData.target_month,
          target_year: formData.target_year,
          target_visits: formData.target_visits,
          target_revenue: formData.target_revenue,
          tipe_donatur: formData.tipe_donatur,
        })
      : await createDailyTarget({
          clinic_id: formData.clinic_id ? parseInt(formData.clinic_id) : null,
          master_poly_id: formData.master_poly_id ? parseInt(formData.master_poly_id) : null,
          source_id: parseInt(formData.source_id),
          target_type: formData.target_type,
          target_date: formData.target_date || null,
          target_month: formData.target_month,
          target_year: formData.target_year,
          target_visits: formData.target_visits,
          target_revenue: formData.target_revenue,
          tipe_donatur: formData.tipe_donatur,
        })
    
    if (result.success) {
      toast.success(editingId ? 'Target harian berhasil diupdate' : 'Target harian berhasil ditambahkan')
      setIsOpen(false)
      setEditingId(null)
      setFormData({
        clinic_id: '',
        master_poly_id: '',
        source_id: '',
        target_type: 'daily',
        target_date: new Date().toISOString().split('T')[0],
        target_month: new Date().getMonth() + 1,
        target_year: new Date().getFullYear(),
        target_visits: 0,
        target_revenue: 0,
        base_rate: 0,
        tipe_donatur: 'retail',
      })
      await loadData()
      onRefresh()
    } else {
      toast.error(result.error || 'Terjadi kesalahan')
    }
  }

  const handleEdit = (target: any) => {
    setEditingId(target.id)
    
    // Format tanggal ke YYYY-MM-DD untuk input type="date"
    let formattedDate = target.target_date || new Date().toISOString().split('T')[0]
    
    if (target.target_date) {
      if (typeof target.target_date === 'string') {
        const dateMatch = target.target_date.match(/^(\d{4})-(\d{2})-(\d{2})/)
        if (dateMatch) {
          formattedDate = target.target_date
        } else {
          const date = new Date(target.target_date)
          if (!isNaN(date.getTime())) {
            const year = date.getFullYear()
            const month = String(date.getMonth() + 1).padStart(2, '0')
            const day = String(date.getDate()).padStart(2, '0')
            formattedDate = `${year}-${month}-${day}`
          }
        }
      } else if (target.target_date instanceof Date) {
        const year = target.target_date.getFullYear()
        const month = String(target.target_date.getMonth() + 1).padStart(2, '0')
        const day = String(target.target_date.getDate()).padStart(2, '0')
        formattedDate = `${year}-${month}-${day}`
      }
    }
    
    setFormData({
      clinic_id: target.clinic_id?.toString() || '',
      master_poly_id: target.master_poly_id?.toString() || '',
      source_id: target.source_id?.toString() || '',
      target_type: (target.target_type as 'daily' | 'cumulative') || 'daily',
      target_date: formattedDate,
      target_month: target.target_month || new Date().getMonth() + 1,
      target_year: target.target_year || new Date().getFullYear(),
      target_visits: target.target_visits || 0,
      target_revenue: Number(target.target_revenue) || 0,
      base_rate: Number(target.base_rate) || 0,
      tipe_donatur: (target.tipe_donatur as 'retail' | 'corporate' | 'community') || 'retail',
    })
    setIsOpen(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Yakin ingin menghapus target harian ini?')) return
    
    const result = await deleteDailyTarget(id)
    if (result.success) {
      toast.success('Target harian berhasil dihapus')
      await loadData()
      onRefresh()
    } else {
      toast.error(result.error || 'Terjadi kesalahan')
    }
  }

  const handleResetFilters = () => {
    setFilters({
      clinic_id: '',
      poly_id: '',
      source_id: '',
      start_date: '',
      end_date: '',
    })
    setPage(1)
  }

  const hasActiveFilters = filters.clinic_id || filters.poly_id || filters.source_id || filters.start_date || filters.end_date

  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch('/api/daily-targets/template')
      if (!response.ok) {
        throw new Error('Gagal download template')
      }
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `template-upload-target-harian-${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success('Template berhasil didownload')
    } catch (error: any) {
      toast.error(error.message || 'Gagal download template')
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
        toast.error('File harus berformat Excel (.xlsx atau .xls)')
        return
      }
      setUploadFile(file)
    }
  }

  const handleUpload = async () => {
    if (!uploadFile) {
      toast.error('Pilih file terlebih dahulu')
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', uploadFile)

      const response = await fetch('/api/daily-targets/upload', {
        method: 'POST',
        body: formData,
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Upload gagal')
      }

      if (result.success) {
        toast.success(result.message || `Berhasil upload ${result.successCount} data`)
        if (result.errors && result.errors.length > 0) {
          console.warn('Upload errors:', result.errors)
          // Show first few errors
          const errorMsg = result.errors.slice(0, 5).join(', ')
          if (result.errors.length > 5) {
            toast.warning(`${errorMsg}... (dan ${result.errors.length - 5} error lainnya)`)
          } else {
            toast.warning(errorMsg)
          }
        }
        setUploadFile(null)
        // Reset file input
        const fileInput = document.getElementById('upload-file') as HTMLInputElement
        if (fileInput) fileInput.value = ''
        await loadData()
        onRefresh()
      } else {
        throw new Error(result.error || 'Upload gagal')
      }
    } catch (error: any) {
      toast.error(error.message || 'Gagal upload file')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Target Harian</h3>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleDownloadTemplate}
            className="border-blue-300 text-blue-600 hover:bg-blue-50"
          >
            <Download className="w-4 h-4 mr-2" />
            Download Template
          </Button>
          <div className="flex items-center gap-2 border border-slate-300 rounded-md px-3 py-1.5">
            <input
              id="upload-file"
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
            />
            <label
              htmlFor="upload-file"
              className="cursor-pointer text-sm text-slate-600 hover:text-slate-800 flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              {uploadFile ? uploadFile.name : 'Pilih File'}
            </label>
            {uploadFile && (
              <Button
                size="sm"
                onClick={handleUpload}
                disabled={uploading}
                className="bg-teal-600 hover:bg-teal-700"
              >
                {uploading ? 'Uploading...' : 'Upload'}
              </Button>
            )}
          </div>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className={showFilters ? 'bg-teal-50 border-teal-600' : ''}
          >
            <Filter className="w-4 h-4 mr-2" />
            Filter
            {hasActiveFilters && (
              <Badge className="ml-2 bg-teal-600 text-white">{Object.values(filters).filter(Boolean).length}</Badge>
            )}
          </Button>
          <Button onClick={() => setIsOpen(true)} className="bg-teal-600 hover:bg-teal-700">
            <Plus className="w-4 h-4 mr-2" />
            Tambah Target
          </Button>
        </div>
      </div>

      {/* Advanced Filter */}
      {showFilters && (
        <Card className="mb-4">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>Advanced Filter</CardTitle>
              <div className="flex gap-2">
                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={handleResetFilters}>
                    <XCircle className="w-4 h-4 mr-1" />
                    Reset
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={() => setShowFilters(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="space-y-2">
                <Label>Filter by Klinik</Label>
                <Select
                  value={filters.clinic_id || 'all'}
                  onValueChange={(value) => {
                    setFilters({ ...filters, clinic_id: value === 'all' ? '' : value })
                    setPage(1)
                  }}
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
              <div className="space-y-2">
                <Label>Filter by Poli</Label>
                <Select
                  value={filters.poly_id || 'all'}
                  onValueChange={(value) => {
                    setFilters({ ...filters, poly_id: value === 'all' ? '' : value })
                    setPage(1)
                  }}
                >
                  <SelectTrigger>
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
              <div className="space-y-2">
                <Label>Filter by Source</Label>
                <Select
                  value={filters.source_id || 'all'}
                  onValueChange={(value) => {
                    setFilters({ ...filters, source_id: value === 'all' ? '' : value })
                    setPage(1)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Semua Source" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Source</SelectItem>
                    {sources.map((source) => (
                      <SelectItem key={source.id} value={source.id.toString()}>
                        {source.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tanggal Mulai</Label>
                <Input
                  type="date"
                  value={filters.start_date}
                  onChange={(e) => {
                    setFilters({ ...filters, start_date: e.target.value })
                    setPage(1)
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label>Tanggal Akhir</Label>
                <Input
                  type="date"
                  value={filters.end_date}
                  onChange={(e) => {
                    setFilters({ ...filters, end_date: e.target.value })
                    setPage(1)
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {isOpen && (
        <Card className="mb-4">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>{editingId ? 'Edit Target Harian' : 'Tambah Target Harian'}</CardTitle>
              <Button variant="ghost" size="icon" onClick={() => {
                setIsOpen(false)
                setEditingId(null)
                setFormData({
                  clinic_id: '',
                  master_poly_id: '',
                  source_id: '',
                  target_type: 'daily',
                  target_date: new Date().toISOString().split('T')[0],
                  target_month: new Date().getMonth() + 1,
                  target_year: new Date().getFullYear(),
                  target_visits: 0,
                  target_revenue: 0,
                  base_rate: 0,
                  tipe_donatur: 'retail',
                })
              }}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Klinik</Label>
                  <Select
                    value={formData.clinic_id || undefined}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, clinic_id: value }))}
                    disabled={!!editingId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih Klinik (Opsional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {clinics.map((clinic) => (
                        <SelectItem key={clinic.id} value={clinic.id.toString()}>
                          {clinic.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Poli</Label>
                  <Select
                    value={formData.master_poly_id || undefined}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, master_poly_id: value }))}
                    disabled={!!editingId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih Poli (Opsional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {polies.map((poly) => (
                        <SelectItem key={poly.id} value={poly.id.toString()}>
                          {poly.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Source *</Label>
                  <Select
                    required
                    value={formData.source_id}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, source_id: value }))}
                    disabled={!!editingId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih Source" />
                    </SelectTrigger>
                    <SelectContent>
                      {sources.map((source) => (
                        <SelectItem key={source.id} value={source.id.toString()}>
                          {source.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tipe Target *</Label>
                  <Select
                    required
                    value={formData.target_type}
                    onValueChange={(value: 'daily' | 'cumulative') => {
                      setFormData(prev => ({
                        ...prev,
                        target_type: value,
                        // Jika ubah ke cumulative, hapus target_date
                        // Jika ubah ke daily, tetap pertahankan target_date jika ada
                        target_date: value === 'cumulative' ? '' : prev.target_date,
                      }))
                    }}
                    disabled={!!editingId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih Tipe Target" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">Harian (Per Tanggal)</SelectItem>
                      <SelectItem value="cumulative">Kumulatif (Per Bulan)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tanggal Target</Label>
                  <Input
                    type="date"
                    value={formData.target_date}
                    onChange={(e) => {
                      const dateValue = e.target.value
                      if (dateValue) {
                        const date = new Date(dateValue)
                        const month = date.getMonth() + 1
                        const year = date.getFullYear()
                        setFormData(prev => ({
                          ...prev,
                          target_date: dateValue,
                          target_month: month,
                          target_year: year,
                        }))
                      } else {
                        setFormData(prev => ({ ...prev, target_date: dateValue }))
                      }
                    }}
                    disabled={!!editingId}
                  />
                  <p className="text-xs text-slate-500">Opsional. Jika diisi, bulan dan tahun akan otomatis disesuaikan</p>
                </div>
                <div className="space-y-2">
                  <Label>Bulan *</Label>
                  <Select
                    required
                    value={formData.target_month.toString()}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, target_month: parseInt(value) }))}
                    disabled={!!editingId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih Bulan" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                        <SelectItem key={month} value={month.toString()}>
                          {new Date(2000, month - 1).toLocaleString('id-ID', { month: 'long' })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tahun *</Label>
                  <Input
                    type="number"
                    required
                    min="2000"
                    max="2100"
                    value={formData.target_year}
                    onChange={(e) => setFormData(prev => ({ ...prev, target_year: parseInt(e.target.value) || new Date().getFullYear() }))}
                    disabled={!!editingId}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tarif (Rp) *</Label>
                  <Input
                    type="number"
                    readOnly
                    value={formData.base_rate}
                    className="bg-slate-50 cursor-not-allowed"
                  />
                  <p className="text-xs text-slate-500">Tarif dari Setting Tarif berdasarkan tahun</p>
                </div>
                <div className="space-y-2">
                  <Label>Target Kunjungan *</Label>
                  <Input
                    type="number"
                    required
                    min="0"
                    value={formData.target_visits}
                    onChange={(e) => {
                      const visits = parseInt(e.target.value) || 0
                      setFormData(prev => {
                        const revenue = prev.base_rate * visits
                        return { ...prev, target_visits: visits, target_revenue: revenue }
                      })
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Target Pendapatan (Rp) *</Label>
                  <Input
                    type="number"
                    readOnly
                    value={formData.target_revenue}
                    className="bg-slate-50 cursor-not-allowed"
                  />
                  <p className="text-xs text-slate-500">Tarif × Target Kunjungan</p>
                </div>
                <div className="space-y-2">
                  <Label>Tipe Donatur</Label>
                  <Select
                    value={formData.tipe_donatur}
                    onValueChange={(value: 'retail' | 'corporate' | 'community') =>
                      setFormData(prev => ({ ...prev, tipe_donatur: value }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih tipe donatur" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="retail">Retail</SelectItem>
                      <SelectItem value="corporate">Corporate</SelectItem>
                      <SelectItem value="community">Community</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" className="bg-teal-600 hover:bg-teal-700">
                  <Save className="w-4 h-4 mr-2" />
                  Simpan
                </Button>
                <Button type="button" variant="outline" onClick={() => {
                  setIsOpen(false)
                  setEditingId(null)
                }}>
                  Batal
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Mobile Card View */}
      <div className="block md:hidden space-y-2">
        {targets.length === 0 && !loading ? (
          <div className="text-center py-8 text-slate-500">Tidak ada data</div>
        ) : (
          targets.map((target) => (
            <Card key={target.id}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="font-semibold">{target.clinic_name} - {target.poly_name}</h4>
                    <p className="text-sm text-slate-500 mt-1">{formatDate(target.target_date)}</p>
                    <div className="flex gap-2 mt-2 flex-wrap">
                      <Badge variant="outline">Tarif: {formatCurrency(target.base_rate || 0)}</Badge>
                      <Badge variant="outline">Kunjungan: {target.target_visits || 0}</Badge>
                      <Badge variant="outline">Pendapatan: {formatCurrency(target.target_revenue)}</Badge>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleEdit(target)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDelete(target.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block">
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-slate-600 w-16">No</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">Klinik</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">Poli</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">Source</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">Tipe</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">Tanggal/Bulan/Tahun</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-slate-600">Tarif</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-slate-600">Target Kunjungan</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-slate-600">Target Pendapatan</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-slate-600">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {targets.length === 0 && !loading ? (
                    <tr>
                      <td colSpan={9} className="text-center py-8 text-slate-500">Tidak ada data</td>
                    </tr>
                  ) : (
                    targets.map((target, index) => {
                      const rowNumber = (page - 1) * limit + index + 1
                      const dateDisplay = target.target_type === 'daily' 
                        ? formatDate(target.target_date)
                        : `${new Date(2000, (target.target_month || 1) - 1).toLocaleString('id-ID', { month: 'long' })} ${target.target_year || ''}`
                      return (
                        <tr key={target.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-4 text-sm text-center text-slate-500">{rowNumber}</td>
                          <td className="py-3 px-4 text-sm font-medium text-slate-800">{target.clinic_name || '-'}</td>
                          <td className="py-3 px-4 text-sm text-slate-600">{target.poly_name || '-'}</td>
                          <td className="py-3 px-4 text-sm text-slate-600">{target.source_name}</td>
                          <td className="py-3 px-4 text-sm text-slate-600">
                            <Badge variant={target.target_type === 'daily' ? 'default' : 'secondary'}>
                              {target.target_type === 'daily' ? 'Harian' : 'Kumulatif'}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-sm text-slate-600">{dateDisplay}</td>
                        <td className="py-3 px-4 text-sm text-right font-medium text-slate-800">{formatCurrency(target.base_rate || 0)}</td>
                        <td className="py-3 px-4 text-sm text-right font-medium text-slate-800">{target.target_visits || 0}</td>
                        <td className="py-3 px-4 text-sm text-right font-medium text-slate-800">{formatCurrency(target.target_revenue)}</td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex gap-2 justify-center">
                            <Button size="sm" variant="outline" onClick={() => handleEdit(target)}>
                              <Edit className="w-4 h-4 mr-1" />
                              Edit
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => handleDelete(target.id)}>
                              <Trash2 className="w-4 h-4 mr-1" />
                              Hapus
                            </Button>
                          </div>
                        </td>
                      </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Pagination */}
            <Pagination
              page={page}
              limit={limit}
              total={total}
              onPageChange={setPage}
              onLimitChange={(v) => { setLimit(v); setPage(1); }}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
