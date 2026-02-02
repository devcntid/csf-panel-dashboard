'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, Edit, X, Save } from 'lucide-react'
import {
  createTargetCategory,
  updateTargetCategory,
  deleteTargetCategory,
} from '@/lib/actions/crud'
import { getTargetCategoriesPaginated } from '@/lib/actions/pagination'
import { Pagination } from '@/components/ui/pagination'
import { toast } from 'sonner'

export function CRUDTargetCategory({ 
  onRefresh,
  initialData 
}: { 
  onRefresh: () => void
  initialData?: { categories: any[]; total: number; page: number; limit: number }
}) {
  const [categories, setCategories] = useState<any[]>(initialData?.categories || [])
  const [isOpen, setIsOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [page, setPage] = useState(initialData?.page || 1)
  const [limit, setLimit] = useState(initialData?.limit || 10)
  const [total, setTotal] = useState(initialData?.total || 0)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    kode_coa: '',
    id_program_zains: '',
    description: '',
  })

  const loadCategories = async () => {
    setLoading(true)
    try {
      const result = await getTargetCategoriesPaginated(page, limit)
      setCategories(result.categories)
      setTotal(result.total)
    } catch (error) {
      console.error('Error loading categories:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Hanya fetch jika initialData tidak ada atau page/limit berubah
    if (!initialData || page !== initialData.page || limit !== initialData.limit) {
      loadCategories()
    }
  }, [page, limit])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const result = editingId
      ? await updateTargetCategory(editingId, formData)
      : await createTargetCategory(formData)
    
    if (result.success) {
      toast.success(editingId ? 'Kategori berhasil diupdate' : 'Kategori berhasil ditambahkan')
      setIsOpen(false)
      setEditingId(null)
      setFormData({
        name: '',
        kode_coa: '',
        id_program_zains: '',
        description: '',
      })
      await loadCategories()
      onRefresh()
    } else {
      toast.error(result.error || 'Terjadi kesalahan')
    }
  }

  const handleEdit = (category: any) => {
    setEditingId(category.id)
    setFormData({
      name: category.name || '',
      kode_coa: category.kode_coa || '',
      id_program_zains: category.id_program_zains || '',
      description: category.description || '',
    })
    setIsOpen(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Yakin ingin menghapus kategori ini?')) return
    
    const result = await deleteTargetCategory(id)
    if (result.success) {
      toast.success('Kategori berhasil dihapus')
      await loadCategories()
      onRefresh()
    } else {
      toast.error(result.error || 'Terjadi kesalahan')
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Manajemen Kategori Target</h3>
        <Button onClick={() => setIsOpen(true)} className="bg-teal-600 hover:bg-teal-700">
          <Plus className="w-4 h-4 mr-2" />
          Tambah Kategori
        </Button>
      </div>

      {isOpen && (
        <Card className="mb-4">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>{editingId ? 'Edit Kategori' : 'Tambah Kategori'}</CardTitle>
              <Button variant="ghost" size="icon" onClick={() => {
                setIsOpen(false)
                setEditingId(null)
                setFormData({
                  name: '',
                  kode_coa: '',
                  description: '',
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
                  <Label>Nama Kategori *</Label>
                  <Input
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Kode COA</Label>
                  <Input
                    value={formData.kode_coa}
                    onChange={(e) => setFormData({ ...formData, kode_coa: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>ID Program Zains</Label>
                  <Input
                    value={formData.id_program_zains}
                    onChange={(e) => setFormData({ ...formData, id_program_zains: e.target.value })}
                    placeholder="Contoh: PROG001"
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Deskripsi</Label>
                  <Input
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
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
        {categories.length === 0 && !loading ? (
          <div className="text-center py-8 text-slate-500">Tidak ada data</div>
        ) : (
          categories.map((category) => (
            <Card key={category.id}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="font-semibold">{category.name}</h4>
                    {category.kode_coa && (
                      <p className="text-sm text-slate-500">Kode COA: {category.kode_coa}</p>
                    )}
                    {category.id_program_zains && (
                      <p className="text-sm text-slate-500">ID Program Zains: {category.id_program_zains}</p>
                    )}
                    {category.description && (
                      <p className="text-sm text-slate-500 mt-1">{category.description}</p>
                    )}
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {category.kode_coa && (
                        <Badge variant="outline">{category.kode_coa}</Badge>
                      )}
                      {category.id_program_zains && (
                        <Badge variant="outline">{category.id_program_zains}</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleEdit(category)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDelete(category.id)}>
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
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">Nama Kategori</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">Kode COA</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">ID Program Zains</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">Deskripsi</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-slate-600">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.length === 0 && !loading ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-slate-500">Tidak ada data</td>
                    </tr>
                  ) : (
                    categories.map((category, index) => {
                      const rowNumber = (page - 1) * limit + index + 1
                      return (
                        <tr key={category.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-4 text-sm text-center text-slate-500">{rowNumber}</td>
                          <td className="py-3 px-4 text-sm font-medium text-slate-800">{category.name}</td>
                        <td className="py-3 px-4 text-sm text-slate-600">{category.kode_coa || '-'}</td>
                        <td className="py-3 px-4 text-sm text-slate-600">{category.id_program_zains || '-'}</td>
                        <td className="py-3 px-4 text-sm text-slate-600">{category.description || '-'}</td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex gap-2 justify-center">
                            <Button size="sm" variant="outline" onClick={() => handleEdit(category)}>
                              <Edit className="w-4 h-4 mr-1" />
                              Edit
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => handleDelete(category.id)}>
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
