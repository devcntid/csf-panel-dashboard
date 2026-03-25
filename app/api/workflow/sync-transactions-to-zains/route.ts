import { serve } from '@upstash/workflow/nextjs'
import { getZainsTransactionSyncEnabled } from '@/lib/settings'
import { syncTransactionsBatchToZains, ZAINS_API_MAX_ATTEMPTS } from '@/lib/services/zains-sync'

/**
 * Upstash Workflow: satu batch sync transactions_to_zains ke Zains (hingga 10 baris pending).
 */
export const { POST } = serve(
  async (context) => {
    const data = await context.run('sync-transactions-batch', async () => {
      const enabled = await getZainsTransactionSyncEnabled()
      if (!enabled) {
        return { kind: 'skipped' as const }
      }
      const batch = await syncTransactionsBatchToZains()
      return { kind: 'done' as const, batch }
    })
    if (data.kind === 'skipped') {
      return { ok: true, skipped: true, total: 0, successCount: 0, failedCount: 0, results: [] }
    }
    const { batch } = data
    return {
      ok: true,
      total: batch.total,
      successCount: batch.success,
      failedCount: batch.failed,
      results: batch.results,
    }
  },
  {
    retries: ZAINS_API_MAX_ATTEMPTS,
  },
)
