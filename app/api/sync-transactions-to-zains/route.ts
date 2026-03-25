import { NextRequest, NextResponse } from 'next/server'
import { syncTransactionsBatchToZainsWorkflow } from '@/lib/services/zains-sync'

/**
 * API Route untuk sync transactions_to_zains ke Zains.
 * Trigger via @upstash/workflow Client ke /api/workflow/sync-transactions-to-zains.
 * Jika token tidak tersedia atau gagal, sync dijalankan secara lokal.
 */
export async function POST(request: NextRequest) {
  try {
    await syncTransactionsBatchToZainsWorkflow()
    return NextResponse.json(
      {
        success: true,
        message:
          'Proses sync transaksi telah di-trigger (Upstash Workflow atau lokal). Cek dashboard Upstash atau system_logs.',
        note: 'Jika QSTASH_TOKEN dikonfigurasi, eksekusi tercatat sebagai workflow run.',
      },
      { status: 200 },
    )
  } catch (error: any) {
    console.error('Error starting transactions sync:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error saat memulai sync transaksi',
      },
      { status: 500 },
    )
  }
}

/**
 * GET endpoint untuk trigger sync (cron / manual trigger).
 * Sama seperti POST: trigger via Upstash Workflow bila token tersedia.
 */
export async function GET(request: NextRequest) {
  try {
    await syncTransactionsBatchToZainsWorkflow()
    return NextResponse.json(
      {
        success: true,
        message:
          'Proses sync transaksi telah di-trigger (Upstash Workflow atau lokal). Cek dashboard Upstash atau system_logs.',
      },
      { status: 200 },
    )
  } catch (error: any) {
    console.error('Error starting transactions sync:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Error saat memulai sync transaksi',
      },
      { status: 500 },
    )
  }
}

