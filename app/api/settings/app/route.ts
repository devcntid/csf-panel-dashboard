import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getAllAppSettings, setAppSetting } from '@/lib/settings'
import { APP_SETTINGS_KEYS } from '@/lib/app-settings-keys'

const ALLOWED_KEYS = new Set(Object.values(APP_SETTINGS_KEYS))

/**
 * GET: Ambil semua app settings (untuk form & layout).
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const settings = await getAllAppSettings()
    return NextResponse.json(settings)
  } catch (error: any) {
    console.error('Error reading app settings:', error)
    return NextResponse.json(
      { error: error?.message || 'Gagal baca pengaturan' },
      { status: 500 }
    )
  }
}

/**
 * PATCH: Update app settings. Body: Record<key, value>. Hanya key yang di-allow akan di-update.
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    if (typeof body !== 'object' || body === null) {
      return NextResponse.json({ error: 'Body harus object' }, { status: 400 })
    }

    for (const [key, value] of Object.entries(body)) {
      if (!ALLOWED_KEYS.has(key)) continue
      await setAppSetting(key, value == null ? '' : String(value))
    }

    const updated = await getAllAppSettings()
    return NextResponse.json(updated)
  } catch (error: any) {
    console.error('Error updating app settings:', error)
    return NextResponse.json(
      { error: error?.message || 'Gagal update pengaturan' },
      { status: 500 }
    )
  }
}
