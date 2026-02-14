'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, Edit, X, Save } from 'lucide-react'
import {
  createMasterPoly,
  updateMasterPoly,
  deleteMasterPoly,
} from '@/lib/actions/crud'
import { getMasterPoliesPaginated } from '@/lib/actions/pagination'
import { Pagination } from '@/components/ui/pagination'
import { toast } from 'sonner'

export function CRUDPoli({ 
  onRefresh,
  initialData 
}: { 
  onRefresh: () => void
  initialData?: { polies: any[]; total: number; page: number; limit: number }
}) {
  const [polies, setPolies] = useState<any[]>(initialData?.polies || [])
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

  const loadPolies = async () => {
    setLoading(true)
    try {
      const result = await getMasterPoliesPaginated(page, limit)
      setPolies(result.polies)
      setTotal(result.total)
    } catch (error) {
      console.error('Error loading polies:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Always fetch when page or limit changes
    loadPolies()
  }, [page, limit])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const result = editingId
      ? await updateMasterPoly(editingId, formData)
      : await createMasterPoly(formData)
    
    if (result.success) {
      toast.success(editingId ? 'Poli berhasil diupdate' : 'Poli berhasil ditambahkan')
      setIsOpen(false)
      setEditingId(null)
      setFormData({
        name: '',
        code: '',
        description: '',
      })
      await loadPolies()
      onRefresh()
    } else {
      toast.error(result.error || 'Terjadi kesalahan')
    }
  }

  const handleEdit = (poly: any) => {
    setEditingId(poly.id)
    setFormData({
      name: poly.name || '',
      code: poly.code || '',
      description: poly.description || '',
    })
    setIsOpen(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Yakin ingin menghapus poli ini?')) return
    
    const result = await deleteMasterPoly(id)
    if (result.success) {
      toast.success('Poli berhasil dihapus')
      await loadPolies()
      onRefresh()
    } else {
      toast.error(result.error || 'Terjadi kesalahan')
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Manajemen Master Poli</h3>
        <Button onClick={() => setIsOpen(true)} className="bg-teal-600 hover:bg-teal-700">
          <Plus className="w-4 h-4 mr-2" />
          Tambah Poli
        </Button>
      </div>

      {isOpen && (
        <Card className="mb-4">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>{editingId ? 'Edit Poli' : 'Tambah Poli'}</CardTitle>
              <Button variant="ghost" size="icon" onClick={() => {
                setIsOpen(false)
                setEditingId(null)
                setFormData({
                  name: '',
                  code: '',
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
                  <Label>Nama Poli *</Label>
                  <Input
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Kode</Label>
                  <Input
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
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
        {polies.length === 0 && !loading ? (
          <div className="text-center py-8 text-slate-500">Tidak ada data</div>
        ) : (
          polies.map((poly) => (
            <Card key={poly.id}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="font-semibold">{poly.name}</h4>
                    {poly.code && (
                      <p className="text-sm text-slate-500">Kode: {poly.code}</p>
                    )}
                    {poly.description && (
                      <p className="text-sm text-slate-500 mt-1">{poly.description}</p>
                    )}
                    {poly.code && (
                      <div className="flex gap-2 mt-2 flex-wrap">
                        <Badge variant="outline">{poly.code}</Badge>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleEdit(poly)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDelete(poly.id)}>
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
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">Nama Poli</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">Kode</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">Deskripsi</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-slate-600">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {polies.length === 0 && !loading ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-slate-500">Tidak ada data</td>
                    </tr>
                  ) : (
                    polies.map((poly, index) => {
                      const rowNumber = (page - 1) * limit + index + 1
                      return (
                        <tr key={poly.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-4 text-sm text-center text-slate-500">{rowNumber}</td>
                          <td className="py-3 px-4 text-sm font-medium text-slate-800">{poly.name}</td>
                        <td className="py-3 px-4 text-sm text-slate-600">{poly.code || '-'}</td>
                        <td className="py-3 px-4 text-sm text-slate-600">{poly.description || '-'}</td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex gap-2 justify-center">
                            <Button size="sm" variant="outline" onClick={() => handleEdit(poly)}>
                              <Edit className="w-4 h-4 mr-1" />
                              Edit
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => handleDelete(poly.id)}>
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
