'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Filter, Loader2, Trash2 } from 'lucide-react'
import { Pagination } from '@/components/ui/pagination'
import { formatCurrency, formatDate } from '@/lib/db'
import { TransaksiZainsSearch } from './transaksi-zains-search'
import { toast } from 'sonner'
import {
  deleteTransaction,
  syncDonaturForTransaction,
  syncTransactionsToZainsFromModal,
} from '@/lib/actions/transactions'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

export function TransaksiZainsClient({
  rows,
  stats,
  search,
  page,
  total,
  perPage,
  clinics,
  role,
  clinicId,
}: {
  rows: any[]
  stats: {
    totalRecords: number
    syncedCount: number
    pendingCount: number
    totalNominal: number
  }
  search?: string
  page: number
  total: number
  perPage: number
  clinics: any[]
  role?: string
  clinicId?: number | null
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [showFilter, setShowFilter] = useState(false)
  const [syncTarget, setSyncTarget] = useState<{ transactionId: number; trxNo?: string } | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ transactionId: number; trxNo?: string } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const handlePageChange = (newPage: number) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('page', newPage.toString())
      router.push(`/dashboard/transaksi-zains?${params.toString()}`)
    })
  }

  const handleLimitChange = (limit: number) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('perPage', String(limit))
      params.set('page', '1')
      router.push(`/dashboard/transaksi-zains?${params.toString()}`)
    })
  }

  const readonlyClinicId = role === 'clinic_manager' ? clinicId ?? undefined : undefined

  const handleConfirmSync = async () => {
    if (!syncTarget) return
    setIsSyncing(true)
    toast.loading('Mengirim ke Zains...', { id: 'zains-sync' })
    try {
      const donorResult = await syncDonaturForTransaction(syncTarget.transactionId)
      if (!donorResult.success && !donorResult.skipped) {
        toast.error(donorResult.error || 'Gagal sync donatur ke Zains', { id: 'zains-sync' })
        setSyncTarget(null)
        setIsSyncing(false)
        return
      }
      const result = await syncTransactionsToZainsFromModal(syncTarget.transactionId)
      toast.dismiss('zains-sync')
      if (result.error) {
        toast.error(result.error)
        setSyncTarget(null)
        setIsSyncing(false)
        return
      }
      if (result.total === 0) {
        toast.info('Tidak ada data yang siap dikirim ke Zains. Cek ID Donatur / konfigurasi sync.')
      } else if (result.failedCount === 0) {
        toast.success(`${result.successCount} baris berhasil dikirim ke Zains`)
      } else {
        const firstError = result.results?.find((r) => !r.success)?.error
        const detail = firstError ? ` ${String(firstError).slice(0, 80)}${firstError.length > 80 ? '...' : ''}` : ''
        toast.error(`${result.successCount} berhasil, ${result.failedCount} gagal.${detail}`)
      }
      router.refresh()
    } catch (err) {
      toast.dismiss('zains-sync')
      toast.error(err instanceof Error ? err.message : 'Gagal mengirim ke Zains')
    } finally {
      setIsSyncing(false)
      setSyncTarget(null)
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    toast.loading('Menghapus transaksi...', { id: 'zains-delete' })
    try {
      const result = await deleteTransaction(deleteTarget.transactionId)
      toast.dismiss('zains-delete')
      if (!result.success) {
        toast.error(result.error || 'Gagal menghapus transaksi')
        return
      }
      toast.success('Transaksi berhasil dihapus')
      router.refresh()
    } catch (error) {
      toast.dismiss('zains-delete')
      toast.error(error instanceof Error ? error.message : 'Gagal menghapus transaksi')
    } finally {
      setIsDeleting(false)
      setDeleteTarget(null)
    }
  }

  return (
    <>
      <header className="bg-white border-b border-slate-200 -mx-6 -mt-6 px-6 py-4 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Transaksi ke Zains</h2>
            <p className="text-slate-500 text-sm">
              Daftar data transactions_to_zains (view only)
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className={`border-slate-300 bg-transparent ${showFilter ? 'bg-teal-50 border-teal-300' : ''}`}
              onClick={() => setShowFilter(!showFilter)}
            >
              <Filter className="w-4 h-4 mr-2" />
              Filter
            </Button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <p className="text-slate-500 text-sm">Total Record</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">
              {stats.totalRecords.toLocaleString('id-ID')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-slate-500 text-sm">Sudah Sync</p>
            <p className="text-2xl font-bold text-green-600 mt-1">
              {stats.syncedCount.toLocaleString('id-ID')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-slate-500 text-sm">Belum Sync</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">
              {stats.pendingCount.toLocaleString('id-ID')}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-slate-500 text-sm">Total Nominal</p>
            <p className="text-2xl font-bold text-teal-600 mt-1">
              {formatCurrency(stats.totalNominal ?? 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      {showFilter && (
        <div className="mb-6">
          <TransaksiZainsSearch
            clinics={clinics}
            readonlyClinicId={readonlyClinicId}
          />
        </div>
      )}

      <Card>
        <CardHeader className="border-b pb-4">
          <CardTitle>Daftar Transaksi ke Zains</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full whitespace-nowrap min-w-[900px]">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-slate-600 w-12">
                    No
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">
                    No. Transaksi
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">
                    ID Transaksi
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">
                    ID Program
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">
                    Program
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">
                    ID Kantor
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">
                    Klinik
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">
                    Metode
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">
                    Tanggal
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">
                    ID Donatur
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">
                    Nama Pasien
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">
                    No. RM
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-slate-600">
                    Nominal
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">
                    ID Rekening
                  </th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-slate-600">
                    Status
                  </th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-slate-600">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row: any, index: number) => {
                  const rowNo = (page - 1) * perPage + index + 1
                  return (
                    <tr
                      key={row.id}
                      className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                    >
                      <td className="py-3 px-4 text-sm text-center text-slate-500">
                        {rowNo}
                      </td>
                      <td className="py-3 px-4 text-sm font-medium text-teal-600">
                        {row.trx_no || '-'}
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600">
                        {row.id_transaksi || '-'}
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600">
                        {row.id_program || '-'}
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-700">
                        {row.program_name || '-'}
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600">
                        {row.id_kantor || '-'}
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600">
                        {row.clinic_name || '-'}
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600">
                        {row.payment_method || '-'}
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600">
                        {row.tgl_transaksi ? formatDate(row.tgl_transaksi) : '-'}
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600">
                        {row.id_donatur || '-'}
                      </td>
                      <td className="py-3 px-4 text-sm font-medium text-slate-800">
                        {row.nama_pasien || '-'}
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600">
                        {row.no_erm || '-'}
                      </td>
                      <td className="py-3 px-4 text-sm text-right font-semibold text-slate-800">
                        {formatCurrency(row.nominal_transaksi ?? 0)}
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600">
                        {row.id_rekening || '-'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {row.synced ? (
                          <Badge className="bg-green-100 text-green-700">Synced</Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-700">Pending</Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-blue-600 border-blue-200"
                            onClick={() =>
                              setSyncTarget({
                                transactionId: row.transaction_id,
                                trxNo: row.trx_no,
                              })
                            }
                            disabled={isPending || isSyncing || isDeleting}
                          >
                            {isSyncing && syncTarget?.transactionId === row.transaction_id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              'Sync ke Zains'
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-600 border-red-200 hover:bg-red-50"
                            onClick={() =>
                              setDeleteTarget({
                                transactionId: row.transaction_id,
                                trxNo: row.trx_no,
                              })
                            }
                            disabled={isPending || isSyncing || isDeleting}
                          >
                            {isDeleting && deleteTarget?.transactionId === row.transaction_id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <Trash2 className="w-4 h-4 mr-1" />
                                Delete
                              </>
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {total > 0 && (
            <Pagination
              page={page}
              limit={perPage}
              total={total}
              onPageChange={handlePageChange}
              onLimitChange={handleLimitChange}
              currentPageCount={rows.length}
            />
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={!!syncTarget}
        onOpenChange={(open) => {
          if (!open && !isSyncing) setSyncTarget(null)
        }}
      >
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Sync transaksi ke Zains?</AlertDialogTitle>
            <AlertDialogDescription>
              Transaksi{' '}
              <strong>
                {syncTarget?.trxNo || (syncTarget ? `TRX-${syncTarget.transactionId}` : '-')}
              </strong>{' '}
              akan dikirim ke Zains. Pastikan data sudah benar sebelum melanjutkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSyncing}>Batal</AlertDialogCancel>
            <Button
              onClick={handleConfirmSync}
              disabled={isSyncing}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSyncing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Mengirim...
                </>
              ) : (
                'Ya, Sync'
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus transaksi ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Transaksi{' '}
              <strong>
                {deleteTarget?.trxNo || (deleteTarget ? `TRX-${deleteTarget.transactionId}` : '-')}
              </strong>{' '}
              akan dihapus permanen beserta data terkait di Zains queue. Tindakan ini tidak bisa dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Batal</AlertDialogCancel>
            <Button
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Menghapus...
                </>
              ) : (
                'Ya, Hapus'
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
