'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Trash2, Edit, X, Save, Filter, XCircle } from 'lucide-react'
import {
  createPublicHoliday,
  updatePublicHoliday,
  deletePublicHoliday,
  getPublicHolidays,
} from '@/lib/actions/crud'
import { Pagination } from '@/components/ui/pagination'
import { toast } from 'sonner'

export function CRUDPublicHoliday({
  onRefresh,
  initialData,
}: {
  onRefresh: () => void
  initialData?: { holidays: any[]; total: number; page: number; limit: number }
}) {
  const [holidays, setHolidays] = useState<any[]>(initialData?.holidays || [])
  const [isOpen, setIsOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [page, setPage] = useState(initialData?.page || 1)
  const [limit, setLimit] = useState(initialData?.limit || 10)
  const [total, setTotal] = useState(initialData?.total || 0)
  const [loading, setLoading] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({
    year: new Date().getFullYear().toString(),
  })
  const [formData, setFormData] = useState({
    holiday_date: '',
    year: new Date().getFullYear(),
    description: '',
    is_national_holiday: true,
  })

  const loadData = async () => {
    setLoading(true)
    try {
      const result = await getPublicHolidays(
        filters.year ? parseInt(filters.year) : undefined,
        page,
        limit
      )
      setHolidays(result.holidays)
      setTotal(result.total)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Always fetch when page, limit, or filters change
    loadData()
  }, [page, limit, filters.year])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.holiday_date) {
      toast.error('Tanggal wajib diisi')
      return
    }
    if (!formData.description.trim()) {
      toast.error('Keterangan wajib diisi')
      return
    }

    const result = editingId
      ? await updatePublicHoliday(editingId, {
          holiday_date: formData.holiday_date,
          year: formData.year,
          description: formData.description.trim(),
          is_national_holiday: formData.is_national_holiday,
        })
      : await createPublicHoliday({
          holiday_date: formData.holiday_date,
          year: formData.year,
          description: formData.description.trim(),
          is_national_holiday: formData.is_national_holiday,
        })

    if (result.success) {
      toast.success(editingId ? 'Hari libur berhasil diupdate' : 'Hari libur berhasil ditambahkan')
      setIsOpen(false)
      setEditingId(null)
      setFormData({
        holiday_date: '',
        year: new Date().getFullYear(),
        description: '',
        is_national_holiday: true,
      })
      await loadData()
      onRefresh()
    } else {
      toast.error(result.error || 'Terjadi kesalahan')
    }
  }

  const handleEdit = (holiday: any) => {
    setEditingId(holiday.id)
    setFormData({
      holiday_date: holiday.holiday_date,
      year: holiday.year,
      description: holiday.description || '',
      is_national_holiday: holiday.is_national_holiday ?? true,
    })
    setIsOpen(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Yakin ingin menghapus hari libur ini?')) return

    const result = await deletePublicHoliday(id)
    if (result.success) {
      toast.success('Hari libur berhasil dihapus')
      await loadData()
      onRefresh()
    } else {
      toast.error(result.error || 'Terjadi kesalahan')
    }
  }

  const handleResetFilters = () => {
    setFilters({
      year: new Date().getFullYear().toString(),
    })
    setPage(1)
  }

  const hasActiveFilters = filters.year && filters.year !== new Date().getFullYear().toString()

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
        <h3 className="text-lg font-semibold">Hari Libur Nasional & Cuti Bersama</h3>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className={showFilters ? 'bg-teal-50 border-teal-600' : ''}
          >
            <Filter className="w-4 h-4 mr-2" />
            Filter
            {hasActiveFilters && (
              <Badge className="ml-2 bg-teal-600 text-white">1</Badge>
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
                <Label>Filter by Tahun</Label>
                <Input
                  type="number"
                  placeholder="Tahun (e.g., 2026)"
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
              <CardTitle>{editingId ? 'Edit Hari Libur' : 'Tambah Hari Libur'}</CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setIsOpen(false)
                  setEditingId(null)
                  setFormData({
                    holiday_date: '',
                    year: new Date().getFullYear(),
                    description: '',
                    is_national_holiday: true,
                  })
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tanggal *</Label>
                  <Input
                    type="date"
                    required
                    value={formData.holiday_date}
                    onChange={(e) => {
                      const date = e.target.value
                      setFormData({
                        ...formData,
                        holiday_date: date,
                        year: date ? new Date(date).getFullYear() : formData.year,
                      })
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tahun *</Label>
                  <Input
                    type="number"
                    required
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Keterangan *</Label>
                  <Input
                    type="text"
                    required
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Contoh: Tahun Baru Masehi, Cuti Bersama Idul Fitri, dll"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tipe Hari Libur *</Label>
                  <Select
                    required
                    value={formData.is_national_holiday ? 'national' : 'collective'}
                    onValueChange={(value) =>
                      setFormData({ ...formData, is_national_holiday: value === 'national' })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih Tipe" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="national">Hari Libur Nasional</SelectItem>
                      <SelectItem value="collective">Cuti Bersama</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" className="bg-teal-600 hover:bg-teal-700">
                  <Save className="w-4 h-4 mr-2" />
                  Simpan
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsOpen(false)
                    setEditingId(null)
                  }}
                >
                  Batal
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Mobile Card View */}
      <div className="block md:hidden space-y-2">
        {holidays.length === 0 && !loading ? (
          <div className="text-center py-8 text-slate-500">Tidak ada data</div>
        ) : (
          holidays.map((holiday) => (
            <Card key={holiday.id}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="font-semibold">{holiday.description}</h4>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      <Badge variant="outline">
                        {new Date(holiday.holiday_date).toLocaleDateString('id-ID', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </Badge>
                      <Badge variant="outline">Tahun: {holiday.year}</Badge>
                      <Badge
                        className={
                          holiday.is_national_holiday
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-purple-100 text-purple-700'
                        }
                      >
                        {holiday.is_national_holiday ? 'Hari Libur Nasional' : 'Cuti Bersama'}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleEdit(holiday)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDelete(holiday.id)}>
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
                    <th className="text-center py-3 px-4 text-xs font-semibold text-slate-600 w-16">
                      No
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">
                      Tanggal
                    </th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">
                      Keterangan
                    </th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-slate-600">
                      Tahun
                    </th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-slate-600">
                      Tipe
                    </th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-slate-600">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {holidays.length === 0 && !loading ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-slate-500">
                        Tidak ada data
                      </td>
                    </tr>
                  ) : (
                    holidays.map((holiday, index) => {
                      const rowNumber = (page - 1) * limit + index + 1
                      return (
                        <tr
                          key={holiday.id}
                          className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                        >
                          <td className="py-3 px-4 text-sm text-center text-slate-500">
                            {rowNumber}
                          </td>
                          <td className="py-3 px-4 text-sm font-medium text-slate-800">
                            {new Date(holiday.holiday_date).toLocaleDateString('id-ID', {
                              weekday: 'short',
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </td>
                          <td className="py-3 px-4 text-sm text-slate-600">{holiday.description}</td>
                          <td className="py-3 px-4 text-sm text-center text-slate-600">
                            {holiday.year}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <Badge
                              className={
                                holiday.is_national_holiday
                                  ? 'bg-blue-100 text-blue-700'
                                  : 'bg-purple-100 text-purple-700'
                              }
                            >
                              {holiday.is_national_holiday ? 'Hari Libur Nasional' : 'Cuti Bersama'}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex gap-2 justify-center">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEdit(holiday)}
                              >
                                <Edit className="w-4 h-4 mr-1" />
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleDelete(holiday.id)}
                              >
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
