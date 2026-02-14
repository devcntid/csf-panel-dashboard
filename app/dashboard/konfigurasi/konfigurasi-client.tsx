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
import { Plus, Trash2, Save, Edit, X, Filter, XCircle } from 'lucide-react'
import { createPolyMapping, updatePolyMapping, deletePolyMapping } from '@/lib/actions/crud'
import { getPolyMappingsPaginated } from '@/lib/actions/pagination'
import { getAllClinics, getMasterPolies } from '@/lib/actions/config'
import { Pagination } from '@/components/ui/pagination'
import { toast } from 'sonner'

export function KonfigurasiClient({
  initialData,
  masterPolies,
  clinics,
}: {
  initialData?: { mappings: any[]; total: number; page: number; limit: number }
  masterPolies: any[]
  clinics: any[]
}) {
  const [mappings, setMappings] = useState<any[]>(initialData?.mappings || [])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [page, setPage] = useState(initialData?.page || 1)
  const [limit, setLimit] = useState(initialData?.limit || 10)
  const [total, setTotal] = useState(initialData?.total || 0)
  const [loading, setLoading] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({
    clinic_id: '',
    master_poly_id: '',
    search: '',
  })
  const [formData, setFormData] = useState({
    clinic_id: '',
    raw_poly_name: '',
    master_poly_id: '',
  })

  const loadMappings = async () => {
    setLoading(true)
    try {
      const result = await getPolyMappingsPaginated(
        filters.clinic_id ? parseInt(filters.clinic_id) : undefined,
        filters.master_poly_id ? (filters.master_poly_id === '-1' ? -1 : parseInt(filters.master_poly_id)) : undefined,
        filters.search || undefined,
        page,
        limit
      )
      setMappings(result.mappings)
      setTotal(result.total)
    } catch (error) {
      console.error('Error loading mappings:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Always fetch when page, limit, or filters change
    loadMappings()
  }, [page, limit, filters.clinic_id, filters.master_poly_id, filters.search])

  const handleAddMapping = () => {
    setEditingId(null)
    setFormData({
      clinic_id: '',
      raw_poly_name: '',
      master_poly_id: '',
    })
  }

  const handleEdit = (mapping: any) => {
    setEditingId(mapping.id)
    setFormData({
      clinic_id: mapping.clinic_id?.toString() || '',
      raw_poly_name: mapping.raw_poly_name || '',
      master_poly_id: mapping.master_poly_id?.toString() || '',
    })
  }

  const handleCancel = () => {
    setEditingId(null)
    setFormData({
      clinic_id: '',
      raw_poly_name: '',
      master_poly_id: '',
    })
  }

  const handleSaveMapping = async (mapping: any) => {
    if (!formData.clinic_id || !formData.raw_poly_name) {
      toast.error('Klinik dan Nama Raw harus diisi')
      return
    }

    const submitData = {
      clinic_id: parseInt(formData.clinic_id),
      raw_poly_name: formData.raw_poly_name,
      master_poly_id: formData.master_poly_id ? parseInt(formData.master_poly_id) : null,
    }

    if (editingId) {
      const result = await updatePolyMapping(editingId, {
        raw_poly_name: submitData.raw_poly_name,
        master_poly_id: submitData.master_poly_id,
      })
      if (result.success) {
        toast.success('Mapping berhasil diupdate')
        setEditingId(null)
        await loadMappings()
      } else {
        toast.error(result.error || 'Terjadi kesalahan')
      }
    } else {
      const result = await createPolyMapping(submitData)
      if (result.success) {
        toast.success('Mapping berhasil ditambahkan')
        setFormData({
          clinic_id: '',
          raw_poly_name: '',
          master_poly_id: '',
        })
        await loadMappings()
      } else {
        toast.error(result.error || 'Terjadi kesalahan')
      }
    }
  }

  const handleDeleteMapping = async (id: number) => {
    if (!confirm('Yakin ingin menghapus mapping ini?')) return
    
    const result = await deletePolyMapping(id)
    if (result.success) {
      toast.success('Mapping berhasil dihapus')
      await loadMappings()
    } else {
      toast.error(result.error || 'Terjadi kesalahan')
    }
  }

  const handleResetFilters = () => {
    setFilters({
      clinic_id: '',
      master_poly_id: '',
      search: '',
    })
    setPage(1)
  }

  const hasActiveFilters = filters.clinic_id || filters.master_poly_id || filters.search

  return (
    <div className="space-y-4">
      {/* Advanced Filter */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Mapping Poliklinik</h3>
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
        </div>
      </div>

      {showFilters && (
        <Card>
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
                <Label>Filter by Master Poli</Label>
                <Select
                  value={filters.master_poly_id || 'all'}
                  onValueChange={(value) => {
                    setFilters({ ...filters, master_poly_id: value === 'all' ? '' : value === 'unmapped' ? '-1' : value })
                    setPage(1)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Semua Poli" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua Poli</SelectItem>
                    <SelectItem value="unmapped">Belum di-mapping</SelectItem>
                    {masterPolies.map((poly) => (
                      <SelectItem key={poly.id} value={poly.id.toString()}>
                        {poly.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Search</Label>
                <Input
                  placeholder="Cari nama raw, klinik, atau master poli..."
                  value={filters.search}
                  onChange={(e) => {
                    setFilters({ ...filters, search: e.target.value })
                    setPage(1)
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Form Add/Edit */}
      <div className="p-4 border border-teal-200 rounded-lg bg-teal-50">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-semibold text-slate-800">
            {editingId ? 'Edit Mapping' : 'Tambah Mapping Baru'}
          </h3>
          {editingId && (
            <Button variant="ghost" size="icon" onClick={handleCancel}>
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Klinik *</Label>
            <Select
              value={formData.clinic_id}
              onValueChange={(value) => setFormData({ ...formData, clinic_id: value })}
            >
              <SelectTrigger className="bg-white">
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
            <Label>Nama Raw (eClinic) *</Label>
            <Input
              placeholder="e.g., Poli Umum Pagi"
              value={formData.raw_poly_name}
              onChange={(e) => setFormData({ ...formData, raw_poly_name: e.target.value })}
              className="bg-white"
            />
          </div>
          <div className="space-y-2">
            <Label>Master Poli</Label>
            <Select
              value={formData.master_poly_id || 'none'}
              onValueChange={(value) => setFormData({ ...formData, master_poly_id: value === 'none' ? '' : value })}
            >
              <SelectTrigger className="bg-white">
                <SelectValue placeholder="Pilih Master Poli" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Tidak Ada</SelectItem>
                {masterPolies.map((poli) => (
                  <SelectItem key={poli.id} value={poli.id.toString()}>
                    {poli.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <Button
            onClick={() => handleSaveMapping(null)}
            className="bg-teal-600 hover:bg-teal-700"
          >
            <Save className="w-4 h-4 mr-2" />
            {editingId ? 'Update' : 'Simpan'}
          </Button>
          {editingId && (
            <Button variant="outline" onClick={handleCancel}>
              Batal
            </Button>
          )}
        </div>
      </div>

      {/* List Mappings */}
      {/* Mobile Card View */}
      <div className="block md:hidden space-y-2">
        {mappings.length === 0 && !loading ? (
          <div className="text-center py-8 text-slate-500">Tidak ada data</div>
        ) : (
          mappings.map((mapping) => (
            <Card key={mapping.id}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="font-semibold">{mapping.clinic_name}</h4>
                    <p className="text-sm text-slate-500 mt-1">Raw: {mapping.raw_poly_name}</p>
                    <p className="text-sm text-slate-500">Master: {mapping.master_poly_name || 'Belum di-mapping'}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleEdit(mapping)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDeleteMapping(mapping.id)}>
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
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">Nama Raw (eClinic)</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">Master Poli</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-slate-600">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {mappings.length === 0 && !loading ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-slate-500">Tidak ada data</td>
                    </tr>
                  ) : (
                    mappings.map((mapping, index) => {
                      const rowNumber = (page - 1) * limit + index + 1
                      return (
                        <tr key={mapping.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-4 text-sm text-center text-slate-500">{rowNumber}</td>
                          <td className="py-3 px-4 text-sm font-medium text-slate-800">{mapping.clinic_name}</td>
                        <td className="py-3 px-4 text-sm text-slate-600">{mapping.raw_poly_name}</td>
                        <td className="py-3 px-4 text-sm text-slate-600">{mapping.master_poly_name || '-'}</td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex gap-2 justify-center">
                            <Button size="sm" variant="outline" onClick={() => handleEdit(mapping)}>
                              <Edit className="w-4 h-4 mr-1" />
                              Edit
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => handleDeleteMapping(mapping.id)}>
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
