// Railway Worker Server untuk Scrap Queue
// Server ini menerima HTTP request untuk trigger scrap queue worker
// Bisa dipanggil dari Vercel (insidental) atau Railway Cron (scheduled)

const http = require('http')
const { spawn } = require('child_process')
const path = require('path')

const PORT = process.env.PORT || 3001
const PROCESS_LIMIT = process.env.PROCESS_LIMIT || '6'

// Flag untuk prevent concurrent execution
let isProcessing = false

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
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    res.writeHead(200)
    res.end()
    return
  }

  // Health check endpoint
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', processing: isProcessing }))
    return
  }

  // Trigger endpoint
  if (req.method === 'POST' && req.url === '/trigger') {
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

server.listen(PORT, () => {
  console.log(`[Railway Worker] Server running on port ${PORT}`)
  console.log(`[Railway Worker] Health check: http://localhost:${PORT}/health`)
  console.log(`[Railway Worker] Trigger endpoint: POST http://localhost:${PORT}/trigger`)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Railway Worker] SIGTERM received, shutting down...')
  server.close(() => {
    console.log('[Railway Worker] Server closed')
    process.exit(0)
  })
})
