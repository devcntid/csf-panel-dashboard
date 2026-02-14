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
import { Plus, Trash2, Edit, X, Save } from 'lucide-react'
import {
  createClinic,
  updateClinic,
  deleteClinic,
} from '@/lib/actions/crud'
import { getClinicsPaginated } from '@/lib/actions/pagination'
import { Pagination } from '@/components/ui/pagination'
import { toast } from 'sonner'

export function CRUDKlinik({ 
  onRefresh,
  initialData 
}: { 
  onRefresh: () => void
  initialData?: { clinics: any[]; total: number; page: number; limit: number }
}) {
  const [clinics, setClinics] = useState<any[]>(initialData?.clinics || [])
  const [isOpen, setIsOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [page, setPage] = useState(initialData?.page || 1)
  const [limit, setLimit] = useState(initialData?.limit || 10)
  const [total, setTotal] = useState(initialData?.total || 0)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    login_url: 'https://csf.eclinic.id/login',
    username: '',
    password_encrypted: '',
    kode_coa: '',
    id_kantor_zains: '',
    coa_qris: '',
    id_rekening: '',
    is_active: true,
  })

  const loadClinics = async () => {
    setLoading(true)
    try {
      const result = await getClinicsPaginated(page, limit)
      setClinics(result.clinics)
      setTotal(result.total)
    } catch (error) {
      console.error('Error loading clinics:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Always fetch when page or limit changes
    loadClinics()
  }, [page, limit])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const result = editingId
      ? await updateClinic(editingId, formData)
      : await createClinic(formData)
    
    if (result.success) {
      toast.success(editingId ? 'Klinik berhasil diupdate' : 'Klinik berhasil ditambahkan')
      setIsOpen(false)
      setEditingId(null)
      setFormData({
        name: '',
        location: '',
        login_url: 'https://csf.eclinic.id/login',
        username: '',
        password_encrypted: '',
        kode_coa: '',
        id_kantor_zains: '',
        coa_qris: '',
        id_rekening: '',
        is_active: true,
      })
      await loadClinics()
      onRefresh()
    } else {
      toast.error(result.error || 'Terjadi kesalahan')
    }
  }

  const handleEdit = (clinic: any) => {
    setEditingId(clinic.id)
    setFormData({
      name: clinic.name || '',
      location: clinic.location || '',
      login_url: clinic.login_url || 'https://csf.eclinic.id/login',
      username: clinic.username || '',
      password_encrypted: '',
      kode_coa: clinic.kode_coa || '',
      id_kantor_zains: clinic.id_kantor_zains || '',
      coa_qris: clinic.coa_qris || '',
      id_rekening: clinic.id_rekening || '',
      is_active: clinic.is_active ?? true,
    })
    setIsOpen(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Yakin ingin menghapus klinik ini?')) return
    
    const result = await deleteClinic(id)
    if (result.success) {
      toast.success('Klinik berhasil dihapus')
      await loadClinics()
      onRefresh()
    } else {
      toast.error(result.error || 'Terjadi kesalahan')
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Manajemen Klinik</h3>
        <Button onClick={() => setIsOpen(true)} className="bg-teal-600 hover:bg-teal-700">
          <Plus className="w-4 h-4 mr-2" />
          Tambah Klinik
        </Button>
      </div>

      {isOpen && (
        <Card className="mb-4">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>{editingId ? 'Edit Klinik' : 'Tambah Klinik'}</CardTitle>
              <Button variant="ghost" size="icon" onClick={() => {
                setIsOpen(false)
                setEditingId(null)
                setFormData({
                  name: '',
                  location: '',
                  login_url: 'https://csf.eclinic.id/login',
                  username: '',
                  password_encrypted: '',
                  kode_coa: '',
                  id_kantor_zains: '',
                  coa_qris: '',
                  id_rekening: '',
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
                  <Label>Nama Klinik *</Label>
                  <Input
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Lokasi</Label>
                  <Input
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Login URL *</Label>
                  <Input
                    required
                    value={formData.login_url}
                    onChange={(e) => setFormData({ ...formData, login_url: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Username *</Label>
                  <Input
                    required
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{editingId ? 'Password Baru (kosongkan jika tidak diubah)' : 'Password *'}</Label>
                  <Input
                    type="password"
                    required={!editingId}
                    value={formData.password_encrypted}
                    onChange={(e) => setFormData({ ...formData, password_encrypted: e.target.value })}
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
                  <Label>ID Kantor Zains</Label>
                  <Input
                    value={formData.id_kantor_zains}
                    onChange={(e) => setFormData({ ...formData, id_kantor_zains: e.target.value })}
                    placeholder="Contoh: KANTOR001"
                  />
                </div>
                <div className="space-y-2">
                  <Label>COA QRIS</Label>
                  <Input
                    value={formData.coa_qris}
                    onChange={(e) => setFormData({ ...formData, coa_qris: e.target.value })}
                    placeholder="Contoh: 101.09.003.000"
                  />
                </div>
                <div className="space-y-2">
                  <Label>ID Rekening</Label>
                  <Input
                    value={formData.id_rekening}
                    onChange={(e) => setFormData({ ...formData, id_rekening: e.target.value })}
                    placeholder="Contoh: 10109003000"
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
        {clinics.length === 0 && !loading ? (
          <div className="text-center py-8 text-slate-500">Tidak ada data</div>
        ) : (
          clinics.map((clinic) => (
            <Card key={clinic.id}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="font-semibold">{clinic.name}</h4>
                    <p className="text-sm text-slate-500">{clinic.location || '-'}</p>
                    <div className="flex gap-2 mt-2 flex-wrap">
                      <Badge className={clinic.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                        {clinic.is_active ? 'Aktif' : 'Tidak Aktif'}
                      </Badge>
                      {clinic.kode_coa && (
                        <Badge variant="outline">{clinic.kode_coa}</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleEdit(clinic)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDelete(clinic.id)}>
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
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">Nama Klinik</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">Lokasi</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">Login URL</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">Username</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">Kode COA</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">ID Kantor Zains</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">COA QRIS</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">ID Rekening</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-slate-600">Status</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-slate-600">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {clinics.length === 0 && !loading ? (
                    <tr>
                      <td colSpan={11} className="text-center py-8 text-slate-500">Tidak ada data</td>
                    </tr>
                  ) : (
                    clinics.map((clinic, index) => {
                      const rowNumber = (page - 1) * limit + index + 1
                      return (
                        <tr key={clinic.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-4 text-sm text-center text-slate-500">{rowNumber}</td>
                          <td className="py-3 px-4 text-sm font-medium text-slate-800">{clinic.name}</td>
                        <td className="py-3 px-4 text-sm text-slate-600">{clinic.location || '-'}</td>
                        <td className="py-3 px-4 text-sm text-slate-600">{clinic.login_url || '-'}</td>
                        <td className="py-3 px-4 text-sm text-slate-600">{clinic.username || '-'}</td>
                        <td className="py-3 px-4 text-sm text-slate-600">{clinic.kode_coa || '-'}</td>
                        <td className="py-3 px-4 text-sm text-slate-600">{clinic.id_kantor_zains || '-'}</td>
                        <td className="py-3 px-4 text-sm text-slate-600">{clinic.coa_qris || '-'}</td>
                        <td className="py-3 px-4 text-sm text-slate-600">{clinic.id_rekening || '-'}</td>
                        <td className="py-3 px-4 text-center">
                          <Badge className={clinic.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                            {clinic.is_active ? 'Aktif' : 'Tidak Aktif'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex gap-2 justify-center">
                            <Button size="sm" variant="outline" onClick={() => handleEdit(clinic)}>
                              <Edit className="w-4 h-4 mr-1" />
                              Edit
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => handleDelete(clinic.id)}>
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
