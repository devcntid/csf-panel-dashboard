'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Eye, ExternalLink, Download } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/db'
import { getTransactionById } from '@/lib/actions/transactions'
import { TransaksiDetail } from './transaksi-detail'
import { TransaksiZainsDetail } from './transaksi-zains-detail'
import { TransaksiSearch } from './transaksi-search'
import { TransaksiHeader } from './transaksi-header'
import { TransaksiUpload } from './transaksi-upload'

export function TransaksiClient({
  transactions,
  stats,
  search,
  page,
  total,
  clinics,
  polies,
  insuranceTypes,
}: {
  transactions: any[]
  stats: any
  search?: string
  page: number
  total: number
  clinics: any[]
  polies: any[]
  insuranceTypes: any[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [detailData, setDetailData] = useState<any>(null)
  const [selectedZainsId, setSelectedZainsId] = useState<number | null>(null)
  const [selectedZainsNo, setSelectedZainsNo] = useState<string>('')
  const [isPending, startTransition] = useTransition()
  const [showFilter, setShowFilter] = useState(false)
  const [showUpload, setShowUpload] = useState(false)

  const handlePageChange = (newPage: number) => {
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('page', newPage.toString())
      router.push(`/dashboard/transaksi?${params.toString()}`)
    })
  }

  const toggleFilter = () => {
    setShowFilter(!showFilter)
  }

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

  const handleViewZainsDetail = (id: number, trxNo?: string) => {
    setSelectedZainsId(id)
    setSelectedZainsNo(trxNo || '')
  }

  const handleCloseZainsDetail = () => {
    setSelectedZainsId(null)
    setSelectedZainsNo('')
  }

  const handleDownloadFormat = async (clinicId: number) => {
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
        : `format-upload-transaksi-${clinicId}.xlsx`
      a.download = filename
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error: any) {
      console.error('Error downloading format:', error)
    }
  }

  return (
    <>
      {/* Header */}
      <TransaksiHeader 
        onToggleFilter={toggleFilter} 
        showFilter={showFilter}
        onOpenUpload={() => setShowUpload(true)}
      />

      {/* Stats Cards - Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6 mt-6">
        <Card>
          <CardContent className="p-4">
            <p className="text-slate-500 text-sm">Total Transaksi</p>
            <p className="text-2xl font-bold text-slate-800 mt-1">{stats.totalTransactions.toLocaleString('id-ID')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-slate-500 text-sm">Sudah Sync</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{stats.syncedCount.toLocaleString('id-ID')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-slate-500 text-sm">Belum Sync</p>
            <p className="text-2xl font-bold text-amber-600 mt-1">{stats.pendingCount.toLocaleString('id-ID')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-slate-500 text-sm">Total Tagihan</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">{formatCurrency(stats.totalTagihan ?? 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-slate-500 text-sm">Total Jaminan</p>
            <p className="text-2xl font-bold text-indigo-600 mt-1">{formatCurrency(stats.totalJaminan ?? 0)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-slate-500 text-sm">Total Nilai</p>
            <p className="text-2xl font-bold text-teal-600 mt-1">{formatCurrency(stats.totalRevenue)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Card - Toggleable (default: hidden) */}
      {showFilter && (
        <div className="mb-6">
          <TransaksiSearch clinics={clinics} polies={polies} insuranceTypes={insuranceTypes} />
        </div>
      )}

      {/* Transactions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Daftar Transaksi</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="whitespace-nowrap relative" style={{ minWidth: '100%', tableLayout: 'fixed', width: '100%' }}>
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="sticky left-0 z-30 text-center py-3 px-4 text-xs font-semibold text-slate-600 bg-slate-50 border-r border-slate-200 shadow-[2px_0_4px_rgba(0,0,0,0.05)]" style={{ backgroundColor: '#f8fafc', isolation: 'isolate', width: '64px', minWidth: '64px', maxWidth: '64px' }}>
                    No
                  </th>
                  <th className="sticky z-30 text-left py-3 px-4 text-xs font-semibold text-slate-600 bg-slate-50 border-r border-slate-200 shadow-[2px_0_4px_rgba(0,0,0,0.05)]" style={{ backgroundColor: '#f8fafc', isolation: 'isolate', left: '64px', width: '150px', minWidth: '150px', maxWidth: '150px' }}>
                    No. Transaksi
                  </th>
                  <th className="sticky z-30 text-left py-3 px-4 text-xs font-semibold text-slate-600 bg-slate-50 border-r border-slate-200 shadow-[2px_0_4px_rgba(0,0,0,0.05)]" style={{ backgroundColor: '#f8fafc', isolation: 'isolate', left: '214px', width: '130px', minWidth: '130px', maxWidth: '130px' }}>
                    Tanggal
                  </th>
                  <th className="sticky z-30 text-left py-3 px-4 text-xs font-semibold text-slate-600 bg-slate-50 border-r border-slate-200 shadow-[2px_0_4px_rgba(0,0,0,0.05)]" style={{ backgroundColor: '#f8fafc', isolation: 'isolate', left: '344px', width: '110px', minWidth: '110px', maxWidth: '110px' }}>
                    No. RM
                  </th>
                  <th className="sticky z-30 text-left py-3 px-4 text-xs font-semibold text-slate-600 bg-slate-50 border-r border-slate-200 shadow-[2px_0_4px_rgba(0,0,0,0.05)]" style={{ backgroundColor: '#f8fafc', isolation: 'isolate', left: '454px', width: '220px', minWidth: '220px', maxWidth: '220px' }}>
                    Nama Pasien
                  </th>
                  <th className="sticky z-30 text-left py-3 px-4 text-xs font-semibold text-slate-600 bg-slate-50 border-r border-slate-200 shadow-[2px_0_4px_rgba(0,0,0,0.05)]" style={{ backgroundColor: '#f8fafc', willChange: 'transform', isolation: 'isolate', left: '674px', width: '240px', minWidth: '240px', maxWidth: '240px' }}>
                    Klinik
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 relative" style={{ width: '120px', minWidth: '120px', maxWidth: '120px' }}>
                    Poli
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-semibold text-slate-600 relative" style={{ width: '100px', minWidth: '100px', maxWidth: '100px' }}>
                    Metode
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-slate-600 relative" style={{ width: '130px', minWidth: '130px', maxWidth: '130px' }}>
                    Total Tagihan
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-semibold text-slate-600 relative" style={{ width: '140px', minWidth: '140px', maxWidth: '140px' }}>
                    Total Pembayaran
                  </th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-slate-600 relative" style={{ width: '100px', minWidth: '100px', maxWidth: '100px' }}>
                    Status
                  </th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-slate-600 relative" style={{ width: '100px', minWidth: '100px', maxWidth: '100px' }}>
                    Sync
                  </th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-slate-600 relative" style={{ width: '110px', minWidth: '110px', maxWidth: '110px' }}>
                    Input Type
                  </th>
                  <th className="text-center py-3 px-4 text-xs font-semibold text-slate-600 relative" style={{ width: '180px', minWidth: '180px', maxWidth: '180px' }}>
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((trx: any, index: number) => {
                  // Status langsung dari insurance_type, jika kosong tampilkan '-'
                  const status = trx.insurance_type || '-'
                  
                  const rowNumber = (page - 1) * 10 + index + 1
                  
                  return (
                    <tr
                      key={trx.id}
                      className="border-b border-slate-100 group hover:bg-slate-50 transition-colors"
                    >
                      <td className="sticky left-0 z-20 py-3 px-4 text-sm text-center text-slate-500 bg-white group-hover:bg-slate-50 border-r border-slate-200 shadow-[2px_0_4px_rgba(0,0,0,0.05)]" style={{ backgroundColor: 'white', isolation: 'isolate', width: '64px', minWidth: '64px', maxWidth: '64px' }}>
                        {rowNumber}
                      </td>
                      <td className="sticky z-20 py-3 px-4 text-sm font-medium text-teal-600 bg-white group-hover:bg-slate-50 border-r border-slate-200 shadow-[2px_0_4px_rgba(0,0,0,0.05)]" style={{ backgroundColor: 'white', isolation: 'isolate', left: '64px', width: '150px', minWidth: '150px', maxWidth: '150px' }}>
                        <div className="truncate">{trx.trx_no || `TRX-${trx.id}`}</div>
                      </td>
                      <td className="sticky z-20 py-3 px-4 text-sm text-slate-600 bg-white group-hover:bg-slate-50 border-r border-slate-200 shadow-[2px_0_4px_rgba(0,0,0,0.05)]" style={{ backgroundColor: 'white', isolation: 'isolate', left: '214px', width: '130px', minWidth: '130px', maxWidth: '130px' }}>
                        {formatDate(trx.trx_date)}
                      </td>
                      <td className="sticky z-20 py-3 px-4 text-sm text-slate-600 bg-white group-hover:bg-slate-50 border-r border-slate-200 shadow-[2px_0_4px_rgba(0,0,0,0.05)]" style={{ backgroundColor: 'white', isolation: 'isolate', left: '344px', width: '110px', minWidth: '110px', maxWidth: '110px' }}>
                        {trx.erm_no}
                      </td>
                      <td className="sticky z-20 py-3 px-4 text-sm font-medium text-slate-800 bg-white group-hover:bg-slate-50 border-r border-slate-200 shadow-[2px_0_4px_rgba(0,0,0,0.05)]" style={{ backgroundColor: 'white', isolation: 'isolate', left: '454px', width: '220px', minWidth: '220px', maxWidth: '220px' }}>
                        <div className="truncate">{trx.patient_name || '-'}</div>
                      </td>
                      <td className="sticky z-20 py-3 px-4 text-sm text-slate-600 bg-white group-hover:bg-slate-50 border-r border-slate-200 shadow-[2px_0_4px_rgba(0,0,0,0.05)]" style={{ backgroundColor: 'white', willChange: 'transform', isolation: 'isolate', left: '674px', width: '240px', minWidth: '240px', maxWidth: '240px' }}>
                        <div className="truncate">{trx.clinic_name || '-'}</div>
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600 whitespace-nowrap relative" style={{ width: '120px', minWidth: '120px', maxWidth: '120px' }}>
                        <span className="font-medium">{trx.master_poly_name || '-'}</span>
                        {trx.polyclinic && trx.polyclinic !== trx.master_poly_name && (
                          <span className="text-xs text-slate-400 ml-1">({trx.polyclinic})</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600 whitespace-nowrap relative" style={{ width: '100px', minWidth: '100px', maxWidth: '100px' }}>
                        {trx.payment_method || '-'}
                      </td>
                      <td className="py-3 px-4 text-sm text-right font-semibold text-slate-800 whitespace-nowrap relative" style={{ width: '130px', minWidth: '130px', maxWidth: '130px' }}>
                        {formatCurrency(trx.bill_total)}
                      </td>
                      <td className="py-3 px-4 text-sm text-right font-semibold text-teal-600 whitespace-nowrap relative" style={{ width: '140px', minWidth: '140px', maxWidth: '140px' }}>
                        {formatCurrency(trx.paid_total || 0)}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap relative" style={{ width: '100px', minWidth: '100px', maxWidth: '100px' }}>
                        <Badge
                          className={
                            status === 'BPJS' || status?.toUpperCase().includes('BPJS')
                              ? 'bg-blue-100 text-blue-700'
                              : status === 'Umum' || status === 'UMUM'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-slate-100 text-slate-700'
                          }
                        >
                          {status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap relative" style={{ width: '100px', minWidth: '100px', maxWidth: '100px' }}>
                        {trx.zains_synced ? (
                          <Badge className="bg-green-100 text-green-700">Synced</Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-700">Pending</Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap relative" style={{ width: '110px', minWidth: '110px', maxWidth: '110px' }}>
                        <Badge
                          className={
                            trx.input_type === 'upload'
                              ? 'bg-blue-100 text-blue-700'
                              : trx.input_type === 'scrap'
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-slate-100 text-slate-700'
                          }
                        >
                          {trx.input_type === 'upload' ? 'Upload' : trx.input_type === 'scrap' ? 'Scrap' : trx.input_type || '-'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-center whitespace-nowrap">
                        <div className="flex gap-2 justify-center">
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
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="text-blue-600 border-blue-200"
                            onClick={() => handleViewZainsDetail(trx.id, trx.trx_no)}
                            disabled={isPending}
                          >
                            <ExternalLink className="w-4 h-4 mr-1" />
                            To Zains
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {total > 0 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-slate-600">
                Menampilkan {(page - 1) * 10 + 1}-{Math.min(page * 10, total)} dari {total.toLocaleString('id-ID')} transaksi
              </p>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={page === 1 || isPending}
                  onClick={() => handlePageChange(1)}
                  className="h-8 px-3"
                >
                  First
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={page === 1 || isPending}
                  onClick={() => handlePageChange(page - 1)}
                >
                  Previous
                </Button>
                {(() => {
                  const totalPages = Math.ceil(total / 10)
                  const pages: number[] = []
                  
                  if (totalPages <= 5) {
                    // Show all pages if 5 or less
                    for (let i = 1; i <= totalPages; i++) {
                      pages.push(i)
                    }
                  } else {
                    // Show pages around current page
                    if (page <= 3) {
                      // Show first 5 pages
                      for (let i = 1; i <= 5; i++) {
                        pages.push(i)
                      }
                    } else if (page >= totalPages - 2) {
                      // Show last 5 pages
                      for (let i = totalPages - 4; i <= totalPages; i++) {
                        pages.push(i)
                      }
                    } else {
                      // Show 2 pages before, current, and 2 pages after
                      for (let i = page - 2; i <= page + 2; i++) {
                        pages.push(i)
                      }
                    }
                  }
                  
                  return pages.map((pageNum) => (
                    <Button
                      key={pageNum}
                      variant="outline"
                      size="sm"
                      disabled={isPending}
                      onClick={() => handlePageChange(pageNum)}
                      className={pageNum === page ? 'bg-teal-600 text-white hover:bg-teal-700' : ''}
                    >
                      {pageNum}
                    </Button>
                  ))
                })()}
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={page * 10 >= total || isPending}
                  onClick={() => handlePageChange(page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Modal */}
      {selectedId && detailData && (
        <TransaksiDetail data={detailData} onClose={handleCloseDetail} />
      )}

      {/* Zains Detail Modal */}
      {selectedZainsId && (
        <TransaksiZainsDetail 
          transactionId={selectedZainsId}
          transactionNo={selectedZainsNo}
          onClose={handleCloseZainsDetail} 
        />
      )}

      {/* Upload Modal */}
      {showUpload && (
        <TransaksiUpload
          clinics={clinics}
          onClose={() => setShowUpload(false)}
          onSuccess={() => {
            setShowUpload(false)
            window.location.reload()
          }}
        />
      )}
    </>
  )
}
