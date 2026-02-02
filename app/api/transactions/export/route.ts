import { NextRequest, NextResponse } from 'next/server'
import postgres from 'postgres'
import * as XLSX from 'xlsx'
import * as dotenv from 'dotenv'

// Load environment variables
dotenv.config({ path: '.env.local' })

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL

// Helper function untuk format tanggal ke "DD Month YYYY"
function formatDateToReadable(date: Date): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]
  const day = date.getDate()
  const month = months[date.getMonth()]
  const year = date.getFullYear()
  return `${day} ${month} ${year}`
}

// Helper function untuk format currency
function formatCurrency(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(value)
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const search = searchParams.get('search') || ''
    const clinicId = searchParams.get('clinic') ? parseInt(searchParams.get('clinic')!) : undefined
    const dateFrom = searchParams.get('dateFrom') || ''
    const dateTo = searchParams.get('dateTo') || ''
    const polyId = searchParams.get('poly') ? parseInt(searchParams.get('poly')!) : undefined
    const insuranceTypeId = searchParams.get('insurance') ? parseInt(searchParams.get('insurance')!) : undefined

    // Normalize dates - hanya gunakan jika bukan empty string
    const validDateFrom = dateFrom && dateFrom.trim() !== '' ? dateFrom : undefined
    const validDateTo = dateTo && dateTo.trim() !== '' ? dateTo : undefined

    // Build query dengan kondisi dinamis - gunakan pendekatan yang lebih sederhana
    let transactions
    const searchPattern = search ? `%${search}%` : undefined

    // Build WHERE conditions secara dinamis
    const whereConditions: string[] = []
    const queryParams: any[] = []
    let paramIndex = 1

    if (search) {
      whereConditions.push(`(t.trx_no ILIKE $${paramIndex} OR t.patient_name ILIKE $${paramIndex} OR t.erm_no ILIKE $${paramIndex})`)
      queryParams.push(searchPattern)
      paramIndex++
    }

    if (clinicId) {
      whereConditions.push(`t.clinic_id = $${paramIndex}`)
      queryParams.push(clinicId)
      paramIndex++
    }

    if (validDateFrom && validDateTo) {
      whereConditions.push(`DATE(t.trx_date) >= DATE($${paramIndex}) AND DATE(t.trx_date) <= DATE($${paramIndex + 1})`)
      queryParams.push(validDateFrom, validDateTo)
      paramIndex += 2
    } else if (validDateFrom) {
      whereConditions.push(`DATE(t.trx_date) >= DATE($${paramIndex})`)
      queryParams.push(validDateFrom)
      paramIndex++
    } else if (validDateTo) {
      whereConditions.push(`DATE(t.trx_date) <= DATE($${paramIndex})`)
      queryParams.push(validDateTo)
      paramIndex++
    }

    if (polyId) {
      whereConditions.push(`t.poly_id = $${paramIndex}`)
      queryParams.push(polyId)
      paramIndex++
    }

    if (insuranceTypeId) {
      whereConditions.push(`t.insurance_type_id = $${paramIndex}`)
      queryParams.push(insuranceTypeId)
      paramIndex++
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}` 
      : 'WHERE 1=1'

    // Build final query menggunakan postgres client untuk query dinamis
    if (!databaseUrl) {
      throw new Error('DATABASE_URL tidak ditemukan')
    }

    const pgSql = postgres(databaseUrl)
    
    try {
      const query = `
        SELECT 
          t.*,
          c.name as clinic_name,
          mp.name as master_poly_name,
          mit.name as master_insurance_name
        FROM transactions t
        JOIN clinics c ON c.id = t.clinic_id
        LEFT JOIN master_polies mp ON mp.id = t.poly_id
        LEFT JOIN master_insurance_types mit ON mit.id = t.insurance_type_id
        ${whereClause}
        ORDER BY t.trx_date DESC, t.trx_time DESC
      `

      transactions = await pgSql.unsafe(query, queryParams)
    } finally {
      await pgSql.end()
    }

    // Prepare Excel data
    const excelData = [
      // Header
      [
        'No',
        'No. Transaksi',
        'Tanggal',
        'No. RM',
        'Nama Pasien',
        'Klinik',
        'Poli',
        'Metode Pembayaran',
        'Asuransi',
        'Total Tagihan',
        'Total Pembayaran',
        'Total Piutang',
        'Status',
        'Sync',
        'Input Type',
      ],
      // Data rows
      ...(Array.isArray(transactions) ? transactions : []).map((trx: any, index: number) => {
        // Format tanggal untuk Excel
        let formattedDate = ''
        if (trx.trx_date) {
          try {
            const date = new Date(trx.trx_date)
            if (!isNaN(date.getTime())) {
              formattedDate = formatDateToReadable(date)
            }
          } catch (e) {
            formattedDate = String(trx.trx_date)
          }
        }
        
        return [
          index + 1,
          trx.trx_no || `TRX-${trx.id}`,
          formattedDate,
          trx.erm_no || '',
          trx.patient_name || '',
          trx.clinic_name || '',
          trx.master_poly_name || trx.polyclinic || '',
          trx.payment_method || '',
          trx.insurance_type || '',
          trx.bill_total || 0,
          trx.paid_total || 0,
          trx.receivable_total || 0,
          trx.insurance_type || '-',
          trx.zains_synced ? 'Synced' : 'Pending',
          trx.input_type === 'upload' ? 'Upload' : trx.input_type === 'scrap' ? 'Scrap' : trx.input_type || '-',
        ]
      }),
    ]

    // Create workbook
    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.aoa_to_sheet(excelData)

    // Set column widths
    worksheet['!cols'] = [
      { wch: 6 },  // No
      { wch: 18 }, // No. Transaksi
      { wch: 20 }, // Tanggal
      { wch: 12 }, // No. RM
      { wch: 25 }, // Nama Pasien
      { wch: 25 }, // Klinik
      { wch: 20 }, // Poli
      { wch: 18 }, // Metode Pembayaran
      { wch: 15 }, // Asuransi
      { wch: 15 }, // Total Tagihan
      { wch: 15 }, // Total Pembayaran
      { wch: 15 }, // Total Piutang
      { wch: 12 }, // Status
      { wch: 12 }, // Sync
      { wch: 12 }, // Input Type
    ]

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Transaksi')

    // Generate Excel buffer
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

    // Generate filename dengan range tanggal
    const today = new Date().toISOString().split('T')[0]
    let filename = `transaksi-export-${today}.xlsx`
    if (dateFrom && dateTo) {
      filename = `transaksi-export-${dateFrom}-${dateTo}.xlsx`
    } else if (dateFrom) {
      filename = `transaksi-export-${dateFrom}-.xlsx`
    } else if (dateTo) {
      filename = `transaksi-export-_-${dateTo}.xlsx`
    }

    return new NextResponse(excelBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error: any) {
    console.error('Error exporting transactions:', error)
    return NextResponse.json(
      { error: error.message || 'Gagal export Excel' },
      { status: 500 }
    )
  }
}
