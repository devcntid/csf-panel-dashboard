import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import * as XLSX from 'xlsx'
import { syncPatientToZainsWorkflow } from '@/lib/services/zains-sync'

// Helper function untuk parse tanggal
function parseDate(dateStr: string | number): Date | null {
  if (!dateStr && dateStr !== 0) return null
  
  // Handle Excel date number
  if (typeof dateStr === 'number') {
    const excelEpoch = new Date(1899, 11, 30)
    const date = new Date(excelEpoch.getTime() + dateStr * 86400000)
    return isNaN(date.getTime()) ? null : date
  }
  
  const str = String(dateStr).trim()
  if (!str) return null
  
  // Handle format "31 January 2026" atau "31 Januari 2026"
  const monthMap: Record<string, number> = {
    'january': 0, 'januari': 0,
    'february': 1, 'februari': 1,
    'march': 2, 'maret': 2,
    'april': 3,
    'may': 4, 'mei': 4,
    'june': 5, 'juni': 5,
    'july': 6, 'juli': 6,
    'august': 7, 'agustus': 7,
    'september': 8,
    'october': 9, 'oktober': 9,
    'november': 10,
    'december': 11, 'desember': 11
  }
  
  // Try parse format "DD Month YYYY" (e.g., "31 January 2026")
  const datePattern1 = /^(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})$/
  const match1 = str.match(datePattern1)
  if (match1) {
    const day = parseInt(match1[1], 10)
    const monthName = match1[2].toLowerCase()
    const year = parseInt(match1[3], 10)
    const month = monthMap[monthName]
    
    if (month !== undefined && day >= 1 && day <= 31 && year >= 1900 && year <= 2100) {
      const date = new Date(year, month, day)
      if (date.getDate() === day && date.getMonth() === month && date.getFullYear() === year) {
        return date
      }
    }
  }
  
  // Try parse format "DD-MM-YYYY" atau "DD/MM/YYYY"
  const datePattern2 = /^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})$/
  const match2 = str.match(datePattern2)
  if (match2) {
    const day = parseInt(match2[1], 10)
    const month = parseInt(match2[2], 10) - 1
    const year = parseInt(match2[3], 10)
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31 && year >= 1900 && year <= 2100) {
      const date = new Date(year, month, day)
      if (date.getDate() === day && date.getMonth() === month && date.getFullYear() === year) {
        return date
      }
    }
  }
  
  // Try parse format "YYYY-MM-DD"
  const datePattern3 = /^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})$/
  const match3 = str.match(datePattern3)
  if (match3) {
    const year = parseInt(match3[1], 10)
    const month = parseInt(match3[2], 10) - 1
    const day = parseInt(match3[3], 10)
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31 && year >= 1900 && year <= 2100) {
      const date = new Date(year, month, day)
      if (date.getDate() === day && date.getMonth() === month && date.getFullYear() === year) {
        return date
      }
    }
  }
  
  // Fallback: try standard Date parsing
  const date = new Date(str)
  if (!isNaN(date.getTime())) {
    return date
  }
  
  return null
}

// Helper function untuk format tanggal ke YYYY-MM-DD
function formatDateToYYYYMMDD(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Helper function untuk parse angka Indonesia (dengan format 1.234.567,89)
function parseIndonesianNumber(value: any): number {
  if (!value && value !== 0) return 0
  if (typeof value === 'number') return value
  
  const str = String(value).trim()
  if (!str || str === '-' || str === '') return 0
  
  // Remove thousand separators (dots) and replace comma with dot
  const cleaned = str.replace(/\./g, '').replace(',', '.')
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { error: 'File tidak ditemukan' },
        { status: 400 }
      )
    }

    // Validasi file extension
    const fileName = file.name.toLowerCase()
    if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
      return NextResponse.json(
        { error: 'File harus berupa Excel (.xlsx atau .xls)' },
        { status: 400 }
      )
    }

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })
    
    // Get first sheet
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    
    // Convert to JSON
    const data = XLSX.utils.sheet_to_json(worksheet, { raw: false })

    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: 'File Excel kosong atau tidak memiliki data' },
        { status: 400 }
      )
    }

    // Ambil master_target_categories untuk mapping
    const categories = await sql`
      SELECT name, id_program_zains 
      FROM master_target_categories
    `
    const categoryMap: Record<string, string> = {}
    categories.forEach((cat: any) => {
      categoryMap[cat.name] = cat.id_program_zains
    })

    // Process dan insert data ke transactions
    let insertedCount = 0
    let skippedCount = 0
    let zainsInsertedCount = 0
    const errors: string[] = []

    for (let i = 0; i < data.length; i++) {
      const row = data[i] as any
      try {
        // Validasi id_klinik (wajib) - support berbagai format
        const clinicIdStr = row['ID Klinik'] || row['id_klinik'] || row['Id Klinik'] || row['ID_Klinik']
        if (!clinicIdStr) {
          errors.push(`Baris ${i + 2}: ID Klinik tidak ditemukan`)
          skippedCount++
          continue
        }

        const clinicId = parseInt(String(clinicIdStr))
        if (isNaN(clinicId)) {
          errors.push(`Baris ${i + 2}: id_klinik tidak valid: ${clinicIdStr}`)
          skippedCount++
          continue
        }

        // Validasi klinik exists dan ambil data yang diperlukan
        const [clinic] = await sql`
          SELECT id, name, id_kantor_zains, id_rekening FROM clinics WHERE id = ${clinicId}
        `
        if (!clinic) {
          errors.push(`Baris ${i + 2}: Klinik dengan ID ${clinicId} tidak ditemukan`)
          skippedCount++
          continue
        }

        const ID_KANTOR_ZAINS = (clinic as any).id_kantor_zains
        const ID_REKENING = (clinic as any).id_rekening || null

        // Parse tanggal
        const trxDate = parseDate(row['Tanggal'] || row['tanggal'] || '')
        if (!trxDate) {
          errors.push(`Baris ${i + 2}: Tanggal tidak valid`)
          skippedCount++
          continue
        }

        const trxNo = row['No Transaksi'] || row['no_transaksi'] || row['No. Transaksi'] || ''
        const ermNo = row['No. eRM'] || row['no_erm'] || row['No RM'] || row['ERM'] || ''
        const patientName = row['Nama Pasien'] || row['nama_pasien'] || row['Nama'] || ''
        const insuranceType = row['Asuransi'] || row['asuransi'] || row['Insurance'] || ''
        const polyclinic = row['Ruangan / Poli'] || row['Poli'] || row['poli'] || row['Ruangan'] || ''
        const paymentMethod = row['Metode Pembayaran'] || row['metode_pembayaran'] || row['Payment Method'] || ''
        const voucherCode = row['Voucher'] || row['voucher'] || '-'

        // Parse semua field jumlah
        const billRegist = parseIndonesianNumber(row['Jumlah Tagihan ( Rp. ) - Karcis'] || row['Bill Regist'] || 0)
        const billAction = parseIndonesianNumber(row['Jumlah Tagihan ( Rp. ) - Tindakan'] || row['Bill Action'] || 0)
        const billLab = parseIndonesianNumber(row['Jumlah Tagihan ( Rp. ) - Laboratorium'] || row['Bill Lab'] || 0)
        const billDrug = parseIndonesianNumber(row['Jumlah Tagihan ( Rp. ) - Obat'] || row['Bill Drug'] || 0)
        const billAlkes = parseIndonesianNumber(row['Jumlah Tagihan ( Rp. ) - Alkes'] || row['Bill Alkes'] || 0)
        const billMcu = parseIndonesianNumber(row['Jumlah Tagihan ( Rp. ) - MCU'] || row['Bill MCU'] || 0)
        const billRadio = parseIndonesianNumber(row['Jumlah Tagihan ( Rp. ) - Radiologi'] || row['Bill Radio'] || 0)
        const billTotal = parseIndonesianNumber(row['Jumlah Tagihan ( Rp. ) - Total'] || row['Bill Total'] || 0)

        const coveredRegist = parseIndonesianNumber(row['Jumlah Jaminan ( Rp. ) - Karcis'] || row['Covered Regist'] || 0)
        const coveredAction = parseIndonesianNumber(row['Jumlah Jaminan ( Rp. ) - Tindakan'] || row['Covered Action'] || 0)
        const coveredLab = parseIndonesianNumber(row['Jumlah Jaminan ( Rp. ) - Laboratorium'] || row['Covered Lab'] || 0)
        const coveredDrug = parseIndonesianNumber(row['Jumlah Jaminan ( Rp. ) - Obat'] || row['Covered Drug'] || 0)
        const coveredAlkes = parseIndonesianNumber(row['Jumlah Jaminan ( Rp. ) - Alkes'] || row['Covered Alkes'] || 0)
        const coveredMcu = parseIndonesianNumber(row['Jumlah Jaminan ( Rp. ) - MCU'] || row['Covered MCU'] || 0)
        const coveredRadio = parseIndonesianNumber(row['Jumlah Jaminan ( Rp. ) - Radiologi'] || row['Covered Radio'] || 0)
        const coveredTotal = parseIndonesianNumber(row['Jumlah Jaminan ( Rp. ) - Total'] || row['Covered Total'] || 0)

        const paidRegist = parseIndonesianNumber(row['Jumlah Pembayaran ( Rp. ) - Karcis'] || row['Paid Regist'] || 0)
        const paidAction = parseIndonesianNumber(row['Jumlah Pembayaran ( Rp. ) - Tindakan'] || row['Paid Action'] || 0)
        const paidLab = parseIndonesianNumber(row['Jumlah Pembayaran ( Rp. ) - Laboratorium'] || row['Paid Lab'] || 0)
        const paidDrug = parseIndonesianNumber(row['Jumlah Pembayaran ( Rp. ) - Obat'] || row['Paid Drug'] || 0)
        const paidAlkes = parseIndonesianNumber(row['Jumlah Pembayaran ( Rp. ) - Alkes'] || row['Paid Alkes'] || 0)
        const paidMcu = parseIndonesianNumber(row['Jumlah Pembayaran ( Rp. ) - MCU'] || row['Paid MCU'] || 0)
        const paidRadio = parseIndonesianNumber(row['Jumlah Pembayaran ( Rp. ) - Radiologi'] || row['Paid Radio'] || 0)
        const paidRounding = parseIndonesianNumber(row['Jumlah Pembayaran ( Rp. ) - Pembulatan'] || row['Paid Rounding'] || 0)
        const paidDiscount = parseIndonesianNumber(row['Jumlah Pembayaran ( Rp. ) - Diskon'] || row['Paid Discount'] || 0)
        const paidTax = parseIndonesianNumber(row['Jumlah Pembayaran ( Rp. ) - PPN'] || row['Paid Tax'] || 0)
        const paidVoucherAmt = parseIndonesianNumber(row['Jumlah Pembayaran ( Rp. ) - Voucher'] || row['Paid Voucher'] || 0)
        const paidTotal = parseIndonesianNumber(row['Jumlah Pembayaran ( Rp. ) - Total'] || row['Paid Total'] || 0)

        // Hitung paid_action_after_discount: jika paid_discount > 0 maka paid_action_after_discount = paid_action - paid_discount
        const paidActionAfterDiscount = paidDiscount > 0 ? paidAction - paidDiscount : paidAction

        const receivableRegist = parseIndonesianNumber(row['Jumlah Piutang ( Rp. ) - Karcis'] || row['Receivable Regist'] || 0)
        const receivableAction = parseIndonesianNumber(row['Jumlah Piutang ( Rp. ) - Tindakan'] || row['Receivable Action'] || 0)
        const receivableLab = parseIndonesianNumber(row['Jumlah Piutang ( Rp. ) - Laboratorium'] || row['Receivable Lab'] || 0)
        const receivableDrug = parseIndonesianNumber(row['Jumlah Piutang ( Rp. ) - Obat'] || row['Receivable Drug'] || 0)
        const receivableAlkes = parseIndonesianNumber(row['Jumlah Piutang ( Rp. ) - Alkes'] || row['Receivable Alkes'] || 0)
        const receivableMcu = parseIndonesianNumber(row['Jumlah Piutang ( Rp. ) - MCU'] || row['Receivable MCU'] || 0)
        const receivableRadio = parseIndonesianNumber(row['Jumlah Piutang ( Rp. ) - Radiologi'] || row['Receivable Radio'] || 0)
        const receivableTotal = parseIndonesianNumber(row['Jumlah Piutang ( Rp. ) - Total'] || row['Receivable Total'] || 0)

        // Format tanggal untuk patient
        const trxDateFormatted = formatDateToYYYYMMDD(trxDate)

        // Cek apakah transaksi sudah ada
        const [existingTransaction] = await sql`
          SELECT id FROM transactions
          WHERE clinic_id = ${clinicId} 
            AND erm_no = ${ermNo}
            AND trx_date = ${trxDateFormatted}
            AND polyclinic = ${polyclinic}
            AND bill_total = ${billTotal}
          LIMIT 1
        `

        const isNewTransaction = !existingTransaction

        // Insert atau update patient dengan logika first_visit_at, last_visit_at
        // visit_count akan di-increment setelah transaksi berhasil di-insert (hanya jika transaksi baru)
        const ermNoForZains = `${clinicId}${ermNo}`
        const [insertedPatient] = await sql`
          INSERT INTO patients (
            clinic_id, 
            erm_no, 
            full_name, 
            first_visit_at, 
            last_visit_at, 
            visit_count,
            erm_no_for_zains
          )
          VALUES (
            ${clinicId},
            ${ermNo},
            ${patientName},
            ${trxDateFormatted},
            ${trxDateFormatted},
            1,
            ${ermNoForZains}
          )
          ON CONFLICT (clinic_id, erm_no) 
          DO UPDATE SET
            full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), patients.full_name),
            first_visit_at = LEAST(patients.first_visit_at, EXCLUDED.first_visit_at),
            last_visit_at = GREATEST(patients.last_visit_at, EXCLUDED.last_visit_at),
            erm_no_for_zains = EXCLUDED.erm_no_for_zains,
            updated_at = NOW()
          RETURNING id, visit_count
        `

        const patientId = insertedPatient ? (insertedPatient as any).id : null
        const patientVisitCount = insertedPatient ? (insertedPatient as any).visit_count : 0

        // Cari poly_id dari clinic_poly_mappings berdasarkan raw_poly_name
        let polyId: number | null = null
        if (polyclinic) {
          const [polyMapping] = await sql`
            SELECT master_poly_id 
            FROM clinic_poly_mappings
            WHERE clinic_id = ${clinicId} 
              AND raw_poly_name = ${polyclinic}
            LIMIT 1
          `
          polyId = polyMapping ? (polyMapping as any).master_poly_id : null
        }

        // Cari insurance_type_id dari clinic_insurance_mappings berdasarkan raw_insurance_name
        let insuranceTypeId: number | null = null
        if (insuranceType) {
          const [insuranceMapping] = await sql`
            SELECT master_insurance_id 
            FROM clinic_insurance_mappings
            WHERE clinic_id = ${clinicId} 
              AND raw_insurance_name = ${insuranceType}
            LIMIT 1
          `
          insuranceTypeId = insuranceMapping ? (insuranceMapping as any).master_insurance_id : null
        }

        // Insert atau update transaction dengan input_type = 'upload'
        const [insertedTransaction] = await sql`
          INSERT INTO transactions (
            clinic_id, patient_id, poly_id, insurance_type_id, trx_date, trx_no, erm_no, patient_name,
            insurance_type, polyclinic, payment_method, voucher_code,
            bill_regist, bill_action, bill_lab, bill_drug, bill_alkes, bill_mcu, bill_radio, bill_total,
            covered_regist, covered_action, covered_lab, covered_drug, covered_alkes, covered_mcu, covered_radio, covered_total,
            paid_regist, paid_action, paid_action_after_discount, paid_lab, paid_drug, paid_alkes, paid_mcu, paid_radio, 
            paid_rounding, paid_discount, paid_tax, paid_voucher_amt, paid_total,
            receivable_regist, receivable_action, receivable_lab, receivable_drug, receivable_alkes, 
            receivable_mcu, receivable_radio, receivable_total,
            raw_json_data, input_type
          )
          VALUES (
            ${clinicId}, ${patientId}, ${polyId}, ${insuranceTypeId}, ${trxDateFormatted}, ${trxNo}, ${ermNo}, ${patientName},
            ${insuranceType}, ${polyclinic}, ${paymentMethod}, ${voucherCode === '-' ? null : voucherCode},
            ${billRegist}, ${billAction}, ${billLab}, ${billDrug}, ${billAlkes}, ${billMcu}, ${billRadio}, ${billTotal},
            ${coveredRegist}, ${coveredAction}, ${coveredLab}, ${coveredDrug}, ${coveredAlkes}, ${coveredMcu}, ${coveredRadio}, ${coveredTotal},
            ${paidRegist}, ${paidAction}, ${paidActionAfterDiscount}, ${paidLab}, ${paidDrug}, ${paidAlkes}, ${paidMcu}, ${paidRadio},
            ${paidRounding}, ${paidDiscount}, ${paidTax}, ${paidVoucherAmt}, ${paidTotal},
            ${receivableRegist}, ${receivableAction}, ${receivableLab}, ${receivableDrug}, ${receivableAlkes},
            ${receivableMcu}, ${receivableRadio}, ${receivableTotal},
            ${JSON.stringify(row)}, 'upload'
          )
          ON CONFLICT (clinic_id, erm_no, trx_date, polyclinic, bill_total) 
          DO UPDATE SET
            trx_no = EXCLUDED.trx_no,
            patient_name = EXCLUDED.patient_name,
            insurance_type = EXCLUDED.insurance_type,
            payment_method = EXCLUDED.payment_method,
            voucher_code = EXCLUDED.voucher_code,
            raw_json_data = EXCLUDED.raw_json_data,
            input_type = 'upload',
            paid_action_after_discount = EXCLUDED.paid_action_after_discount,
            updated_at = NOW()
          RETURNING id
        `

        const transactionId = (insertedTransaction as any).id

        // Increment visit_count hanya jika transaksi benar-benar baru (bukan duplicate)
        // Jika patient baru (visit_count = 1 dari insert), tidak perlu increment karena sudah di-set ke 1
        // Jika patient sudah ada (visit_count > 1), increment visit_count untuk transaksi baru
        if (isNewTransaction && patientId && patientVisitCount > 1) {
          await sql`
            UPDATE patients 
            SET visit_count = visit_count + 1,
                updated_at = NOW()
            WHERE id = ${patientId}
          `
        }

        insertedCount++

        // Break data ke transactions_to_zains berdasarkan master_target_categories
        // Hanya ambil field "Jumlah Pembayaran" yang ada nilainya (tidak 0)
        // Mapping sesuai dengan nama di master_target_categories
        // Khusus untuk kategori Tindakan: jika ada diskon (paid_discount > 0), gunakan paid_action_after_discount
        const paidFields = [
          { key: 'Jumlah Pembayaran ( Rp. ) - Karcis', category: 'Karcis', value: paidRegist },
          { key: 'Jumlah Pembayaran ( Rp. ) - Tindakan', category: 'Tindakan', value: paidActionAfterDiscount },
          { key: 'Jumlah Pembayaran ( Rp. ) - Laboratorium', category: 'Laboratorium', value: paidLab },
          { key: 'Jumlah Pembayaran ( Rp. ) - Obat', category: 'Obat-obatan', value: paidDrug },
          { key: 'Jumlah Pembayaran ( Rp. ) - Alkes', category: 'Alat Kesehatan', value: paidAlkes },
          { key: 'Jumlah Pembayaran ( Rp. ) - MCU', category: 'MCU', value: paidMcu },
          { key: 'Jumlah Pembayaran ( Rp. ) - Radiologi', category: 'Radiologi', value: paidRadio },
          { key: 'Jumlah Pembayaran ( Rp. ) - Pembulatan', category: 'Pembulatan', value: paidRounding },
        ]

        // Cari id_donatur dari patient jika ada
        const [patientData] = await sql`
          SELECT id_donatur_zains FROM patients 
          WHERE clinic_id = ${clinicId} AND erm_no = ${ermNo}
          LIMIT 1
        `
        const idDonatur = patientData ? (patientData as any).id_donatur_zains : null

        // Counter untuk transaction to zains per transaction (untuk workflow integration)
        let transactionZainsInsertedCount = 0

        // Insert ke transactions_to_zains untuk setiap field yang memiliki nilai > 0
        for (const field of paidFields) {
          if (field.value > 0) {
            const idProgram = categoryMap[field.category]
            if (idProgram && ID_KANTOR_ZAINS) {
              const nominalValue = Math.round(field.value)
              
              // Cek apakah sudah ada untuk menghindari duplikasi
              // Gunakan kombinasi transaction_id, id_program, dan nominal untuk uniqueness
              const [existing] = await sql`
                SELECT id FROM transactions_to_zains
                WHERE transaction_id = ${transactionId}
                  AND id_program = ${idProgram}
                  AND nominal_transaksi = ${nominalValue}
                  AND tgl_transaksi = ${trxDateFormatted}
                LIMIT 1
              `

              if (!existing) {
                // Hanya isi id_rekening jika payment_method adalah QRIS
                const idRekening = paymentMethod && paymentMethod.toUpperCase().includes('QRIS') ? ID_REKENING : null
                
                await sql`
                  INSERT INTO transactions_to_zains (
                    transaction_id, id_transaksi, id_program, id_kantor, tgl_transaksi,
                    id_donatur, nominal_transaksi, id_rekening, synced, todo_zains, nama_pasien, no_erm, created_at, updated_at
                  )
                  VALUES (
                    ${transactionId},
                    NULL,
                    ${idProgram},
                    ${ID_KANTOR_ZAINS},
                    ${trxDateFormatted},
                    ${idDonatur},
                    ${nominalValue},
                    ${idRekening},
                    false,
                    true,
                    ${patientName},
                    ${ermNo},
                    NOW(),
                    NOW()
                  )
                `
                zainsInsertedCount++
                transactionZainsInsertedCount++
              }
            } else {
              console.warn(`⚠️  Category "${field.category}" tidak memiliki id_program_zains atau id_kantor_zains tidak tersedia untuk klinik ${clinicId}`)
            }
          }
        }

        // Sync patient ke Zains setelah transaction to zains berhasil (workflow integration)
        // Hanya sync jika ada insert ke transactions_to_zains dan patient belum punya id_donatur_zains
        if (transactionZainsInsertedCount > 0 && patientId && !idDonatur) {
          syncPatientToZainsWorkflow(patientId)
        }
      } catch (error: any) {
        console.error(`Error processing row ${i + 2}:`, error)
        errors.push(`Baris ${i + 2}: ${error.message || 'Error tidak diketahui'}`)
        skippedCount++
      }
    }

    return NextResponse.json({
      success: true,
      insertedCount,
      zainsInsertedCount,
      skippedCount,
      totalRows: data.length,
      errors: errors.slice(0, 50), // Limit errors to 50
    })
  } catch (error: any) {
    console.error('Error uploading transactions:', error)
    return NextResponse.json(
      { 
        error: 'Gagal memproses file Excel', 
        details: error.message 
      },
      { status: 500 }
    )
  }
}
