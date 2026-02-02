import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const { clinic_id, tgl_awal, tgl_akhir, requested_by } = await request.json()

    // Validate input
    if (!clinic_id || !tgl_awal || !tgl_akhir) {
      return NextResponse.json(
        { error: 'Missing required fields: clinic_id, tgl_awal, tgl_akhir' },
        { status: 400 }
      )
    }

    // Insert into queue
    const result = await sql`
      INSERT INTO scrap_queue (clinic_id, tgl_awal, tgl_akhir, requested_by, status)
      VALUES (${clinic_id}, ${tgl_awal}, ${tgl_akhir}, ${requested_by || null}, 'pending')
      RETURNING *
    `

    console.log(`[v0] Scrape request queued: clinic_id=${clinic_id}, period=${tgl_awal} to ${tgl_akhir}`)

    return NextResponse.json({
      success: true,
      message: 'Scrape request queued successfully',
      queue_id: result[0].id,
      status: 'pending',
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
