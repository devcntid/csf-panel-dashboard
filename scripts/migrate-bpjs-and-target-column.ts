/**
 * Migrasi INCREMENTAL – hanya tabel yang bersinggungan.
 * Aman untuk data: TIDAK ada DROP TABLE. Hanya ADD COLUMN dan CREATE TABLE IF NOT EXISTS.
 * Gunakan ini jika DB sudah jalan dan tidak ingin jalankan migrate penuh (yang drop semua).
 *
 * Menjalankan:
 *   npx tsx scripts/migrate-bpjs-and-target-column.ts
 *
 * Dari folder project: csf-panel-dashboard
 */

import * as dotenv from 'dotenv';
import postgres from 'postgres';

dotenv.config({ path: '.env.local' });

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!databaseUrl) {
  console.error('❌ DATABASE_URL atau POSTGRES_URL tidak ditemukan di .env.local');
  process.exit(1);
}

const sql = postgres(databaseUrl);

const statements = [
  `ALTER TABLE "public"."clinic_daily_targets"
   ADD COLUMN IF NOT EXISTS "insurance_type_id" BIGINT REFERENCES "public"."master_insurance_types"("id") ON DELETE SET NULL`,
  `CREATE TABLE IF NOT EXISTS "public"."clinic_bpjs_realizations" (
    "id" BIGSERIAL PRIMARY KEY,
    "clinic_id" BIGINT NOT NULL REFERENCES "public"."clinics"("id") ON DELETE CASCADE,
    "month" INT NOT NULL CHECK ("month" >= 1 AND "month" <= 12),
    "year" INT NOT NULL,
    "total_peserta_terdaftar" INT DEFAULT 0,
    "total_kapitasi_diterima" DECIMAL(15, 2) DEFAULT 0,
    "pbi_count" INT DEFAULT 0,
    "non_pbi_count" INT DEFAULT 0,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT "unique_bpjs_realization_per_clinic_month_year" UNIQUE ("clinic_id", "month", "year")
  )`,
  `CREATE INDEX IF NOT EXISTS idx_bpjs_realization_clinic_period ON "public"."clinic_bpjs_realizations"("clinic_id", "year", "month")`,
];

async function run() {
  try {
    console.log('🚀 Migrasi incremental (BPJS realisasi + kolom insurance_type_id)...');
    for (let i = 0; i < statements.length; i++) {
      await sql.unsafe(statements[i]);
      console.log(`✅ Statement ${i + 1}/${statements.length} selesai.`);
    }
    console.log('✅ Migrasi incremental selesai. Data existing tidak dihapus.');
    await sql.end();
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    await sql.end();
    process.exit(1);
  }
}

run();
