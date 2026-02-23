'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { X, Loader2 } from 'lucide-react'
import { formatDate, formatCurrency } from '@/lib/db'
import { getTransactionsToZains, syncTransactionsToZainsFromModal } from '@/lib/actions/transactions'
import { toast } from 'sonner'

export function TransaksiZainsDetail({ 
  transactionId, 
  transactionNo,
  onClose 
}: { 
  transactionId: number
  transactionNo?: string
  onClose: () => void 
}) {
  const [zainsData, setZainsData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)

  useEffect(() => {
    loadData()
  }, [transactionId])

  const handleSyncToZains = async () => {
    setIsSyncing(true)
    toast.loading('Mengirim ke Zains...', { id: 'zains-sync' })
    try {
      const result = await syncTransactionsToZainsFromModal(transactionId)
      toast.dismiss('zains-sync')
      if (result.error) {
        toast.error(result.error)
        return
      }
      if (result.total === 0) {
        toast.info('Semua baris sudah terkirim ke Zains')
      } else if (result.failedCount === 0) {
        toast.success(`${result.successCount} baris berhasil dikirim ke Zains`)
      } else {
        const firstError = result.results?.find((r) => !r.success)?.error
        const detail = firstError ? ` ${String(firstError).slice(0, 80)}${firstError.length > 80 ? '...' : ''}` : ''
        toast.error(`${result.successCount} berhasil, ${result.failedCount} gagal.${detail}`)
      }
      await loadData()
    } catch (err) {
      toast.dismiss('zains-sync')
      toast.error(err instanceof Error ? err.message : 'Gagal mengirim ke Zains')
    } finally {
      setIsSyncing(false)
    }
  }

  const loadData = async () => {
    setLoading(true)
    try {
      const data = await getTransactionsToZains(transactionId)
      setZainsData(data)
    } catch (error) {
      console.error('Error loading zains data:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-6xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between border-b">
          <CardTitle>Detail Transaksi ke Zains - {transactionNo || `TRX-${transactionId}`}</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {/* Summary */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600">
              Total: <span className="font-semibold">{zainsData.length}</span> record(s)
            </p>
            <p className="text-sm text-slate-600">
              Total Nominal: <span className="font-semibold text-teal-600">
                {formatCurrency(zainsData.reduce((sum, item) => sum + (item.nominal_transaksi || 0), 0))}
              </span>
            </p>
          </div>

          {/* Table */}
          {loading ? (
            <div className="text-center py-8 text-slate-500">Loading...</div>
          ) : zainsData.length === 0 ? (
            <div className="text-center py-8 text-slate-500">Tidak ada data</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-slate-600 w-16">No</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">ID Transaksi</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">ID Program</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">Nama Program</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">ID Kantor</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">Nama Klinik</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">Tanggal Transaksi</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">ID Donatur</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">Nama Pasien</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">No. RM</th>
                    <th className="text-right py-3 px-4 text-xs font-semibold text-slate-600">Nominal Transaksi</th>
                    <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">ID Rekening</th>
                    <th className="text-center py-3 px-4 text-xs font-semibold text-slate-600">Status Sync</th>
                  </tr>
                </thead>
                <tbody>
                  {zainsData.map((item: any, index: number) => (
                    <tr
                      key={item.id}
                      className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                    >
                      <td className="py-3 px-4 text-sm text-center text-slate-500">{index + 1}</td>
                      <td className="py-3 px-4 text-sm text-slate-600">{item.id_transaksi || '-'}</td>
                      <td className="py-3 px-4 text-sm text-slate-600">{item.id_program || '-'}</td>
                      <td className="py-3 px-4 text-sm font-medium text-slate-700">{item.program_name || '-'}</td>
                      <td className="py-3 px-4 text-sm text-slate-600">{item.id_kantor || '-'}</td>
                      <td className="py-3 px-4 text-sm font-medium text-slate-700">{item.clinic_name || '-'}</td>
                      <td className="py-3 px-4 text-sm text-slate-600">
                        {item.tgl_transaksi ? formatDate(item.tgl_transaksi) : '-'}
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600">{item.id_donatur || '-'}</td>
                      <td className="py-3 px-4 text-sm font-medium text-slate-800">{item.nama_pasien || '-'}</td>
                      <td className="py-3 px-4 text-sm text-slate-600">{item.no_erm || '-'}</td>
                      <td className="py-3 px-4 text-sm text-right font-semibold text-slate-800">
                        {item.nominal_transaksi ? formatCurrency(item.nominal_transaksi) : '-'}
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600">
                        {item.id_rekening || '-'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {item.synced ? (
                          <Badge className="bg-green-100 text-green-700">Synced</Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-700">Pending</Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-slate-300 bg-slate-50">
                  <tr>
                    <td colSpan={10} className="py-3 px-4 text-sm font-semibold text-slate-700 text-right">
                      Grand Total:
                    </td>
                    <td className="py-3 px-4 text-sm text-right font-bold text-teal-600">
                      {formatCurrency(zainsData.reduce((sum, item) => sum + (item.nominal_transaksi || 0), 0))}
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Tombol Sync ke Zains */}
          {!loading && zainsData.length > 0 && (
            <div className="flex justify-end gap-2 pt-2">
              <Button
                onClick={handleSyncToZains}
                disabled={isSyncing}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isSyncing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Mengirim...
                  </>
                ) : (
                  'Sync ke Zains'
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
