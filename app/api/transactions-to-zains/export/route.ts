import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getTransactionsToZainsList } from '@/lib/actions/transactions'

function formatDateToReadable(date: Date): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ]
  const day = date.getDate()
  const month = months[date.getMonth()]
  const year = date.getFullYear()
  return `${day} ${month} ${year}`
}

const EXPORT_LIMIT = 50000

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const role = (session.user as any)?.role || 'super_admin'
    const sessionClinicId = (session.user as any)?.clinic_id as number | null | undefined
    const isClinicManager = role === 'clinic_manager'
    const clinicId = isClinicManager ? sessionClinicId ?? undefined : undefined

    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search') || ''
    const requestedClinicId = searchParams.get('clinic') ? parseInt(searchParams.get('clinic')!) : undefined
    const dateFrom = searchParams.get('dateFrom') || ''
    const dateTo = searchParams.get('dateTo') || ''
    const zainsSync = searchParams.get('zainsSync') || 'all'
    const zainsSynced =
      zainsSync === 'synced' || zainsSync === 'pending' ? (zainsSync as 'synced' | 'pending') : 'all'
    const method = searchParams.get('method') || 'all'

    const effectiveClinicId = isClinicManager ? clinicId : requestedClinicId

    const { rows } = await getTransactionsToZainsList(
      search || undefined,
      effectiveClinicId ?? undefined,
      dateFrom || undefined,
      dateTo || undefined,
      1,
      EXPORT_LIMIT,
      zainsSynced,
      method
    )

    const excelData = [
      [
        'No',
        'No. Transaksi',
        'ID Transaksi',
        'ID Program',
        'Program',
        'ID Kantor',
        'Klinik',
        'Metode',
        'Tanggal Transaksi',
        'ID Donatur',
        'Nama Pasien',
        'No. RM',
        'Nominal Transaksi',
        'ID Rekening',
        'Status Sync',
      ],
      ...(Array.isArray(rows) ? rows : []).map((row: any, index: number) => {
        let formattedDate = ''
        if (row.tgl_transaksi) {
          try {
            const date = new Date(row.tgl_transaksi)
            if (!isNaN(date.getTime())) formattedDate = formatDateToReadable(date)
            else formattedDate = String(row.tgl_transaksi)
          } catch {
            formattedDate = String(row.tgl_transaksi)
          }
        }
        return [
          index + 1,
          row.trx_no || '-',
          row.id_transaksi || '-',
          row.id_program || '-',
          row.program_name || '-',
          row.id_kantor || '-',
          row.clinic_name || '-',
          row.payment_method || '-',
          formattedDate,
          row.id_donatur || '-',
          row.nama_pasien || '-',
          row.no_erm || '-',
          row.nominal_transaksi ?? 0,
          row.id_rekening || '-',
          row.synced ? 'Synced' : 'Pending',
        ]
      }),
    ]

    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.aoa_to_sheet(excelData)
    worksheet['!cols'] = [
      { wch: 6 },
      { wch: 18 },
      { wch: 24 },
      { wch: 14 },
      { wch: 22 },
      { wch: 14 },
      { wch: 22 },
      { wch: 12 },
      { wch: 18 },
      { wch: 20 },
      { wch: 22 },
      { wch: 12 },
      { wch: 16 },
      { wch: 14 },
      { wch: 10 },
    ]
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Transaksi ke Zains')

    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
    const today = new Date().toISOString().split('T')[0]
    let filename = `transaksi-ke-zains-export-${today}.xlsx`
    if (dateFrom && dateTo) filename = `transaksi-ke-zains-export-${dateFrom}-${dateTo}.xlsx`

    return new NextResponse(excelBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error: any) {
    console.error('Error exporting transactions to zains:', error)
    return NextResponse.json(
      { error: error?.message || 'Gagal export Excel' },
      { status: 500 }
    )
  }
}
