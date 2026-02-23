import { NextResponse } from 'next/server'
import { syncTransactionsBatchToZains } from '@/lib/services/zains-sync'

/**
 * Endpoint untuk handle Upstash QStash workflow: sync batch transactions_to_zains ke Zains.
 * Dipanggil oleh QStash (cron atau trigger dari /api/sync-transactions-to-zains).
 * Dengan ini, log QStash akan mencatat eksekusi sync transaction to zains seperti patient to zains.
 */
export async function POST() {
  try {
    const result = await syncTransactionsBatchToZains()
    console.log(
      `✅ [Upstash Workflow] Sync transaksi batch selesai: ${result.success} berhasil, ${result.failed} gagal dari ${result.total} records`,
    )
    return NextResponse.json({
      success: result.failed === 0,
      message: `Sync transaksi ke Zains: ${result.success} berhasil, ${result.failed} gagal dari ${result.total} records`,
      total: result.total,
      success: result.success,
      failed: result.failed,
      results: result.results,
    })
  } catch (error: any) {
    console.error('❌ [Upstash Workflow] Error saat sync transaksi batch ke Zains:', error)
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Error saat sync transaksi ke Zains',
      },
      { status: 500 },
    )
  }
}
