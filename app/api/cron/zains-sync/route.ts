import { NextRequest, NextResponse } from 'next/server'
import { sql } from '@/lib/db'
import { getZainsTransactionSyncEnabled } from '@/lib/settings'
import {
  getUnsyncedPatients,
  syncPatientToZains,
  syncTransactionsBatchToZains,
} from '@/lib/services/zains-sync'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const LOCK_KEY_1 = 931_001 // arbitrary stable int
const LOCK_KEY_2 = 931_002 // arbitrary stable int

async function tryAcquireLock(): Promise<boolean> {
  const rows = (await sql`SELECT pg_try_advisory_lock(${LOCK_KEY_1}, ${LOCK_KEY_2}) AS locked`) as any[]
  return Boolean(rows?.[0]?.locked)
}

async function releaseLock(): Promise<void> {
  await sql`SELECT pg_advisory_unlock(${LOCK_KEY_1}, ${LOCK_KEY_2})`
}

function isAuthorizedCron(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return false
  const authHeader = req.headers.get('authorization') || ''
  return authHeader === `Bearer ${cronSecret}`
}

async function runCronZainsSync(): Promise<{
  ok: boolean
  skipped?: boolean
  reason?: string
  patientSync?: { total: number; success: number; failed: number }
  transactionSync?: { total: number; success: number; failed: number }
}> {
  const enabled = await getZainsTransactionSyncEnabled()
  if (!enabled) {
    return { ok: true, skipped: true, reason: 'toggle_disabled' }
  }

  // 1) Sync patients dulu (maks 10)
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

  // 2) Sync transactions batch (maks 10, dan sudah filter paid_total > 0 + id_donatur terisi)
  const trxBatch = await syncTransactionsBatchToZains()

  return {
    ok: true,
    patientSync: { total: patients.length, success: patientSuccess, failed: patientFailed },
    transactionSync: { total: trxBatch.total, success: trxBatch.success, failed: trxBatch.failed },
  }
}

async function handler(req: NextRequest) {
  if (!isAuthorizedCron(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const locked = await tryAcquireLock()
  if (!locked) {
    return NextResponse.json(
      { ok: true, skipped: true, reason: 'already_running' },
      { status: 200 },
    )
  }

  const startedAt = Date.now()
  try {
    const result = await runCronZainsSync()

    // Log ringkas ke system_logs agar bisa audit via dashboard
    try {
      await sql`
        INSERT INTO system_logs (clinic_id, process_type, status, message, payload)
        VALUES (
          NULL,
          'cron_zains_sync_fallback',
          ${result.ok ? 'success' : 'error'},
          ${result.skipped ? `Skipped: ${result.reason || 'unknown'}` : 'Cron Zains sync executed'},
          ${JSON.stringify({
            ...result,
            duration_ms: Date.now() - startedAt,
          })}::jsonb
        )
      `
    } catch (e) {
      // ignore log error
    }

    return NextResponse.json(
      {
        ...result,
        duration_ms: Date.now() - startedAt,
        batch: { patients: 10, transactions: 10 },
      },
      { status: 200 },
    )
  } catch (error: any) {
    const message = error?.message || String(error)
    try {
      await sql`
        INSERT INTO system_logs (clinic_id, process_type, status, message, payload)
        VALUES (
          NULL,
          'cron_zains_sync_fallback',
          'error',
          ${message},
          ${JSON.stringify({ error: message })}::jsonb
        )
      `
    } catch {}
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  } finally {
    try {
      await releaseLock()
    } catch {}
  }
}

export async function GET(req: NextRequest) {
  return handler(req)
}

export async function POST(req: NextRequest) {
  return handler(req)
}

