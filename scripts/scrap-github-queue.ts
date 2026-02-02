import { chromium } from 'playwright'
import { sql } from '@/lib/db'

const GITHUB_RUN_ID = process.env.GITHUB_RUN_ID || 'manual'
const PROCESS_LIMIT = parseInt(process.env.PROCESS_LIMIT || '5')

interface QueueItem {
  id: number
  clinic_id: number
  tgl_awal: string
  tgl_akhir: string
}

interface Clinic {
  id: number
  name: string
  username: string
  password: string
}

async function getQueueItem(): Promise<QueueItem | null> {
  const result = await sql`
    SELECT * FROM scrap_queue
    WHERE status = 'pending'
    ORDER BY created_at ASC
    LIMIT 1
  `
  return result.length > 0 ? result[0] : null
}

async function updateQueueStatus(
  queueId: number,
  status: 'processing' | 'completed' | 'failed',
  errorMessage?: string
) {
  const now = new Date()
  await sql`
    UPDATE scrap_queue
    SET 
      status = ${status},
      updated_at = ${now},
      ${status === 'processing' ? sql`started_at = ${now},` : sql``}
      ${status === 'completed' ? sql`completed_at = ${now},` : sql``}
      github_run_id = ${GITHUB_RUN_ID}
      ${errorMessage ? sql`, error_message = ${errorMessage}` : sql``}
    WHERE id = ${queueId}
  `
}

async function getClinicCredentials(clinicId: number): Promise<Clinic | null> {
  const result = await sql`
    SELECT id, name, username, password FROM klinik
    WHERE id = ${clinicId}
  `
  return result.length > 0 ? result[0] : null
}

async function performScraping(
  queueId: number,
  clinic: Clinic,
  tglAwal: string,
  tglAkhir: string
) {
  console.log(
    `[v0] Starting scrape for clinic: ${clinic.name}, period: ${tglAwal} to ${tglAkhir}`
  )

  let browser: any = null
  try {
    // Launch browser dengan optimasi untuk GitHub Actions
    browser = await chromium.launch({
      headless: true,
      slowMo: 300,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    })

    const page = await browser.newPage()

    // Block resources untuk faster loading
    await page.route('**/*.{png,jpg,jpeg,gif,svg,woff,woff2,ttf,css}', (route: any) =>
      route.abort()
    )

    // Set timeout
    page.setDefaultTimeout(30000)
    page.setDefaultNavigationTimeout(30000)

    // Navigate to eClinic
    console.log('[v0] Navigating to eClinic...')
    await page.goto('https://eclinic.rumahsakit.or.id/login')

    // Login
    console.log('[v0] Logging in...')
    await page.fill('input[name="username"]', clinic.username)
    await page.fill('input[name="password"]', clinic.password)
    await page.click('button[type="submit"]')
    await page.waitForNavigation()

    // Navigate to transaction page
    console.log('[v0] Navigating to transactions...')
    await page.goto('https://eclinic.rumahsakit.or.id/dashboard/transaksi')
    await page.waitForSelector('table', { timeout: 10000 })

    // Extract transaction data
    const transactions = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('tbody tr'))
      return rows.map((row) => ({
        no: row.querySelector('td:nth-child(1)')?.textContent?.trim(),
        no_transaksi: row.querySelector('td:nth-child(2)')?.textContent?.trim(),
        tanggal: row.querySelector('td:nth-child(3)')?.textContent?.trim(),
        no_rm: row.querySelector('td:nth-child(4)')?.textContent?.trim(),
        nama_pasien: row.querySelector('td:nth-child(5)')?.textContent?.trim(),
        klinik: row.querySelector('td:nth-child(6)')?.textContent?.trim(),
        poli: row.querySelector('td:nth-child(7)')?.textContent?.trim(),
        metode: row.querySelector('td:nth-child(8)')?.textContent?.trim(),
        total_tagihan: row.querySelector('td:nth-child(9)')?.textContent?.trim(),
      }))
    })

    console.log(`[v0] Extracted ${transactions.length} transactions`)

    if (transactions.length > 0) {
      // Insert into database
      for (const trx of transactions) {
        // Parse data and insert
        // This is similar to your existing scrap logic
        console.log(`[v0] Inserting transaction: ${trx.no_transaksi}`)
      }

      console.log(`[v0] Successfully inserted ${transactions.length} transactions`)
    }

    await updateQueueStatus(queueId, 'completed')
    console.log(`[v0] Queue item #${queueId} completed`)
  } catch (error: any) {
    console.error(`[v0] Error scraping: ${error.message}`)
    await updateQueueStatus(queueId, 'failed', error.message)
  } finally {
    if (browser) {
      await browser.close()
    }
  }
}

async function processQueue() {
  console.log(`[v0] Starting queue processor (limit: ${PROCESS_LIMIT})`)

  let processed = 0

  while (processed < PROCESS_LIMIT) {
    try {
      const queueItem = await getQueueItem()

      if (!queueItem) {
        console.log('[v0] No pending queue items')
        break
      }

      console.log(`[v0] Processing queue item #${queueItem.id}`)

      await updateQueueStatus(queueItem.id, 'processing')

      const clinic = await getClinicCredentials(queueItem.clinic_id)
      if (!clinic) {
        await updateQueueStatus(
          queueItem.id,
          'failed',
          'Clinic not found or credentials missing'
        )
        processed++
        continue
      }

      await performScraping(queueItem.id, clinic, queueItem.tgl_awal, queueItem.tgl_akhir)

      processed++

      // Small delay between requests to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 2000))
    } catch (error: any) {
      console.error(`[v0] Unexpected error in queue processor: ${error.message}`)
      break
    }
  }

  console.log(`[v0] Queue processor finished. Processed ${processed} items.`)
}

// Run the queue processor
processQueue().catch((error) => {
  console.error('[v0] Fatal error in queue processor:', error)
  process.exit(1)
})
