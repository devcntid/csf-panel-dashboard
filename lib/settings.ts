'use server'

import { sql } from '@/lib/db'

const KEY_ZAINS_TRANSACTION_SYNC_ENABLED = 'zains_transaction_sync_enabled'

/**
 * Ambil satu nilai app_setting by key. Return null jika tidak ada.
 */
export async function getAppSetting(key: string): Promise<string | null> {
  try {
    const rows = await sql`
      SELECT value FROM app_settings WHERE key = ${key} LIMIT 1
    `
    const row = Array.isArray(rows) ? rows[0] : rows
    if (!row || (row as any).value == null) return null
    return String((row as any).value)
  } catch {
    return null
  }
}

/**
 * Ambil semua app_settings sebagai Record<key, value>.
 */
export async function getAllAppSettings(): Promise<Record<string, string>> {
  try {
    const rows = await sql`SELECT key, value FROM app_settings`
    const arr = Array.isArray(rows) ? rows : [rows]
    const out: Record<string, string> = {}
    for (const r of arr) {
      const k = (r as any).key
      const v = (r as any).value
      if (k != null) out[k] = v != null ? String(v) : ''
    }
    return out
  } catch {
    return {}
  }
}

/**
 * Set/update satu app_setting. Menggunakan UPSERT (update jika key sudah ada).
 */
export async function setAppSetting(key: string, value: string): Promise<void> {
  await sql`
    INSERT INTO app_settings (key, value)
    VALUES (${key}, ${value})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
  `
}

/**
 * Baca apakah sync transaksi ke Zains aktif (toggle global).
 * Default true jika tabel/row belum ada (sesuai default DB todo_zains = true).
 */
export async function getZainsTransactionSyncEnabled(): Promise<boolean> {
  try {
    const rows = await sql`
      SELECT value FROM app_settings
      WHERE key = ${KEY_ZAINS_TRANSACTION_SYNC_ENABLED}
      LIMIT 1
    `
    const row = Array.isArray(rows) ? rows[0] : rows
    if (!row || (row as any).value == null) return true
    const v = String((row as any).value).toLowerCase()
    return v === 'true' || v === '1'
  } catch {
    return true
  }
}

/**
 * Set toggle sync transaksi ke Zains.
 * Jika enabled = true, opsional: set todo_zains = true untuk semua record yang synced = false
 * agar seluruh data (manual/upload) ikut di-sync saat cron/workflow jalan.
 */
export async function setZainsTransactionSyncEnabled(
  enabled: boolean,
  options?: { activateAllPending?: boolean }
): Promise<void> {
  await sql`
    INSERT INTO app_settings (key, value)
    VALUES (${KEY_ZAINS_TRANSACTION_SYNC_ENABLED}, ${enabled ? 'true' : 'false'})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
  `
  if (enabled && options?.activateAllPending) {
    await sql`
      UPDATE transactions_to_zains
      SET todo_zains = true, updated_at = NOW()
      WHERE synced = false
    `
  }
}
