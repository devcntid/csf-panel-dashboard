/**
 * Seed khusus untuk app_settings (pengaturan dinamisasi).
 * Sifatnya UPDATE: menggunakan INSERT ... ON CONFLICT (key) DO UPDATE.
 * Men-set nilai default untuk: logo, warna sidebar, nama perusahaan,
 * teks hero & fitur login (richtext), tone background login, background image login.
 */
import { neon } from '@neondatabase/serverless'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })
const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL
if (!databaseUrl) {
  console.error('❌ DATABASE_URL atau POSTGRES_URL tidak ditemukan di .env.local')
  process.exit(1)
}

const sql = neon(databaseUrl)

const DEFAULT_LOGIN_CONTENT = `<h2>Kelola Klinik dengan Lebih Efisien</h2>
<p>Pantau transaksi, kelola pasien, dan optimalkan operasional klinik dalam satu dashboard yang terpadu.</p>
<ul>
<li><strong>Monitoring Real-time</strong> — Lihat progres transaksi dan aktivitas klinik secara langsung dengan update real-time.</li>
<li><strong>Tim Lebih Terkoordinasi</strong> — Berikan akses terkontrol untuk operator dan tim lapangan dengan manajemen peran yang fleksibel.</li>
<li><strong>Laporan Siap Pakai</strong> — Unduh laporan transaksi dan kehadiran pasien untuk evaluasi dan analisis operasional klinik.</li>
</ul>`

const DEFAULT_APP_SETTINGS: Array<{ key: string; value: string }> = [
  { key: 'app_title', value: 'Cita Sehat - Dashboard' },
  { key: 'app_favicon_url', value: '/favicon.png' },
  { key: 'app_logo_url', value: '/asset/logo_csf_new.png' },
  { key: 'app_sidebar_bg_color', value: '#00786F' },
  { key: 'app_company_name', value: 'Cita Sehat Foundation' },
  { key: 'app_login_content', value: DEFAULT_LOGIN_CONTENT },
  {
    key: 'app_login_tone_bg',
    value:
      'linear-gradient(to bottom right, rgba(19,78,74,0.85), rgba(25,58,58,0.75), rgba(30,58,138,0.85))',
  },
  {
    key: 'app_login_bg_image',
    value: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d',
  },
]

async function seedAppSettings() {
  try {
    console.log('🌱 Memulai seed app_settings (pengaturan dinamisasi)...')

    for (const row of DEFAULT_APP_SETTINGS) {
      await sql`
        INSERT INTO app_settings (key, value)
        VALUES (${row.key}, ${row.value})
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
      `
    }

    console.log(`✅ app_settings seeded (${DEFAULT_APP_SETTINGS.length} keys).`)
    process.exit(0)
  } catch (error: any) {
    console.error('❌ Error seed app_settings:', error?.message)
    process.exit(1)
  }
}

seedAppSettings()
