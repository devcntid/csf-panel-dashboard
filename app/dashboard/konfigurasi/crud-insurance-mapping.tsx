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
import { createInsuranceMapping, updateInsuranceMapping, deleteInsuranceMapping } from '@/lib/actions/crud'
import { getInsuranceMappingsPaginated } from '@/lib/actions/pagination'
import { getAllClinics, getMasterInsuranceTypes } from '@/lib/actions/config'
import { Pagination } from '@/components/ui/pagination'
import { toast } from 'sonner'

export function CRUDInsuranceMapping({
  initialData,
  masterInsuranceTypes,
  clinics,
  onRefresh,
}: {
  initialData?: { mappings: any[]; total: number; page: number; limit: number }
  masterInsuranceTypes: any[]
  clinics: any[]
  onRefresh: () => void
}) {
  const [mappings, setMappings] = useState<any[]>(initialData?.mappings || [])
  const [editingId, setEditingId] = useState<number | null>(null)
  const [page, setPage] = useState(initialData?.page || 1)
  const [limit, setLimit] = useState(initialData?.limit || 10)
  const [total, setTotal] = useState(initialData?.total || 0)
  const [loading, setLoading] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [filters, setFilters] = useState({
    clinic_id: '',
    master_insurance_id: '',
    search: '',
  })
  const [formData, setFormData] = useState({
    clinic_id: '',
    raw_insurance_name: '',
    master_insurance_id: '',
  })

  const loadMappings = async () => {
    setLoading(true)
    try {
      const result = await getInsuranceMappingsPaginated(
        filters.clinic_id ? parseInt(filters.clinic_id) : undefined,
        filters.master_insurance_id ? (filters.master_insurance_id === '-1' ? -1 : parseInt(filters.master_insurance_id)) : undefined,
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
  }, [page, limit, filters.clinic_id, filters.master_insurance_id, filters.search])

  const handleAddMapping = () => {
    setEditingId(null)
    setShowForm(true)
    setFormData({
      clinic_id: '',
      raw_insurance_name: '',
      master_insurance_id: '',
    })
  }

  const handleEdit = (mapping: any) => {
    setEditingId(mapping.id)
    setShowForm(true)
    setFormData({
      clinic_id: mapping.clinic_id?.toString() || '',
      raw_insurance_name: mapping.raw_insurance_name || '',
      master_insurance_id: mapping.master_insurance_id?.toString() || '',
    })
  }

  const handleSave = async () => {
    if (!formData.clinic_id || !formData.raw_insurance_name) {
      toast.error('Klinik dan Nama Insurance Type harus diisi')
      return
    }

    try {
      if (editingId) {
        const result = await updateInsuranceMapping(editingId, {
          raw_insurance_name: formData.raw_insurance_name,
          master_insurance_id: formData.master_insurance_id && formData.master_insurance_id !== 'none' ? parseInt(formData.master_insurance_id) : null,
        })
        if (result.success) {
          toast.success('Mapping berhasil diupdate')
          setEditingId(null)
          setShowForm(false)
          loadMappings()
          onRefresh()
        } else {
          toast.error(result.error || 'Gagal update mapping')
        }
      } else {
        const result = await createInsuranceMapping({
          clinic_id: parseInt(formData.clinic_id),
          raw_insurance_name: formData.raw_insurance_name,
          master_insurance_id: formData.master_insurance_id && formData.master_insurance_id !== 'none' ? parseInt(formData.master_insurance_id) : null,
        })
        if (result.success) {
          toast.success('Mapping berhasil ditambahkan')
          setFormData({
            clinic_id: '',
            raw_insurance_name: '',
            master_insurance_id: '',
          })
          setShowForm(false)
          loadMappings()
          onRefresh()
        } else {
          toast.error(result.error || 'Gagal tambah mapping')
        }
      }
    } catch (error: any) {
      toast.error(error.message || 'Terjadi kesalahan')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Yakin ingin menghapus mapping ini?')) return

    try {
      const result = await deleteInsuranceMapping(id)
      if (result.success) {
        toast.success('Mapping berhasil dihapus')
        loadMappings()
        onRefresh()
      } else {
        toast.error(result.error || 'Gagal hapus mapping')
      }
    } catch (error: any) {
      toast.error(error.message || 'Terjadi kesalahan')
    }
  }

  const handleResetFilters = () => {
    setFilters({
      clinic_id: '',
      master_insurance_id: '',
      search: '',
    })
    setPage(1)
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2"
        >
          <Filter className="w-4 h-4" />
          Filter
        </Button>
        <Button onClick={handleAddMapping} className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Tambah Mapping
        </Button>
      </div>

      {showFilters && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Klinik</Label>
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
                <Label>Master Insurance Type</Label>
                <Select
                  value={filters.master_insurance_id || 'all'}
                  onValueChange={(value) => {
                    setFilters({ ...filters, master_insurance_id: value === 'all' ? '' : value })
                    setPage(1)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Semua" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua</SelectItem>
                    <SelectItem value="-1">Unmapped</SelectItem>
                    {masterInsuranceTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id.toString()}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Search</Label>
                <Input
                  placeholder="Cari nama insurance..."
                  value={filters.search}
                  onChange={(e) => {
                    setFilters({ ...filters, search: e.target.value })
                    setPage(1)
                  }}
                />
              </div>
              <div className="flex items-end">
                <Button variant="outline" onClick={handleResetFilters}>
                  <XCircle className="w-4 h-4 mr-2" />
                  Reset
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Form Add/Edit */}
      {showForm && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{editingId ? 'Edit Mapping' : 'Tambah Mapping'}</h3>
              <Button variant="ghost" size="sm" onClick={() => {
                setEditingId(null)
                setShowForm(false)
                setFormData({ clinic_id: '', raw_insurance_name: '', master_insurance_id: '' })
              }}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Klinik *</Label>
                <Select
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
                <Label>Raw Insurance Name *</Label>
                <Input
                  placeholder="Nama dari eClinic"
                  value={formData.raw_insurance_name}
                  onChange={(e) => setFormData({ ...formData, raw_insurance_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Master Insurance Type</Label>
                <Select
                  value={formData.master_insurance_id || 'none'}
                  onValueChange={(value) => setFormData({ ...formData, master_insurance_id: value === 'none' ? '' : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih Master Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Tidak ada mapping</SelectItem>
                    {masterInsuranceTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id.toString()}>
                        {type.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => {
                setEditingId(null)
                setShowForm(false)
                setFormData({ clinic_id: '', raw_insurance_name: '', master_insurance_id: '' })
              }}>
                Batal
              </Button>
              <Button onClick={handleSave}>
                <Save className="w-4 h-4 mr-2" />
                Simpan
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Mapping Insurance Type</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : mappings.length === 0 ? (
            <div className="text-center py-8 text-slate-500">Tidak ada data</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-center py-2 px-4 text-sm font-semibold w-16">No</th>
                      <th className="text-left py-2 px-4 text-sm font-semibold">Klinik</th>
                      <th className="text-left py-2 px-4 text-sm font-semibold">Raw Name</th>
                      <th className="text-left py-2 px-4 text-sm font-semibold">Master Type</th>
                      <th className="text-center py-2 px-4 text-sm font-semibold">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mappings.map((mapping, index) => (
                      <tr key={mapping.id} className="border-b hover:bg-slate-50">
                        <td className="py-2 px-4 text-sm text-center">{(page - 1) * limit + index + 1}</td>
                        <td className="py-2 px-4 text-sm">{mapping.clinic_name}</td>
                        <td className="py-2 px-4 text-sm">{mapping.raw_insurance_name}</td>
                        <td className="py-2 px-4 text-sm">
                          {mapping.master_insurance_name ? (
                            <Badge variant="default">{mapping.master_insurance_name}</Badge>
                          ) : (
                            <Badge variant="outline">Unmapped</Badge>
                          )}
                        </td>
                        <td className="py-2 px-4 text-center">
                          <div className="flex justify-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(mapping)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(mapping.id)}
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4">
                <Pagination
                  page={page}
                  limit={limit}
                  total={total}
                  onPageChange={setPage}
                  onLimitChange={(v) => { setLimit(v); setPage(1); }}
                />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
