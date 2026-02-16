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
import { Plus, Trash2, Edit, X, Save, Filter, XCircle } from 'lucide-react'
import {
  createBpjsRealization,
  updateBpjsRealization,
  deleteBpjsRealization,
} from '@/lib/actions/crud'
import { getBpjsRealizationsPaginated } from '@/lib/actions/pagination'
import { Pagination } from '@/components/ui/pagination'
import { toast } from 'sonner'

const BULAN_OPTIONS = [
  { value: 1, label: 'Januari' },
  { value: 2, label: 'Februari' },
  { value: 3, label: 'Maret' },
  { value: 4, label: 'April' },
  { value: 5, label: 'Mei' },
  { value: 6, label: 'Juni' },
  { value: 7, label: 'Juli' },
  { value: 8, label: 'Agustus' },
  { value: 9, label: 'September' },
  { value: 10, label: 'Oktober' },
  { value: 11, label: 'November' },
  { value: 12, label: 'Desember' },
]

export function CRUDBpjsRealization({
  onRefresh,
  initialData,
  clinics,
}: {
  onRefresh: () => void
  initialData?: { realizations: any[]; total: number; page: number; limit: number }
  clinics: { id: number; name: string }[]
}) {
  const [realizations, setRealizations] = useState<any[]>(initialData?.realizations || [])
  const [isOpen, setIsOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [page, setPage] = useState(initialData?.page || 1)
  const [limit, setLimit] = useState(initialData?.limit || 10)
  const [total, setTotal] = useState(initialData?.total || 0)
  const [loading, setLoading] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({
    clinic_id: '',
    year: '',
    month: '',
  })
  const [formData, setFormData] = useState({
    clinic_id: '',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    total_peserta_terdaftar: 0,
    total_kapitasi_diterima: 0,
    pbi_count: '' as number | '',
    non_pbi_count: '' as number | '',
  })

  const loadData = async () => {
    setLoading(true)
    try {
      const result = await getBpjsRealizationsPaginated(
        filters.clinic_id ? parseInt(filters.clinic_id) : undefined,
        filters.year ? parseInt(filters.year) : undefined,
        filters.month ? parseInt(filters.month) : undefined,
        page,
        limit
      )
      setRealizations(result.realizations)
      setTotal(result.total)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [page, limit, filters.clinic_id, filters.year, filters.month])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.clinic_id) {
      toast.error('Klinik wajib dipilih')
      return
    }
    const payload = {
      clinic_id: parseInt(formData.clinic_id),
      month: formData.month,
      year: formData.year,
      total_peserta_terdaftar: Number(formData.total_peserta_terdaftar) || 0,
      total_kapitasi_diterima: Number(formData.total_kapitasi_diterima) || 0,
      pbi_count: formData.pbi_count === '' ? null : Number(formData.pbi_count),
      non_pbi_count: formData.non_pbi_count === '' ? null : Number(formData.non_pbi_count),
    }

    const result = editingId
      ? await updateBpjsRealization(editingId, payload)
      : await createBpjsRealization(payload)

    if (result.success) {
      toast.success(editingId ? 'Realisasi kapitasi berhasil diupdate' : 'Realisasi kapitasi berhasil ditambahkan')
      setIsOpen(false)
      setEditingId(null)
      setFormData({
        clinic_id: '',
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        total_peserta_terdaftar: 0,
        total_kapitasi_diterima: 0,
        pbi_count: '',
        non_pbi_count: '',
      })
      await loadData()
      onRefresh()
    } else {
      toast.error(result.error || 'Terjadi kesalahan')
    }
  }

  const handleEdit = (row: any) => {
    setEditingId(row.id)
    setFormData({
      clinic_id: String(row.clinic_id),
      month: row.month,
      year: row.year,
      total_peserta_terdaftar: Number(row.total_peserta_terdaftar) || 0,
      total_kapitasi_diterima: Number(row.total_kapitasi_diterima) || 0,
      pbi_count: row.pbi_count != null ? Number(row.pbi_count) : '',
      non_pbi_count: row.non_pbi_count != null ? Number(row.non_pbi_count) : '',
    })
    setIsOpen(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Yakin ingin menghapus realisasi kapitasi ini?')) return
    const result = await deleteBpjsRealization(id)
    if (result.success) {
      toast.success('Realisasi kapitasi berhasil dihapus')
      await loadData()
      onRefresh()
    } else {
      toast.error(result.error || 'Terjadi kesalahan')
    }
  }

  const formatRupiah = (n: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'decimal', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Number(n))
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
       
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="w-4 h-4 mr-1" />
            Filter
          </Button>
          <Button onClick={() => {
            setEditingId(null)
            setFormData({
              clinic_id: '',
              month: new Date().getMonth() + 1,
              year: new Date().getFullYear(),
              total_peserta_terdaftar: 0,
              total_kapitasi_diterima: 0,
              pbi_count: '',
              non_pbi_count: '',
            })
            setIsOpen(true)
          }} className="bg-teal-600 hover:bg-teal-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Tambah Realisasi
          </Button>
        </div>
      </div>

      {showFilters && (
        <Card className="mb-4">
          <CardContent className="pt-4">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="space-y-2">
                <Label>Klinik</Label>
                <Select
                  value={filters.clinic_id || 'all'}
                  onValueChange={(v) => setFilters({ ...filters, clinic_id: v === 'all' ? '' : v })}
                >
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Semua" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua klinik</SelectItem>
                    {clinics.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tahun</Label>
                <Input
                  type="number"
                  placeholder="Tahun"
                  className="w-24"
                  value={filters.year}
                  onChange={(e) => setFilters({ ...filters, year: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Bulan</Label>
                <Select
                  value={filters.month || 'all'}
                  onValueChange={(v) => setFilters({ ...filters, month: v === 'all' ? '' : v })}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Semua" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Semua bulan</SelectItem>
                    {BULAN_OPTIONS.map((b) => (
                      <SelectItem key={b.value} value={String(b.value)}>{b.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFilters({ clinic_id: '', year: '', month: '' })}
              >
                <XCircle className="w-4 h-4 mr-1" />
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isOpen && (
        <Card className="mb-4">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>{editingId ? 'Edit Realisasi Kapitasi' : 'Tambah Realisasi Kapitasi'}</CardTitle>
              <Button variant="ghost" size="icon" onClick={() => {
                setIsOpen(false)
                setEditingId(null)
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
                    onValueChange={(v) => setFormData({ ...formData, clinic_id: v })}
                    disabled={!!editingId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih klinik" />
                    </SelectTrigger>
                    <SelectContent>
                      {clinics.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tahun *</Label>
                  <Input
                    type="number"
                    required
                    min={2000}
                    max={2100}
                    value={formData.year}
                    onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) || 0 })}
                    disabled={!!editingId}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Bulan *</Label>
                  <Select
                    value={String(formData.month)}
                    onValueChange={(v) => setFormData({ ...formData, month: parseInt(v) })}
                    disabled={!!editingId}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BULAN_OPTIONS.map((b) => (
                        <SelectItem key={b.value} value={String(b.value)}>{b.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Jumlah Peserta Terdaftar *</Label>
                  <Input
                    type="number"
                    required
                    min={0}
                    value={formData.total_peserta_terdaftar}
                    onChange={(e) => setFormData({ ...formData, total_peserta_terdaftar: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Total Kapitasi Diterima (Rp) *</Label>
                  <Input
                    type="number"
                    required
                    min={0}
                    step={0.01}
                    value={formData.total_kapitasi_diterima}
                    onChange={(e) => setFormData({ ...formData, total_kapitasi_diterima: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Peserta PBI (opsional)</Label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="Opsional"
                    value={formData.pbi_count === '' ? '' : formData.pbi_count}
                    onChange={(e) => setFormData({ ...formData, pbi_count: e.target.value === '' ? '' : parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Peserta Non-PBI / Mandiri (opsional)</Label>
                  <Input
                    type="number"
                    min={0}
                    placeholder="Opsional"
                    value={formData.non_pbi_count === '' ? '' : formData.non_pbi_count}
                    onChange={(e) => setFormData({ ...formData, non_pbi_count: e.target.value === '' ? '' : parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" className="bg-teal-600 hover:bg-teal-700">
                  <Save className="w-4 h-4 mr-2" />
                  Simpan
                </Button>
                <Button type="button" variant="outline" onClick={() => { setIsOpen(false); setEditingId(null) }}>
                  Batal
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Mobile Card View */}
      <div className="block md:hidden space-y-2">
        {realizations.length === 0 && !loading ? (
          <div className="text-center py-8 text-slate-500">Tidak ada data</div>
        ) : (
          realizations.map((r) => (
            <Card key={r.id}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="font-semibold">{r.clinic_name}</h4>
                    <p className="text-sm text-slate-500">{BULAN_OPTIONS.find(b => b.value === r.month)?.label} {r.year}</p>
                    <p className="text-sm">Peserta: {formatRupiah(r.total_peserta_terdaftar)} · Kapitasi: Rp {formatRupiah(r.total_kapitasi_diterima)}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => handleEdit(r)}><Edit className="w-4 h-4" /></Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDelete(r.id)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block">
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-slate-600 w-14">No</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">Klinik</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">Bulan</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">Tahun</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-slate-600">Peserta Terdaftar</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-slate-600">Kapitasi Diterima</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-slate-600">PBI</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-slate-600">Non-PBI</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-slate-600">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {realizations.length === 0 && !loading ? (
                    <tr>
                      <td colSpan={9} className="text-center py-8 text-slate-500">Tidak ada data</td>
                    </tr>
                  ) : (
                    realizations.map((r, index) => (
                      <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="py-3 px-4 text-sm text-center">{(page - 1) * limit + index + 1}</td>
                        <td className="py-3 px-4 text-sm font-medium text-slate-800">{r.clinic_name}</td>
                        <td className="py-3 px-4 text-sm text-slate-600">{BULAN_OPTIONS.find(b => b.value === r.month)?.label ?? r.month}</td>
                        <td className="py-3 px-4 text-sm text-slate-600">{r.year}</td>
                        <td className="py-3 px-4 text-sm text-right text-slate-600">{formatRupiah(r.total_peserta_terdaftar)}</td>
                        <td className="py-3 px-4 text-sm text-right text-slate-600">Rp {formatRupiah(r.total_kapitasi_diterima)}</td>
                        <td className="py-3 px-4 text-sm text-right text-slate-500">{r.pbi_count != null ? formatRupiah(r.pbi_count) : '-'}</td>
                        <td className="py-3 px-4 text-sm text-right text-slate-500">{r.non_pbi_count != null ? formatRupiah(r.non_pbi_count) : '-'}</td>
                        <td className="py-3 px-4 text-center">
                          <div className="flex gap-2 justify-center">
                            <Button size="sm" variant="outline" onClick={() => handleEdit(r)}><Edit className="w-4 h-4 mr-1" /> Edit</Button>
                            <Button size="sm" variant="destructive" onClick={() => handleDelete(r.id)}><Trash2 className="w-4 h-4 mr-1" /> Hapus</Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page}
              limit={limit}
              total={total}
              onPageChange={setPage}
              onLimitChange={(v) => { setLimit(v); setPage(1) }}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
