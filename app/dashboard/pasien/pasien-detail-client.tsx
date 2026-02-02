'use client'

import { useState, useTransition, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Eye } from 'lucide-react'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/db'
import { getTransactionById } from '@/lib/actions/transactions'
import { TransaksiDetail } from '../transaksi/transaksi-detail'
import { Pagination } from '@/components/ui/pagination'
import { useRouter, useSearchParams } from 'next/navigation'

export function PasienDetailClient({
  transactions,
  total,
  page,
  limit: initialLimit,
  patientId,
}: {
  transactions: any[]
  total: number
  page: number
  limit: number
  patientId: number
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detailData, setDetailData] = useState<any>(null)
  const [isPending, startTransition] = useTransition()
  
  // Sync limit dengan URL params
  const urlLimit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : initialLimit
  const [limit, setLimit] = useState(urlLimit)

  useEffect(() => {
    const urlLimit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : initialLimit
    setLimit(urlLimit)
  }, [searchParams, initialLimit])

  const handleViewDetail = async (id: number) => {
    setSelectedId(id)
    startTransition(async () => {
      const data = await getTransactionById(id)
      setDetailData(data)
    })
  }

  const handleCloseDetail = () => {
    setSelectedId(null)
    setDetailData(null)
  }

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('page', newPage.toString())
    router.push(`/dashboard/pasien/${patientId}?${params.toString()}`)
  }

  const handleLimitChange = (newLimit: number) => {
    setLimit(newLimit)
    const params = new URLSearchParams(searchParams.toString())
    params.set('limit', newLimit.toString())
    params.set('page', '1')
    router.push(`/dashboard/pasien/${patientId}?${params.toString()}`)
  }

  return (
    <>
      {/* Transactions Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="text-center py-3 px-4 text-xs font-semibold text-slate-600 w-16">No</th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">
                No. Transaksi
              </th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">
                Tanggal & Waktu
              </th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">
                Klinik
              </th>
              <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600">
                Poli
              </th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-slate-600">
                Total Tagihan
              </th>
              <th className="text-right py-3 px-4 text-xs font-semibold text-slate-600">
                Total Bayar
              </th>
              <th className="text-center py-3 px-4 text-xs font-semibold text-slate-600">
                Status
              </th>
              <th className="text-center py-3 px-4 text-xs font-semibold text-slate-600">
                Sync
              </th>
              <th className="text-center py-3 px-4 text-xs font-semibold text-slate-600">
                Aksi
              </th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={10} className="text-center py-8 text-slate-500">
                  Tidak ada transaksi
                </td>
              </tr>
            ) : (
              transactions.map((trx: any, index: number) => {
                const status = trx.paid_total > 0 && trx.covered_total === 0 
                  ? 'Lunas' 
                  : trx.covered_total > 0 
                    ? (trx.insurance_type?.includes('BPJS') ? 'BPJS' : 'Asuransi')
                    : 'Pending'
                
                const rowNumber = (page - 1) * limit + index + 1
                
                return (
                  <tr
                    key={trx.id}
                    className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                  >
                    <td className="py-3 px-4 text-sm text-center text-slate-500">{rowNumber}</td>
                    <td className="py-3 px-4 text-sm font-medium text-teal-600">
                      {trx.trx_no || `TRX-${trx.id}`}
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-600">
                      <div>{formatDate(trx.trx_date)}</div>
                      {trx.trx_time && (
                        <div className="text-xs text-slate-400">{trx.trx_time}</div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-sm text-slate-600">{trx.clinic_name || '-'}</td>
                    <td className="py-3 px-4 text-sm text-slate-600">{trx.polyclinic || '-'}</td>
                    <td className="py-3 px-4 text-sm text-right font-semibold text-slate-800">
                      {formatCurrency(trx.bill_total)}
                    </td>
                    <td className="py-3 px-4 text-sm text-right font-semibold text-slate-800">
                      {formatCurrency(trx.paid_total)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Badge
                        className={
                          status === 'Lunas'
                            ? 'bg-green-100 text-green-700'
                            : status === 'BPJS'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-purple-100 text-purple-700'
                        }
                      >
                        {status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-center">
                      {trx.zains_synced ? (
                        <Badge className="bg-green-100 text-green-700">Synced</Badge>
                      ) : (
                        <Badge className="bg-amber-100 text-amber-700">Pending</Badge>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        className="text-teal-600"
                        onClick={() => handleViewDetail(trx.id)}
                        disabled={isPending}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        Detail
                      </Button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > 0 && (
        <Pagination
          page={page}
          limit={limit}
          total={total}
          onPageChange={handlePageChange}
          onLimitChange={handleLimitChange}
        />
      )}

      {/* Detail Modal */}
      {selectedId && detailData && (
        <TransaksiDetail data={detailData} onClose={handleCloseDetail} />
      )}
    </>
  )
}
