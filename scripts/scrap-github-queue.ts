import { chromium } from 'playwright'
import { sql } from '@/lib/db'

const GITHUB_RUN_ID = process.env.GITHUB_RUN_ID || process.env.RAILWAY_RUN_ID || 'manual'
const PROCESS_LIMIT = parseInt(process.env.PROCESS_LIMIT || '5')
const SCRAPERAPI_KEY = process.env.SCRAPERAPI_KEY
const USE_SCRAPERAPI = !!SCRAPERAPI_KEY

interface QueueItem {
  id: number
  clinic_id: number
  tgl_awal: string
  tgl_akhir: string
}

interface Clinic {
  id: number
  name: string
  location: string | null
  login_url: string | null
  username: string
  password_encrypted: string
  id_kantor_zains: string | null
  id_rekening: string | null
}

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

async function getQueueItem(): Promise<QueueItem | null> {
  const result = (await sql`
    SELECT * FROM scrap_queue
    WHERE status = 'pending'
    ORDER BY created_at ASC
    LIMIT 1
  `) as QueueItem[]
  return result.length > 0 ? result[0] : null
}

async function updateQueueStatus(
  queueId: number,
  status: 'processing' | 'completed' | 'failed',
  errorMessage?: string
) {
  const now = new Date()
  if (status === 'processing') {
    await sql`
      UPDATE scrap_queue
      SET 
        status = ${status},
        updated_at = ${now},
        started_at = COALESCE(started_at, ${now}),
        github_run_id = ${GITHUB_RUN_ID},
        error_message = ${errorMessage ?? null}
      WHERE id = ${queueId}
    `
  } else if (status === 'completed') {
    await sql`
      UPDATE scrap_queue
      SET 
        status = ${status},
        updated_at = ${now},
        completed_at = ${now},
        github_run_id = ${GITHUB_RUN_ID},
        error_message = ${errorMessage ?? null}
      WHERE id = ${queueId}
    `
  } else {
  await sql`
    UPDATE scrap_queue
    SET 
      status = ${status},
      updated_at = ${now},
        github_run_id = ${GITHUB_RUN_ID},
        error_message = ${errorMessage ?? null}
    WHERE id = ${queueId}
  `
  }
}

async function getClinicCredentials(clinicId: number): Promise<Clinic | null> {
  const result = (await sql`
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
    WHERE id = ${clinicId} AND is_active = true
  `) as Clinic[]
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

  const NAMA_KLINIK = clinic.location || clinic.name
  const USERNAME = clinic.username
  const PASSWORD = clinic.password_encrypted
  const URL_CLINIC = clinic.login_url || 'https://csf.eclinic.id/login'
  const ID_KANTOR_ZAINS = clinic.id_kantor_zains
  const ID_REKENING = clinic.id_rekening || null
  const clinic_id = clinic.id

  let browser: any = null
  try {
    console.log(`[v0] 🔧 HTTP proxy: ${USE_SCRAPERAPI ? 'ScraperAPI' : 'Direct'}`)

    // Launch browser dengan konfigurasi untuk Railway (optimized untuk limited resources)
    browser = await chromium.launch({
      headless: true,
      slowMo: 100, // Kurangi dari 500 ke 100 untuk lebih cepat (masih smooth)
      proxy: USE_SCRAPERAPI
        ? {
            server: 'http://proxy-server.scraperapi.com:8001',
            username: 'scraperapi',
            password: SCRAPERAPI_KEY!,
          }
        : undefined,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage', // Penting untuk Railway agar tidak kehabisan memory
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--disable-extensions',
        '--disable-background-networking',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
        '--disable-ipc-flooding-protection',
        '--memory-pressure-off', // Penting untuk Railway free tier
        '--max_old_space_size=512', // Limit memory usage untuk Railway
        // Jangan pakai --single-process di Railway (bisa lebih lambat)
      ],
    })
    console.log('[v0] ✅ Browser launched')

    const context = await browser.newContext({
      // Set user agent untuk bypass Cloudflare (mimic real browser)
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1920, height: 1080 },
      locale: 'id-ID',
      timezoneId: 'Asia/Jakarta',
      // ScraperAPI bertindak sebagai proxy dan melakukan TLS termination sendiri,
      // sehingga certificate chain bisa berbeda dari yang diharapkan browser normal.
      // ignoreHTTPSErrors=true diperlukan agar Playwright tidak memblokir dengan
      // net::ERR_CERT_AUTHORITY_INVALID ketika lewat proxy.
      ignoreHTTPSErrors: true,
      // JANGAN set extraHTTPHeaders - biarkan Playwright menggunakan header default browser
      // Semua header custom (Cache-Control, Upgrade-Insecure-Requests, dll) menyebabkan CORS error dengan Cloudflare Turnstile
      // Playwright secara default sudah mengirim header yang benar untuk browser Chrome
    })
    const page = await context.newPage()

    // JANGAN block resources - Cloudflare perlu semua resources untuk challenge verification
    // Blocking resources bisa membuat Cloudflare mendeteksi bot dan tidak melepaskan challenge
    
    // Set timeout
    page.setDefaultTimeout(120000) // Increase timeout untuk Cloudflare challenge (2 menit)
    page.setDefaultNavigationTimeout(120000)

    // Monitor console errors untuk debugging
    page.on('console', (msg: any) => {
      const type = msg.type()
      if (type === 'error') {
        console.log(`[v0] ⚠️  Console error: ${msg.text()}`)
      }
    })

    // playwright-extra-plugin-stealth sudah menangani semua anti-detection secara otomatis
    // Tidak perlu manual addInitScript lagi

    // 1. Navigate ke login page
    console.log(`[v0] 🌐 Navigating to eClinic: ${URL_CLINIC}`)
    try {
      // Gunakan 'domcontentloaded' agar tidak terlalu sensitif terhadap resource 400/timeout lewat proxy
      await page.goto(URL_CLINIC, { waitUntil: 'domcontentloaded', timeout: 60000 })
      console.log('[v0] ✅ Page navigation completed')
      
      // Wait untuk JavaScript execution (Cloudflare challenge butuh JS)
      await page.waitForTimeout(3000)
      console.log('[v0] ✅ Waiting for JavaScript execution...')
      
      // Wait untuk Turnstile widget jika ada
      try {
        await page.waitForSelector('iframe[src*="challenges.cloudflare.com"]', { timeout: 5000 }).catch(() => {})
        console.log('[v0] ✅ Turnstile widget detected')
      } catch (e) {
        // Turnstile mungkin tidak muncul atau sudah selesai
      }
    } catch (error: any) {
      console.error(`[v0] ❌ Failed to load page: ${error.message}`)
      throw new Error(`Failed to load page: ${error.message}`)
    }

    // Wait for Cloudflare challenge to complete
    console.log('[v0] ⏳ Waiting for Cloudflare challenge to complete...')
    let attempts = 0
    const maxAttempts = 120 // Max 120 detik (2 menit) - Cloudflare bisa butuh waktu lebih lama di Railway
    
    while (attempts < maxAttempts) {
      const pageTitle = await page.title()
      const currentURL = page.url()
      
      // Log setiap 5 detik atau 5 attempt pertama
      if (attempts % 5 === 0 || attempts < 5) {
        console.log(`[v0]    Attempt ${attempts + 1}/${maxAttempts}: Page title = "${pageTitle}", URL = "${currentURL}"`)
      }
      
      // Check jika ada form login (indikasi challenge selesai) - prioritas utama
      try {
        // Check multiple selectors untuk login form
        const clinicInput = page.locator('input[placeholder="Pilih Klinik"]')
        const usernameInput = page.locator('input[placeholder="ID Pengguna"]')
        
        const clinicVisible = await clinicInput.isVisible({ timeout: 2000 }).catch(() => false)
        const usernameVisible = await usernameInput.isVisible({ timeout: 2000 }).catch(() => false)
        
        if (clinicVisible || usernameVisible) {
          console.log(`[v0] ✅ Login form detected (clinic: ${clinicVisible}, username: ${usernameVisible}), Cloudflare challenge completed`)
          break
        }
      } catch (checkError) {
        // Form belum muncul, continue waiting
      }
      
      // Check jika URL berubah (indikasi redirect setelah challenge)
      if (currentURL !== URL_CLINIC && !currentURL.includes('/login')) {
        console.log(`[v0] ✅ URL changed to "${currentURL}", Cloudflare challenge likely completed`)
        break
      }
      
      // Check jika Cloudflare challenge sudah selesai berdasarkan page title
      // Cloudflare show "Just a moment..." (EN) atau "Tunggu sebentar..." (ID) saat challenge
      const titleLower = pageTitle?.toLowerCase() || ''
      const isCloudflareChallenge = 
        titleLower.includes('just a moment') ||
        titleLower.includes('tunggu sebentar') ||
        titleLower.includes('checking your browser') ||
        titleLower.includes('mengecek browser') ||
        pageTitle === 'Just a moment...' ||
        pageTitle === 'Tunggu sebentar...'
      
      if (pageTitle && !isCloudflareChallenge && pageTitle !== '') {
        console.log(`[v0] ✅ Cloudflare challenge completed. Page title: "${pageTitle}"`)
        break
      }
      
      // Human-like random delay (1-2 seconds)
      const delay = 1000 + Math.random() * 1000
      await page.waitForTimeout(delay)
      attempts++
    }
    
    if (attempts >= maxAttempts) {
      const finalTitle = await page.title()
      const finalURL = page.url()
      console.error(`[v0] ❌ Cloudflare challenge timeout after ${maxAttempts} seconds`)
      console.error(`[v0]    Final page title: "${finalTitle}"`)
      console.error(`[v0]    Final URL: ${finalURL}`)
      
      // Check page content untuk debugging
      try {
        const pageContent = await page.content()
        const hasCloudflareScript = pageContent.includes('cf-browser-verification') || 
                                   pageContent.includes('challenge-platform') ||
                                   pageContent.includes('cf-challenge')
        console.log(`[v0]    Has Cloudflare script: ${hasCloudflareScript}`)
        
        // Take screenshot untuk debugging
        await page.screenshot({ path: `/tmp/cloudflare-timeout-${clinic_id}-${Date.now()}.png`, fullPage: true })
        console.log('[v0] 📸 Screenshot saved for debugging')
      } catch (screenshotError) {
        console.error('[v0] ⚠️  Failed to take screenshot:', screenshotError)
      }
      
      throw new Error(`Cloudflare challenge did not complete within ${maxAttempts} seconds. Page stuck at: "${finalTitle}"`)
    }
    
    // Additional wait setelah challenge complete untuk memastikan page fully ready
    console.log('[v0] ⏳ Waiting additional 5 seconds for page to stabilize...')
    await page.waitForTimeout(5000)

    // Wait for page to be fully ready (networkidle atau load)
    try {
      await page.waitForLoadState('networkidle', { timeout: 30000 })
      console.log('[v0] ✅ Page network idle')
    } catch (idleError) {
      console.log('[v0] ⚠️  Network idle timeout, trying load state...')
      try {
        await page.waitForLoadState('load', { timeout: 10000 })
        console.log('[v0] ✅ Page loaded')
      } catch (loadError) {
        console.log('[v0] ⚠️  Load state timeout, continuing anyway...')
      }
    }
    console.log('[v0] ✅ Page fully ready')

    // 2. Pilih Klinik
    console.log(`[v0] 📝 Memilih klinik: ${NAMA_KLINIK}...`)
    try {
      // Check page title lagi - mungkin ada Cloudflare challenge kedua
      const currentTitle = await page.title()
      console.log(`[v0]    Current page title before clinic selection: "${currentTitle}"`)
      
      // Jika page title kembali ke "Tunggu sebentar...", wait lagi untuk challenge kedua
      const titleLower = currentTitle?.toLowerCase() || ''
      const isCloudflareChallengeAgain = 
        titleLower.includes('just a moment') ||
        titleLower.includes('tunggu sebentar') ||
        titleLower.includes('checking your browser') ||
        titleLower.includes('mengecek browser') ||
        currentTitle === 'Just a moment...' ||
        currentTitle === 'Tunggu sebentar...'
      
      if (isCloudflareChallengeAgain) {
        console.log('[v0] ⚠️  Cloudflare challenge detected again, waiting for second challenge to complete...')
        let secondAttempts = 0
        const maxSecondAttempts = 60 // Max 60 detik untuk challenge kedua
        
        while (secondAttempts < maxSecondAttempts) {
          const secondTitle = await page.title()
          
          if (secondAttempts % 5 === 0 || secondAttempts < 5) {
            console.log(`[v0]    Second challenge attempt ${secondAttempts + 1}/${maxSecondAttempts}: Page title = "${secondTitle}"`)
          }
          
          // Check jika form login muncul
          try {
            const clinicInput = page.locator('input[placeholder="Pilih Klinik"]')
            const isVisible = await clinicInput.isVisible({ timeout: 2000 }).catch(() => false)
            if (isVisible) {
              console.log('[v0] ✅ Second Cloudflare challenge completed, login form visible')
              break
            }
          } catch (checkError) {
            // Form belum muncul
          }
          
          // Check jika challenge selesai
          const secondTitleLower = secondTitle?.toLowerCase() || ''
          const isStillChallenge = 
            secondTitleLower.includes('just a moment') ||
            secondTitleLower.includes('tunggu sebentar') ||
            secondTitleLower.includes('checking your browser') ||
            secondTitleLower.includes('mengecek browser') ||
            secondTitle === 'Just a moment...' ||
            secondTitle === 'Tunggu sebentar...'
          
          if (!isStillChallenge && secondTitle !== '') {
            console.log(`[v0] ✅ Second Cloudflare challenge completed. Page title: "${secondTitle}"`)
            break
          }
          
          await page.waitForTimeout(1000)
          secondAttempts++
        }
        
        if (secondAttempts >= maxSecondAttempts) {
          console.error(`[v0] ❌ Second Cloudflare challenge timeout after ${maxSecondAttempts} seconds`)
        } else {
          // Wait additional time setelah challenge kedua selesai
          await page.waitForTimeout(3000)
          console.log('[v0] ✅ Waiting additional 3 seconds after second challenge...')
        }
      }
      
      // Wait for page to be fully interactive
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {
        console.log('[v0] ⚠️  Network idle timeout, continuing anyway...')
      })
      
      // Final check page title sebelum select clinic
      const finalTitle = await page.title()
      console.log(`[v0]    Final page title before clinic selection: "${finalTitle}"`)
      
      // Wait for the clinic selector to be visible (try multiple selectors)
      console.log('[v0] ⏳ Waiting for clinic selector...')
      let clinicInput
      
      try {
        // Try placeholder selector first
        await page.waitForSelector('input[placeholder="Pilih Klinik"]', { 
          state: 'visible', 
          timeout: 15000 
        })
        clinicInput = page.getByPlaceholder('Pilih Klinik')
        console.log('[v0] ✅ Clinic selector found (by placeholder)')
      } catch (placeholderError) {
        // Fallback: try by role or other selectors
        console.log('[v0] ⚠️  Placeholder selector not found, trying alternative selectors...')
        try {
          clinicInput = page.locator('input[type="text"]').first()
          await clinicInput.waitFor({ state: 'visible', timeout: 10000 })
          console.log('[v0] ✅ Clinic selector found (by input type)')
        } catch (altError) {
          // Last resort: get page content for debugging
          const pageContent = await page.content()
          console.error(`[v0] ❌ Could not find clinic selector. Page title: ${await page.title()}`)
          throw new Error(`Clinic selector not found. Tried placeholder and input[type="text"]`)
        }
      }

      await clinicInput.click({ timeout: 10000 })
      console.log('[v0] ✅ Clinic input clicked')
      
      // Clear any existing text first
      await clinicInput.clear({ timeout: 5000 }).catch(() => {})
      
      // Type instead of fill - autocomplete hanya muncul jika diketik, bukan di-paste
      console.log(`[v0] ⌨️  Typing clinic name: ${NAMA_KLINIK}...`)
      await clinicInput.type(NAMA_KLINIK, { delay: 100 }) // Delay 100ms per karakter untuk simulasi typing manusia
      console.log(`[v0] ✅ Clinic name typed: ${NAMA_KLINIK}`)
      
      // Wait for dropdown option to appear (autocomplete)
      await page.waitForTimeout(2000)
      
      // Try to click the clinic option
      try {
        await page.getByText(NAMA_KLINIK, { exact: false }).click({ timeout: 10000 })
        console.log(`[v0] ✅ Clinic selected: ${NAMA_KLINIK}`)
      } catch (clickError: any) {
        // Fallback: try pressing Enter
        console.log(`[v0] ⚠️  Could not click clinic option, trying Enter key...`)
        await clinicInput.press('Enter')
        await page.waitForTimeout(1000)
        console.log(`[v0] ✅ Clinic selected via Enter key: ${NAMA_KLINIK}`)
      }
    } catch (error: any) {
      console.error(`[v0] ❌ Error selecting clinic "${NAMA_KLINIK}": ${error.message}`)
      console.error(`[v0]    Error type: ${error.name || 'Unknown'}`)
      
      // Take screenshot for debugging
      try {
        const screenshotPath = `/tmp/clinic-select-error-${clinic_id}-${Date.now()}.png`
        await page.screenshot({ path: screenshotPath, fullPage: true })
        console.log(`[v0] 📸 Screenshot saved: ${screenshotPath}`)
        
        // Also log page URL and title
        console.log(`[v0] 📄 Current URL: ${page.url()}`)
        console.log(`[v0] 📄 Page title: ${await page.title()}`)
      } catch (screenshotError: any) {
        console.error(`[v0] ⚠️  Failed to take screenshot: ${screenshotError.message}`)
      }
      
      throw new Error(`Failed to select clinic "${NAMA_KLINIK}": ${error.message}`)
    }

    // 3. Login
    console.log(`[v0] 🔐 Melakukan login untuk user: ${USERNAME}...`)
    try {
      await page.waitForSelector('input[placeholder="ID Pengguna"]', { 
        state: 'visible', 
        timeout: 10000 
      })
      await page.getByPlaceholder('ID Pengguna').fill(USERNAME, { timeout: 10000 })
      console.log('[v0] ✅ Username filled')
      
      await page.getByPlaceholder('Kata Sandi').fill(PASSWORD, { timeout: 10000 })
      console.log('[v0] ✅ Password filled')
      
      await page.getByRole('button', { name: 'Login' }).click({ timeout: 10000 })
      console.log('[v0] ✅ Login button clicked')
    } catch (error: any) {
      console.error(`[v0] ❌ Error during login: ${error.message}`)
      throw new Error(`Failed to login: ${error.message}`)
    }

    await page.waitForURL('**/dashboard**', { timeout: 15000 }).catch(() => {
      console.log('[v0] ⚠️  Mungkin sudah di dashboard atau perlu menunggu lebih lama')
    })
    console.log('[v0] ✅ Login berhasil')

    // 4. Masuk Laporan Pendapatan Harian
    console.log('[v0] 📊 Membuka halaman laporan pendapatan harian...')
    await page.getByRole('button', { name: 'Laporan' }).click()
    await page.getByRole('link', { name: 'Laporan Pendapatan Harian' }).click()

    // 5. Set filter tanggal
    console.log('[v0] 📅 Mengatur filter tanggal...')
    // Gunakan tgl_awal dan tgl_akhir dari request
    const dateAwalFormatted = new Date(tglAwal)
    const dateAkhirFormatted = new Date(tglAkhir)
    await selectDate(page, dateAwalFormatted, true) // Tanggal awal
    await selectDate(page, dateAkhirFormatted, false) // Tanggal akhir

    // 6. Pilih filter (semua puskesmas/asuransi/ruangan)
    console.log('[v0] ✅ Mengaktifkan semua filter...')
    await page.locator('#selectAllPuskesmas').check()
    await page.locator('#selectAllAsuransi').check()
    await page.locator('#selectAllRuangan').check()

    // 7. Tampilkan data
    console.log('[v0] 🔍 Menampilkan data...')
    await page.getByRole('button', { name: 'Tampilkan' }).click()

    // 8. Scraping data
    console.log('[v0] ⏳ Menunggu tabel muncul...')
    try {
      await page.waitForSelector('table tbody tr', { timeout: 30000 })
    } catch (e) {
      console.log('[v0] ⚠️ Tidak menemukan baris data dalam 30 detik, lanjut dengan 0 row')
    }

    // Code evaluated in browser context, types cannot be inferred
    // @ts-ignore
    const dataScraped = await page.$eval('table', (table) => {
      // @ts-ignore
      // Bangun header multi-level (meng-handle colspan/rowspan)
      var headerRows = Array.from(table.querySelectorAll('thead tr'))
      // @ts-ignore
      var headerMatrix = []

      headerRows.forEach(function (row, rowIndex) {
        // @ts-ignore
        if (!headerMatrix[rowIndex]) headerMatrix[rowIndex] = []
        // @ts-ignore
        var cells = Array.from(row.children)
        var colIndex = 0

        cells.forEach(function (cell) {
          // @ts-ignore
          // Lompat ke kolom kosong berikutnya
          while (headerMatrix[rowIndex][colIndex]) {
            colIndex++
          }

          // @ts-ignore
          var rowSpan = parseInt(cell.getAttribute('rowspan') || '1', 10)
          // @ts-ignore
          var colSpan = parseInt(cell.getAttribute('colspan') || '1', 10)
          // @ts-ignore
          var text = (cell.innerText || '').trim()

          for (var r = 0; r < rowSpan; r++) {
            var targetRow = rowIndex + r
            // @ts-ignore
            if (!headerMatrix[targetRow]) headerMatrix[targetRow] = []
            for (var c = 0; c < colSpan; c++) {
              // @ts-ignore
              headerMatrix[targetRow][colIndex + c] = text
            }
          }

          colIndex += colSpan
        })
      })

      // Gabungkan header per kolom (parent - child - dst)
      // @ts-ignore
      var maxHeaderRow = headerMatrix.length
      // @ts-ignore
      var totalCols = headerMatrix[maxHeaderRow - 1].length
      // @ts-ignore
      var finalHeaders = []

      for (var col = 0; col < totalCols; col++) {
        var labels = []
        for (var rowIdx = 0; rowIdx < maxHeaderRow; rowIdx++) {
          // @ts-ignore
          var label = headerMatrix[rowIdx][col]
          if (label && labels.indexOf(label) === -1) {
            labels.push(label)
          }
        }
        // @ts-ignore
        finalHeaders[col] = labels.join(' - ') || ('Col ' + (col + 1))
      }

      // Scrap semua baris body
      // @ts-ignore
      var bodyRows = Array.from(table.querySelectorAll('tbody tr'))

      return bodyRows.map(function (tr) {
        // @ts-ignore
        var cells = Array.from(tr.querySelectorAll('td'))
        if (cells.length === 0) return null

        // @ts-ignore
        var rowData = {}
        // @ts-ignore
        finalHeaders.forEach(function (header, idx) {
          // @ts-ignore
          var cell = cells[idx]
          // @ts-ignore
          rowData[header] = cell && cell.innerText ? cell.innerText.trim() : ''
        })

        return rowData
      }).filter(function (row) { return row !== null })
    })

    console.log(`[v0] ✅ Berhasil mengambil ${dataScraped.length} baris data`)

    // 9. Ambil master_target_categories untuk mapping
    const categories = (await sql`
      SELECT name, id_program_zains 
      FROM master_target_categories
    `) as Array<{ name: string; id_program_zains: string }>
    const categoryMap: Record<string, string> = {}
    categories.forEach((cat) => {
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
          console.warn('[v0] ⚠️  Tanggal tidak valid, skip row:', row)
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
        // @ts-ignore
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

        // Insert atau update patient dengan logika first_visit_at, last_visit_at
        // visit_count akan di-increment setelah transaksi berhasil di-insert (hanya jika transaksi baru)
        const [insertedPatient] = await sql`
          INSERT INTO patients (
            clinic_id, 
            erm_no, 
            full_name, 
            first_visit_at, 
            last_visit_at, 
            visit_count
          )
          VALUES (
            ${clinic_id},
            ${ermNo},
            ${patientName},
            ${trxDateFormatted},
            ${trxDateFormatted},
            1
          )
          ON CONFLICT (clinic_id, erm_no) 
          DO UPDATE SET
            full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), patients.full_name),
            first_visit_at = LEAST(patients.first_visit_at, EXCLUDED.first_visit_at),
            last_visit_at = GREATEST(patients.last_visit_at, EXCLUDED.last_visit_at),
            updated_at = NOW()
          RETURNING id, visit_count
        `

        const patientId = insertedPatient ? (insertedPatient as any).id : null
        const patientVisitCount = insertedPatient ? (insertedPatient as any).visit_count : 0

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
        const [insertedTransaction] = await sql`
          INSERT INTO transactions (
            clinic_id, patient_id, poly_id, insurance_type_id, trx_date, trx_no, erm_no, patient_name,
            insurance_type, polyclinic, payment_method, voucher_code,
            bill_regist, bill_action, bill_lab, bill_drug, bill_alkes, bill_mcu, bill_radio, bill_total,
            covered_regist, covered_action, covered_lab, covered_drug, covered_alkes, covered_mcu, covered_radio, covered_total,
            paid_regist, paid_action, paid_lab, paid_drug, paid_alkes, paid_mcu, paid_radio, 
            paid_rounding, paid_discount, paid_tax, paid_voucher_amt, paid_total,
            receivable_regist, receivable_action, receivable_lab, receivable_drug, receivable_alkes, 
            receivable_mcu, receivable_radio, receivable_total,
            raw_json_data, input_type
          )
          VALUES (
            ${clinic_id}, ${patientId}, ${polyId}, ${insuranceTypeId}, ${formatDateToYYYYMMDD(trxDate)}, ${trxNo}, ${ermNo}, ${patientName},
            ${insuranceType}, ${polyclinic}, ${paymentMethod}, ${voucherCode === '-' ? null : voucherCode},
            ${billRegist}, ${billAction}, ${billLab}, ${billDrug}, ${billAlkes}, ${billMcu}, ${billRadio}, ${billTotal},
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

        // 12. Break data ke transactions_to_zains berdasarkan master_target_categories
        // Hanya ambil field "Jumlah Pembayaran" yang ada nilainya (tidak 0)
        // Mapping sesuai dengan nama di master_target_categories
        const paidFields = [
          { key: 'Jumlah Pembayaran ( Rp. ) - Karcis', category: 'Karcis', value: paidRegist },
          { key: 'Jumlah Pembayaran ( Rp. ) - Tindakan', category: 'Tindakan', value: paidAction },
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
          WHERE clinic_id = ${clinic_id} AND erm_no = ${ermNo}
          LIMIT 1
        `
        const idDonatur = patientData ? (patientData as any).id_donatur_zains : null

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
              }
            } else {
              console.warn(`[v0] ⚠️  Category "${field.category}" tidak memiliki id_program_zains atau id_kantor_zains tidak tersedia`)
            }
          }
        }
      } catch (error: any) {
        console.error('[v0] ❌ Error processing row:', error.message, row)
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
      tgl_awal: tglAwal,
      tgl_akhir: tglAkhir,
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

    console.log(`[v0] ✅ Selesai: ${insertedCount} transaksi inserted, ${zainsInsertedCount} records ke Zains, ${skippedCount} skipped`)

    await updateQueueStatus(queueId, 'completed')
    console.log(`[v0] ✅ Queue item #${queueId} completed`)
  } catch (error: any) {
    const errorMessage = error.message || 'Unknown error'
    const errorName = error.name || 'Error'
    
    console.error(`[v0] ❌ Error saat scraping untuk queue item #${queueId}:`)
    console.error(`[v0]    Error type: ${errorName}`)
    console.error(`[v0]    Error message: ${errorMessage}`)
    if (error.stack) {
      console.error(`[v0]    Stack trace: ${error.stack.split('\n').slice(0, 5).join('\n')}`)
    }
    
    // Log error ke system_logs dengan detail lengkap
    try {
      const errorPayload = {
        queue_id: queueId,
        tgl_awal: tglAwal || 'unknown',
        tgl_akhir: tglAkhir || 'unknown',
        clinic_id: clinic_id || null,
        clinic_name: clinic?.name || 'Unknown',
        error_name: errorName,
        error_message: errorMessage,
        error_stack: error.stack ? error.stack.split('\n').slice(0, 10).join('\n') : null,
        timestamp: new Date().toISOString(),
      }

      if (clinic_id) {
        await sql`
          INSERT INTO system_logs (clinic_id, process_type, status, message, payload)
          VALUES (
            ${clinic_id},
            'scraping',
            'error',
            ${`Scraping failed: ${errorName} - ${errorMessage}`},
            ${JSON.stringify(errorPayload)}
          )
        `
        console.log(`[v0] ✅ Error logged to system_logs for clinic_id: ${clinic_id}`)
      }
    } catch (logError: any) {
      console.error(`[v0] ❌ Error logging to system_logs: ${logError.message}`)
    }

    await updateQueueStatus(queueId, 'failed', errorMessage)
    throw error // Re-throw untuk di-handle di processQueue
  } finally {
    if (browser) {
      try {
        // Close browser
        await browser.close()
        console.log('[v0] 🔒 Browser ditutup')
      } catch (closeError: any) {
        console.error(`[v0] ⚠️  Error closing browser: ${closeError.message}`)
      }
    }
  }
}

async function processQueue() {
  console.log(`[v0] ========================================`)
  console.log(`[v0] Starting queue processor (limit: ${PROCESS_LIMIT})`)
  console.log(`[v0] ========================================`)

  let processed = 0
  let successCount = 0
  let failedCount = 0

  while (processed < PROCESS_LIMIT) {
    const startTime = Date.now()
    let queueItem: QueueItem | null = null
    
    try {
      queueItem = await getQueueItem()

      if (!queueItem) {
        console.log(`[v0] ℹ️  No pending queue items. Processed: ${processed}/${PROCESS_LIMIT}`)
        break
      }

      console.log(`[v0] ────────────────────────────────────────`)
      console.log(`[v0] Processing queue item #${queueItem.id}`)
      console.log(`[v0] Clinic ID: ${queueItem.clinic_id}`)
      console.log(`[v0] Period: ${queueItem.tgl_awal} to ${queueItem.tgl_akhir}`)
      console.log(`[v0] ────────────────────────────────────────`)

      await updateQueueStatus(queueItem.id, 'processing')

      const clinic = await getClinicCredentials(queueItem.clinic_id)
      if (!clinic) {
        const errorMsg = 'Clinic not found or credentials missing'
        console.error(`[v0] ❌ ${errorMsg}`)
        await updateQueueStatus(
          queueItem.id,
          'failed',
          errorMsg
        )
        failedCount++
        processed++
        continue
      }

      console.log(`[v0] ✅ Clinic found: ${clinic.name} (ID: ${clinic.id})`)
      
      try {
        await performScraping(queueItem.id, clinic, queueItem.tgl_awal, queueItem.tgl_akhir)
        const duration = Math.round((Date.now() - startTime) / 1000)
        console.log(`[v0] ✅ Queue item #${queueItem.id} completed successfully (${duration}s)`)
        successCount++
      } catch (scrapingError: any) {
        const errorMsg = scrapingError.message || 'Unknown scraping error'
        const duration = Math.round((Date.now() - startTime) / 1000)
        console.error(`[v0] ❌ Scraping failed for queue item #${queueItem.id} (${duration}s)`)
        console.error(`[v0]    Error: ${errorMsg}`)
        // Error sudah di-handle di performScraping (update status, log ke system_logs)
        failedCount++
      }

      processed++

      // Small delay between requests to avoid rate limiting
      if (processed < PROCESS_LIMIT) {
        console.log(`[v0] ⏳ Waiting 2 seconds before next item...`)
        await new Promise((resolve) => setTimeout(resolve, 2000))
      }
    } catch (error: any) {
      console.error(`[v0] ❌ Unexpected error in queue processor:`)
      console.error(`[v0]    Error: ${error.message}`)
      if (error.stack) {
        console.error(`[v0]    Stack: ${error.stack.split('\n').slice(0, 3).join('\n')}`)
      }
      
      if (queueItem) {
        await updateQueueStatus(
          queueItem.id,
          'failed',
          `Unexpected error: ${error.message}`
        )
        failedCount++
      }
      
      // Continue to next item instead of breaking
      processed++
      if (processed < PROCESS_LIMIT) {
        console.log(`[v0] ⏳ Waiting 2 seconds before retry...`)
        await new Promise((resolve) => setTimeout(resolve, 2000))
      }
    }
  }

  console.log(`[v0] ========================================`)
  console.log(`[v0] Queue processor finished`)
  console.log(`[v0] Total processed: ${processed}/${PROCESS_LIMIT}`)
  console.log(`[v0] ✅ Success: ${successCount}`)
  console.log(`[v0] ❌ Failed: ${failedCount}`)
  console.log(`[v0] ========================================`)
}

// Run the queue processor
processQueue().catch((error) => {
  console.error('[v0] Fatal error in queue processor:', error)
  process.exit(1)
})
