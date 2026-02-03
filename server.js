// Railway Worker Server untuk Scrap Queue
// Server ini menerima HTTP request untuk trigger scrap queue worker
// Bisa dipanggil dari Vercel (insidental) atau Railway Cron (scheduled)

const http = require('http')
const { spawn } = require('child_process')
const path = require('path')

// Railway akan auto-assign PORT via environment variable
// JANGAN set PORT manual di Railway env vars, biarkan Railway auto-assign
// Default ke 3001 hanya untuk local development
const PORT = process.env.PORT || 3001

// Log PORT untuk debugging
console.log('[Railway Worker] Starting server...')
console.log('[Railway Worker] PORT from env:', process.env.PORT)
console.log('[Railway Worker] Using PORT:', PORT)

// Validate PORT
if (!PORT || isNaN(parseInt(PORT))) {
  console.error('[Railway Worker] ERROR: PORT environment variable tidak valid:', PORT)
  process.exit(1)
}
const PROCESS_LIMIT = process.env.PROCESS_LIMIT || '6'

// Flag untuk prevent concurrent execution
let isProcessing = false

// Optimasi untuk Railway Free: Auto-sleep setelah idle
const IDLE_TIMEOUT = parseInt(process.env.IDLE_TIMEOUT || '300000') // 5 menit default (300000 ms)
let lastRequestTime = Date.now()
let idleCheckInterval = null

// Function untuk check idle dan prepare sleep
function checkIdleAndSleep() {
  const now = Date.now()
  const idleTime = now - lastRequestTime

  if (idleTime > IDLE_TIMEOUT && !isProcessing) {
    console.log(`[Railway Worker] Idle for ${Math.round(idleTime / 1000)}s, service will sleep soon`)
    console.log('[Railway Worker] Service akan auto-sleep. Wake via HTTP request ke /health atau /trigger')
    // Railway akan auto-sleep service yang idle
    // Service akan wake otomatis saat ada HTTP request
  }
}

// Start idle check (setiap 1 menit)
function startIdleCheck() {
  if (idleCheckInterval) {
    clearInterval(idleCheckInterval)
  }
  idleCheckInterval = setInterval(checkIdleAndSleep, 60000) // Check setiap 1 menit
  console.log(`[Railway Worker] Idle check started (timeout: ${IDLE_TIMEOUT / 1000}s)`)
}

async function runScrapQueue(isCron = false) {
  if (isProcessing) {
    console.log('[Railway Worker] Job sedang berjalan, skip request ini')
    return { success: false, message: 'Job sedang berjalan' }
  }

  isProcessing = true
  console.log(`[Railway Worker] Starting scrap queue worker (cron: ${isCron})`)

  try {
    // Jika cron, enqueue dulu
    if (isCron) {
      console.log('[Railway Worker] Running enqueue-today...')
      const enqueueProcess = spawn('pnpm', ['scrap:enqueue-today'], {
        cwd: process.cwd(),
        stdio: 'inherit',
        env: { ...process.env },
      })

      await new Promise((resolve, reject) => {
        enqueueProcess.on('close', (code) => {
          if (code === 0) {
            console.log('[Railway Worker] Enqueue completed')
            resolve(null)
          } else {
            console.error(`[Railway Worker] Enqueue failed with code ${code}`)
            reject(new Error(`Enqueue process exited with code ${code}`))
          }
        })
      })
    }

    // Run scrap queue worker
    console.log('[Railway Worker] Running scrap:github:queue...')
    const workerProcess = spawn('pnpm', ['scrap:github:queue'], {
      cwd: process.cwd(),
      stdio: 'inherit',
      env: { ...process.env, PROCESS_LIMIT },
    })

    await new Promise((resolve, reject) => {
      workerProcess.on('close', (code) => {
        if (code === 0) {
          console.log('[Railway Worker] Scrap queue worker completed')
          resolve(null)
        } else {
          console.error(`[Railway Worker] Worker failed with code ${code}`)
          reject(new Error(`Worker process exited with code ${code}`))
        }
      })
    })

    return { success: true, message: 'Scrap queue worker completed' }
  } catch (error) {
    console.error('[Railway Worker] Error:', error)
    return { success: false, message: error.message }
  } finally {
    isProcessing = false
  }
}

const server = http.createServer(async (req, res) => {
  // Update last request time (untuk idle check)
  lastRequestTime = Date.now()

  // Parse URL (handle query string)
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  const pathname = url.pathname

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    res.writeHead(200)
    res.end()
    return
  }

  // Health check endpoint (juga untuk wake service)
  if (req.method === 'GET' && pathname === '/health') {
    const idleTime = Date.now() - lastRequestTime
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(
      JSON.stringify({
        status: 'ok',
        processing: isProcessing,
        idleTime: Math.round(idleTime / 1000),
        idleTimeout: IDLE_TIMEOUT / 1000,
      })
    )
    return
  }

  // Wake endpoint (untuk external cron wake service sebelum scraping)
  if (req.method === 'GET' && pathname === '/wake') {
    lastRequestTime = Date.now()
    console.log('[Railway Worker] Service woken up via /wake endpoint')
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(
      JSON.stringify({
        success: true,
        message: 'Service woken up',
        timestamp: new Date().toISOString(),
      })
    )
    return
  }

  // Trigger endpoint
  if (req.method === 'POST' && pathname === '/trigger') {
    try {
      // Parse body untuk cek apakah ini cron atau manual
      let body = ''
      req.on('data', (chunk) => {
        body += chunk.toString()
      })

      req.on('end', async () => {
        try {
          const data = body ? JSON.parse(body) : {}
          const isCron = data.isCron === true

          // Run async (jangan block response)
          runScrapQueue(isCron).catch((err) => {
            console.error('[Railway Worker] Unhandled error:', err)
          })

          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(
            JSON.stringify({
              success: true,
              message: 'Scrap queue worker triggered',
              isCron,
            })
          )
        } catch (parseError) {
          console.error('[Railway Worker] Parse error:', parseError)
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ success: false, error: 'Invalid JSON' }))
        }
      })
    } catch (error) {
      console.error('[Railway Worker] Request error:', error)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: false, error: error.message }))
    }
    return
  }

  // 404
  res.writeHead(404, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: 'Not found' }))
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Railway Worker] Server running on port ${PORT}`)
  console.log(`[Railway Worker] Listening on 0.0.0.0:${PORT}`)
  console.log(`[Railway Worker] Health check: http://localhost:${PORT}/health`)
  console.log(`[Railway Worker] Trigger endpoint: POST http://localhost:${PORT}/trigger`)
  console.log(`[Railway Worker] Auto-sleep enabled (idle timeout: ${IDLE_TIMEOUT / 1000}s)`)
  
  // Start idle check
  startIdleCheck()
})

// Error handling untuk server
server.on('error', (error) => {
  console.error('[Railway Worker] Server error:', error)
  if (error.code === 'EADDRINUSE') {
    console.error(`[Railway Worker] Port ${PORT} sudah digunakan. Cek apakah ada process lain yang menggunakan port ini.`)
  }
  process.exit(1)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Railway Worker] SIGTERM received, shutting down...')
  if (idleCheckInterval) {
    clearInterval(idleCheckInterval)
  }
  server.close(() => {
    console.log('[Railway Worker] Server closed')
    process.exit(0)
  })
})

// Cleanup on exit
process.on('exit', () => {
  if (idleCheckInterval) {
    clearInterval(idleCheckInterval)
  }
})
