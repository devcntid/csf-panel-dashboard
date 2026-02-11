'use client'

import { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { X, Upload, FileSpreadsheet, Download, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

export function TransaksiUpload({ 
  clinics, 
  onClose, 
  onSuccess 
}: { 
  clinics: any[]
  onClose: () => void
  onSuccess?: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<any>(null)
  const resultSectionRef = useRef<HTMLDivElement>(null)

  // Setelah hasil upload ada, scroll ke bagian hasil agar tabel per baris terlihat
  useEffect(() => {
    if (uploadResult && resultSectionRef.current) {
      resultSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [uploadResult])

  const handleDownloadFormat = async (clinicId: number, clinicName: string) => {
    try {
      const response = await fetch(`/api/upload-transactions/template/${clinicId}`)
      if (!response.ok) {
        throw new Error('Gagal download format')
      }
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const contentDisposition = response.headers.get('content-disposition')
      const filename = contentDisposition
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '')
        : `format-upload-transaksi-${clinicName.replace(/\s+/g, '-')}.xlsx`
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success(`Format untuk ${clinicName} berhasil didownload`)
    } catch (error: any) {
      console.error('Error downloading format:', error)
      toast.error('Gagal download format')
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      const fileName = selectedFile.name.toLowerCase()
      if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
        toast.error('File harus berupa Excel (.xlsx atau .xls)')
        return
      }
      setFile(selectedFile)
      setUploadResult(null)
    }
  }

  const handleUpload = async () => {
    if (!file) {
      toast.error('Pilih file Excel terlebih dahulu')
      return
    }

    setUploading(true)
    setUploadResult(null)
    toast.loading('Memproses file... Proses bisa beberapa saat. Jangan tutup halaman.', { id: 'upload' })

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/upload-transactions', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Gagal mengupload file')
      }

      setUploadResult(data)
      const successCount = data.results?.filter((r: any) => r.status === 'success').length ?? data.insertedCount
      const failCount = (data.results?.filter((r: any) => r.status === 'error' || r.status === 'skipped').length) ?? data.skippedCount
      toast.success(
        `Selesai: ${successCount} baris berhasil, ${failCount} baris gagal/dilewati. Lihat detail di bawah.`,
        { id: 'upload' }
      )

      if (data.insertedCount > 0 && onSuccess) {
        setTimeout(() => onSuccess(), 2000)
      }
    } catch (error: any) {
      console.error('Error uploading:', error)
      toast.error(error.message || 'Gagal mengupload file', { id: 'upload' })
    } finally {
      setUploading(false)
    }
  }

  // Sort clinics by id ascending
  const sortedClinics = [...clinics].sort((a, b) => a.id - b.id)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-4xl max-h-[85vh] flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between border-b flex-shrink-0">
          <CardTitle>Upload Transaksi dari Excel</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent className="p-6 flex flex-col flex-1 overflow-hidden">
          <div className="flex flex-col gap-4 flex-1 min-h-0">
            {/* Upload Form - Paling Atas */}
            <div className="flex-shrink-0">
              <Label htmlFor="file" className="text-sm font-semibold mb-2 block">
                Pilih File Excel
              </Label>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <Input
                    id="file"
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleFileChange}
                    disabled={uploading}
                    className="cursor-pointer"
                  />
                </div>
                {file && (
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <FileSpreadsheet className="w-4 h-4" />
                    <span className="max-w-[200px] truncate">{file.name}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Daftar Klinik dengan Tombol Download Format */}
            <div className="flex-shrink-0">
              <Label className="text-sm font-semibold mb-2 block">
                Download Format Upload per Klinik
              </Label>
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto max-h-[200px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b sticky top-0">
                      <tr>
                        <th className="text-left py-2 px-4 font-semibold text-slate-700">ID</th>
                        <th className="text-left py-2 px-4 font-semibold text-slate-700">Nama Klinik</th>
                        <th className="text-center py-2 px-4 font-semibold text-slate-700">Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedClinics.map((clinic) => (
                        <tr key={clinic.id} className="border-b hover:bg-slate-50">
                          <td className="py-2 px-4 font-medium text-slate-800">{clinic.id}</td>
                          <td className="py-2 px-4 text-slate-600">{clinic.name}</td>
                          <td className="py-2 px-4 text-center">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-blue-600 border-blue-200 hover:bg-blue-50"
                              onClick={() => handleDownloadFormat(clinic.id, clinic.name)}
                            >
                              <Download className="w-3 h-3 mr-1" />
                              Download Format
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <p className="text-xs text-slate-500 mt-2">
                Format yang didownload sudah berisi sample data 3 baris dan kolom dalam bahasa Indonesia
              </p>
            </div>

            {/* Tempat hasil upload: placeholder saat proses, isi setelah selesai */}
            <div ref={resultSectionRef} className="flex-1 min-h-[140px] flex flex-col">
              {uploading && !uploadResult && (
                <div className="bg-slate-100 border border-slate-200 rounded-lg p-6 flex flex-col items-center justify-center gap-2 text-slate-600">
                  <span className="animate-spin text-2xl">⏳</span>
                  <p className="text-sm font-medium">Memproses baris...</p>
                  <p className="text-xs">Hasil per baris (sukses/gagal) akan tampil di sini setelah selesai.</p>
                </div>
              )}
              {uploadResult && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3 flex-1 min-h-0 flex flex-col">
                <p className="font-semibold text-slate-800">Hasil Upload</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm flex-shrink-0">
                  <div className="bg-white rounded border border-slate-200 px-3 py-2">
                    <span className="text-slate-600 block text-xs">Total Baris</span>
                    <span className="font-semibold text-slate-800">{uploadResult.totalRows}</span>
                  </div>
                  <div className="bg-green-50 rounded border border-green-200 px-3 py-2">
                    <span className="text-green-700 block text-xs">Berhasil</span>
                    <span className="font-semibold text-green-800">{uploadResult.insertedCount}</span>
                  </div>
                  <div className="bg-blue-50 rounded border border-blue-200 px-3 py-2">
                    <span className="text-blue-700 block text-xs">Ke Zains</span>
                    <span className="font-semibold text-blue-800">{uploadResult.zainsInsertedCount ?? 0}</span>
                  </div>
                  <div className="bg-amber-50 rounded border border-amber-200 px-3 py-2">
                    <span className="text-amber-700 block text-xs">Gagal / Dilewati</span>
                    <span className="font-semibold text-amber-800">{uploadResult.skippedCount}</span>
                  </div>
                </div>
                {/* Tabel status per baris */}
                {uploadResult.results && uploadResult.results.length > 0 && (
                  <div className="flex flex-col min-h-0 flex-1">
                    <p className="text-sm font-medium text-slate-700 mb-2">Status per baris (baris Excel)</p>
                    <div className="border border-slate-200 rounded-lg overflow-hidden bg-white flex-1 min-h-0 flex flex-col">
                      <div className="overflow-auto flex-1 max-h-48 min-h-[120px]">
                        <table className="w-full text-sm border-collapse">
                          <thead className="bg-slate-100 sticky top-0">
                            <tr>
                              <th className="text-left py-2 px-3 font-semibold text-slate-700 w-24">Baris</th>
                              <th className="text-left py-2 px-3 font-semibold text-slate-700 w-28">Status</th>
                              <th className="text-left py-2 px-3 font-semibold text-slate-700">Keterangan</th>
                            </tr>
                          </thead>
                          <tbody>
                            {uploadResult.results.map((r: { row: number; status: string; message?: string }, idx: number) => (
                              <tr key={idx} className="border-t border-slate-100">
                                <td className="py-1.5 px-3 font-medium text-slate-800">{r.row}</td>
                                <td className="py-1.5 px-3">
                                  {r.status === 'success' && (
                                    <span className="inline-flex items-center gap-1 text-green-700">
                                      <CheckCircle2 className="w-4 h-4" /> Sukses
                                    </span>
                                  )}
                                  {r.status === 'skipped' && (
                                    <span className="inline-flex items-center gap-1 text-amber-700">
                                      <AlertCircle className="w-4 h-4" /> Dilewati
                                    </span>
                                  )}
                                  {r.status === 'error' && (
                                    <span className="inline-flex items-center gap-1 text-red-700">
                                      <XCircle className="w-4 h-4" /> Gagal
                                    </span>
                                  )}
                                </td>
                                <td className="py-1.5 px-3 text-slate-600">{r.message ?? '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              )}
            </div>

            {/* Action Buttons - Selalu Terlihat di Bawah */}
            <div className="flex justify-end gap-3 pt-4 border-t flex-shrink-0 mt-auto">
              <Button variant="outline" onClick={onClose} disabled={uploading}>
                Tutup
              </Button>
              <Button
                onClick={handleUpload}
                disabled={!file || uploading}
                className="bg-teal-600 hover:bg-teal-700"
              >
                {uploading ? (
                  <>
                    <span className="animate-spin mr-2">⏳</span>
                    Mengupload...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
