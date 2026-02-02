import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    // Optional: Verify GitHub Actions token
    const githubToken = request.headers.get('X-GitHub-Token')
    if (githubToken !== process.env.GITHUB_ACTIONS_TOKEN) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get pending requests
    const pendingRequests = await sql`
      SELECT * FROM scrap_queue
      WHERE status = 'pending'
      ORDER BY created_at ASC
      LIMIT 1
    `

    if (pendingRequests.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No pending requests',
        processed: 0,
      })
    }

    const request_data = pendingRequests[0]

    // Update status to processing
    await sql`
      UPDATE scrap_queue
      SET status = 'processing', started_at = CURRENT_TIMESTAMP
      WHERE id = ${request_data.id}
    `

    console.log(`[v0] Processing queue request #${request_data.id}`)

    return NextResponse.json({
      success: true,
      message: 'Request marked for processing',
      queue_id: request_data.id,
      clinic_id: request_data.clinic_id,
      tgl_awal: request_data.tgl_awal,
      tgl_akhir: request_data.tgl_akhir,
    })
  } catch (error: any) {
    console.error('[v0] Error processing queue:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process queue' },
      { status: 500 }
    )
  }
}

// PATCH - Update queue request status
export async function PATCH(request: NextRequest) {
  try {
    const { queue_id, status, error_message, github_run_id } = await request.json()

    // Validate input
    if (!queue_id || !status) {
      return NextResponse.json(
        { error: 'Missing required fields: queue_id, status' },
        { status: 400 }
      )
    }

    const validStatuses = ['pending', 'processing', 'completed', 'failed']
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status value' },
        { status: 400 }
      )
    }

    const updates: any = {
      status,
      updated_at: new Date(),
    }

    if (status === 'completed') {
      updates.completed_at = new Date()
    }

    if (error_message) {
      updates.error_message = error_message
    }

    if (github_run_id) {
      updates.github_run_id = github_run_id
    }

    const result = await sql`
      UPDATE scrap_queue
      SET ${Object.keys(updates)
        .map((key) => `${key} = ${updates[key]}`)
        .join(', ')}
      WHERE id = ${queue_id}
      RETURNING *
    `

    console.log(`[v0] Queue request #${queue_id} updated to status: ${status}`)

    return NextResponse.json({
      success: true,
      message: `Queue request updated to ${status}`,
      queue_id,
    })
  } catch (error: any) {
    console.error('[v0] Error updating queue status:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update queue' },
      { status: 500 }
    )
  }
}
