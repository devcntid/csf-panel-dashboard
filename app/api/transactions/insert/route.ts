import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { syncPatientToZainsWorkflow } from '@/lib/services/zains-sync'

// Helper function untuk parse angka dengan koma (format Indonesia)
function parseIndonesianNumber(value: string | number | undefined): number {
  if (!value || value === '-' || value === '0') return 0
  // Hapus koma dan parse ke number
  const cleaned = String(value).replace(/,/g, '').trim()
  return parseFloat(cleaned) || 0
}

// Helper function untuk format tanggal ke yyyy-mm-dd
function formatDateToYYYYMMDD(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export async function POST(request: NextRequest) {
  let requestBody: any = null
  try {
    requestBody = await request.json()
    const body = requestBody
    const { clinic_id, transaction_data } = body

    // Validasi input
    if (!clinic_id) {
      return NextResponse.json(
        { error: 'clinic_id harus diisi' },
        { status: 400 }
      )
    }

    if (!transaction_data || !Array.isArray(transaction_data) || transaction_data.length === 0) {
      return NextResponse.json(
        { error: 'transaction_data harus berupa array yang tidak kosong' },
        { status: 400 }
      )
    }

    // Validasi clinic exists dan aktif
    const [clinic] = await sql`
      SELECT 
        id, 
        name, 
        id_kantor_zains,
        id_rekening,
        is_active
      FROM clinics 
      WHERE id = ${clinic_id} AND is_active = true
    `

    if (!clinic) {
      return NextResponse.json(
        { error: 'Clinic tidak ditemukan atau tidak aktif' },
        { status: 404 }
      )
    }

    const ID_KANTOR_ZAINS = clinic.id_kantor_zains
    const ID_REKENING = (clinic as any).id_rekening || null

    // Ambil master_target_categories untuk mapping
    const categories = await sql`
      SELECT name, id_program_zains 
      FROM master_target_categories
    `
    const categoryMap: Record<string, string> = {}
    categories.forEach((cat: any) => {
      categoryMap[cat.name] = cat.id_program_zains
    })

    let insertedCount = 0
    let skippedCount = 0
    let zainsInsertedCount = 0
    const errors: any[] = []

    // Process setiap transaksi
    for (let i = 0; i < transaction_data.length; i++) {
      const row = transaction_data[i]
      
      try {
        // Parse data dari row
        const trxDateStr = row['trx_date'] || row['Tanggal'] || row['tanggal']
        if (!trxDateStr) {
          errors.push({ index: i, error: 'Tanggal transaksi tidak ditemukan' })
          skippedCount++
          continue
        }

        const trxDate = new Date(trxDateStr)
        if (isNaN(trxDate.getTime())) {
          errors.push({ index: i, error: 'Format tanggal tidak valid' })
          skippedCount++
          continue
        }

        const trxNo = row['trx_no'] || row['No Transaksi'] || row['no_transaksi'] || ''
        const ermNo = row['erm_no'] || row['No. eRM'] || row['no_erm'] || ''

        // Fast duplicate check: jika sudah ada transaksi dengan clinic_id + trx_no + erm_no yang sama,
        // anggap transaksi sudah pernah masuk dan skip tanpa melakukan proses berat lainnya.
        if (trxNo && ermNo) {
          const [existingByTrxNo] = await sql`
            SELECT id FROM transactions
            WHERE clinic_id = ${clinic_id}
              AND trx_no = ${trxNo}
              AND erm_no = ${ermNo}
            LIMIT 1
          `

          if (existingByTrxNo) {
            skippedCount++
            errors.push({
              index: i,
              error: 'Transaksi sudah masuk (duplicate trx_no & erm_no)',
              trx_no: trxNo,
              erm_no: ermNo,
            })
            continue
          }
        }

        const patientName = row['patient_name'] || row['Nama Pasien'] || row['patient_name'] || ''
        const insuranceType = row['insurance_type'] || row['Asuransi'] || row['insurance_type'] || ''
        const polyclinic = row['polyclinic'] || row['Ruangan / Poli'] || row['polyclinic'] || ''
        const paymentMethod = row['payment_method'] || row['Metode Pembayaran'] || row['payment_method'] || ''
        const voucherCode = row['voucher_code'] || row['Voucher'] || row['voucher_code'] || '-'

        // Parse semua field jumlah
        const billRegist = parseIndonesianNumber(row['bill_regist'] || row['Jumlah Tagihan ( Rp. ) - Karcis'] || 0)
        const billAction = parseIndonesianNumber(row['bill_action'] || row['Jumlah Tagihan ( Rp. ) - Tindakan'] || 0)
        const billLab = parseIndonesianNumber(row['bill_lab'] || row['Jumlah Tagihan ( Rp. ) - Laboratorium'] || 0)
        const billDrug = parseIndonesianNumber(row['bill_drug'] || row['Jumlah Tagihan ( Rp. ) - Obat'] || 0)
        const billAlkes = parseIndonesianNumber(row['bill_alkes'] || row['Jumlah Tagihan ( Rp. ) - Alkes'] || 0)
        const billMcu = parseIndonesianNumber(row['bill_mcu'] || row['Jumlah Tagihan ( Rp. ) - MCU'] || 0)
        const billRadio = parseIndonesianNumber(row['bill_radio'] || row['Jumlah Tagihan ( Rp. ) - Radiologi'] || 0)
        const billTotal = parseIndonesianNumber(row['bill_total'] || row['Jumlah Tagihan ( Rp. ) - Total'] || 0)

        // Parse diskon tagihan
        const billRegistDiscount = parseIndonesianNumber(row['bill_regist_discount'] || row['Diskon Tagihan ( Rp. ) - Karcis'] || 0)
        const billActionDiscount = parseIndonesianNumber(row['bill_action_discount'] || row['Diskon Tagihan ( Rp. ) - Tindakan'] || 0)
        const billLabDiscount = parseIndonesianNumber(row['bill_lab_discount'] || row['Diskon Tagihan ( Rp. ) - Laboratorium'] || 0)
        const billDrugDiscount = parseIndonesianNumber(row['bill_drug_discount'] || row['Diskon Tagihan ( Rp. ) - Obat'] || 0)
        const billAlkesDiscount = parseIndonesianNumber(row['bill_alkes_discount'] || row['Diskon Tagihan ( Rp. ) - Alkes'] || 0)
        const billMcuDiscount = parseIndonesianNumber(row['bill_mcu_discount'] || row['Diskon Tagihan ( Rp. ) - MCU'] || 0)
        const billRadioDiscount = parseIndonesianNumber(row['bill_radio_discount'] || row['Diskon Tagihan ( Rp. ) - Radiologi'] || 0)

        const coveredRegist = parseIndonesianNumber(row['covered_regist'] || row['Jumlah Jaminan ( Rp. ) - Karcis'] || 0)
        const coveredAction = parseIndonesianNumber(row['covered_action'] || row['Jumlah Jaminan ( Rp. ) - Tindakan'] || 0)
        const coveredLab = parseIndonesianNumber(row['covered_lab'] || row['Jumlah Jaminan ( Rp. ) - Laboratorium'] || 0)
        const coveredDrug = parseIndonesianNumber(row['covered_drug'] || row['Jumlah Jaminan ( Rp. ) - Obat'] || 0)
        const coveredAlkes = parseIndonesianNumber(row['covered_alkes'] || row['Jumlah Jaminan ( Rp. ) - Alkes'] || 0)
        const coveredMcu = parseIndonesianNumber(row['covered_mcu'] || row['Jumlah Jaminan ( Rp. ) - MCU'] || 0)
        const coveredRadio = parseIndonesianNumber(row['covered_radio'] || row['Jumlah Jaminan ( Rp. ) - Radiologi'] || 0)
        const coveredTotal = parseIndonesianNumber(row['covered_total'] || row['Jumlah Jaminan ( Rp. ) - Total'] || 0)

        const paidRegist = parseIndonesianNumber(row['paid_regist'] || row['Jumlah Pembayaran ( Rp. ) - Karcis'] || 0)
        const paidAction = parseIndonesianNumber(row['paid_action'] || row['Jumlah Pembayaran ( Rp. ) - Tindakan'] || 0)
        const paidLab = parseIndonesianNumber(row['paid_lab'] || row['Jumlah Pembayaran ( Rp. ) - Laboratorium'] || 0)
        const paidDrug = parseIndonesianNumber(row['paid_drug'] || row['Jumlah Pembayaran ( Rp. ) - Obat'] || 0)
        const paidAlkes = parseIndonesianNumber(row['paid_alkes'] || row['Jumlah Pembayaran ( Rp. ) - Alkes'] || 0)
        const paidMcu = parseIndonesianNumber(row['paid_mcu'] || row['Jumlah Pembayaran ( Rp. ) - MCU'] || 0)
        const paidRadio = parseIndonesianNumber(row['paid_radio'] || row['Jumlah Pembayaran ( Rp. ) - Radiologi'] || 0)
        const paidRounding = parseIndonesianNumber(row['paid_rounding'] || row['Jumlah Pembayaran ( Rp. ) - Pembulatan'] || 0)
        const paidDiscount = parseIndonesianNumber(row['paid_discount'] || row['Jumlah Pembayaran ( Rp. ) - Diskon'] || 0)
        const paidTax = parseIndonesianNumber(row['paid_tax'] || row['Jumlah Pembayaran ( Rp. ) - PPN'] || 0)
        const paidVoucherAmt = parseIndonesianNumber(row['paid_voucher_amt'] || row['Jumlah Pembayaran ( Rp. ) - Voucher'] || 0)
        const paidTotal = parseIndonesianNumber(row['paid_total'] || row['Jumlah Pembayaran ( Rp. ) - Total'] || 0)

        const receivableRegist = parseIndonesianNumber(row['receivable_regist'] || row['Jumlah Piutang ( Rp. ) - Karcis'] || 0)
        const receivableAction = parseIndonesianNumber(row['receivable_action'] || row['Jumlah Piutang ( Rp. ) - Tindakan'] || 0)
        const receivableLab = parseIndonesianNumber(row['receivable_lab'] || row['Jumlah Piutang ( Rp. ) - Laboratorium'] || 0)
        const receivableDrug = parseIndonesianNumber(row['receivable_drug'] || row['Jumlah Piutang ( Rp. ) - Obat'] || 0)
        const receivableAlkes = parseIndonesianNumber(row['receivable_alkes'] || row['Jumlah Piutang ( Rp. ) - Alkes'] || 0)
        const receivableMcu = parseIndonesianNumber(row['receivable_mcu'] || row['Jumlah Piutang ( Rp. ) - MCU'] || 0)
        const receivableRadio = parseIndonesianNumber(row['receivable_radio'] || row['Jumlah Piutang ( Rp. ) - Radiologi'] || 0)
        const receivableTotal = parseIndonesianNumber(row['receivable_total'] || row['Jumlah Piutang ( Rp. ) - Total'] || 0)

        // Format tanggal untuk patient & transaksi
        const trxDateFormatted = formatDateToYYYYMMDD(trxDate)

        // Cek apakah transaksi sudah ada (untuk menentukan apakah perlu increment visit_count)
        const [existingTransaction] = await sql`
          SELECT id FROM transactions
          WHERE clinic_id = ${clinic_id} 
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

        // Cari poly_id dari clinic_poly_mappings berdasarkan raw_poly_name (dari eclinic)
        let polyId: number | null = null
        if (polyclinic) {
          const [polyMapping] = await sql`
            SELECT master_poly_id 
            FROM clinic_poly_mappings
            WHERE clinic_id = ${clinic_id} 
              AND raw_poly_name = ${polyclinic}
            LIMIT 1
          `
          polyId = polyMapping ? (polyMapping as any).master_poly_id : null
        }

        // Cari insurance_type_id dari clinic_insurance_mappings berdasarkan raw_insurance_name (dari eclinic)
        let insuranceTypeId: number | null = null
        if (insuranceType) {
          const [insuranceMapping] = await sql`
            SELECT master_insurance_id 
            FROM clinic_insurance_mappings
            WHERE clinic_id = ${clinic_id} 
              AND raw_insurance_name = ${insuranceType}
            LIMIT 1
          `
          insuranceTypeId = insuranceMapping ? (insuranceMapping as any).master_insurance_id : null
        }

        // Insert atau update transaction (dengan ON CONFLICT untuk menghindari duplikasi)
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
            ${clinic_id}, NULL, ${polyId}, ${insuranceTypeId}, ${trxDateFormatted}, ${trxNo}, ${ermNo}, ${patientName},
            ${insuranceType}, ${polyclinic}, ${paymentMethod}, ${voucherCode === '-' ? null : voucherCode},
            ${billRegist}, ${billAction}, ${billLab}, ${billDrug}, ${billAlkes}, ${billMcu}, ${billRadio}, ${billTotal},
            ${billRegistDiscount}, ${billActionDiscount}, ${billLabDiscount}, ${billDrugDiscount}, ${billAlkesDiscount}, ${billMcuDiscount}, ${billRadioDiscount},
            ${coveredRegist}, ${coveredAction}, ${coveredLab}, ${coveredDrug}, ${coveredAlkes}, ${coveredMcu}, ${coveredRadio}, ${coveredTotal},
            ${paidRegist}, ${paidAction}, ${paidLab}, ${paidDrug}, ${paidAlkes}, ${paidMcu}, ${paidRadio},
            ${paidRounding}, ${paidDiscount}, ${paidTax}, ${paidVoucherAmt}, ${paidTotal},
            ${receivableRegist}, ${receivableAction}, ${receivableLab}, ${receivableDrug}, ${receivableAlkes},
            ${receivableMcu}, ${receivableRadio}, ${receivableTotal},
            ${JSON.stringify(row)}, 'manual'
          )
          ON CONFLICT (clinic_id, erm_no, trx_date, polyclinic, bill_total) 
          DO UPDATE SET
            trx_no = EXCLUDED.trx_no,
            patient_name = EXCLUDED.patient_name,
            insurance_type = EXCLUDED.insurance_type,
            payment_method = EXCLUDED.payment_method,
            voucher_code = EXCLUDED.voucher_code,
            raw_json_data = EXCLUDED.raw_json_data,
            input_type = 'manual',
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

        // Break data ke transactions_to_zains berdasarkan master_target_categories
        // Hanya ambil field "Jumlah Pembayaran" yang ada nilainya (tidak 0)
        // Mapping sesuai dengan nama di master_target_categories
        // Setiap kategori dikurangi diskonnya masing-masing jika ada (dengan Math.max untuk memastikan tidak negatif)
        const paidFields = [
          { key: 'Jumlah Pembayaran ( Rp. ) - Karcis', category: 'Karcis', value: billRegistDiscount > 0 ? Math.max(0, paidRegist - billRegistDiscount) : paidRegist },
          { key: 'Jumlah Pembayaran ( Rp. ) - Tindakan', category: 'Tindakan', value: billActionDiscount > 0 ? Math.max(0, paidAction - billActionDiscount) : paidAction },
          { key: 'Jumlah Pembayaran ( Rp. ) - Laboratorium', category: 'Laboratorium', value: billLabDiscount > 0 ? Math.max(0, paidLab - billLabDiscount) : paidLab },
          { key: 'Jumlah Pembayaran ( Rp. ) - Obat', category: 'Obat-obatan', value: billDrugDiscount > 0 ? Math.max(0, paidDrug - billDrugDiscount) : paidDrug },
          { key: 'Jumlah Pembayaran ( Rp. ) - Alkes', category: 'Alat Kesehatan', value: billAlkesDiscount > 0 ? Math.max(0, paidAlkes - billAlkesDiscount) : paidAlkes },
          { key: 'Jumlah Pembayaran ( Rp. ) - MCU', category: 'MCU', value: billMcuDiscount > 0 ? Math.max(0, paidMcu - billMcuDiscount) : paidMcu },
          { key: 'Jumlah Pembayaran ( Rp. ) - Radiologi', category: 'Radiologi', value: billRadioDiscount > 0 ? Math.max(0, paidRadio - billRadioDiscount) : paidRadio },
          { key: 'Jumlah Pembayaran ( Rp. ) - Pembulatan', category: 'Pembulatan', value: paidRounding },
        ]

        // Cari id_donatur dari patient jika ada (hanya dari patient yang SUDAH ada)
        const [patientData] = await sql`
          SELECT id_donatur_zains FROM patients 
          WHERE clinic_id = ${clinic_id} AND erm_no = ${ermNo}
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
                  AND tgl_transaksi = ${formatDateToYYYYMMDD(trxDate)}
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
                    ${formatDateToYYYYMMDD(trxDate)},
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
              console.warn(`⚠️  Category "${field.category}" tidak memiliki id_program_zains atau id_kantor_zains tidak tersedia`)
            }
          }
        }

        // Hanya jika transaksi ini benar-benar punya record di transactions_to_zains,
        // baru kita pastikan patient ada (insert/update) dan relasi patient_id di transactions diisi.
        if (transactionZainsInsertedCount > 0) {
          const ermNoForZains = `${clinic_id}${ermNo}`
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
              ${clinic_id},
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
        console.error('❌ Error processing transaction:', error.message, row)
        errors.push({ index: i, error: error.message, data: row })
        skippedCount++
      }
    }

    // Jika tidak ada data baru yang di-insert dan semua yang diskip adalah duplikat,
    // ubah pesan menjadi "transaksi sudah masuk"
    const allDuplicates =
      insertedCount === 0 &&
      skippedCount > 0 &&
      errors.length > 0 &&
      errors.every((e) =>
        typeof e.error === 'string' &&
        e.error.toLowerCase().includes('transaksi sudah masuk'),
      )

    const responsePayload = {
      success: true,
      message: allDuplicates
        ? 'Semua transaksi sudah masuk sebelumnya, tidak ada data baru yang diinsert'
        : 'Insert transaksi berhasil',
      data: {
        total_processed: transaction_data.length,
        inserted: insertedCount,
        zains_inserted: zainsInsertedCount,
        skipped: skippedCount,
        errors: errors.length > 0 ? errors : undefined,
      },
    }

    // Log request dan response ke system_logs
    try {
      await sql`
        INSERT INTO system_logs (clinic_id, process_type, status, message, payload)
        VALUES (
          ${clinic_id},
          'transactions_insert',
          'success',
          ${responsePayload.message},
          ${JSON.stringify({
            request: requestBody,
            response: responsePayload,
          })}::jsonb
        )
      `
    } catch (logErr: any) {
      console.error('Error logging transactions/insert to system_logs:', logErr?.message)
    }

    return NextResponse.json(responsePayload)
  } catch (error: any) {
    console.error('❌ Error:', error)
    // Log error ke system_logs (request body sudah consumed di try)
    try {
      await sql`
        INSERT INTO system_logs (clinic_id, process_type, status, message, payload)
        VALUES (
          NULL,
          'transactions_insert',
          'error',
          ${error.message || 'Unknown error occurred'},
          ${JSON.stringify({
            request: requestBody,
            response: null,
            error: error.message,
          })}::jsonb
        )
      `
    } catch (logErr: any) {
      console.error('Error logging transactions/insert error to system_logs:', logErr?.message)
    }
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error.message || 'Unknown error occurred'
      },
      { status: 500 }
    )
  }
}
