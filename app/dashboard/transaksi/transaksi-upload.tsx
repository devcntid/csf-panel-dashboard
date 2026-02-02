'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { X, Upload, FileSpreadsheet, Download } from 'lucide-react'
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
    toast.loading('Mengupload file...', { id: 'upload' })

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
      toast.success(
        `Upload berhasil! ${data.insertedCount} transaksi ditambahkan, ${data.zainsInsertedCount || 0} records ke Zains, ${data.skippedCount} baris dilewati`,
        { id: 'upload' }
      )

      // Refresh page setelah 2 detik jika ada transaksi yang berhasil di-insert
      if (data.insertedCount > 0 && onSuccess) {
        setTimeout(() => {
          onSuccess()
        }, 2000)
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

            {/* Upload Result */}
            {uploadResult && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2 flex-shrink-0">
                <p className="font-semibold text-slate-800">Hasil Upload:</p>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-slate-600">Total Baris:</span>
                    <span className="ml-2 font-semibold">{uploadResult.totalRows}</span>
                  </div>
                  <div>
                    <span className="text-green-600">Transaksi:</span>
                    <span className="ml-2 font-semibold text-green-700">{uploadResult.insertedCount}</span>
                  </div>
                  <div>
                    <span className="text-blue-600">Ke Zains:</span>
                    <span className="ml-2 font-semibold text-blue-700">{uploadResult.zainsInsertedCount || 0}</span>
                  </div>
                  <div>
                    <span className="text-amber-600">Dilewati:</span>
                    <span className="ml-2 font-semibold text-amber-700">{uploadResult.skippedCount}</span>
                  </div>
                </div>
                {uploadResult.errors && uploadResult.errors.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm font-semibold text-red-600 mb-1">Error:</p>
                    <div className="max-h-32 overflow-y-auto text-xs text-red-700 space-y-1">
                      {uploadResult.errors.map((error: string, idx: number) => (
                        <div key={idx}>{error}</div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

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
