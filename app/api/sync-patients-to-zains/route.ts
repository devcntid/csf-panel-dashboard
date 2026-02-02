import { NextRequest, NextResponse } from 'next/server'
import { syncPatientsBatchToZains } from '@/lib/services/zains-sync'

/**
 * API Route untuk sync patients ke Zains
 * Proses async, tidak blocking - langsung return response
 * Sync akan berjalan di background menggunakan setTimeout untuk memastikan non-blocking
 */
export async function POST(request: NextRequest) {
  try {
    // Gunakan setTimeout dengan delay 0 untuk memastikan proses benar-benar async
    // dan tidak memblok event loop
    setTimeout(() => {
      syncPatientsBatchToZains()
        .then(result => {
          console.log(`✅ Sync batch selesai: ${result.success} berhasil, ${result.failed} gagal dari ${result.total} patients`)
        })
        .catch(error => {
          console.error('❌ Error saat sync batch:', error)
        })
    }, 0)

    // Langsung return response tanpa menunggu proses selesai
    return NextResponse.json({
      success: true,
      message: 'Proses sync dimulai di background. Silakan cek system logs untuk hasilnya.',
      note: 'Sync berjalan secara async dan tidak akan memblok proses lain.'
    }, { status: 200 })

  } catch (error: any) {
    console.error('Error starting sync:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Error saat memulai sync'
    }, { status: 500 })
  }
}

/**
 * GET endpoint untuk trigger sync (optional, untuk testing)
 */
export async function GET(request: NextRequest) {
  try {
    // Gunakan setTimeout dengan delay 0 untuk memastikan proses benar-benar async
    setTimeout(() => {
      syncPatientsBatchToZains()
        .then(result => {
          console.log(`✅ Sync batch selesai: ${result.success} berhasil, ${result.failed} gagal dari ${result.total} patients`)
        })
        .catch(error => {
          console.error('❌ Error saat sync batch:', error)
        })
    }, 0)

    return NextResponse.json({
      success: true,
      message: 'Proses sync dimulai di background. Silakan cek system logs untuk hasilnya.'
    }, { status: 200 })

  } catch (error: any) {
    console.error('Error starting sync:', error)
    return NextResponse.json({
      success: false,
      error: error.message || 'Error saat memulai sync'
    }, { status: 500 })
  }
}
