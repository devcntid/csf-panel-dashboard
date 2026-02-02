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
  const [formData, setFormData] = useState({ name: '' })

  useEffect(() => {
    if (initialData) {
      setSources(initialData)
    }
  }, [initialData])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const payload = { name: formData.name.trim() }
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
      setFormData({ name: '' })
      onRefresh()
    } else {
      toast.error((result as any).error || 'Terjadi kesalahan')
    }
  }

  const handleEdit = (source: any) => {
    setEditingId(source.id)
    setFormData({ name: source.name || '' })
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
                  setFormData({ name: '' })
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Nama Source *</Label>
                <Input
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ name: e.target.value })}
                  placeholder="Contoh: SE Klinik"
                />
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
