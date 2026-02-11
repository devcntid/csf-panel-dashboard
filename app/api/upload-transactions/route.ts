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
    const results: { row: number; status: 'success' | 'skipped' | 'error'; message?: string }[] = []

    for (let i = 0; i < data.length; i++) {
      const rowIndex = i + 2 // Excel baris (1-based + header)
      const row = data[i] as any
      try {
        // Validasi id_klinik (wajib) - support berbagai format
        const clinicIdStr = row['ID Klinik'] || row['id_klinik'] || row['Id Klinik'] || row['ID_Klinik']
        if (!clinicIdStr) {
          const msg = 'ID Klinik tidak ditemukan'
          errors.push(`Baris ${rowIndex}: ${msg}`)
          results.push({ row: rowIndex, status: 'skipped', message: msg })
          skippedCount++
          continue
        }

        const clinicId = parseInt(String(clinicIdStr))
        if (isNaN(clinicId)) {
          const msg = `id_klinik tidak valid: ${clinicIdStr}`
          errors.push(`Baris ${rowIndex}: ${msg}`)
          results.push({ row: rowIndex, status: 'skipped', message: msg })
          skippedCount++
          continue
        }

        // Validasi klinik exists dan ambil data yang diperlukan
        const [clinic] = await sql`
          SELECT id, name, id_kantor_zains, id_rekening, kode_coa FROM clinics WHERE id = ${clinicId}
        `
        if (!clinic) {
          const msg = `Klinik dengan ID ${clinicId} tidak ditemukan`
          errors.push(`Baris ${rowIndex}: ${msg}`)
          results.push({ row: rowIndex, status: 'skipped', message: msg })
          skippedCount++
          continue
        }

        const ID_KANTOR_ZAINS = (clinic as any).id_kantor_zains
        const ID_REKENING_QRIS = (clinic as any).id_rekening || null
        const KODE_COA_RAW = (clinic as any).kode_coa || null
        const KODE_COA_NO_DOT = KODE_COA_RAW ? String(KODE_COA_RAW).replace(/\./g, '') : null

        // Parse tanggal
        const trxDate = parseDate(row['Tanggal'] || row['tanggal'] || '')
        if (!trxDate) {
          const msg = 'Tanggal tidak valid'
          errors.push(`Baris ${rowIndex}: ${msg}`)
          results.push({ row: rowIndex, status: 'skipped', message: msg })
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

        // Parse diskon tagihan
        const billRegistDiscount = parseIndonesianNumber(row['Diskon Tagihan ( Rp. ) - Karcis'] || row['Bill Regist Discount'] || 0)
        const billActionDiscount = parseIndonesianNumber(row['Diskon Tagihan ( Rp. ) - Tindakan'] || row['Bill Action Discount'] || 0)
        const billLabDiscount = parseIndonesianNumber(row['Diskon Tagihan ( Rp. ) - Laboratorium'] || row['Bill Lab Discount'] || 0)
        const billDrugDiscount = parseIndonesianNumber(row['Diskon Tagihan ( Rp. ) - Obat'] || row['Bill Drug Discount'] || 0)
        const billAlkesDiscount = parseIndonesianNumber(row['Diskon Tagihan ( Rp. ) - Alkes'] || row['Bill Alkes Discount'] || 0)
        const billMcuDiscount = parseIndonesianNumber(row['Diskon Tagihan ( Rp. ) - MCU'] || row['Bill MCU Discount'] || 0)
        const billRadioDiscount = parseIndonesianNumber(row['Diskon Tagihan ( Rp. ) - Radiologi'] || row['Bill Radio Discount'] || 0)

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

        const receivableRegist = parseIndonesianNumber(row['Jumlah Piutang ( Rp. ) - Karcis'] || row['Receivable Regist'] || 0)
        const receivableAction = parseIndonesianNumber(row['Jumlah Piutang ( Rp. ) - Tindakan'] || row['Receivable Action'] || 0)
        const receivableLab = parseIndonesianNumber(row['Jumlah Piutang ( Rp. ) - Laboratorium'] || row['Receivable Lab'] || 0)
        const receivableDrug = parseIndonesianNumber(row['Jumlah Piutang ( Rp. ) - Obat'] || row['Receivable Drug'] || 0)
        const receivableAlkes = parseIndonesianNumber(row['Jumlah Piutang ( Rp. ) - Alkes'] || row['Receivable Alkes'] || 0)
        const receivableMcu = parseIndonesianNumber(row['Jumlah Piutang ( Rp. ) - MCU'] || row['Receivable MCU'] || 0)
        const receivableRadio = parseIndonesianNumber(row['Jumlah Piutang ( Rp. ) - Radiologi'] || row['Receivable Radio'] || 0)
        const receivableTotal = parseIndonesianNumber(row['Jumlah Piutang ( Rp. ) - Total'] || row['Receivable Total'] || 0)

        // Format tanggal untuk patient & transaksi
        const trxDateFormatted = formatDateToYYYYMMDD(trxDate)

        // ERM khusus untuk Zains (digabung clinicId + ermNo)
        const ermNoForZains = `${clinicId}${ermNo}`

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

        // patientId & visitCount akan diisi NANTI,
        // hanya jika transaksi ini benar-benar di-break ke transactions_to_zains
        let patientId: number | null = null
        let patientVisitCount = 0

        // Cari poly_id dari clinic_poly_mappings: clinic_id + raw string polyclinic
        // Gunakan TRIM + case-insensitive agar match dengan raw_poly_name di mapping
        let polyId: number | null = null
        const polyclinicNorm = (polyclinic || '').trim()
        if (polyclinicNorm) {
          const polyResults = await sql`
            SELECT master_poly_id 
            FROM clinic_poly_mappings
            WHERE clinic_id = ${clinicId} 
              AND LOWER(TRIM(raw_poly_name)) = LOWER(${polyclinicNorm})
            LIMIT 1
          `
          const polyMapping = Array.isArray(polyResults) ? polyResults[0] : polyResults
          polyId = polyMapping ? (polyMapping as any).master_poly_id : null
        }

        // Cari insurance_type_id dari clinic_insurance_mappings: clinic_id + raw string insurance_type
        // Gunakan TRIM + case-insensitive agar match dengan raw_insurance_name di mapping
        let insuranceTypeId: number | null = null
        const insuranceTypeNorm = (insuranceType || '').trim()
        if (insuranceTypeNorm) {
          const insuranceResults = await sql`
            SELECT master_insurance_id 
            FROM clinic_insurance_mappings
            WHERE clinic_id = ${clinicId} 
              AND LOWER(TRIM(raw_insurance_name)) = LOWER(${insuranceTypeNorm})
            LIMIT 1
          `
          const insuranceMapping = Array.isArray(insuranceResults) ? insuranceResults[0] : insuranceResults
          insuranceTypeId = insuranceMapping ? (insuranceMapping as any).master_insurance_id : null
        }

        // Insert atau update transaction dengan input_type = 'upload'
        // patient_id sementara NULL; akan di-update setelah patient ter-insert (jika perlu dikirim ke Zains)
        const [insertedTransaction] = await sql`
          INSERT INTO transactions (
            clinic_id, patient_id, poly_id, insurance_type_id, trx_date, trx_no, erm_no, patient_name,
            insurance_type, polyclinic, payment_method, voucher_code,
            bill_regist, bill_action, bill_lab, bill_drug, bill_alkes, bill_mcu, bill_radio, bill_total,
            bill_regist_discount, bill_action_discount, bill_lab_discount, bill_drug_discount, bill_alkes_discount, bill_mcu_discount, bill_radio_discount,
            covered_regist, covered_action, covered_lab, covered_drug, covered_alkes, covered_mcu, covered_radio, covered_total,
            paid_regist, paid_action, paid_lab, paid_drug, paid_alkes, paid_mcu, paid_radio, 
            paid_rounding, paid_discount, paid_tax, paid_voucher_amt, paid_total,
            receivable_regist, receivable_action, receivable_lab, receivable_drug, receivable_alkes, 
            receivable_mcu, receivable_radio, receivable_total,
            raw_json_data, input_type
          )
          VALUES (
            ${clinicId}, NULL, ${polyId}, ${insuranceTypeId}, ${trxDateFormatted}, ${trxNo}, ${ermNo}, ${patientName},
            ${insuranceType}, ${polyclinic}, ${paymentMethod}, ${voucherCode === '-' ? null : voucherCode},
            ${billRegist}, ${billAction}, ${billLab}, ${billDrug}, ${billAlkes}, ${billMcu}, ${billRadio}, ${billTotal},
            ${billRegistDiscount}, ${billActionDiscount}, ${billLabDiscount}, ${billDrugDiscount}, ${billAlkesDiscount}, ${billMcuDiscount}, ${billRadioDiscount},
            ${coveredRegist}, ${coveredAction}, ${coveredLab}, ${coveredDrug}, ${coveredAlkes}, ${coveredMcu}, ${coveredRadio}, ${coveredTotal},
            ${paidRegist}, ${paidAction}, ${paidLab}, ${paidDrug}, ${paidAlkes}, ${paidMcu}, ${paidRadio},
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
            poly_id = EXCLUDED.poly_id,
            insurance_type_id = EXCLUDED.insurance_type_id,
            bill_regist_discount = EXCLUDED.bill_regist_discount,
            bill_action_discount = EXCLUDED.bill_action_discount,
            bill_lab_discount = EXCLUDED.bill_lab_discount,
            bill_drug_discount = EXCLUDED.bill_drug_discount,
            bill_alkes_discount = EXCLUDED.bill_alkes_discount,
            bill_mcu_discount = EXCLUDED.bill_mcu_discount,
            bill_radio_discount = EXCLUDED.bill_radio_discount,
            updated_at = NOW()
          RETURNING id
        `

        const transactionId = (insertedTransaction as any).id

        insertedCount++
        results.push({ row: rowIndex, status: 'success' })

        // Break data ke transactions_to_zains berdasarkan master_target_categories
        // Hanya ambil field "Jumlah Pembayaran" yang ada nilainya (tidak 0)
        // Mapping sesuai dengan nama di master_target_categories
        //
        // KHUSUS UPLOAD EXCEL: Jika bill_*_discount tidak terisi tapi paid_discount ada,
        // maka diskon hanya mengurangi nominal Tindakan di transactions_to_zains.
        const allBillDiscountsEmpty =
          billRegistDiscount === 0 &&
          billActionDiscount === 0 &&
          billLabDiscount === 0 &&
          billDrugDiscount === 0 &&
          billAlkesDiscount === 0 &&
          billMcuDiscount === 0 &&
          billRadioDiscount === 0

        const usePaidDiscountForTindakanOnly = allBillDiscountsEmpty && paidDiscount > 0

        const paidFields = usePaidDiscountForTindakanOnly
          ? [
              { key: 'Jumlah Pembayaran ( Rp. ) - Karcis', category: 'Karcis', value: paidRegist },
              { key: 'Jumlah Pembayaran ( Rp. ) - Tindakan', category: 'Tindakan', value: Math.max(0, paidAction - paidDiscount) },
              { key: 'Jumlah Pembayaran ( Rp. ) - Laboratorium', category: 'Laboratorium', value: paidLab },
              { key: 'Jumlah Pembayaran ( Rp. ) - Obat', category: 'Obat-obatan', value: paidDrug },
              { key: 'Jumlah Pembayaran ( Rp. ) - Alkes', category: 'Alat Kesehatan', value: paidAlkes },
              { key: 'Jumlah Pembayaran ( Rp. ) - MCU', category: 'MCU', value: paidMcu },
              { key: 'Jumlah Pembayaran ( Rp. ) - Radiologi', category: 'Radiologi', value: paidRadio },
              { key: 'Jumlah Pembayaran ( Rp. ) - Pembulatan', category: 'Pembulatan', value: paidRounding },
            ]
          : [
              { key: 'Jumlah Pembayaran ( Rp. ) - Karcis', category: 'Karcis', value: Math.max(0, paidRegist - billRegistDiscount) },
              { key: 'Jumlah Pembayaran ( Rp. ) - Tindakan', category: 'Tindakan', value: Math.max(0, paidAction - billActionDiscount) },
              { key: 'Jumlah Pembayaran ( Rp. ) - Laboratorium', category: 'Laboratorium', value: Math.max(0, paidLab - billLabDiscount) },
              { key: 'Jumlah Pembayaran ( Rp. ) - Obat', category: 'Obat-obatan', value: Math.max(0, paidDrug - billDrugDiscount) },
              { key: 'Jumlah Pembayaran ( Rp. ) - Alkes', category: 'Alat Kesehatan', value: Math.max(0, paidAlkes - billAlkesDiscount) },
              { key: 'Jumlah Pembayaran ( Rp. ) - MCU', category: 'MCU', value: Math.max(0, paidMcu - billMcuDiscount) },
              { key: 'Jumlah Pembayaran ( Rp. ) - Radiologi', category: 'Radiologi', value: Math.max(0, paidRadio - billRadioDiscount) },
              { key: 'Jumlah Pembayaran ( Rp. ) - Pembulatan', category: 'Pembulatan', value: paidRounding },
            ]

        // Cari id_donatur dari patient jika ada (hanya dari patient yang SUDAH ada)
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
                // id_rekening:
                // - Jika QRIS  -> gunakan id_rekening dari klinik (ID_REKENING_QRIS)
                // - Jika TUNAI / lainnya -> gunakan kode_coa klinik tanpa titik (KODE_COA_NO_DOT)
                const isQris = paymentMethod && paymentMethod.toUpperCase().includes('QRIS')
                const idRekening = isQris ? ID_REKENING_QRIS : KODE_COA_NO_DOT

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
                    ${ermNoForZains},
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

        // Hanya jika transaksi ini benar-benar punya record di transactions_to_zains,
        // baru kita pastikan patient ada (insert/update) dan relasi patient_id di transactions diisi.
        if (transactionZainsInsertedCount > 0) {
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

          patientId = insertedPatient ? (insertedPatient as any).id : null
          patientVisitCount = insertedPatient ? (insertedPatient as any).visit_count : 0

          // Update relasi patient_id di transactions
          if (patientId) {
            await sql`
              UPDATE transactions
              SET patient_id = ${patientId},
                  updated_at = NOW()
              WHERE id = ${transactionId}
            `
          }

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

          // Sync patient ke Zains setelah transaction to zains berhasil (workflow integration, spesifik transaction ini)
          if (patientId && !idDonatur) {
            syncPatientToZainsWorkflow(patientId, transactionId)
          }
        }
      } catch (error: any) {
        const msg = error.message || 'Error tidak diketahui'
        console.error(`Error processing row ${rowIndex}:`, error)
        errors.push(`Baris ${rowIndex}: ${msg}`)
        results.push({ row: rowIndex, status: 'error', message: msg })
        skippedCount++
      }
    }

    return NextResponse.json({
      success: true,
      insertedCount,
      zainsInsertedCount,
      skippedCount,
      totalRows: data.length,
      errors: errors.slice(0, 50),
      results,
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
