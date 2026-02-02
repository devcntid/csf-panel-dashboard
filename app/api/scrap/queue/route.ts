import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const { clinic_id, tgl_awal, tgl_akhir, requested_by, auto_trigger } = await request.json()

    // Validate input
    if (!clinic_id || !tgl_awal || !tgl_akhir) {
      return NextResponse.json(
        { error: 'Missing required fields: clinic_id, tgl_awal, tgl_akhir' },
        { status: 400 }
      )
    }

    // Cek apakah sudah ada pending/processing untuk kombinasi yang sama (hindari duplikasi)
    const existing = await sql`
      SELECT id FROM scrap_queue
      WHERE clinic_id = ${clinic_id}
        AND tgl_awal = ${tgl_awal}::date
        AND tgl_akhir = ${tgl_akhir}::date
        AND status IN ('pending', 'processing')
      LIMIT 1
    `

    if (existing.length > 0) {
      return NextResponse.json({
        success: true,
        message: 'Request sudah ada di queue (pending/processing). Tidak perlu duplikasi.',
        queue_id: existing[0].id,
        status: 'pending',
        duplicate: true,
      })
    }

    // Insert into queue
    const result = await sql`
      INSERT INTO scrap_queue (clinic_id, tgl_awal, tgl_akhir, requested_by, status)
      VALUES (${clinic_id}, ${tgl_awal}, ${tgl_akhir}, ${requested_by || null}, 'pending')
      RETURNING *
    `

    console.log(`[v0] Scrape request queued: clinic_id=${clinic_id}, period=${tgl_awal} to ${tgl_akhir}`)

    // Auto-trigger worker jika diminta (untuk insidental yang ingin langsung jalan)
    let triggerResult = null
    if (auto_trigger) {
      try {
        const githubToken = process.env.GITHUB_ACTIONS_TOKEN
        const githubRepo = process.env.GITHUB_REPO
        const githubRef = process.env.GITHUB_REF || 'main'

        if (githubToken && githubRepo) {
          const workflowId = 'scrap-queue.yml'
          const apiUrl = `https://api.github.com/repos/${githubRepo}/actions/workflows/${workflowId}/dispatches`

          const triggerResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${githubToken}`,
              'Accept': 'application/vnd.github+json',
              'X-GitHub-Api-Version': '2022-11-28',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              ref: githubRef,
              inputs: {},
            }),
          })

          if (triggerResponse.ok) {
            triggerResult = { triggered: true, message: 'Worker telah di-trigger via GitHub Actions' }
            console.log('[v0] Auto-triggered GitHub Actions workflow after enqueue')
          } else {
            triggerResult = { triggered: false, message: 'Gagal trigger worker, akan diproses pada cron berikutnya' }
          }
        } else {
          triggerResult = { triggered: false, message: 'Worker akan diproses pada cron berikutnya (30 menit)' }
        }
      } catch (triggerError: any) {
        console.warn('[v0] Error auto-triggering worker:', triggerError)
        triggerResult = { triggered: false, message: 'Worker akan diproses pada cron berikutnya' }
      }
    }

    return NextResponse.json({
      success: true,
      message: auto_trigger && triggerResult?.triggered
        ? 'Scrape request queued dan worker telah di-trigger. Proses akan berjalan dalam beberapa detik.'
        : 'Scrape request queued successfully. Akan diproses pada cron berikutnya (30 menit) atau trigger manual.',
      queue_id: result[0].id,
      status: 'pending',
      trigger: triggerResult,
    })
  } catch (error: any) {
    console.error('[v0] Error queuing scrape request:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to queue scrape request' },
      { status: 500 }
    )
  }
}

// GET - List pending requests
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const status = searchParams.get('status') || 'pending'
    const limit = parseInt(searchParams.get('limit') || '10')

    const requests = await sql`
      SELECT * FROM scrap_queue
      WHERE status = ${status}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `

    return NextResponse.json({
      success: true,
      count: requests.length,
      requests,
    })
  } catch (error: any) {
    console.error('[v0] Error fetching queue requests:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch queue' },
      { status: 500 }
    )
  }
}
