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
  createUser,
  updateUser,
  deleteUser,
} from '@/lib/actions/crud'
import { getUsersPaginated } from '@/lib/actions/pagination'
import { getAllClinics } from '@/lib/actions/config'
import { Pagination } from '@/components/ui/pagination'
import { toast } from 'sonner'

export function CRUDUser({ 
  onRefresh,
  initialData,
  initialClinics
}: { 
  onRefresh: () => void
  initialData?: { users: any[]; total: number; page: number; limit: number }
  initialClinics?: any[]
}) {
  const [users, setUsers] = useState<any[]>(initialData?.users || [])
  const [clinics, setClinics] = useState<any[]>(initialClinics || [])
  const [isOpen, setIsOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [page, setPage] = useState(initialData?.page || 1)
  const [limit, setLimit] = useState(initialData?.limit || 10)
  const [total, setTotal] = useState(initialData?.total || 0)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    full_name: '',
    role: 'clinic_manager',
    clinic_id: '',
  })

  const loadClinics = async () => {
    try {
      const clinicsData = await getAllClinics()
      setClinics(clinicsData)
    } catch (error) {
      console.error('Error loading clinics:', error)
    }
  }

  const loadUsers = async () => {
    setLoading(true)
    try {
      const result = await getUsersPaginated(page, limit)
      setUsers(result.users)
      setTotal(result.total)
    } catch (error) {
      console.error('Error loading users:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Hanya fetch jika initialData tidak ada atau page/limit berubah
    if (!initialData || page !== initialData.page || limit !== initialData.limit) {
      loadUsers()
    }
    if (!initialClinics || initialClinics.length === 0) {
      loadClinics()
    }
  }, [page, limit])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const submitData = {
      email: formData.email,
      full_name: formData.full_name || undefined,
      role: formData.role,
      clinic_id: formData.clinic_id ? parseInt(formData.clinic_id) : undefined,
    }
    
    const result = editingId
      ? await updateUser(editingId, submitData)
      : await createUser(submitData)
    
    if (result.success) {
      toast.success(editingId ? 'User berhasil diupdate' : 'User berhasil ditambahkan')
      setIsOpen(false)
      setEditingId(null)
      setFormData({
        email: '',
        full_name: '',
        role: 'clinic_manager',
        clinic_id: '',
      })
      await loadUsers()
      onRefresh()
    } else {
      toast.error(result.error || 'Terjadi kesalahan')
    }
  }

  const handleEdit = (user: any) => {
    setEditingId(user.id)
    setFormData({
      email: user.email || '',
      full_name: user.full_name || '',
      role: user.role || 'clinic_manager',
      clinic_id: user.clinic_id ? user.clinic_id.toString() : '',
    })
    setIsOpen(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Yakin ingin menghapus user ini?')) return
    
    const result = await deleteUser(id)
    if (result.success) {
      toast.success('User berhasil dihapus')
      await loadUsers()
      onRefresh()
    } else {
      toast.error(result.error || 'Terjadi kesalahan')
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Manajemen User</h3>
        <Button onClick={() => setIsOpen(true)} className="bg-teal-600 hover:bg-teal-700">
          <Plus className="w-4 h-4 mr-2" />
          Tambah User
        </Button>
      </div>

      {isOpen && (
        <Card className="mb-4">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>{editingId ? 'Edit User' : 'Tambah User'}</CardTitle>
              <Button variant="ghost" size="icon" onClick={() => {
                setIsOpen(false)
                setEditingId(null)
                setFormData({
                  email: '',
                  full_name: '',
                  role: 'clinic_manager',
                  clinic_id: '',
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
                  <Label>Email *</Label>
                  <Input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="user@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nama Lengkap</Label>
                  <Input
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="Nama Lengkap"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Role *</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value) => setFormData({ ...formData, role: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih Role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="super_admin">Super Admin</SelectItem>
                      <SelectItem value="finance_admin">Finance Admin</SelectItem>
                      <SelectItem value="clinic_manager">Clinic Manager</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Klinik</Label>
                  <Select
                    value={formData.clinic_id || 'none'}
                    onValueChange={(value) => setFormData({ ...formData, clinic_id: value === 'none' ? '' : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih Klinik (Opsional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Tidak Ada</SelectItem>
                      {clinics.map((clinic) => (
                        <SelectItem key={clinic.id} value={clinic.id.toString()}>
                          {clinic.name}
                        </SelectItem>
                      ))}
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
        {users.length === 0 && !loading ? (
          <div className="text-center py-8 text-slate-500">Tidak ada data</div>
        ) : (
          users.map((user) => (
            <Card key={user.id}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="font-semibold">{user.full_name || '-'}</h4>
                    <p className="text-sm text-slate-500">{user.email}</p>
                    <div className="flex gap-2 mt-2 flex-wrap">
                      <Badge
                        className={
                          user.role === 'super_admin'
                            ? 'bg-purple-100 text-purple-700'
                            : user.role === 'finance_admin'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-teal-100 text-teal-700'
                        }
                      >
                        {user.role}
                      </Badge>
                      {user.clinic_name && (
                        <Badge variant="outline">{user.clinic_name}</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleEdit(user)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDelete(user.id)}>
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
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">Nama</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">Email</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">Role</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">Klinik</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-slate-600">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 && !loading ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-slate-500">Tidak ada data</td>
                    </tr>
                  ) : (
                    users.map((user, index) => {
                      const rowNumber = (page - 1) * limit + index + 1
                      return (
                        <tr key={user.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-4 text-sm text-center text-slate-500">{rowNumber}</td>
                          <td className="py-3 px-4 text-sm font-medium text-slate-800">{user.full_name || '-'}</td>
                        <td className="py-3 px-4 text-sm text-slate-600">{user.email}</td>
                        <td className="py-3 px-4 text-sm">
                          <Badge
                            className={
                              user.role === 'super_admin'
                                ? 'bg-purple-100 text-purple-700'
                                : user.role === 'finance_admin'
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-teal-100 text-teal-700'
                            }
                          >
                            {user.role}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-600">{user.clinic_name || '-'}</td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex gap-2 justify-center">
                            <Button size="sm" variant="outline" onClick={() => handleEdit(user)}>
                              <Edit className="w-4 h-4 mr-1" />
                              Edit
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => handleDelete(user.id)}>
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
