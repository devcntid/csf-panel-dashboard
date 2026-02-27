'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Trash2, Edit, X, Save } from 'lucide-react'
import { createSource, updateSource, deleteSource } from '@/lib/actions/crud'
import { toast } from 'sonner'

export function CRUDSource({
  onRefresh,
  initialData,
}: {
  onRefresh: () => void
  initialData?: any[]
}) {
  const [sources, setSources] = useState<any[]>(initialData || [])
  const [isOpen, setIsOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    category: '',
    mode: '',
    coaDebet: '',
    coaKredit: '',
    summaryOrder: '',
  })

  useEffect(() => {
    if (initialData) {
      setSources(initialData)
    }
  }, [initialData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload: any = {
      name: formData.name.trim(),
      slug: formData.slug.trim() || null,
      category: formData.category.trim() || null,
      mode: formData.mode.trim() || null,
      coa_debet: formData.coaDebet.trim() || null,
      coa_kredit: formData.coaKredit.trim() || null,
      summary_order: formData.summaryOrder ? Number(formData.summaryOrder) : null,
    }
    if (!payload.name) {
      toast.error('Nama source wajib diisi')
      return
    }

    const result = editingId
      ? await updateSource(editingId, payload)
      : await createSource(payload)

    if (result.success) {
      toast.success(editingId ? 'Source berhasil diupdate' : 'Source berhasil ditambahkan')
      setIsOpen(false)
      setEditingId(null)
      setFormData({
        name: '',
        slug: '',
        category: '',
        mode: '',
        coaDebet: '',
        coaKredit: '',
        summaryOrder: '',
      })
      onRefresh()
    } else {
      toast.error((result as any).error || 'Terjadi kesalahan')
    }
  }

  const handleEdit = (source: any) => {
    setEditingId(source.id)
    setFormData({
      name: source.name || '',
      slug: source.slug || '',
      category: source.category || '',
      mode: source.mode || '',
      coaDebet: source.coa_debet || '',
      coaKredit: source.coa_kredit || '',
      summaryOrder: source.summary_order != null ? String(source.summary_order) : '',
    })
    setIsOpen(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Yakin ingin menghapus source ini?')) return
    const result = await deleteSource(id)
    if (result.success) {
      toast.success('Source berhasil dihapus')
      onRefresh()
    } else {
      toast.error(result.error || 'Terjadi kesalahan')
    }
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Master Source</h3>
        <Button onClick={() => setIsOpen(true)} className="bg-teal-600 hover:bg-teal-700">
          <Plus className="w-4 h-4 mr-2" />
          Tambah Source
        </Button>
      </div>

      {isOpen && (
        <Card className="mb-4">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>{editingId ? 'Edit Source' : 'Tambah Source'}</CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setIsOpen(false)
                  setEditingId(null)
                  setFormData({
                    name: '',
                    slug: '',
                    category: '',
                    mode: '',
                    coaDebet: '',
                    coaKredit: '',
                    summaryOrder: '',
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
                  <Label>Nama Source *</Label>
                  <Input
                    required
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Contoh: SE Klinik"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Slug (unik, untuk kode)</Label>
                  <Input
                    value={formData.slug}
                    onChange={(e) => setFormData((prev) => ({ ...prev, slug: e.target.value }))}
                    placeholder="Contoh: se_klinik"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Kategori</Label>
                  <Input
                    value={formData.category}
                    onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
                    placeholder="Contoh: SE / FUNDRAISING"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Mode</Label>
                  <Input
                    value={formData.mode}
                    onChange={(e) => setFormData((prev) => ({ ...prev, mode: e.target.value }))}
                    placeholder="per_clinic / single"
                  />
                </div>
                <div className="space-y-2">
                  <Label>COA Debet (pisahkan dengan koma)</Label>
                  <Input
                    value={formData.coaDebet}
                    onChange={(e) => setFormData((prev) => ({ ...prev, coaDebet: e.target.value }))}
                    placeholder="Contoh: 101.01.002.013,101.02.003.000"
                  />
                </div>
                <div className="space-y-2">
                  <Label>COA Kredit (pisahkan dengan koma)</Label>
                  <Input
                    value={formData.coaKredit}
                    onChange={(e) => setFormData((prev) => ({ ...prev, coaKredit: e.target.value }))}
                    placeholder="Contoh: 401.04.002.020,401.04.002.021,..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Urutan Summary</Label>
                  <Input
                    type="number"
                    value={formData.summaryOrder}
                    onChange={(e) => setFormData((prev) => ({ ...prev, summaryOrder: e.target.value }))}
                    placeholder="Semakin kecil semakin atas"
                  />
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

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-slate-600 w-16">No</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">Nama Source</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">Slug</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">Kategori</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">Mode</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">COA Debet</th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">COA Kredit</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-slate-600">Order</th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-slate-600">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {sources.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="text-center py-8 text-slate-500">
                      Tidak ada data
                    </td>
                  </tr>
                ) : (
                  sources.map((source, index) => (
                  <tr
                      key={source.id}
                      className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                    >
                      <td className="py-3 px-4 text-sm text-center text-slate-500">{index + 1}</td>
                      <td className="py-3 px-4 text-sm font-medium text-slate-800">{source.name}</td>
                      <td className="py-3 px-4 text-xs text-slate-600">{source.slug || '-'}</td>
                      <td className="py-3 px-4 text-xs text-slate-600">{source.category || '-'}</td>
                      <td className="py-3 px-4 text-xs text-slate-600">{source.mode || '-'}</td>
                      <td className="py-3 px-4 text-xs text-slate-600 max-w-[220px] truncate" title={source.coa_debet || ''}>
                        {source.coa_debet || '-'}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600 max-w-[220px] truncate" title={source.coa_kredit || ''}>
                        {source.coa_kredit || '-'}
                      </td>
                      <td className="py-3 px-4 text-xs text-center text-slate-600">
                        {source.summary_order ?? '-'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex gap-2 justify-center">
                          <Button size="sm" variant="outline" onClick={() => handleEdit(source)}>
                            <Edit className="w-4 h-4 mr-1" />
                            Edit
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => handleDelete(source.id)}>
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
        </CardContent>
      </Card>
    </div>
  )
}
