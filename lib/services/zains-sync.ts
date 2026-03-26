import { sql } from '@/lib/db'
import { getZainsTransactionSyncEnabled } from '@/lib/settings'
import { getZainsApiConfig } from '@/lib/zains-api-config'
import { Client as WorkflowTriggerClient } from '@upstash/workflow'

/** Minimal percobaan HTTP ke API Zains (cold start / 5xx / rate limit) */
export const ZAINS_API_MAX_ATTEMPTS = 5
/** Retry trigger Upstash Workflow (delivery ke endpoint) */
const WORKFLOW_TRIGGER_MAX_ATTEMPTS = 5
const WORKFLOW_TRIGGER_RETRY_DELAY_MS = 800
/** Trigger banyak workflow sekaligus (upload): konkurensi terbatas */
export const ZAINS_WORKFLOW_TRIGGER_CONCURRENCY = 5

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function getBackoffMs(attemptIndex: number): number {
  return Math.min(800 * Math.pow(2, attemptIndex - 1), 15_000)
}

/**
 * Fetch ke Zains dengan retry untuk kegagalan jaringan, 5xx, dan 429.
 * Response selain itu dikembalikan langsung (termasuk 4xx bisnis).
 */
async function fetchZainsWithRetry(url: string, init: RequestInit): Promise<Response> {
  for (let attempt = 1; attempt <= ZAINS_API_MAX_ATTEMPTS; attempt++) {
    try {
      const response = await fetch(url, init)
      if ((response.status >= 500 || response.status === 429) && attempt < ZAINS_API_MAX_ATTEMPTS) {
        await response.text().catch(() => {})
        await sleep(getBackoffMs(attempt))
        continue
      }
      return response
    } catch (err) {
      if (attempt === ZAINS_API_MAX_ATTEMPTS) throw err
      await sleep(getBackoffMs(attempt))
    }
  }
  throw new Error('fetchZainsWithRetry: unreachable')
}

interface ZainsSyncPayload {
  nama: string
  id_jenis: number
  hp: string
  telpon: string
  email: string
  alamat: string
  id_crm: string
}

interface ZainsSyncResponse {
  status?: boolean
  message?: string
  data?: {
    id_donatur?: string
    donatur?: string
    [key: string]: any
  }
  id_donatur?: string  // Bisa di level root response (untuk case sudah terdaftar)
  success?: boolean
  error?: string
}

/**
 * Extract phone and email untuk payload Zains (hp, telpon, email).
 * Menggunakan NIK jika ada; jika NIK kosong caller wajib pass fallback (biasanya erm_no_for_zains).
 * Sync ke Zains tidak pernah dibatalkan hanya karena NIK kosong.
 */
function extractContactFromNik(nikOrFallback: string): { hp: string; telpon: string; email: string } {
  const value = nikOrFallback || ''
  return {
    hp: value,
    telpon: value,
    email: value ? `${value}@gmail.com` : ''
  }
}

/** Base URL API Zains (Golang/Koyeb) dari env; kosong = fallback ke Next lokal `/api/corez/*`. */
function getZainsHttpApiBase(): string {
  const { url } = getZainsApiConfig()
  return url ? url.trim().replace(/\/+$/, '') : ''
}

function isZainsHttpApiConfigured(): boolean {
  return getZainsHttpApiBase().length > 0
}

function corezPostHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (isZainsHttpApiConfigured() && process.env.API_KEY_ZAINS) {
    headers.Authorization = process.env.API_KEY_ZAINS
  }
  return headers
}

function urlCorezMitraSave(): string {
  const base = getZainsHttpApiBase()
  if (base) return `${base}/corez/mitra/save`
  return `${getWorkflowBaseUrl()}/api/corez/mitra/save`
}

function urlCorezTransaksiSave(): string {
  const base = getZainsHttpApiBase()
  if (base) return `${base}/corez/transaksi/save`
  return `${getWorkflowBaseUrl()}/api/corez/transaksi/save`
}

/** Helper: tambah mode dan host Zains ke payload log agar bisa diverifikasi di system_logs */
function payloadWithZainsEnv(payload: any): any {
  let urlHost = ''
  let mode: string = 'next-corez'
  let target: string = 'next'
  try {
    const base = getZainsHttpApiBase()
    if (base) {
      urlHost = new URL(base).hostname
      mode = 'zains-golang'
      target = 'koyeb'
    } else {
      const w = getWorkflowBaseUrl()
      urlHost = new URL(w).hostname
    }
  } catch {
    urlHost = ''
  }

  return {
    ...payload,
    _zains_env: { mode, urlHost },
    _zains_target: target,
  }
}

/**
 * Sync single patient to Zains API
 */
export async function syncPatientToZains(patient: any): Promise<{
  success: boolean
  id_donatur?: string
  error?: string
  patientId: number
}> {
  // Prioritas: API Zains Golang (URL_API_ZAINS* / URL_API_ZAINS) dari env; fallback: Next `/api/corez/mitra/save`.
  const mitraUrl = urlCorezMitraSave()

  // NIK boleh kosong: fallback ke erm_no_for_zains agar sync tetap jalan (Zains butuh isi hp/telpon/email)
  const contactSource = patient.nik || patient.erm_no_for_zains || ''
  const { hp, telpon, email } = extractContactFromNik(contactSource)
  
  const payload: ZainsSyncPayload = {
    nama: patient.full_name || '',
    id_jenis: 1,
    hp: hp,
    telpon: telpon,
    email: email,
    alamat: '-',
    id_crm: '-'
  }

  try {
    const response = await fetchZainsWithRetry(mitraUrl, {
      method: 'POST',
      headers: corezPostHeaders(),
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()

      // Coba parse errorText sebagai JSON untuk case:
      // {"status":false,"message":"Mitra ... sudah terdaftar","id_donatur":"..."}
      try {
        const parsed = JSON.parse(errorText)
        const idDonaturFromError =
          (parsed.data && parsed.data.id_donatur) || parsed.id_donatur || undefined
        const msg = parsed.message as string | undefined

        if (idDonaturFromError && msg && msg.includes('sudah terdaftar')) {
          // Anggap sukses: mitra sudah terdaftar, simpan id_donatur ke patients & transactions_to_zains
          await logSyncResult(patient.clinic_id ?? null, 'success', errorText, payload)

          await sql`
            UPDATE patients
            SET id_donatur_zains = ${idDonaturFromError},
                updated_at = NOW()
            WHERE id = ${patient.id}
              AND (id_donatur_zains IS NULL OR id_donatur_zains = '')
          `

          await sql`
            UPDATE transactions_to_zains tz
            SET id_donatur = ${idDonaturFromError}
            FROM transactions t
            WHERE tz.transaction_id = t.id
              AND t.patient_id = ${patient.id}
              AND (tz.id_donatur IS NULL OR tz.id_donatur = '')
          `

          return {
            success: true,
            id_donatur: String(idDonaturFromError),
            patientId: patient.id,
          }
        }
      } catch {
        // ignore parse error, jatuh ke return error default
      }

      await logSyncResult(patient.clinic_id ?? null, 'error', errorText, payload)
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`,
        patientId: patient.id,
      }
    }

    const data: ZainsSyncResponse = await response.json()
    
    // Ambil id_donatur dari response API Zains (prioritas: data.data.id_donatur, lalu data.id_donatur)
    const idDonatur = data.data?.id_donatur || data.id_donatur
    
    // Handle case: Mitra sudah terdaftar (tidak perlu retry)
    if (data.status === false && data.message && data.message.includes('sudah terdaftar')) {
      await logSyncResult(patient.clinic_id ?? null, 'success', data, payload)
      // Patient sudah terdaftar di Zains
      // Update patient dengan id_donatur dari response jika ada
      if (idDonatur) {
        await sql`
          UPDATE patients
          SET id_donatur_zains = ${idDonatur},
              updated_at = NOW()
          WHERE id = ${patient.id}
            AND (id_donatur_zains IS NULL OR id_donatur_zains = '')
        `

        await sql`
          UPDATE transactions_to_zains tz
          SET id_donatur = ${idDonatur}
          FROM transactions t
          WHERE tz.transaction_id = t.id
            AND t.patient_id = ${patient.id}
            AND (tz.id_donatur IS NULL OR tz.id_donatur = '')
        `

        return {
          success: true,
          id_donatur: idDonatur,
          patientId: patient.id
        }
      } else {
        // Jika tidak ada id_donatur di response, tetap mark as success agar tidak retry
        return {
          success: true,
          id_donatur: 'already_registered',
          patientId: patient.id
        }
      }
    }
    
    // Handle response sukses: Update patient dengan id_donatur dari response
    if (idDonatur) {
      await logSyncResult(patient.clinic_id ?? null, 'success', data, payload)
      await sql`
        UPDATE patients
        SET id_donatur_zains = ${idDonatur},
            updated_at = NOW()
        WHERE id = ${patient.id}
          AND (id_donatur_zains IS NULL OR id_donatur_zains = '')
      `

      await sql`
        UPDATE transactions_to_zains tz
        SET id_donatur = ${idDonatur}
        FROM transactions t
        WHERE tz.transaction_id = t.id
          AND t.patient_id = ${patient.id}
          AND (tz.id_donatur IS NULL OR tz.id_donatur = '')
      `

      return {
        success: true,
        id_donatur: idDonatur,
        patientId: patient.id
      }
    } else {
      // Jika tidak ada id_donatur di response, return error
      await logSyncResult(patient.clinic_id ?? null, 'error', data, payload)
      return {
        success: false,
        error: data.message || data.error || 'id_donatur tidak ditemukan di response',
        patientId: patient.id
      }
    }
  } catch (error: any) {
    await logSyncResult(patient.clinic_id ?? null, 'error', error.message || 'Error saat sync ke Zains', payload)
    return {
      success: false,
      error: error.message || 'Error saat sync ke Zains',
      patientId: patient.id
    }
  }
}

/**
 * Get batch of patients yang belum di-sync (id_donatur_zains kosong)
 */
export async function getUnsyncedPatients(limit: number = 10): Promise<any[]> {
  try {
    const patients = await sql`
      SELECT p.id, p.clinic_id, p.erm_no, p.full_name, p.erm_no_for_zains, p.nik
      FROM patients p
      WHERE (p.id_donatur_zains IS NULL OR p.id_donatur_zains = '')
        AND p.erm_no_for_zains IS NOT NULL
        AND p.erm_no_for_zains != ''
        -- Hanya pasien yang punya minimal 1 transaksi yang sudah dibreak ke transactions_to_zains
        AND EXISTS (
          SELECT 1
          FROM transactions t
          JOIN transactions_to_zains tz ON tz.transaction_id = t.id
          WHERE t.patient_id = p.id
        )
      ORDER BY p.created_at ASC
      LIMIT ${limit}
    `
    
    return Array.isArray(patients) ? patients : []
  } catch (error) {
    console.error('Error fetching unsynced patients:', error)
    return []
  }
}

/**
 * Log sync result patient ke system_logs
 * message = response utuh dari API Zains (string atau object), payload = body request yang dikirim
 */
export async function logSyncResult(
  clinicId: number | null,
  status: 'success' | 'error',
  message: any,
  payload: any,
): Promise<void> {
  try {
    await sql`
      INSERT INTO system_logs (clinic_id, process_type, status, message, payload)
      VALUES (
        ${clinicId},
        'patient_zains_sync',
        ${status},
        ${typeof message === 'string' ? message : JSON.stringify(message)},
        ${JSON.stringify(payload)}::jsonb
      )
    `
  } catch (error) {
    console.error('Error logging sync result (patient):', error)
  }
}

/**
 * Log sync result transaksi ke system_logs
 */
export async function logTransactionSyncResult(
  clinicId: number | null,
  status: 'success' | 'error',
  message: any,
  payload: any,
): Promise<void> {
  try {
    await sql`
      INSERT INTO system_logs (clinic_id, process_type, status, message, payload)
      VALUES (
        ${clinicId},
        'transaction_zains_sync',
        ${status},
        ${typeof message === 'string' ? message : JSON.stringify(message)},
        ${JSON.stringify(payload)}::jsonb
      )
    `
  } catch (error) {
    console.error('Error logging sync result (transaction):', error)
  }
}

/**
 * Sync batch of patients to Zains (async, non-blocking)
 * This function processes 10 patients at a time in parallel
 */
export async function syncPatientsBatchToZains(): Promise<{
  total: number
  success: number
  failed: number
  results: Array<{
    patientId: number
    success: boolean
    id_donatur?: string
    error?: string
  }>
}> {
  const syncEnabled = await getZainsTransactionSyncEnabled()
  if (!syncEnabled) {
    return {
      total: 0,
      success: 0,
      failed: 0,
      results: []
    }
  }

  const patients = await getUnsyncedPatients(10)
  
  if (patients.length === 0) {
    return {
      total: 0,
      success: 0,
      failed: 0,
      results: []
    }
  }

  // Process all patients in parallel for maximum speed
  const syncPromises = patients.map(patient => syncPatientToZains(patient))
  const results = await Promise.all(syncPromises)

  const successCount = results.filter(r => r.success).length
  const failedCount = results.filter(r => !r.success).length

  // Log summary
  await logSyncResult(
    null, // clinic_id bisa null untuk batch sync
    failedCount === 0 ? 'success' : (successCount > 0 ? 'success' : 'error'),
    `Sync batch: ${successCount} berhasil, ${failedCount} gagal dari ${patients.length} patients`,
    {
      total: patients.length,
      success: successCount,
      failed: failedCount,
      results: results.map(r => ({
        patientId: r.patientId,
        success: r.success,
        id_donatur: r.id_donatur,
        error: r.error
      }))
    }
  )

  // Log individual failures
  for (const result of results) {
    if (!result.success) {
      const patient = patients.find(p => p.id === result.patientId)
      await logSyncResult(
        patient?.clinic_id || null,
        'error',
        `Gagal sync patient ID ${result.patientId}: ${result.error}`,
        {
          patientId: result.patientId,
          ermNo: patient?.erm_no,
          fullName: patient?.full_name,
          error: result.error
        }
      )
    }
  }

  return {
    total: patients.length,
    success: successCount,
    failed: failedCount,
    results: results.map(r => ({
      patientId: r.patientId,
      success: r.success,
      id_donatur: r.id_donatur,
      error: r.error
    }))
  }
}

/**
 * Client Upstash Workflow (QStash-backed) untuk trigger workflow run
 */
function getWorkflowTriggerClient(): WorkflowTriggerClient | null {
  try {
    const token = process.env.QSTASH_TOKEN || process.env.UPSTASH_QSTASH_TOKEN

    if (!token) {
      console.warn('⚠️  [Workflow] QSTASH_TOKEN atau UPSTASH_QSTASH_TOKEN tidak dikonfigurasi')
      return null
    }

    return new WorkflowTriggerClient({ token })
  } catch (error) {
    console.error('❌ [Workflow] Error membuat Workflow client:', error)
    return null
  }
}

/**
 * Skema alur sync (workflow) — tetap selesai dari awal hingga akhir meskipun Upstash gagal:
 *
 * 1. Coba trigger via @upstash/workflow Client.trigger (retry untuk delivery).
 * 2. Jika token tidak tersedia / gagal setelah retry:
 *    → Fallback: jalankan alur yang sama secara lokal (await sampai selesai):
 *    a. Sync patient ke Zains (syncPatientToZains)
 *    b. Jika ada transactionId: sync transactions_to_zains untuk transaksi tersebut (syncTransactionsToZainsByTransactionId)
 *
 * Dengan ini, insert/upload transaksi tetap menghasilkan donatur + transaksi ter-sync ke Zains
 * walaupun QStash limit, timeout, atau error lainnya.
 */

function getWorkflowBaseUrl(): string {
  const url =
    process.env.BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
    'http://localhost:3000'
  if (url.startsWith('http://localhost') || url.startsWith('http://127.0.0.1')) {
    console.warn(
      '⚠️  [Workflow] BASE_URL/VERCEL_URL mengarah ke localhost; QStash cloud tidak bisa mengirim webhook ke localhost. Untuk log QStash, deploy ke URL publik atau pakai tunnel (ngrok).',
    )
  }
  return url
}

/**
 * Jalankan alur sync patient + transaksi secara lokal (untuk fallback ketika QStash gagal).
 * Dijalankan sampai selesai (await).
 */
async function runWorkflowSyncLocally(
  patient: any,
  patientId: number,
  transactionId?: number,
): Promise<void> {
  const result = await syncPatientToZains(patient)
  if (result.success) {
    console.log(
      `✅ [Workflow Fallback] Patient ID ${patientId} berhasil di-sync ke Zains, id_donatur: ${result.id_donatur}`,
    )
    if (transactionId != null && transactionId > 0) {
      const trxResult = await syncTransactionsToZainsByTransactionId(transactionId)
      console.log(
        `✅ [Workflow Fallback] Sync transaksi spesifik (transaction_id=${transactionId}): ${trxResult.success}/${trxResult.total}`,
      )
    }
  } else {
    console.warn(
      `⚠️  [Workflow Fallback] Patient ID ${patientId} gagal di-sync ke Zains: ${result.error}`,
    )
  }
}

/**
 * Sync single patient ke Zains lalu (jika ada transactionId) sync transactions_to_zains.
 * Prioritas: trigger via Upstash Workflow SDK ke /api/workflow/sync-patient-to-zains (eksekusi terpisah).
 * Jika token tidak tersedia atau gagal setelah retry, fallback jalankan secara lokal.
 * Dipanggil dari API insert/upload/scrap (bisa di dalam after() atau langsung).
 *
 * @param patientId - ID patient yang akan di-sync donatur ke Zains
 * @param transactionId - Opsional; jika ada, setelah patient sync akan sync transactions_to_zains ke /corez/transaksi/save
 */
export async function syncPatientToZainsWorkflow(
  patientId: number,
  transactionId?: number,
): Promise<void> {
  const workflowEndpoint = `${getWorkflowBaseUrl()}/api/workflow/sync-patient-to-zains`
  const body = { patientId, transactionId: transactionId ?? null }

  // 1. Trigger run workflow (tercatat di Upstash Workflow / QStash).
  const wf = getWorkflowTriggerClient()
  if (wf) {
    let lastErr: unknown = null
    for (let attempt = 1; attempt <= WORKFLOW_TRIGGER_MAX_ATTEMPTS; attempt++) {
      try {
        await wf.trigger({
          url: workflowEndpoint,
          body,
          retries: ZAINS_API_MAX_ATTEMPTS,
          retryDelay: 'min(15000, 1000 * pow(2, retried))',
        })
        console.log(
          `✅ [Upstash Workflow] sync-patient-to-zains triggered (patientId=${patientId}, transactionId=${transactionId ?? 'n/a'})`,
        )
        return
      } catch (err: unknown) {
        lastErr = err
        const isLast = attempt === WORKFLOW_TRIGGER_MAX_ATTEMPTS
        console.warn(
          `⚠️  [Upstash Workflow] Attempt ${attempt}/${WORKFLOW_TRIGGER_MAX_ATTEMPTS} gagal (trigger sync-patient):`,
          err instanceof Error ? err.message : err,
        )
        if (!isLast) {
          await sleep(WORKFLOW_TRIGGER_RETRY_DELAY_MS)
        }
      }
    }
    console.warn(
      '⚠️  [Workflow] Trigger gagal setelah retry, jalankan sync patient+transaksi secara lokal:',
      lastErr instanceof Error ? lastErr.message : lastErr,
    )
  }

  // 2. Fallback: jalankan secara lokal (fetch patient + sync + sync transaksi).
  try {
    const patientResult = await sql`
      SELECT id, clinic_id, erm_no, full_name, erm_no_for_zains, nik, id_donatur_zains
      FROM patients
      WHERE id = ${patientId}
        AND (id_donatur_zains IS NULL OR id_donatur_zains = '')
        AND erm_no_for_zains IS NOT NULL
        AND erm_no_for_zains != ''
      LIMIT 1
    `
    const patient = Array.isArray(patientResult) ? patientResult[0] : patientResult

    if (!patient) {
      console.log(
        `ℹ️  [Workflow] Patient ID ${patientId} sudah di-sync atau tidak memiliki erm_no_for_zains, skip`,
      )
      if (transactionId != null && transactionId > 0) {
        const trxResult = await syncTransactionsToZainsByTransactionId(transactionId)
        console.log(
          `✅ [Workflow] Sync transaksi (transaction_id=${transactionId}): ${trxResult.success}/${trxResult.total} records`,
        )
      }
      return
    }

    await runWorkflowSyncLocally(patient, patientId, transactionId)
  } catch (error) {
    console.error(`❌ [Workflow] Error saat fetch/sync patient ID ${patientId}:`, error)
  }
}

/**
 * Trigger sync batch transactions_to_zains via Upstash Workflow.
 * Jika token tidak tersedia atau gagal setelah retry, jalankan sync secara lokal.
 */
export async function syncTransactionsBatchToZainsWorkflow(): Promise<void> {
  const wf = getWorkflowTriggerClient()
  if (!wf) {
    console.warn('⚠️  [Workflow] Token tidak dikonfigurasi, jalankan sync transaksi batch secara lokal')
    await syncTransactionsBatchToZains()
    return
  }

  const workflowEndpoint = `${getWorkflowBaseUrl()}/api/workflow/sync-transactions-to-zains`

  let lastError: unknown = null
  for (let attempt = 1; attempt <= WORKFLOW_TRIGGER_MAX_ATTEMPTS; attempt++) {
    try {
      await wf.trigger({
        url: workflowEndpoint,
        body: {},
        retries: ZAINS_API_MAX_ATTEMPTS,
        retryDelay: 'min(15000, 1000 * pow(2, retried))',
      })
      console.log('✅ [Upstash Workflow] sync-transactions-to-zains batch triggered')
      return
    } catch (err: unknown) {
      lastError = err
      const isLast = attempt === WORKFLOW_TRIGGER_MAX_ATTEMPTS
      console.warn(
        `⚠️  [Upstash Workflow] Attempt ${attempt}/${WORKFLOW_TRIGGER_MAX_ATTEMPTS} gagal (trigger batch):`,
        err instanceof Error ? err.message : err,
      )
      if (!isLast) {
        await sleep(WORKFLOW_TRIGGER_RETRY_DELAY_MS)
      }
    }
  }

  console.warn(
    '⚠️  [Workflow] Trigger batch gagal setelah retry, jalankan lokal:',
    lastError instanceof Error ? lastError.message : lastError,
  )
  await syncTransactionsBatchToZains()
}

/**
 * Trigger banyak workflow sync patient+transaksi dengan konkurensi terbatas (hindari spike memori/koneksi).
 */
export async function syncPatientToZainsWorkflowsBatch(
  items: Array<{ patientId: number; transactionId?: number }>,
): Promise<void> {
  if (items.length === 0) return
  for (let i = 0; i < items.length; i += ZAINS_WORKFLOW_TRIGGER_CONCURRENCY) {
    const chunk = items.slice(i, i + ZAINS_WORKFLOW_TRIGGER_CONCURRENCY)
    await Promise.all(
      chunk.map(({ patientId, transactionId }) =>
        syncPatientToZainsWorkflow(patientId, transactionId).catch((err: unknown) => {
          console.error(
            `[Workflow batch] Sync Zains gagal (patientId=${patientId}, transactionId=${transactionId}):`,
            err instanceof Error ? err.message : err,
          )
        }),
      ),
    )
  }
}

/**
 * Response type untuk Zains /corez/transaksi/save
 * Bentuk sukses: { status: true, data: { id_transaksi, ... } }
 * Bentuk "transaksi sudah ada": { status: false, message: "...", id_transaksi, no_bukti, id_donatur } (top-level)
 */
interface ZainsTransactionSaveResponse {
  status?: boolean
  message?: string
  id_transaksi?: string
  no_bukti?: string
  id_donatur?: string
  data?: {
    id_transaksi?: string
    id_donatur?: number
    [key: string]: any
  }
}

/**
 * Ambil batch transactions_to_zains yang siap di-sync ke Zains
 * Criteria:
 * - Toggle global sync transaksi ke Zains = true
 * - id_donatur terisi
 * - synced = false
 * - todo_zains = true
 */
export async function getPendingTransactionsToZains(limit: number = 10): Promise<any[]> {
  try {
    const syncEnabled = await getZainsTransactionSyncEnabled()
    if (!syncEnabled) return []

    const rows = await sql`
      SELECT 
        tz.id,
        c.id AS clinic_id,
        tz.transaction_id,
        tz.id_transaksi,
        tz.id_program,
        tz.id_kantor,
        tz.tgl_transaksi::text AS tgl_transaksi,
        tz.id_donatur,
        tz.nominal_transaksi,
        tz.id_rekening,
        tz.synced,
        tz.todo_zains,
        tz.nama_pasien,
        tz.no_erm,
        t.payment_method,
        c.name AS clinic_name,
        mtc.name AS program_name
      FROM transactions_to_zains tz
      JOIN transactions t ON t.id = tz.transaction_id
      LEFT JOIN clinics c ON c.id_kantor_zains = tz.id_kantor
      LEFT JOIN master_target_categories mtc ON mtc.id_program_zains = tz.id_program
      WHERE tz.id_donatur IS NOT NULL
        AND tz.id_donatur != ''
        AND tz.synced = false
        AND tz.todo_zains = true
        AND COALESCE(t.paid_total, 0) > 0
      ORDER BY tz.id ASC
      LIMIT ${limit}
    `

    return Array.isArray(rows) ? rows : []
  } catch (error) {
    console.error('Error fetching pending transactions_to_zains:', error)
    return []
  }
}

/**
 * Ambil transactions_to_zains yang pending untuk satu transaction_id (untuk workflow spesifik)
 * Kriteria sama dengan getPendingTransactionsToZains, tapi filter by transaction_id
 */
export async function getPendingTransactionsToZainsByTransactionId(
  transactionId: number,
): Promise<any[]> {
  try {
    const syncEnabled = await getZainsTransactionSyncEnabled()
    if (!syncEnabled) return []

    const rows = await sql`
      SELECT 
        tz.id,
        c.id AS clinic_id,
        tz.transaction_id,
        tz.id_transaksi,
        tz.id_program,
        tz.id_kantor,
        tz.tgl_transaksi::text AS tgl_transaksi,
        tz.id_donatur,
        tz.nominal_transaksi,
        tz.id_rekening,
        tz.synced,
        tz.todo_zains,
        tz.nama_pasien,
        tz.no_erm,
        t.payment_method,
        c.name AS clinic_name,
        mtc.name AS program_name
      FROM transactions_to_zains tz
      JOIN transactions t ON t.id = tz.transaction_id
      LEFT JOIN clinics c ON c.id_kantor_zains = tz.id_kantor
      LEFT JOIN master_target_categories mtc ON mtc.id_program_zains = tz.id_program
      WHERE tz.transaction_id = ${transactionId}
        AND tz.id_donatur IS NOT NULL
        AND tz.id_donatur != ''
        AND tz.synced = false
        AND tz.todo_zains = true
        AND COALESCE(t.paid_total, 0) > 0
      ORDER BY tz.id ASC
    `
    return Array.isArray(rows) ? rows : []
  } catch (error) {
    console.error('Error fetching pending transactions_to_zains by transaction_id:', error)
    return []
  }
}

/**
 * Sync transactions_to_zains hanya untuk satu transaction_id (untuk workflow, spesifik)
 * Tidak pakai limit general; hanya record yang terkait transaction ini.
 */
export async function syncTransactionsToZainsByTransactionId(transactionId: number): Promise<{
  total: number
  success: number
  failed: number
  results: Array<{
    transactionsToZainsId: number
    success: boolean
    id_transaksi?: string
    error?: string
    rawResponse?: any
    httpStatus?: number
  }>
}> {
  const records = await getPendingTransactionsToZainsByTransactionId(transactionId)
  if (records.length === 0) {
    return { total: 0, success: 0, failed: 0, results: [] }
  }
  const syncPromises = records.map((r) => syncSingleTransactionToZains(r))
  const results = await Promise.all(syncPromises)
  const successCount = results.filter((r) => r.success).length
  const failedCount = results.filter((r) => !r.success).length
  return {
    total: records.length,
    success: successCount,
    failed: failedCount,
    results: results.map((r) => ({
      transactionsToZainsId: r.transactionsToZainsId,
      success: r.success,
      id_transaksi: r.id_transaksi,
      error: r.error,
      rawResponse: r.rawResponse,
      httpStatus: r.httpStatus,
    })),
  }
}

/**
 * Sync transactions_to_zains untuk satu transaction_id secara sequential (satu per satu).
 * Dipakai dari modal agar request ke API Zains berurutan.
 */
export async function syncTransactionsToZainsByTransactionIdSequential(transactionId: number): Promise<{
  total: number
  success: number
  failed: number
  results: Array<{
    transactionsToZainsId: number
    success: boolean
    id_transaksi?: string
    error?: string
    rawResponse?: any
    httpStatus?: number
  }>
}> {
  const records = await getPendingTransactionsToZainsByTransactionId(transactionId)
  if (records.length === 0) {
    return { total: 0, success: 0, failed: 0, results: [] }
  }
  const results: Array<{
    transactionsToZainsId: number
    success: boolean
    id_transaksi?: string
    error?: string
    rawResponse?: any
    httpStatus?: number
  }> = []
  for (const record of records) {
    const r = await syncSingleTransactionToZains(record)
    results.push({
      transactionsToZainsId: r.transactionsToZainsId,
      success: r.success,
      id_transaksi: r.id_transaksi,
      error: r.error,
      rawResponse: r.rawResponse,
      httpStatus: r.httpStatus,
    })
  }
  const successCount = results.filter((r) => r.success).length
  const failedCount = results.filter((r) => !r.success).length
  return {
    total: records.length,
    success: successCount,
    failed: failedCount,
    results,
  }
}

/**
 * Sync single transactions_to_zains record ke Zains (/corez/transaksi/save)
 */
export async function syncSingleTransactionToZains(record: any): Promise<{
  success: boolean
  id_transaksi?: string
  error?: string
  transactionsToZainsId: number
  rawResponse?: any
  httpStatus?: number
}> {
  const transaksiUrl = urlCorezTransaksiSave()

  // Helper: format tgl_transaksi ke YYYY-MM-DD
  const formatDateOnly = (value: any): string | null => {
    if (!value) return null
    if (typeof value === 'string') {
      if (value.length >= 10) return value.slice(0, 10)
      const d = new Date(value)
      return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
    }
    if (value instanceof Date) {
      return value.toISOString().slice(0, 10)
    }
    const d = new Date(value)
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10)
  }

  // tgl_transaksi di DB bertipe DATE, kita pakai apa adanya dari query (string 'YYYY-MM-DD')
  const tglTransaksi: string | null =
    typeof record.tgl_transaksi === 'string'
      ? record.tgl_transaksi.slice(0, 10)
      : formatDateOnly(record.tgl_transaksi)

  // Penentuan cara bayar (tunai vs QRIS) dari payment_method
  const paymentMethod: string = record.payment_method || ''
  const isQris = paymentMethod.toUpperCase().includes('QRIS')
  const idCaraBayar = isQris ? 2 : 1
  const idViaBayar = idCaraBayar

  // Build keterangan: "{kategori} {nama klinik} - {nama pasien}"
  const programName = record.program_name || ''
  const clinicName = record.clinic_name || ''
  const namaPasien = record.nama_pasien || ''
  const ketParts: string[] = []
  if (programName) ketParts.push(programName)
  if (clinicName) ketParts.push(clinicName)
  const baseKeterangan = ketParts.join(' ')
  const keterangan =
    baseKeterangan && namaPasien ? `${baseKeterangan} - ${namaPasien}` : namaPasien || baseKeterangan

  // Konstanta dari requirement
  const ID_KARYAWAN = 1012023087548
  const ID_PENGHIMPUNAN = 6
  const ID_VIA_HIMPUN = 6
  const USER_INSERT = 'admin'
  const VIA_INPUT = 'eclinic'
  const ID_CRM = '1012023087548'
  const DP = 0
  const SEND_OFF = 'off'

  // Generate random alfanumerik yang sama untuk no_bukti dan note
  const randomRef = Math.random().toString(36).substring(2, 10).toUpperCase()

  // Siapkan payload lengkap untuk Zains
  const payload: any = {
    id_program: record.id_program,
    id_kantor: record.id_kantor,
    id_karyawan: ID_KARYAWAN,
    id_donatur: record.id_donatur,
    tgl_transaksi: tglTransaksi,
    id_penghimpunan: ID_PENGHIMPUNAN,
    id_via_himpun: ID_VIA_HIMPUN,
    user_insert: USER_INSERT,
    ViaInput: VIA_INPUT,
    transaksi: Number(record.nominal_transaksi || 0),
    quantity: 1,
    id_crm: ID_CRM,
    id_program_claim: record.id_program,
    keterangan: keterangan,
    no_bukti: randomRef,
    note: randomRef,
    dp: DP,
    id_cara_bayar: idCaraBayar,
    id_affiliate: null,
    send_sms: SEND_OFF,
    send_email: SEND_OFF,
    send_whatsapp: SEND_OFF,
    id_via_bayar: idViaBayar,
  }

  // Aturan id_rekening:
  // - Jika id_via_bayar = 1 => jangan kirim id_rekening di payload
  // - Jika id_via_bayar != 1 => wajib kirim id_rekening
  if (idViaBayar !== 1) {
    payload.id_rekening = record.id_rekening
  }

  try {
    const response = await fetchZainsWithRetry(transaksiUrl, {
      method: 'POST',
      headers: corezPostHeaders(),
      body: JSON.stringify(payload),
    })

    const httpStatus = response.status

    if (!response.ok) {
      const errorText = await response.text()

      // Jika duplikat, Next endpoint mengembalikan HTTP 409 dengan JSON.
      // Kita perlakukan duplikat sebagai sukses agar record ditandai `synced`
      // dan tidak di-retry oleh workflow/batch.
      try {
        const parsed = JSON.parse(errorText) as Partial<any>
        const msg = typeof parsed?.message === 'string' ? parsed.message : ''
        const isDuplicateMessage =
          parsed?.status === false &&
          msg &&
          (msg.toLowerCase().includes('transaksi sudah ada') ||
            msg.toLowerCase().includes('sudah ada') ||
            msg.toLowerCase().includes('telah tercatat'))

        const idTransaksi = parsed?.id_transaksi ?? parsed?.data?.id_transaksi ?? null
        const idDonatur = parsed?.id_donatur ?? parsed?.data?.id_donatur ?? null

        if (isDuplicateMessage && idTransaksi) {
          await sql`
            UPDATE transactions_to_zains
            SET 
              id_transaksi = ${idTransaksi},
              synced = true,
              todo_zains = false,
              updated_at = NOW()
            WHERE id = ${record.id}
          `

          if (record.transaction_id) {
            await sql`
              UPDATE transactions
              SET 
                zains_synced = true,
                zains_sync_at = NOW(),
                updated_at = NOW()
              WHERE id = ${record.transaction_id}
            `
          }

          await logTransactionSyncResult(
            record.clinic_id || null,
            'success',
            { ...parsed, _note: 'Transaksi duplikat (HTTP 409) di Next corez - di-skip dan ditandai synced' },
            payloadWithZainsEnv(payload),
          )

          return {
            success: true,
            id_transaksi: String(idTransaksi),
            transactionsToZainsId: record.id,
            rawResponse: parsed,
            httpStatus: response.status,
          }
        }
      } catch {
        // ignore parse error, jatuh ke return error default
      }

      // Log setiap request yang gagal dengan payload request & response dari Zains
      await logTransactionSyncResult(
        record.clinic_id || null,
        'error',
        errorText,
        payloadWithZainsEnv(payload),
      )

      return {
        success: false,
        error: `HTTP ${httpStatus}: ${errorText}`,
        transactionsToZainsId: record.id,
        rawResponse: errorText,
        httpStatus,
      }
    }

    const data: ZainsTransactionSaveResponse = await response.json()
    // id_transaksi bisa di data.data (sukses) atau top-level (response "transaksi sudah ada")
    const idTransaksi = data.data?.id_transaksi ?? data.id_transaksi

    // Response "transaksi sudah ada" dari Zains: skip dan tandai record sebagai synced agar tidak di-retry
    const isDuplicateMessage =
      data.status === false &&
      data.message &&
      (String(data.message).toLowerCase().includes('sudah ada') ||
        String(data.message).toLowerCase().includes('telah tercatat'))

    if (isDuplicateMessage && idTransaksi) {
      // Update record: tandai synced + simpan id_transaksi yang dikembalikan Zains
      await sql`
        UPDATE transactions_to_zains
        SET 
          id_transaksi = ${idTransaksi},
          synced = true,
          todo_zains = false,
          updated_at = NOW()
        WHERE id = ${record.id}
      `
      if (record.transaction_id) {
        await sql`
          UPDATE transactions
          SET 
            zains_synced = true,
            zains_sync_at = NOW(),
            updated_at = NOW()
          WHERE id = ${record.transaction_id}
        `
      }
      await logTransactionSyncResult(
        record.clinic_id || null,
        'success',
        { ...data, _note: 'Transaksi sudah ada di Zains, di-skip dan ditandai synced' },
        payloadWithZainsEnv(payload),
      )
      return {
        success: true,
        id_transaksi: idTransaksi,
        transactionsToZainsId: record.id,
        rawResponse: data,
        httpStatus,
      }
    }

    if (!idTransaksi) {
      // Log response error ketika tidak ada id_transaksi di response
      await logTransactionSyncResult(
        record.clinic_id || null,
        'error',
        data,
        payloadWithZainsEnv(payload),
      )

      return {
        success: false,
        error: data.message || 'id_transaksi tidak ditemukan di response',
        transactionsToZainsId: record.id,
        rawResponse: data,
        httpStatus,
      }
    }

    // Update record di transactions_to_zains
    await sql`
      UPDATE transactions_to_zains
      SET 
        id_transaksi = ${idTransaksi},
        synced = true,
        todo_zains = false,
        updated_at = NOW()
      WHERE id = ${record.id}
    `

    // Tandai juga transaksi utama sebagai sudah tersinkron ke Zains
    if (record.transaction_id) {
      await sql`
        UPDATE transactions
        SET 
          zains_synced = true,
          zains_sync_at = NOW(),
          updated_at = NOW()
        WHERE id = ${record.transaction_id}
      `
    }

    // Log setiap request yang berhasil dengan payload request & full response dari Zains
    await logTransactionSyncResult(
      record.clinic_id || null,
      'success',
      data,
      payloadWithZainsEnv(payload),
    )

    return {
      success: true,
      id_transaksi: idTransaksi,
      transactionsToZainsId: record.id,
      rawResponse: data,
      httpStatus,
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Error saat sync transaksi ke Zains',
      transactionsToZainsId: record.id,
      rawResponse: undefined,
      httpStatus: undefined,
    }
  }
}

/**
 * Sync batch transactions_to_zains ke Zains (10 data per batch)
 */
export async function syncTransactionsBatchToZains(): Promise<{
  total: number
  success: number
  failed: number
  results: Array<{
    transactionsToZainsId: number
    success: boolean
    id_transaksi?: string
    error?: string
    rawResponse?: any
    httpStatus?: number
  }>
}> {
  const records = await getPendingTransactionsToZains(10)

  if (records.length === 0) {
    return {
      total: 0,
      success: 0,
      failed: 0,
      results: [],
    }
  }

  const syncPromises = records.map((r) => syncSingleTransactionToZains(r))
  const results = await Promise.all(syncPromises)

  const successCount = results.filter((r) => r.success).length
  const failedCount = results.filter((r) => !r.success).length

  // Log ringkasan batch ke console
  console.log(
    `✅ Sync transaksi batch selesai: ${successCount} berhasil, ${failedCount} gagal dari ${records.length} records`,
  )

  // Simpan ringkasan batch ke system_logs (process_type = transaction_zains_sync)
  await logTransactionSyncResult(
    null, // clinic_id bisa null untuk batch summary
    failedCount === 0 ? 'success' : successCount > 0 ? 'success' : 'error',
    `Sync batch transaksi_to_zains: ${successCount} berhasil, ${failedCount} gagal dari ${records.length} records`,
    payloadWithZainsEnv({
      total: records.length,
      success: successCount,
      failed: failedCount,
      results: results.map((r) => ({
        transactionsToZainsId: r.transactionsToZainsId,
        success: r.success,
        id_transaksi: r.id_transaksi,
        error: r.error,
        rawResponse: r.rawResponse,
        httpStatus: r.httpStatus,
      })),
    }),
  )

  // Log detail error per record yang gagal, termasuk ke system_logs
  for (const result of results) {
    if (!result.success) {
      const record = records.find((r) => r.id === result.transactionsToZainsId)
      const clinicId = record?.clinic_id || null

      console.error(
        `❌ Gagal sync transactions_to_zains ID ${result.transactionsToZainsId}: ${result.error}`,
      )

      await logTransactionSyncResult(
        clinicId,
        'error',
        `Gagal sync transactions_to_zains ID ${result.transactionsToZainsId}: ${result.error}`,
        payloadWithZainsEnv({
          transactionsToZainsId: result.transactionsToZainsId,
          transactionId: record?.transaction_id,
          id_program: record?.id_program,
          id_kantor: record?.id_kantor,
          id_donatur: record?.id_donatur,
          nominal_transaksi: record?.nominal_transaksi,
          payment_method: record?.payment_method,
          clinic_id: clinicId,
          clinic_name: record?.clinic_name,
          program_name: record?.program_name,
          error: result.error,
          rawResponse: result.rawResponse,
          httpStatus: result.httpStatus,
        }),
      )
    }
  }

  return {
    total: records.length,
    success: successCount,
    failed: failedCount,
    results: results.map((r) => ({
      transactionsToZainsId: r.transactionsToZainsId,
      success: r.success,
      id_transaksi: r.id_transaksi,
      error: r.error,
      rawResponse: r.rawResponse,
      httpStatus: r.httpStatus,
    })),
  }
}
