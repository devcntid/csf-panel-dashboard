/**
 * Migration TAMBAHAN saja (additive only).
 * Hanya menambah tabel app_settings + default row, tidak DROP / ubah tabel lain.
 * Logic yang sama juga masuk ke migrate utama (scripts/migrate.ts).
 */
import * as dotenv from 'dotenv'
import postgres from 'postgres'

dotenv.config({ path: '.env.local' })

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL
if (!databaseUrl) {
  console.error('❌ DATABASE_URL atau POSTGRES_URL tidak ditemukan di .env.local')
  process.exit(1)
}

const sql = postgres(databaseUrl)

async function run() {
  try {
    console.log('🔄 [Additive] Membuat tabel app_settings (jika belum ada)...')
    await sql`
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `
    console.log('✅ Tabel app_settings siap')

    const existing = await sql`
      SELECT 1 FROM app_settings WHERE key = 'zains_transaction_sync_enabled' LIMIT 1
    `
    if (!existing?.length) {
      await sql`
        INSERT INTO app_settings (key, value)
        VALUES ('zains_transaction_sync_enabled', 'true')
      `
      console.log('✅ Default zains_transaction_sync_enabled = true ditambahkan')
    } else {
      console.log('ℹ️  zains_transaction_sync_enabled sudah ada, dilewati')
    }

    console.log('✅ Migration tambahan (app_settings) selesai!')
    process.exit(0)
  } catch (error: any) {
    console.error('❌ Error:', error?.message || error)
    process.exit(1)
  }
}

run()
