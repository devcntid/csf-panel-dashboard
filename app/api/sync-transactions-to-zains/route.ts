import { NextRequest, NextResponse } from 'next/server'
import { syncTransactionsBatchToZainsWorkflow } from '@/lib/services/zains-sync'

/**
 * API Route untuk sync transactions_to_zains ke Zains.
 * Trigger via QStash ke /api/workflow/sync-transactions-to-zains agar muncul di log QStash.
 * Jika QStash tidak tersedia atau gagal, sync dijalankan secara lokal.
 */
export async function POST(request: NextRequest) {
  try {
    await syncTransactionsBatchToZainsWorkflow()
    return NextResponse.json(
      {
        success: true,
        message:
          'Proses sync transaksi telah di-trigger (via QStash atau lokal). Cek log QStash atau system_logs untuk hasilnya.',
        note: 'Jika QStash dikonfigurasi, eksekusi akan tercatat di dashboard QStash.',
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
 * Sama seperti POST: trigger via QStash agar muncul di log QStash.
 */
export async function GET(request: NextRequest) {
  try {
    await syncTransactionsBatchToZainsWorkflow()
    return NextResponse.json(
      {
        success: true,
        message:
          'Proses sync transaksi telah di-trigger (via QStash atau lokal). Cek log QStash atau system_logs untuk hasilnya.',
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

