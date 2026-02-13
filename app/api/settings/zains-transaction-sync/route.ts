import { NextRequest, NextResponse } from 'next/server'
import {
  getZainsTransactionSyncEnabled,
  setZainsTransactionSyncEnabled,
} from '@/lib/settings'

/**
 * GET: Baca status toggle sync transaksi ke Zains (default true).
 */
export async function GET() {
  try {
    const enabled = await getZainsTransactionSyncEnabled()
    return NextResponse.json({ enabled })
  } catch (error: any) {
    console.error('Error reading zains transaction sync setting:', error)
    return NextResponse.json(
      { error: error?.message || 'Gagal baca setting' },
      { status: 500 }
    )
  }
}

/**
 * PATCH: Set toggle sync transaksi ke Zains.
 * Body: { enabled: boolean, activateAllPending?: boolean }
 * - enabled: true = sync aktif (cron/workflow akan hit Zains), false = tidak ada yang di-POST ke Zains
 * - activateAllPending: jika true saat enabled = true, set todo_zains = true untuk semua record yang synced = false
 *   sehingga seluruh data (manual/upload) akan ikut di-sync saat cron/workflow jalan.
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const enabled =
      body.enabled === true || (typeof body.enabled === 'string' && body.enabled.toLowerCase() === 'true')
    const activateAllPending = body.activateAllPending === true

    await setZainsTransactionSyncEnabled(enabled, {
      activateAllPending: enabled ? activateAllPending : false,
    })

    return NextResponse.json({
      success: true,
      enabled,
      activateAllPending: enabled && activateAllPending,
    })
  } catch (error: any) {
    console.error('Error updating zains transaction sync setting:', error)
    return NextResponse.json(
      { error: error?.message || 'Gagal update setting' },
      { status: 500 }
    )
  }
}
