import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import * as XLSX from 'xlsx'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ clinicId: string }> }
) {
  try {
    const { clinicId } = await params
    const clinicIdNum = parseInt(clinicId)

    if (isNaN(clinicIdNum)) {
      return NextResponse.json(
        { error: 'ID Klinik tidak valid' },
        { status: 400 }
      )
    }

    // Get clinic info
    const [clinic] = await sql`
      SELECT id, name FROM clinics WHERE id = ${clinicIdNum}
    `

    if (!clinic) {
      return NextResponse.json(
        { error: 'Klinik tidak ditemukan' },
        { status: 404 }
      )
    }

    // Get sample raw_poly_name dan raw_insurance_name dari mapping klinik ini
    const polyMappings = await sql`
      SELECT DISTINCT raw_poly_name 
      FROM clinic_poly_mappings 
      WHERE clinic_id = ${clinicIdNum}
      LIMIT 3
    `

    const insuranceMappings = await sql`
      SELECT DISTINCT raw_insurance_name 
      FROM clinic_insurance_mappings 
      WHERE clinic_id = ${clinicIdNum}
      LIMIT 2
    `

    const samplePolies = Array.isArray(polyMappings) ? polyMappings.map((p: any) => p.raw_poly_name) : []
    const sampleInsurances = Array.isArray(insuranceMappings) ? insuranceMappings.map((i: any) => i.raw_insurance_name) : []

    // Prepare sample data (3 baris)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    const twoDaysAgo = new Date(today)
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)

    // Format tanggal seperti "31 January 2026"
    const formatDate = (date: Date) => {
      const months = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ]
      const day = date.getDate()
      const month = months[date.getMonth()]
      const year = date.getFullYear()
      return `${day} ${month} ${year}`
    }

    // Prepare Excel data dengan kolom bahasa Indonesia
    const excelData = [
      // Header (Bahasa Indonesia)
      [
        'ID Klinik',
        'Tanggal',
        'No. eRM',
        'Nama Pasien',
        'Ruangan / Poli',
        'Asuransi',
        'Metode Pembayaran',
        'Voucher',
        'Jumlah Tagihan ( Rp. ) - Karcis',
        'Jumlah Tagihan ( Rp. ) - Tindakan',
        'Jumlah Tagihan ( Rp. ) - Laboratorium',
        'Jumlah Tagihan ( Rp. ) - Obat',
        'Jumlah Tagihan ( Rp. ) - Alkes',
        'Jumlah Tagihan ( Rp. ) - MCU',
        'Jumlah Tagihan ( Rp. ) - Radiologi',
        'Jumlah Tagihan ( Rp. ) - Total',
        'Diskon Tagihan ( Rp. ) - Karcis',
        'Diskon Tagihan ( Rp. ) - Tindakan',
        'Diskon Tagihan ( Rp. ) - Laboratorium',
        'Diskon Tagihan ( Rp. ) - Obat',
        'Diskon Tagihan ( Rp. ) - Alkes',
        'Diskon Tagihan ( Rp. ) - MCU',
        'Diskon Tagihan ( Rp. ) - Radiologi',
        'Jumlah Jaminan ( Rp. ) - Karcis',
        'Jumlah Jaminan ( Rp. ) - Tindakan',
        'Jumlah Jaminan ( Rp. ) - Laboratorium',
        'Jumlah Jaminan ( Rp. ) - Obat',
        'Jumlah Jaminan ( Rp. ) - Alkes',
        'Jumlah Jaminan ( Rp. ) - MCU',
        'Jumlah Jaminan ( Rp. ) - Radiologi',
        'Jumlah Jaminan ( Rp. ) - Total',
        'Jumlah Pembayaran ( Rp. ) - Karcis',
        'Jumlah Pembayaran ( Rp. ) - Tindakan',
        'Jumlah Pembayaran ( Rp. ) - Laboratorium',
        'Jumlah Pembayaran ( Rp. ) - Obat',
        'Jumlah Pembayaran ( Rp. ) - Alkes',
        'Jumlah Pembayaran ( Rp. ) - MCU',
        'Jumlah Pembayaran ( Rp. ) - Radiologi',
        'Jumlah Pembayaran ( Rp. ) - Pembulatan',
        'Jumlah Pembayaran ( Rp. ) - Diskon',
        'Jumlah Pembayaran ( Rp. ) - PPN',
        'Jumlah Pembayaran ( Rp. ) - Voucher',
        'Jumlah Pembayaran ( Rp. ) - Total',
        'Jumlah Piutang ( Rp. ) - Karcis',
        'Jumlah Piutang ( Rp. ) - Tindakan',
        'Jumlah Piutang ( Rp. ) - Laboratorium',
        'Jumlah Piutang ( Rp. ) - Obat',
        'Jumlah Piutang ( Rp. ) - Alkes',
        'Jumlah Piutang ( Rp. ) - MCU',
        'Jumlah Piutang ( Rp. ) - Radiologi',
        'Jumlah Piutang ( Rp. ) - Total',
      ],
      // Sample data baris 1
      [
        clinicIdNum,
        formatDate(twoDaysAgo),
        'RM001',
        'Contoh Pasien 1',
        samplePolies[0] || 'Poli Umum',
        sampleInsurances[0] || 'BPJS',
        'TUNAI',
        '-',
        50000,
        200000,
        150000,
        100000,
        0,
        0,
        0,
        500000,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        50000,
        200000,
        150000,
        100000,
        0,
        0,
        0,
        0,
        0,
        0,
        500000,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
      ],
      // Sample data baris 2
      [
        clinicIdNum,
        formatDate(yesterday),
        'RM002',
        'Contoh Pasien 2',
        samplePolies[1] || samplePolies[0] || 'Poli Gigi',
        sampleInsurances[1] || sampleInsurances[0] || 'UMUM',
        'QRIS',
        '-',
        75000,
        300000,
        0,
        150000,
        50000,
        0,
        0,
        575000,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        50000,
        200000,
        0,
        100000,
        0,
        0,
        0,
        350000,
        25000,
        100000,
        0,
        50000,
        50000,
        0,
        0,
        0,
        0,
        0,
        225000,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
      ],
      // Sample data baris 3
      [
        clinicIdNum,
        formatDate(today),
        'RM003',
        'Contoh Pasien 3',
        samplePolies[2] || samplePolies[0] || 'Poli KIA',
        sampleInsurances[0] || 'BPJS',
        'TUNAI',
        '-',
        100000,
        500000,
        250000,
        200000,
        100000,
        0,
        0,
        1150000,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        100000,
        400000,
        200000,
        150000,
        50000,
        0,
        0,
        0,
        900000,
        0,
        100000,
        50000,
        50000,
        50000,
        0,
        0,
        0,
        0,
        250000,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
        0,
      ],
    ]

    // Create workbook
    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.aoa_to_sheet(excelData)

    // Set column widths
    worksheet['!cols'] = [
      { wch: 12 }, // ID Klinik
      { wch: 20 }, // Tanggal (format "31 January 2026" lebih panjang)
      { wch: 12 }, // No. eRM
      { wch: 20 }, // Nama Pasien
      { wch: 20 }, // Ruangan / Poli
      { wch: 15 }, // Asuransi
      { wch: 18 }, // Metode Pembayaran
      { wch: 12 }, // Voucher
      { wch: 15 }, // Bill Regist
      { wch: 15 }, // Bill Action
      { wch: 15 }, // Bill Lab
      { wch: 15 }, // Bill Drug
      { wch: 15 }, // Bill Alkes
      { wch: 15 }, // Bill MCU
      { wch: 15 }, // Bill Radio
      { wch: 15 }, // Bill Total
      { wch: 15 }, // Bill Regist Discount
      { wch: 15 }, // Bill Action Discount
      { wch: 15 }, // Bill Lab Discount
      { wch: 15 }, // Bill Drug Discount
      { wch: 15 }, // Bill Alkes Discount
      { wch: 15 }, // Bill MCU Discount
      { wch: 15 }, // Bill Radio Discount
      { wch: 15 }, // Covered Regist
      { wch: 15 }, // Covered Action
      { wch: 15 }, // Covered Lab
      { wch: 15 }, // Covered Drug
      { wch: 15 }, // Covered Alkes
      { wch: 15 }, // Covered MCU
      { wch: 15 }, // Covered Radio
      { wch: 15 }, // Covered Total
      { wch: 15 }, // Paid Regist
      { wch: 15 }, // Paid Action
      { wch: 15 }, // Paid Lab
      { wch: 15 }, // Paid Drug
      { wch: 15 }, // Paid Alkes
      { wch: 15 }, // Paid MCU
      { wch: 15 }, // Paid Radio
      { wch: 15 }, // Paid Rounding
      { wch: 15 }, // Paid Discount
      { wch: 15 }, // Paid Tax
      { wch: 15 }, // Paid Voucher
      { wch: 15 }, // Paid Total
      { wch: 15 }, // Receivable Regist
      { wch: 15 }, // Receivable Action
      { wch: 15 }, // Receivable Lab
      { wch: 15 }, // Receivable Drug
      { wch: 15 }, // Receivable Alkes
      { wch: 15 }, // Receivable MCU
      { wch: 15 }, // Receivable Radio
      { wch: 15 }, // Receivable Total
    ]

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Format Upload')

    // Generate Excel buffer
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

    const clinicName = (clinic as any).name.replace(/\s+/g, '-').toLowerCase()
    const filename = `format-upload-transaksi-${clinicName}-${new Date().toISOString().split('T')[0]}.xlsx`

    return new NextResponse(excelBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error: any) {
    console.error('Error generating template:', error)
    return NextResponse.json(
      { error: error.message || 'Gagal generate template' },
      { status: 500 }
    )
  }
}
