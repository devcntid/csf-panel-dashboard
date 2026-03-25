import { serve } from '@upstash/workflow/nextjs'
import { z } from 'zod'
import { sql } from '@/lib/db'
import { getZainsTransactionSyncEnabled } from '@/lib/settings'
import {
  syncPatientToZains,
  syncTransactionsToZainsByTransactionId,
  ZAINS_API_MAX_ATTEMPTS,
} from '@/lib/services/zains-sync'

/**
 * Upstash Workflow: urut — toggle → pasien (Zains) → cek paid_total → transaksi (Zains).
 * paid_total = 0 → tidak memanggil transaksi ke Zains.
 */
const SyncPatientToZainsPayloadSchema = z.object({
  patientId: z.coerce.number().int().positive(),
  transactionId: z.preprocess(
    (v) => (v === null || v === undefined || v === '' ? undefined : v),
    z.coerce.number().int().positive().optional(),
  ),
})

type SyncPatientToZainsPayload = z.infer<typeof SyncPatientToZainsPayloadSchema>

export const { POST } = serve(
  async (context) => {
    const { patientId, transactionId } = context.requestPayload as SyncPatientToZainsPayload
    const hasTransactionId = transactionId != null && transactionId > 0

    const syncEnabled = await context.run('check-zains-toggle', () =>
      getZainsTransactionSyncEnabled(),
    )
    if (!syncEnabled) {
      return {
        success: true,
        skipped: true,
        message: 'Sync ke Zains dimatikan (toggle).',
      }
    }

    const patientRow = await context.run('load-patient-row', async () => {
      const rows = await sql`
        SELECT id, clinic_id, erm_no, full_name, erm_no_for_zains, nik, id_donatur_zains
        FROM patients
        WHERE id = ${patientId}
          AND (id_donatur_zains IS NULL OR id_donatur_zains = '')
          AND erm_no_for_zains IS NOT NULL
          AND erm_no_for_zains != ''
        LIMIT 1
      `
      const list = (Array.isArray(rows) ? rows : []) as Record<string, unknown>[]
      return list[0] ?? null
    })

    if (!patientRow) {
      if (hasTransactionId) {
        const skipZero = await context.run('check-paid-total', async () => {
          const rows = await sql`
            SELECT COALESCE(paid_total, 0)::float8 AS paid FROM transactions WHERE id = ${transactionId!}
          `
          const row = (Array.isArray(rows) ? rows[0] : undefined) as { paid?: number } | undefined
          const paid = Number(row?.paid ?? 0)
          return paid <= 0
        })
        if (skipZero) {
          return {
            success: true,
            skipped: true,
            skippedTransaction: true,
            reason: 'paid_total_zero',
            patientId,
          }
        }
        const trxOnly = await context.run('sync-transactions-only', () =>
          syncTransactionsToZainsByTransactionId(transactionId!),
        )
        return {
          success: true,
          skippedPatient: true,
          patientId,
          transactionId,
          transactionSync: {
            total: trxOnly.total,
            success: trxOnly.success,
            failed: trxOnly.failed,
          },
        }
      }
      return {
        success: true,
        skipped: true,
        message: `Patient ID ${patientId} sudah di-sync atau tidak memiliki erm_no_for_zains`,
      }
    }

    const patientSync = await context.run('sync-patient-zains', async () => {
      const result = await syncPatientToZains(patientRow)
      if (!result.success) {
        throw new Error(result.error || 'Gagal sync patient ke Zains')
      }
      return result
    })

    if (!hasTransactionId) {
      return {
        success: true,
        patientId,
        id_donatur: patientSync.id_donatur,
      }
    }

    const skipTransaction = await context.run('check-paid-total', async () => {
      const rows = await sql`
        SELECT COALESCE(paid_total, 0)::float8 AS paid FROM transactions WHERE id = ${transactionId!}
      `
      const row = (Array.isArray(rows) ? rows[0] : undefined) as { paid?: number } | undefined
      const paid = Number(row?.paid ?? 0)
      return paid <= 0
    })

    if (skipTransaction) {
      return {
        success: true,
        skippedTransaction: true,
        reason: 'paid_total_zero',
        patientId,
        id_donatur: patientSync.id_donatur,
        transactionId,
      }
    }

    const trxResult = await context.run('sync-transactions-zains', () =>
      syncTransactionsToZainsByTransactionId(transactionId!),
    )

    return {
      success: true,
      patientId,
      transactionId,
      id_donatur: patientSync.id_donatur,
      transactionSync: {
        total: trxResult.total,
        success: trxResult.success,
        failed: trxResult.failed,
      },
    }
  },
  {
    schema: SyncPatientToZainsPayloadSchema,
    retries: ZAINS_API_MAX_ATTEMPTS,
  },
)
