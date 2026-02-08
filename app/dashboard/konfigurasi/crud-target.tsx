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
import { Plus, Trash2, Edit, X, Save, Filter, XCircle } from 'lucide-react'
import {
  createTargetConfig,
  updateTargetConfig,
  deleteTargetConfig,
  getTargetConfigs,
} from '@/lib/actions/crud'
import { getAllClinics, getMasterPolies } from '@/lib/actions/config'
import { formatCurrency } from '@/lib/db'
import { Pagination } from '@/components/ui/pagination'
import { toast } from 'sonner'

export function CRUDTarget({ 
  onRefresh,
  initialData,
  initialPolies,
  initialClinics
}: { 
  onRefresh: () => void
  initialData?: { configs: any[]; total: number; page: number; limit: number }
  initialPolies?: any[]
  initialClinics?: any[]
}) {
  // Setting Tarif - CRUD untuk konfigurasi target
  const [configs, setConfigs] = useState<any[]>(initialData?.configs || [])
  const [polies, setPolies] = useState<any[]>(initialPolies || [])
  const [clinics, setClinics] = useState<any[]>(initialClinics || [])
  const [isOpen, setIsOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [page, setPage] = useState(initialData?.page || 1)
  const [limit, setLimit] = useState(initialData?.limit || 10)
  const [total, setTotal] = useState(initialData?.total || 0)
  const [loading, setLoading] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({
    clinic_id: '',
    poly_id: '',
    year: '',
  })
  const [formData, setFormData] = useState({
    clinic_id: '',
    master_poly_id: '',
    target_year: new Date().getFullYear(),
    base_rate: 0,
    is_active: true,
  })

  const loadData = async () => {
    setLoading(true)
    try {
      const [configsResult, poliesData, clinicsData] = await Promise.all([
        getTargetConfigs(
          filters.clinic_id ? parseInt(filters.clinic_id) : undefined,
          filters.poly_id ? parseInt(filters.poly_id) : undefined,
          filters.year ? parseInt(filters.year) : undefined,
          page,
          limit
        ),
        getMasterPolies(),
        getAllClinics(),
      ])
      setConfigs(configsResult.configs)
      setTotal(configsResult.total)
      setPolies(poliesData)
      setClinics(clinicsData)
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
  }, [page, limit, filters.clinic_id, filters.poly_id, filters.year])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const result = editingId
      ? await updateTargetConfig(editingId, {
          target_year: formData.target_year,
          base_rate: formData.base_rate,
          is_active: formData.is_active,
        })
      : await createTargetConfig({
          clinic_id: parseInt(formData.clinic_id),
          master_poly_id: parseInt(formData.master_poly_id),
          target_year: formData.target_year,
          base_rate: formData.base_rate,
          is_active: formData.is_active,
        })
    
    if (result.success) {
      toast.success(editingId ? 'Target berhasil diupdate' : 'Target berhasil ditambahkan')
      setIsOpen(false)
      setEditingId(null)
      setFormData({
        clinic_id: '',
        master_poly_id: '',
        target_year: new Date().getFullYear(),
        base_rate: 0,
        is_active: true,
      })
      await loadData()
      onRefresh()
    } else {
      toast.error(result.error || 'Terjadi kesalahan')
    }
  }

  const handleEdit = (config: any) => {
    setEditingId(config.id)
    setFormData({
      clinic_id: config.clinic_id.toString(),
      master_poly_id: config.master_poly_id.toString(),
      target_year: config.target_year,
      base_rate: Number(config.base_rate),
      is_active: config.is_active,
    })
    setIsOpen(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Yakin ingin menghapus target ini?')) return
    
    const result = await deleteTargetConfig(id)
    if (result.success) {
      toast.success('Target berhasil dihapus')
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
      year: '',
    })
    setPage(1)
  }

  const hasActiveFilters = filters.clinic_id || filters.poly_id || filters.year

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
        <h3 className="text-lg font-semibold">Setting Tarif</h3>
        <div className="flex gap-2">
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
            Tambah
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                <Label>Filter by Tahun</Label>
                <Input
                  type="number"
                  placeholder="Tahun (e.g., 2025)"
                  value={filters.year}
                  onChange={(e) => {
                    setFilters({ ...filters, year: e.target.value })
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
              <CardTitle>{editingId ? 'Edit Target' : 'Tambah Target'}</CardTitle>
              <Button variant="ghost" size="icon" onClick={() => {
                setIsOpen(false)
                setEditingId(null)
                setFormData({
                  clinic_id: '',
                  master_poly_id: '',
                  target_year: new Date().getFullYear(),
                  base_rate: 0,
                  is_active: true,
                })
              }}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Klinik *</Label>
                  <Select
                    required
                    value={formData.clinic_id}
                    onValueChange={(value) => setFormData({ ...formData, clinic_id: value })}
                    disabled={!!editingId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih Klinik" />
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
                  <Label>Poli *</Label>
                  <Select
                    required
                    value={formData.master_poly_id}
                    onValueChange={(value) => setFormData({ ...formData, master_poly_id: value })}
                    disabled={!!editingId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih Poli" />
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
                  <Label>Tahun *</Label>
                  <Input
                    type="number"
                    required
                    value={formData.target_year}
                    onChange={(e) => setFormData({ ...formData, target_year: parseInt(e.target.value) })}
                    disabled={!!editingId}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Base Rate (Tarif Dasar) *</Label>
                  <Input
                    type="number"
                    required
                    step="0.01"
                    value={formData.base_rate}
                    onChange={(e) => setFormData({ ...formData, base_rate: parseFloat(e.target.value) })}
                  />
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
        {configs.length === 0 && !loading ? (
          <div className="text-center py-8 text-slate-500">Tidak ada data</div>
        ) : (
          configs.map((config) => (
            <Card key={config.id}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                    <div className="flex-1">
                    <h4 className="font-semibold">{config.clinic_name} - {config.poly_name}</h4>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      <Badge variant="outline">Tahun: {config.target_year}</Badge>
                      <Badge variant="outline">Base Rate: {formatCurrency(config.base_rate)}</Badge>
                      <Badge className={config.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                        {config.is_active ? 'Aktif' : 'Tidak Aktif'}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleEdit(config)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDelete(config.id)}>
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
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">Tahun</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-slate-600">Base Rate</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-slate-600">Status</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-slate-600">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {configs.length === 0 && !loading ? (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-slate-500">Tidak ada data</td>
                    </tr>
                  ) : (
                    configs.map((config, index) => {
                      const rowNumber = (page - 1) * limit + index + 1
                      return (
                        <tr key={config.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-4 text-sm text-center text-slate-500">{rowNumber}</td>
                          <td className="py-3 px-4 text-sm font-medium text-slate-800">{config.clinic_name}</td>
                          <td className="py-3 px-4 text-sm text-slate-600">{config.poly_name}</td>
                          <td className="py-3 px-4 text-sm text-slate-600">{config.target_year}</td>
                          <td className="py-3 px-4 text-sm text-right font-medium text-slate-800">{formatCurrency(config.base_rate)}</td>
                          <td className="py-3 px-4 text-center">
                            <Badge className={config.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                              {config.is_active ? 'Aktif' : 'Tidak Aktif'}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex gap-2 justify-center">
                              <Button size="sm" variant="outline" onClick={() => handleEdit(config)}>
                                <Edit className="w-4 h-4 mr-1" />
                                Edit
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => handleDelete(config.id)}>
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
              onLimitChange={setLimit}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
