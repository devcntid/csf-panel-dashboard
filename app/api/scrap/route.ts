import { NextRequest, NextResponse } from 'next/server'
import { chromium } from 'playwright'
import { sql } from '@/lib/db'
import { syncPatientToZainsWorkflow } from '@/lib/services/zains-sync'

// Check if we're running in Vercel (serverless environment without browser binaries)
const isVercelEnv = process.env.VERCEL === '1'

// Helper function untuk parse angka dengan koma (format Indonesia)
function parseIndonesianNumber(value: string | undefined): number {
  if (!value || value === '-' || value === '0') return 0
  // Hapus koma dan parse ke number
  const cleaned = value.replace(/,/g, '').trim()
  return parseFloat(cleaned) || 0
}

// Helper function untuk parse tanggal dari format "28 January 2026" ke Date
function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null
  try {
    // Format: "28 January 2026"
    const date = new Date(dateStr)
    return isNaN(date.getTime()) ? null : date
  } catch {
    return null
  }
}

// Helper function untuk format tanggal ke yyyy-mm-dd
function formatDateToYYYYMMDD(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Helper function untuk klik tanggal di calendar
async function selectDate(page: any, date: Date, isStartDate: boolean) {
  const day = date.getDate()
  const month = date.getMonth() + 1 // 1-12
  const year = date.getFullYear()
  
  // Format tanggal untuk data-day attribute (dd/mm/yyyy)
  const dateStr = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`
  
  try {
    // Klik field tanggal
    if (isStartDate) {
      await page.getByText('Dari').click()
      await page.getByPlaceholder('Tanggal Awal').click()
      // Tunggu calendar muncul
      await page.waitForTimeout(500)
      // Klik icon calendar
      await page.locator('#form_search span').first().click()
    } else {
      await page.getByText('Sampai').click()
      await page.getByPlaceholder('Tanggal Akhir').click()
      // Tunggu calendar muncul
      await page.waitForTimeout(500)
      // Klik icon calendar
      await page.locator('#form_search i').nth(1).click()
    }
    
    // Tunggu calendar muncul
    await page.waitForTimeout(500)
    
    // Navigate ke bulan dan tahun yang benar jika perlu
    // Cek bulan dan tahun saat ini di calendar
    const monthNames = ['january', 'february', 'march', 'april', 'may', 'june', 
                        'july', 'august', 'september', 'october', 'november', 'december']
    const monthNamesId = ['januari', 'februari', 'maret', 'april', 'mei', 'juni',
                         'juli', 'agustus', 'september', 'oktober', 'november', 'desember']
    
    let attempts = 0
    const maxAttempts = 24 // Maksimal 24 bulan (2 tahun) ke belakang/depan
    
    while (attempts < maxAttempts) {
      try {
        // Cek current month/year dari datepicker switch
        const currentViewText = await page.locator('.datepicker-days .datepicker-switch').textContent()
        
        if (currentViewText) {
          // Parse bulan dan tahun dari currentView (format: "January 2026" atau "Januari 2026")
          const parts = currentViewText.trim().toLowerCase().split(' ')
          const currentMonthName = parts[0]
          const currentYear = parseInt(parts[1])
          
          let currentMonth = monthNames.indexOf(currentMonthName) + 1
          if (currentMonth === 0) {
            currentMonth = monthNamesId.indexOf(currentMonthName) + 1
          }
          
          if (currentMonth === month && currentYear === year) {
            break // Sudah di bulan dan tahun yang benar
          }
          
          // Hitung selisih bulan
          const monthDiff = (year - currentYear) * 12 + (month - currentMonth)
          
          if (monthDiff > 0) {
            // Klik next month
            for (let i = 0; i < monthDiff && i < 12; i++) {
              await page.locator('.datepicker-days .next').click()
              await page.waitForTimeout(200)
            }
          } else if (monthDiff < 0) {
            // Klik prev month
            for (let i = 0; i < Math.abs(monthDiff) && i < 12; i++) {
              await page.locator('.datepicker-days .prev').click()
              await page.waitForTimeout(200)
            }
          }
        }
        
        await page.waitForTimeout(300)
        attempts++
        
        // Cek lagi apakah sudah di bulan/tahun yang benar
        const checkViewText = await page.locator('.datepicker-days .datepicker-switch').textContent()
        if (checkViewText) {
          const checkParts = checkViewText.trim().toLowerCase().split(' ')
          const checkMonthName = checkParts[0]
          const checkYear = parseInt(checkParts[1])
          
          let checkMonth = monthNames.indexOf(checkMonthName) + 1
          if (checkMonth === 0) {
            checkMonth = monthNamesId.indexOf(checkMonthName) + 1
          }
          
          if (checkMonth === month && checkYear === year) {
            break
          }
        }
      } catch (navError) {
        console.warn(`⚠️  Error navigasi calendar: ${navError}`)
        break
      }
    }
    
    // Tunggu calendar update
    await page.waitForTimeout(500)
    
    // Pilih tanggal menggunakan data-day attribute untuk menghindari ambiguity
    // Format data-day: "dd/mm/yyyy"
    const dateSelector = `td[data-day="${dateStr}"]`
    const dateElement = page.locator(dateSelector)
    
    // Cek apakah elemen ada dan visible
    const count = await dateElement.count()
    if (count > 0) {
      await dateElement.first().click()
    } else {
      // Fallback: gunakan selector yang lebih spesifik - hanya tanggal di bulan aktif (bukan .old atau .new)
      await page.locator(`td.day:not(.old):not(.new)`).filter({ hasText: String(day) }).first().click()
    }
    
    // Tunggu calendar tertutup
    await page.waitForTimeout(300)
  } catch (error) {
    console.warn(`⚠️  Error saat select date: ${error}`)
    // Fallback: coba langsung isi field dengan format dd-mm-yyyy (sesuai UI)
    try {
      const dateFormatted = `${String(day).padStart(2, '0')}-${String(month).padStart(2, '0')}-${String(year)}`
      if (isStartDate) {
        await page.getByPlaceholder('Tanggal Awal').fill(dateFormatted)
      } else {
        await page.getByPlaceholder('Tanggal Akhir').fill(dateFormatted)
      }
      await page.waitForTimeout(300)
    } catch (fallbackError) {
      console.warn(`⚠️  Fallback juga gagal: ${fallbackError}`)
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    // Parse request body dengan error handling
    let body
    try {
      const text = await request.text()
      if (!text || text.trim() === '') {
        return NextResponse.json(
          { 
            error: 'Request body is empty', 
            details: 'Request body harus berisi JSON dengan clinic_id dan tanggal'
          },
          { status: 400 }
        )
      }
      body = JSON.parse(text)
    } catch (parseError: any) {
      console.error('❌ Error parsing request body:', parseError)
      return NextResponse.json(
        { 
          error: 'Invalid JSON in request body', 
          details: parseError.message || 'Request body must be valid JSON. Pastikan Content-Type: application/json dan format JSON valid. Contoh: {"clinic_id": 1, "tanggal": "2026-01-28"}'
        },
        { status: 400 }
      )
    }

    const { clinic_id, tgl_awal, tgl_akhir } = body || {}

    // Validasi input
    if (!clinic_id || !tgl_awal || !tgl_akhir) {
      return NextResponse.json(
        { error: 'clinic_id, tgl_awal, dan tgl_akhir harus diisi' },
        { status: 400 }
      )
    }

    // Validasi format tanggal (yyyy-mm-dd)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(tgl_awal) || !dateRegex.test(tgl_akhir)) {
      return NextResponse.json(
        { error: 'Format tanggal harus yyyy-mm-dd' },
        { status: 400 }
      )
    }

    // Parse tanggal
    const dateAwal = new Date(tgl_awal)
    const dateAkhir = new Date(tgl_akhir)
    if (isNaN(dateAwal.getTime()) || isNaN(dateAkhir.getTime())) {
      return NextResponse.json(
        { error: 'Tanggal tidak valid' },
        { status: 400 }
      )
    }

    // Validasi tgl_awal tidak boleh lebih besar dari tgl_akhir
    if (dateAwal > dateAkhir) {
      return NextResponse.json(
        { error: 'Tanggal awal tidak boleh lebih besar dari tanggal akhir' },
        { status: 400 }
      )
    }

    // Ambil data clinic dari database
    const [clinic] = await sql`
      SELECT 
        id, 
        name, 
        location, 
        login_url, 
        username, 
        password_encrypted,
        id_kantor_zains,
        id_rekening
      FROM clinics 
      WHERE id = ${clinic_id} AND is_active = true
    `

    if (!clinic) {
      return NextResponse.json(
        { error: 'Clinic tidak ditemukan atau tidak aktif' },
        { status: 404 }
      )
    }

    const NAMA_KLINIK = clinic.location || clinic.name
    const USERNAME = clinic.username
    const PASSWORD = clinic.password_encrypted // Asumsi tidak perlu decrypt
    const URL_CLINIC = clinic.login_url || 'https://csf.eclinic.id/login'
    const ID_KANTOR_ZAINS = clinic.id_kantor_zains
    const ID_REKENING = (clinic as any).id_rekening || null

    console.log(`🚀 Memulai scraping untuk klinik: ${clinic.name}, tanggal: ${tgl_awal} sampai ${tgl_akhir}`)

    // Check if Playwright browsers are available
    if (isVercelEnv) {
      return NextResponse.json(
        {
          error: 'Scrap API tidak tersedia di environment Vercel (Playwright browsers tidak terinstall)',
          message: 'Silakan jalankan command berikut secara lokal: npm run playwright:install, kemudian deploy kembali',
        },
        { status: 503 }
      )
    }

    // Launch browser dengan konfigurasi untuk serverless environment
    const browser = await chromium.launch({
      headless: true,
      slowMo: 500,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage', // Penting untuk serverless agar tidak kehabisan memory
        '--disable-gpu',
        '--single-process', // Hanya untuk development/testing
      ],
    })

    const context = await browser.newContext()
    const page = await context.newPage()

    try {
      // 1. Navigate ke login page
      await page.goto(URL_CLINIC)
      console.log('✅ Halaman login dimuat')

      // 2. Pilih Klinik
      console.log('📝 Memilih klinik...')
      await page.getByPlaceholder('Pilih Klinik').click()
      await page.getByPlaceholder('Pilih Klinik').fill(NAMA_KLINIK)
      await page.getByText(NAMA_KLINIK).click()

      // 3. Login
      console.log('🔐 Melakukan login...')
      await page.getByPlaceholder('ID Pengguna').fill(USERNAME)
      await page.getByPlaceholder('Kata Sandi').fill(PASSWORD)
      await page.getByRole('button', { name: 'Login' }).click()

      await page.waitForURL('**/dashboard**', { timeout: 15000 }).catch(() => {
        console.log('⚠️  Mungkin sudah di dashboard atau perlu menunggu lebih lama')
      })
      console.log('✅ Login berhasil')

      // 4. Masuk Laporan Pendapatan Harian
      console.log('📊 Membuka halaman laporan pendapatan harian...')
      await page.getByRole('button', { name: 'Laporan' }).click()
      await page.getByRole('link', { name: 'Laporan Pendapatan Harian' }).click()

      // 5. Set filter tanggal
      console.log('📅 Mengatur filter tanggal...')
      // Gunakan tgl_awal dan tgl_akhir dari request
      const dateAwalFormatted = new Date(tgl_awal)
      const dateAkhirFormatted = new Date(tgl_akhir)
      await selectDate(page, dateAwalFormatted, true) // Tanggal awal
      await selectDate(page, dateAkhirFormatted, false) // Tanggal akhir

      // 6. Pilih filter (semua puskesmas/asuransi/ruangan)
      console.log('✅ Mengaktifkan semua filter...')
      await page.locator('#selectAllPuskesmas').check()
      await page.locator('#selectAllAsuransi').check()
      await page.locator('#selectAllRuangan').check()

      // 7. Tampilkan data
      console.log('🔍 Menampilkan data...')
      await page.getByRole('button', { name: 'Tampilkan' }).click()

      // 8. Scraping data
      console.log('⏳ Menunggu tabel muncul...')
      try {
        await page.waitForSelector('table tbody tr', { timeout: 30000 })
      } catch (e) {
        console.log('⚠️ Tidak menemukan baris data dalam 30 detik, lanjut dengan 0 row')
      }

      const dataScraped = await page.$eval('table', (table) => {
        // Bangun header multi-level (meng-handle colspan/rowspan)
        var headerRows = Array.from(table.querySelectorAll('thead tr'))
        var headerMatrix = []

        headerRows.forEach(function (row, rowIndex) {
          if (!headerMatrix[rowIndex]) headerMatrix[rowIndex] = []
          var cells = Array.from(row.children)
          var colIndex = 0

          cells.forEach(function (cell) {
            // Lompat ke kolom kosong berikutnya
            while (headerMatrix[rowIndex][colIndex]) {
              colIndex++
            }

            var rowSpan = parseInt(cell.getAttribute('rowspan') || '1', 10)
            var colSpan = parseInt(cell.getAttribute('colspan') || '1', 10)
            var text = (cell.innerText || '').trim()

            for (var r = 0; r < rowSpan; r++) {
              var targetRow = rowIndex + r
              if (!headerMatrix[targetRow]) headerMatrix[targetRow] = []
              for (var c = 0; c < colSpan; c++) {
                headerMatrix[targetRow][colIndex + c] = text
              }
            }

            colIndex += colSpan
          })
        })

        // Gabungkan header per kolom (parent - child - dst)
        var maxHeaderRow = headerMatrix.length
        var totalCols = headerMatrix[maxHeaderRow - 1].length
        var finalHeaders = []

        for (var col = 0; col < totalCols; col++) {
          var labels = []
          for (var rowIdx = 0; rowIdx < maxHeaderRow; rowIdx++) {
            var label = headerMatrix[rowIdx][col]
            if (label && labels.indexOf(label) === -1) {
              labels.push(label)
            }
          }
          finalHeaders[col] = labels.join(' - ') || ('Col ' + (col + 1))
        }

        // Scrap semua baris body
        var bodyRows = Array.from(table.querySelectorAll('tbody tr'))

        return bodyRows.map(function (tr) {
          var cells = Array.from(tr.querySelectorAll('td'))
          if (cells.length === 0) return null

          var rowData = {}
          finalHeaders.forEach(function (header, idx) {
            var cell = cells[idx]
            rowData[header] = cell && cell.innerText ? cell.innerText.trim() : ''
          })

          return rowData
        }).filter(function (row) { return row !== null })
      })

      console.log(`✅ Berhasil mengambil ${dataScraped.length} baris data`)

      // 9. Ambil master_target_categories untuk mapping
      const categories = await sql`
        SELECT name, id_program_zains 
        FROM master_target_categories
      `
      const categoryMap: Record<string, string> = {}
      categories.forEach((cat: any) => {
        categoryMap[cat.name] = cat.id_program_zains
      })

      // 10. Tidak perlu ambil master_polies langsung
      // Akan dicari via clinic_poly_mappings per transaksi

      // 11. Process dan insert data ke transactions
      let insertedCount = 0
      let skippedCount = 0
      let zainsInsertedCount = 0

      for (const row of dataScraped) {
        try {
          // Parse data dari row
          const trxDate = parseDate(row['Tanggal'] || '')
          if (!trxDate) {
            console.warn('⚠️  Tanggal tidak valid, skip row:', row)
            skippedCount++
            continue
          }

          const trxNo = row['No Transaksi'] || ''
          const ermNo = row['No. eRM'] || ''
          const patientName = row['Nama Pasien'] || ''
          const insuranceType = row['Asuransi'] || ''
          const polyclinic = row['Ruangan / Poli'] || ''
          const paymentMethod = row['Metode Pembayaran'] || ''
          const voucherCode = row['Voucher'] || '-'

          // Parse semua field jumlah
          const billRegist = parseIndonesianNumber(row['Jumlah Tagihan ( Rp. ) - Karcis'])
          const billAction = parseIndonesianNumber(row['Jumlah Tagihan ( Rp. ) - Tindakan'])
          const billLab = parseIndonesianNumber(row['Jumlah Tagihan ( Rp. ) - Laboratorium'])
          const billDrug = parseIndonesianNumber(row['Jumlah Tagihan ( Rp. ) - Obat'])
          const billAlkes = parseIndonesianNumber(row['Jumlah Tagihan ( Rp. ) - Alkes'])
          const billMcu = parseIndonesianNumber(row['Jumlah Tagihan ( Rp. ) - MCU'])
          const billRadio = parseIndonesianNumber(row['Jumlah Tagihan ( Rp. ) - Radiologi'])
          const billTotal = parseIndonesianNumber(row['Jumlah Tagihan ( Rp. ) - Total'])

          // Parse diskon tagihan
          const billRegistDiscount = parseIndonesianNumber(row['Diskon Tagihan ( Rp. ) - Karcis'] || 0)
          const billActionDiscount = parseIndonesianNumber(row['Diskon Tagihan ( Rp. ) - Tindakan'] || 0)
          const billLabDiscount = parseIndonesianNumber(row['Diskon Tagihan ( Rp. ) - Laboratorium'] || 0)
          const billDrugDiscount = parseIndonesianNumber(row['Diskon Tagihan ( Rp. ) - Obat'] || 0)
          const billAlkesDiscount = parseIndonesianNumber(row['Diskon Tagihan ( Rp. ) - Alkes'] || 0)
          const billMcuDiscount = parseIndonesianNumber(row['Diskon Tagihan ( Rp. ) - MCU'] || 0)
          const billRadioDiscount = parseIndonesianNumber(row['Diskon Tagihan ( Rp. ) - Radiologi'] || 0)

          const coveredRegist = parseIndonesianNumber(row['Jumlah Jaminan ( Rp. ) - Karcis'])
          const coveredAction = parseIndonesianNumber(row['Jumlah Jaminan ( Rp. ) - Tindakan'])
          const coveredLab = parseIndonesianNumber(row['Jumlah Jaminan ( Rp. ) - Laboratorium'])
          const coveredDrug = parseIndonesianNumber(row['Jumlah Jaminan ( Rp. ) - Obat'])
          const coveredAlkes = parseIndonesianNumber(row['Jumlah Jaminan ( Rp. ) - Alkes'])
          const coveredMcu = parseIndonesianNumber(row['Jumlah Jaminan ( Rp. ) - MCU'])
          const coveredRadio = parseIndonesianNumber(row['Jumlah Jaminan ( Rp. ) - Radiologi'])
          const coveredTotal = parseIndonesianNumber(row['Jumlah Jaminan ( Rp. ) - Total'])

          const paidRegist = parseIndonesianNumber(row['Jumlah Pembayaran ( Rp. ) - Karcis'])
          const paidAction = parseIndonesianNumber(row['Jumlah Pembayaran ( Rp. ) - Tindakan'])
          const paidLab = parseIndonesianNumber(row['Jumlah Pembayaran ( Rp. ) - Laboratorium'])
          const paidDrug = parseIndonesianNumber(row['Jumlah Pembayaran ( Rp. ) - Obat'])
          const paidAlkes = parseIndonesianNumber(row['Jumlah Pembayaran ( Rp. ) - Alkes'])
          const paidMcu = parseIndonesianNumber(row['Jumlah Pembayaran ( Rp. ) - MCU'])
          const paidRadio = parseIndonesianNumber(row['Jumlah Pembayaran ( Rp. ) - Radiologi'])
          const paidRounding = parseIndonesianNumber(row['Jumlah Pembayaran ( Rp. ) - Pembulatan'])
          const paidDiscount = parseIndonesianNumber(row['Jumlah Pembayaran ( Rp. ) - Diskon'])
          const paidTax = parseIndonesianNumber(row['Jumlah Pembayaran ( Rp. ) - PPN'])
          const paidVoucherAmt = parseIndonesianNumber(row['Jumlah Pembayaran ( Rp. ) - Voucher'])
          const paidTotal = parseIndonesianNumber(row['Jumlah Pembayaran ( Rp. ) - Total'])

          const receivableRegist = parseIndonesianNumber(row['Jumlah Piutang ( Rp. ) - Karcis'])
          const receivableAction = parseIndonesianNumber(row['Jumlah Piutang ( Rp. ) - Tindakan'])
          const receivableLab = parseIndonesianNumber(row['Jumlah Piutang ( Rp. ) - Laboratorium'])
          const receivableDrug = parseIndonesianNumber(row['Jumlah Piutang ( Rp. ) - Obat'])
          const receivableAlkes = parseIndonesianNumber(row['Jumlah Piutang ( Rp. ) - Alkes'])
          const receivableMcu = parseIndonesianNumber(row['Jumlah Piutang ( Rp. ) - MCU'])
          const receivableRadio = parseIndonesianNumber(row['Jumlah Piutang ( Rp. ) - Radiologi'])
          const receivableTotal = parseIndonesianNumber(row['Jumlah Piutang ( Rp. ) - Total'])

          // Format tanggal untuk patient
          const trxDateFormatted = formatDateToYYYYMMDD(trxDate)

          // Cek apakah transaksi sudah ada (untuk menentukan apakah perlu increment visit_count)
          const [existingTransaction] = await sql`
            SELECT id FROM transactions
            WHERE clinic_id = ${clinic_id} 
              AND erm_no = ${ermNo}
              AND trx_date = ${formatDateToYYYYMMDD(trxDate)}
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
              ${clinic_id}, NULL, ${polyId}, ${insuranceTypeId}, ${formatDateToYYYYMMDD(trxDate)}, ${trxNo}, ${ermNo}, ${patientName},
              ${insuranceType}, ${polyclinic}, ${paymentMethod}, ${voucherCode === '-' ? null : voucherCode},
              ${billRegist}, ${billAction}, ${billLab}, ${billDrug}, ${billAlkes}, ${billMcu}, ${billRadio}, ${billTotal},
              ${billRegistDiscount}, ${billActionDiscount}, ${billLabDiscount}, ${billDrugDiscount}, ${billAlkesDiscount}, ${billMcuDiscount}, ${billRadioDiscount},
              ${coveredRegist}, ${coveredAction}, ${coveredLab}, ${coveredDrug}, ${coveredAlkes}, ${coveredMcu}, ${coveredRadio}, ${coveredTotal},
              ${paidRegist}, ${paidAction}, ${paidLab}, ${paidDrug}, ${paidAlkes}, ${paidMcu}, ${paidRadio},
              ${paidRounding}, ${paidDiscount}, ${paidTax}, ${paidVoucherAmt}, ${paidTotal},
              ${receivableRegist}, ${receivableAction}, ${receivableLab}, ${receivableDrug}, ${receivableAlkes},
              ${receivableMcu}, ${receivableRadio}, ${receivableTotal},
              ${JSON.stringify(row)}, 'scrap'
            )
            ON CONFLICT (clinic_id, erm_no, trx_date, polyclinic, bill_total) 
            DO UPDATE SET
              trx_no = EXCLUDED.trx_no,
              patient_name = EXCLUDED.patient_name,
              insurance_type = EXCLUDED.insurance_type,
              payment_method = EXCLUDED.payment_method,
              voucher_code = EXCLUDED.voucher_code,
              raw_json_data = EXCLUDED.raw_json_data,
              input_type = 'scrap',
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

          // 12. Break data ke transactions_to_zains berdasarkan master_target_categories
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
          console.error('❌ Error processing row:', error.message, row)
          skippedCount++
        }
      }

      // Update last_scraped_at di clinic
      await sql`
        UPDATE clinics 
        SET last_scraped_at = NOW(), updated_at = NOW()
        WHERE id = ${clinic_id}
      `

      // Log hasil scraping ke system_logs dengan detail lengkap
      const logPayload = {
        tgl_awal,
        tgl_akhir,
        clinic_id,
        clinic_name: clinic.name,
        total_scraped: dataScraped.length,
        inserted: insertedCount,
        zains_inserted: zainsInsertedCount,
        skipped: skippedCount,
        timestamp: new Date().toISOString(),
      }

      await sql`
        INSERT INTO system_logs (clinic_id, process_type, status, message, payload)
        VALUES (
          ${clinic_id},
          'scraping',
          'success',
          ${`Berhasil scraping ${insertedCount} transaksi, ${zainsInsertedCount} records ke Zains, ${skippedCount} skipped`},
          ${JSON.stringify(logPayload)}
        )
      `

      console.log(`✅ Selesai: ${insertedCount} transaksi inserted, ${zainsInsertedCount} records ke Zains, ${skippedCount} skipped`)

      return NextResponse.json({
        success: true,
        message: 'Scraping berhasil',
        insertedCount,
        data: {
          total_scraped: dataScraped.length,
          inserted: insertedCount,
          zains_inserted: zainsInsertedCount,
          skipped: skippedCount,
        },
      })
    } catch (error: any) {
      console.error('❌ Error saat scraping:', error)
      
      // Log error ke system_logs dengan detail lengkap (jika clinic_id sudah terdefinisi)
      try {
        const errorPayload = {
          tgl_awal: tgl_awal || 'unknown',
          tgl_akhir: tgl_akhir || 'unknown',
          clinic_id: clinic_id || null,
          clinic_name: clinic?.name || 'Unknown',
          error: error.message || 'Unknown error',
          stack: error.stack,
          timestamp: new Date().toISOString(),
        }

        if (clinic_id) {
          await sql`
            INSERT INTO system_logs (clinic_id, process_type, status, message, payload)
            VALUES (
              ${clinic_id},
              'scraping',
              'error',
              ${error.message || 'Unknown error'},
              ${JSON.stringify(errorPayload)}
            )
          `
        }
      } catch (logError) {
        console.error('❌ Error logging to system_logs:', logError)
      }

      return NextResponse.json(
        { error: 'Error saat scraping', details: error.message },
        { status: 500 }
      )
    } finally {
      await browser.close()
      console.log('🔒 Browser ditutup')
    }
  } catch (error: any) {
    console.error('❌ Error:', error)
    
    // Handle JSON parsing error dengan lebih spesifik
    if (error.message && error.message.includes('JSON')) {
      return NextResponse.json(
        { 
          error: 'Invalid request body', 
          details: error.message || 'Request body must be valid JSON. Pastikan Content-Type: application/json dan body berformat JSON yang valid.'
        },
        { status: 400 }
      )
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
