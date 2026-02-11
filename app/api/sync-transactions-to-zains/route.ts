import { NextRequest, NextResponse } from 'next/server'
import { syncTransactionsBatchToZains } from '@/lib/services/zains-sync'

/**
 * API Route untuk sync transactions_to_zains ke Zains
 * Proses async, non-blocking - langsung return response
 * Sync akan berjalan di background menggunakan setTimeout
 */
export async function POST(request: NextRequest) {
  try {
    // Jalankan proses di background agar tidak memblokir request
    setTimeout(() => {
      syncTransactionsBatchToZains()
        .then((result) => {
          console.log(
            `✅ Sync transaksi batch selesai: ${result.success} berhasil, ${result.failed} gagal dari ${result.total} records`,
          )
        })
        .catch((error) => {
          console.error('❌ Error saat sync transaksi batch:', error)
        })
    }, 0)

    return NextResponse.json(
      {
        success: true,
        message:
          'Proses sync transaksi dimulai di background. Silakan cek system logs / console untuk hasilnya.',
        note: 'Sync berjalan secara async dan tidak akan memblok proses lain.',
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
 * GET endpoint untuk trigger sync (optional, untuk testing/manual trigger)
 */
export async function GET(request: NextRequest) {
  try {
    setTimeout(() => {
      syncTransactionsBatchToZains()
        .then((result) => {
          console.log(
            `✅ Sync transaksi batch selesai: ${result.success} berhasil, ${result.failed} gagal dari ${result.total} records`,
          )
        })
        .catch((error) => {
          console.error('❌ Error saat sync transaksi batch:', error)
        })
    }, 0)

    return NextResponse.json(
      {
        success: true,
        message:
          'Proses sync transaksi dimulai di background. Silakan cek system logs / console untuk hasilnya.',
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

