'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, Edit, X, Save } from 'lucide-react'
import {
  createInsuranceType,
  updateInsuranceType,
  deleteInsuranceType,
} from '@/lib/actions/crud'
import { getInsuranceTypesPaginated } from '@/lib/actions/pagination'
import { Pagination } from '@/components/ui/pagination'
import { toast } from 'sonner'

export function CRUDInsuranceType({ 
  onRefresh,
  initialData 
}: { 
  onRefresh: () => void
  initialData?: { insuranceTypes: any[]; total: number; page: number; limit: number }
}) {
  const [insuranceTypes, setInsuranceTypes] = useState<any[]>(initialData?.insuranceTypes || [])
  const [isOpen, setIsOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [page, setPage] = useState(initialData?.page || 1)
  const [limit, setLimit] = useState(initialData?.limit || 10)
  const [total, setTotal] = useState(initialData?.total || 0)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    description: '',
  })

  const loadInsuranceTypes = async () => {
    setLoading(true)
    try {
      const result = await getInsuranceTypesPaginated(page, limit)
      setInsuranceTypes(result.insuranceTypes)
      setTotal(result.total)
    } catch (error) {
      console.error('Error loading insurance types:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Hanya fetch jika initialData tidak ada atau page/limit berubah
    if (!initialData || page !== initialData.page || limit !== initialData.limit) {
      loadInsuranceTypes()
    }
  }, [page, limit])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const result = editingId
      ? await updateInsuranceType(editingId, formData)
      : await createInsuranceType(formData)
    
    if (result.success) {
      toast.success(editingId ? 'Insurance Type berhasil diupdate' : 'Insurance Type berhasil ditambahkan')
      setIsOpen(false)
      setEditingId(null)
      setFormData({ name: '', code: '', description: '' })
      await loadInsuranceTypes()
      onRefresh()
    } else {
      toast.error(result.error || 'Terjadi kesalahan')
    }
  }

  const handleEdit = (insuranceType: any) => {
    setEditingId(insuranceType.id)
    setFormData({
      name: insuranceType.name || '',
      code: insuranceType.code || '',
      description: insuranceType.description || '',
    })
    setIsOpen(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Yakin ingin menghapus insurance type ini?')) return
    
    const result = await deleteInsuranceType(id)
    if (result.success) {
      toast.success('Insurance Type berhasil dihapus')
      await loadInsuranceTypes()
      onRefresh()
    } else {
      toast.error(result.error || 'Terjadi kesalahan')
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Master Insurance Type</h3>
        <Button onClick={() => setIsOpen(true)} className="bg-teal-600 hover:bg-teal-700">
          <Plus className="w-4 h-4 mr-2" />
          Tambah Insurance Type
        </Button>
      </div>

      {isOpen && (
        <Card className="mb-4">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>{editingId ? 'Edit Insurance Type' : 'Tambah Insurance Type'}</CardTitle>
              <Button variant="ghost" size="icon" onClick={() => {
                setIsOpen(false)
                setEditingId(null)
                setFormData({ name: '', code: '', description: '' })
              }}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Nama Insurance Type *</Label>
                <Input
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Code</Label>
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Deskripsi</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
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
        {insuranceTypes.length === 0 && !loading ? (
          <div className="text-center py-8 text-slate-500">Tidak ada data</div>
        ) : (
          insuranceTypes.map((insuranceType) => (
            <Card key={insuranceType.id}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="font-semibold">{insuranceType.name}</h4>
                    {insuranceType.code && (
                      <Badge variant="outline" className="mt-1">{insuranceType.code}</Badge>
                    )}
                    {insuranceType.description && (
                      <p className="text-sm text-slate-500 mt-1">{insuranceType.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleEdit(insuranceType)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDelete(insuranceType.id)}>
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
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">Nama Insurance Type</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">Code</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">Deskripsi</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-slate-600">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {insuranceTypes.length === 0 && !loading ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-slate-500">Tidak ada data</td>
                    </tr>
                  ) : (
                    insuranceTypes.map((insuranceType, index) => (
                      <tr key={insuranceType.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 text-sm text-center">{(page - 1) * limit + index + 1}</td>
                        <td className="py-3 px-4 text-sm font-medium text-slate-800">{insuranceType.name}</td>
                        <td className="py-3 px-4 text-sm text-slate-600">{insuranceType.code || '-'}</td>
                        <td className="py-3 px-4 text-sm text-slate-600">{insuranceType.description || '-'}</td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex gap-2 justify-center">
                            <Button size="sm" variant="outline" onClick={() => handleEdit(insuranceType)}>
                              <Edit className="w-4 h-4 mr-1" />
                              Edit
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => handleDelete(insuranceType.id)}>
                              <Trash2 className="w-4 h-4 mr-1" />
                              Hapus
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
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
