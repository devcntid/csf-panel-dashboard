import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { after } from 'next/server'
import { authOptions } from '@/lib/auth'
import { sql } from '@/lib/db'
import { getZainsTransactionSyncEnabled } from '@/lib/settings'
import {
  getUnsyncedPatients,
  syncPatientToZains,
  syncTransactionsBatchToZains,
} from '@/lib/services/zains-sync'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const LOCK_KEY_1 = 931_001 // keep same as cron endpoint
const LOCK_KEY_2 = 931_002

async function tryAcquireLock(): Promise<boolean> {
  const rows = (await sql`SELECT pg_try_advisory_lock(${LOCK_KEY_1}, ${LOCK_KEY_2}) AS locked`) as any[]
  return Boolean(rows?.[0]?.locked)
}

async function releaseLock(): Promise<void> {
  await sql`SELECT pg_advisory_unlock(${LOCK_KEY_1}, ${LOCK_KEY_2})`
}

function makeJobId(): string {
  // no crypto dependency; sufficiently unique for log correlation
  return `zsync_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

async function logJob(jobId: string, status: 'processing' | 'success' | 'error', message: string, payload: any) {
  await sql`
    INSERT INTO system_logs (clinic_id, process_type, status, message, payload)
    VALUES (
      NULL,
      'manual_zains_sync',
      ${status},
      ${message},
      ${JSON.stringify({ jobId, ...payload })}::jsonb
    )
  `
}

async function runManualZainsSync(jobId: string) {
  const startedAt = Date.now()
  await logJob(jobId, 'processing', 'Manual Zains sync started', { started_at: new Date().toISOString() })

  try {
    const enabled = await getZainsTransactionSyncEnabled()
    if (!enabled) {
      await logJob(jobId, 'success', 'Skipped: toggle_disabled', {
        ok: true,
        skipped: true,
        reason: 'toggle_disabled',
        duration_ms: Date.now() - startedAt,
      })
      return
    }

    const patients = await getUnsyncedPatients(10)
    let patientSuccess = 0
    let patientFailed = 0

    for (const p of patients) {
      const r = await syncPatientToZains(p).catch((e: any) => ({
        success: false,
        error: e?.message || String(e),
        patientId: p?.id,
      }))
      if (r && (r as any).success) patientSuccess++
      else patientFailed++
    }

    const trxBatch = await syncTransactionsBatchToZains()

    await logJob(jobId, 'success', 'Manual Zains sync finished', {
      ok: true,
      patientSync: { total: patients.length, success: patientSuccess, failed: patientFailed },
      transactionSync: { total: trxBatch.total, success: trxBatch.success, failed: trxBatch.failed },
      duration_ms: Date.now() - startedAt,
      batch: { patients: 10, transactions: 10 },
    })
  } catch (error: any) {
    const message = error?.message || String(error)
    await logJob(jobId, 'error', message, { ok: false, error: message, duration_ms: Date.now() - startedAt })
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const role = (session.user as any)?.role as string | undefined
  if (role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const locked = await tryAcquireLock()
  if (!locked) {
    return NextResponse.json(
      { started: false, skipped: true, reason: 'already_running' },
      { status: 200 },
    )
  }

  const jobId = makeJobId()

  // Jalankan background: lock dilepas saat job selesai
  after(async () => {
    try {
      await runManualZainsSync(jobId)
    } finally {
      try {
        await releaseLock()
      } catch {}
    }
  })

  return NextResponse.json({ started: true, jobId }, { status: 200 })
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const role = (session.user as any)?.role as string | undefined
  if (role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const jobId = searchParams.get('jobId') || ''
  if (!jobId) {
    return NextResponse.json({ error: 'jobId is required' }, { status: 400 })
  }

  const rows = (await sql`
    SELECT id, status, message, payload, created_at
    FROM system_logs
    WHERE process_type = 'manual_zains_sync'
      AND payload->>'jobId' = ${jobId}
    ORDER BY created_at DESC
    LIMIT 1
  `) as any[]

  const row = rows?.[0]
  if (!row) {
    return NextResponse.json({ status: 'unknown', jobId }, { status: 200 })
  }

  return NextResponse.json(
    {
      jobId,
      status: row.status,
      message: row.message,
      payload: row.payload,
      created_at: row.created_at,
    },
    { status: 200 },
  )
}

