'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { X } from 'lucide-react'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/db'

export function TransaksiDetail({ data, onClose }: { data: any; onClose: () => void }) {
  if (!data) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between border-b">
          <CardTitle>Detail Transaksi</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {/* Informasi Umum */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Informasi Transaksi</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-slate-500">No. Transaksi</p>
                <p className="font-medium">{data.trx_no || `TRX-${data.id}`}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Tanggal & Waktu</p>
                <p className="font-medium">
                  {formatDate(data.trx_date)} {data.trx_time || ''}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Klinik</p>
                <p className="font-medium">{data.clinic_name || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Poliklinik</p>
                <p className="font-medium">{data.polyclinic || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Input Type</p>
                <p className="font-medium">
                  <Badge
                    className={
                      data.input_type === 'upload'
                        ? 'bg-blue-100 text-blue-700'
                        : data.input_type === 'scrap'
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-slate-100 text-slate-700'
                    }
                  >
                    {data.input_type === 'upload' ? 'Upload' : data.input_type === 'scrap' ? 'Scrap' : data.input_type || '-'}
                  </Badge>
                </p>
              </div>
            </div>
          </div>

          {/* Informasi Pasien */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Informasi Pasien</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-slate-500">No. RM</p>
                <p className="font-medium">{data.erm_no || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Nama Pasien</p>
                <p className="font-medium">{data.patient_name || data.patient_full_name || '-'}</p>
              </div>
              {data.first_visit_at && (
                <div>
                  <p className="text-sm text-slate-500">First Visit</p>
                  <p className="font-medium">{formatDate(data.first_visit_at)}</p>
                </div>
              )}
              {data.visit_count && (
                <div>
                  <p className="text-sm text-slate-500">Total Kunjungan</p>
                  <p className="font-medium">{data.visit_count}</p>
                </div>
              )}
              <div>
                <p className="text-sm text-slate-500">Jenis Asuransi</p>
                <p className="font-medium">{data.insurance_type || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500">Metode Pembayaran</p>
                <p className="font-medium">{data.payment_method || '-'}</p>
              </div>
            </div>
          </div>

          {/* Rincian Tagihan */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Rincian Tagihan</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-600">Registrasi</span>
                <span className="font-medium">{formatCurrency(data.bill_regist)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Tindakan</span>
                <span className="font-medium">{formatCurrency(data.bill_action)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Laboratorium</span>
                <span className="font-medium">{formatCurrency(data.bill_lab)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Obat</span>
                <span className="font-medium">{formatCurrency(data.bill_drug)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Alkes</span>
                <span className="font-medium">{formatCurrency(data.bill_alkes)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">MCU</span>
                <span className="font-medium">{formatCurrency(data.bill_mcu)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Radiologi</span>
                <span className="font-medium">{formatCurrency(data.bill_radio)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t font-semibold text-lg">
                <span>Total Tagihan</span>
                <span>{formatCurrency(data.bill_total)}</span>
              </div>
            </div>
          </div>

          {/* Jaminan/BPJS */}
          {(data.covered_total > 0) && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Jaminan / BPJS</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-600">Registrasi</span>
                  <span className="font-medium">{formatCurrency(data.covered_regist)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Tindakan</span>
                  <span className="font-medium">{formatCurrency(data.covered_action)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Laboratorium</span>
                  <span className="font-medium">{formatCurrency(data.covered_lab)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Obat</span>
                  <span className="font-medium">{formatCurrency(data.covered_drug)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Alkes</span>
                  <span className="font-medium">{formatCurrency(data.covered_alkes)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">MCU</span>
                  <span className="font-medium">{formatCurrency(data.covered_mcu)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Radiologi</span>
                  <span className="font-medium">{formatCurrency(data.covered_radio)}</span>
                </div>
                <div className="flex justify-between pt-2 border-t font-semibold">
                  <span>Total Jaminan</span>
                  <span>{formatCurrency(data.covered_total)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Pembayaran */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Pembayaran</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-600">Registrasi</span>
                <span className="font-medium">{formatCurrency(data.paid_regist)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Tindakan</span>
                <span className="font-medium">{formatCurrency(data.paid_action)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Laboratorium</span>
                <span className="font-medium">{formatCurrency(data.paid_lab)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Obat</span>
                <span className="font-medium">{formatCurrency(data.paid_drug)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Alkes</span>
                <span className="font-medium">{formatCurrency(data.paid_alkes)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">MCU</span>
                <span className="font-medium">{formatCurrency(data.paid_mcu)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Radiologi</span>
                <span className="font-medium">{formatCurrency(data.paid_radio)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Pembulatan</span>
                <span className="font-medium">{formatCurrency(data.paid_rounding || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Diskon</span>
                <span className="font-medium text-red-600">-{formatCurrency(data.paid_discount || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Pajak</span>
                <span className="font-medium">{formatCurrency(data.paid_tax || 0)}</span>
              </div>
              {data.paid_voucher_amt > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-600">Voucher ({data.voucher_code || '-'})</span>
                  <span className="font-medium text-red-600">-{formatCurrency(data.paid_voucher_amt)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t font-semibold text-lg">
                <span>Total Pembayaran</span>
                <span>{formatCurrency(data.paid_total)}</span>
              </div>
            </div>
          </div>

          {/* Piutang */}
          {(data.receivable_total > 0) && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Piutang</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-600">Total Piutang</span>
                  <span className="font-medium text-amber-600">{formatCurrency(data.receivable_total)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Status Sync */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Status Sinkronisasi</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                {data.zains_synced ? (
                  <>
                    <Badge className="bg-green-100 text-green-700">Sudah Sync</Badge>
                    {data.zains_sync_at && (
                      <span className="text-sm text-slate-500">
                        pada {formatDateTime(data.zains_sync_at)}
                      </span>
                    )}
                  </>
                ) : (
                  <Badge className="bg-amber-100 text-amber-700">Belum Sync</Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-500">Sumber Data:</span>
                <Badge
                  className={
                    data.input_type === 'upload'
                      ? 'bg-blue-100 text-blue-700'
                      : data.input_type === 'scrap'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-slate-100 text-slate-700'
                  }
                >
                  {data.input_type === 'upload' ? 'Upload Excel' : data.input_type === 'scrap' ? 'Scraping' : data.input_type || '-'}
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
