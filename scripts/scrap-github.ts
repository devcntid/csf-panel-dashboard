import { chromium } from 'playwright'
import { sql } from '@/lib/db'

interface ScrapConfig {
  username: string
  password: string
  clinic_name: string
  tgl_awal: string
  tgl_akhir: string
}

// Helper function untuk parse angka dengan koma (format Indonesia)
function parseIndonesianNumber(value: string | undefined): number {
  if (!value || value === '-' || value === '0') return 0
  const cleaned = value.replace(/,/g, '').trim()
  return parseFloat(cleaned) || 0
}

// Helper function untuk parse tanggal
function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null
  try {
    const date = new Date(dateStr)
    return isNaN(date.getTime()) ? null : date
  } catch {
    return null
  }
}

// Helper function untuk format tanggal
function formatDateToYYYYMMDD(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Optimized selectDate function
async function selectDate(page: any, date: Date, isStartDate: boolean) {
  const day = date.getDate()
  const month = date.getMonth() + 1
  const year = date.getFullYear()

  const dateStr = `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`

  try {
    if (isStartDate) {
      await page.getByText('Dari').click()
      await page.getByPlaceholder('Tanggal Awal').click()
      await page.waitForTimeout(300)
      await page.locator('#form_search span').first().click()
    } else {
      await page.getByText('Sampai').click()
      await page.getByPlaceholder('Tanggal Akhir').click()
      await page.waitForTimeout(300)
      await page.locator('#form_search i').nth(1).click()
    }

    await page.waitForTimeout(300)

    const monthNames = [
      'january',
      'february',
      'march',
      'april',
      'may',
      'june',
      'july',
      'august',
      'september',
      'october',
      'november',
      'december',
    ]
    const monthNamesId = [
      'januari',
      'februari',
      'maret',
      'april',
      'mei',
      'juni',
      'juli',
      'agustus',
      'september',
      'oktober',
      'november',
      'desember',
    ]

    let attempts = 0
    const maxAttempts = 24

    while (attempts < maxAttempts) {
      try {
        const currentViewText = await page.locator('.datepicker-days .datepicker-switch').textContent()

        if (currentViewText) {
          const parts = currentViewText.trim().toLowerCase().split(' ')
          const currentMonthName = parts[0]
          const currentYear = parseInt(parts[1])

          let currentMonth = monthNames.indexOf(currentMonthName) + 1
          if (currentMonth === 0) {
            currentMonth = monthNamesId.indexOf(currentMonthName) + 1
          }

          if (currentMonth === month && currentYear === year) {
            break
          }

          const monthDiff = (year - currentYear) * 12 + (month - currentMonth)

          if (monthDiff > 0) {
            await page.locator('.datepicker-days .next').click()
          } else {
            await page.locator('.datepicker-days .prev').click()
          }
        }
      } catch (e) {
        console.log(`Attempt ${attempts + 1} failed, retrying...`)
      }

      attempts++
      await page.waitForTimeout(200)
    }

    // Klik tanggal yang diminta
    await page.locator(`[data-day="${dateStr}"]`).click()
  } catch (error) {
    console.error(`Error selecting date: ${error}`)
  }
}

async function scrapeEclinic(config: ScrapConfig) {
  const { username, password, clinic_name, tgl_awal, tgl_akhir } = config

  console.log(
    `🚀 Starting scrape: ${clinic_name} from ${tgl_awal} to ${tgl_akhir}`
  )

  // Launch browser dengan optimisasi untuk CI/CD
  const browser = await chromium.launch({
    headless: true, // Always true in CI/CD
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-web-resources', // Block resource loading
    ],
  })

  const context = await browser.newContext({
    // Block resources untuk lebih cepat
    extraHTTPHeaders: {
      'Accept-Encoding': 'gzip',
    },
  })

  // Block image, CSS, font loading
  await context.route('**/*.{png,jpg,jpeg,gif,svg,webp}', (route) =>
    route.abort()
  )
  await context.route('**/*.css', (route) => route.abort())
  await context.route('**/*.{woff,woff2,ttf,otf}', (route) => route.abort())
  await context.route('**/analytics/**', (route) => route.abort())
  await context.route('**/tracking/**', (route) => route.abort())

  const page = await context.newPage()

  try {
    // Navigate to login
    console.log('📍 Navigating to login page...')
    await page.goto('https://csf.eclinic.id/login', {
      waitUntil: 'domcontentloaded', // Faster than 'load'
      timeout: 30000,
    })

    // Select clinic
    console.log('📝 Selecting clinic...')
    await page.getByPlaceholder('Pilih Klinik').click()
    await page.getByPlaceholder('Pilih Klinik').fill(clinic_name)
    await page.getByText(clinic_name).click()

    // Login
    console.log('🔐 Logging in...')
    await page.getByPlaceholder('ID Pengguna').fill(username)
    await page.getByPlaceholder('Kata Sandi').fill(password)
    await page.getByRole('button', { name: 'Login' }).click()

    await page.waitForURL('**/dashboard**', { timeout: 20000 }).catch(() => {
      console.log('⚠️  Already on dashboard or need to wait longer')
    })
    console.log('✅ Login successful')

    // Open Daily Income Report
    console.log('📊 Opening daily income report...')
    await page.getByRole('button', { name: 'Laporan' }).click()
    await page.getByRole('link', { name: 'Laporan Pendapatan Harian' }).click()

    // Enable filters
    console.log('✅ Enabling all filters...')
    await page.locator('#selectAllPuskesmas').check()
    await page.locator('#selectAllAsuransi').check()
    await page.locator('#selectAllRuangan').check()

    // Select date range
    console.log(`📅 Setting date range: ${tgl_awal} to ${tgl_akhir}`)
    const startDate = parseDate(tgl_awal)
    const endDate = parseDate(tgl_akhir)

    if (startDate) {
      await selectDate(page, startDate, true)
    }

    if (endDate) {
      await selectDate(page, endDate, false)
    }

    // Show data
    console.log('🔍 Fetching data...')
    await page.getByRole('button', { name: 'Tampilkan' }).click()

    // Wait for table
    console.log('⏳ Waiting for table...')
    await page.waitForSelector('table tbody tr', { timeout: 30000 })

    // Scrape data
    const dataScraped = await page.$eval('table', (table: any) => {
      var headerRows = Array.from(table.querySelectorAll('thead tr'))
      var headerMatrix: any[] = []

      headerRows.forEach(function (row: any, rowIndex: number) {
        if (!headerMatrix[rowIndex]) headerMatrix[rowIndex] = []
        var cells = Array.from(row.children)
        var colIndex = 0

        cells.forEach(function (cell: any) {
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

      var maxHeaderRow = headerMatrix.length
      var totalCols = headerMatrix[maxHeaderRow - 1].length
      var finalHeaders: any[] = []

      for (var col = 0; col < totalCols; col++) {
        var labels: any[] = []
        for (var rowIdx = 0; rowIdx < maxHeaderRow; rowIdx++) {
          var label = headerMatrix[rowIdx][col]
          if (label) labels.push(label)
        }
        finalHeaders[col] = labels.join(' ')
      }

      var rows: any[] = []
      var bodyRows = Array.from(table.querySelectorAll('tbody tr'))

      bodyRows.forEach(function (row: any) {
        var rowData: any = {}
        var cells = Array.from(row.querySelectorAll('td'))

        cells.forEach(function (cell: any, cellIndex: number) {
          var header = finalHeaders[cellIndex] || `Column ${cellIndex}`
          var value = (cell.innerText || '').trim()
          rowData[header] = value
        })

        if (Object.keys(rowData).length > 0) {
          rows.push(rowData)
        }
      })

      return { headers: finalHeaders, rows: rows }
    })

    console.log(`📊 Scraped ${dataScraped.rows.length} rows`)

    // Save to database
    if (dataScraped.rows.length > 0) {
      console.log('💾 Saving to database...')

      for (const row of dataScraped.rows) {
        try {
          const clinic = await sql`
            SELECT id FROM clinics WHERE name = ${clinic_name} LIMIT 1
          `

          if (!clinic || clinic.length === 0) {
            console.warn(`⚠️  Clinic not found: ${clinic_name}`)
            continue
          }

          const clinicId = clinic[0].id
          const tanggal = new Date().toISOString().split('T')[0]

          // Extract data
          const puskesmas = row['Puskesmas'] || row['PUSKESMAS'] || ''
          const asuransi = row['Asuransi'] || row['ASURANSI'] || ''
          const ruangan = row['Ruangan'] || row['RUANGAN'] || ''
          const totalPasien = parseIndonesianNumber(
            row['Total Pasien'] || row['TOTAL PASIEN']
          )
          const pendapatan = parseIndonesianNumber(
            row['Pendapatan'] || row['PENDAPATAN']
          )

          // Upsert to database
          await sql`
            INSERT INTO transactions 
            (clinic_id, tanggal, puskesmas, asuransi, ruangan, total_pasien, pendapatan)
            VALUES (${clinicId}, ${tanggal}, ${puskesmas}, ${asuransi}, ${ruangan}, ${totalPasien}, ${pendapatan})
            ON CONFLICT (clinic_id, tanggal, puskesmas, asuransi, ruangan)
            DO UPDATE SET total_pasien = ${totalPasien}, pendapatan = ${pendapatan}
          `
        } catch (error) {
          console.error(`Error processing row: ${error}`)
        }
      }

      console.log('✅ Data saved successfully')
    }
  } catch (error) {
    console.error(`❌ Scraping error: ${error}`)
    throw error
  } finally {
    await context.close()
    await browser.close()
  }
}

// Main function
async function main() {
  const config: ScrapConfig = {
    username: process.env.ECLINIC_USERNAME || '',
    password: process.env.ECLINIC_PASSWORD || '',
    clinic_name: 'PRATAMA CITA SEHAT JAKARTA',
    tgl_awal: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0],
    tgl_akhir: new Date().toISOString().split('T')[0],
  }

  if (!config.username || !config.password) {
    console.error('❌ Missing ECLINIC_USERNAME or ECLINIC_PASSWORD')
    process.exit(1)
  }

  try {
    await scrapeEclinic(config)
    console.log('✅ Scraping completed successfully')
  } catch (error) {
    console.error('❌ Scraping failed:', error)
    process.exit(1)
  }
}

main()
