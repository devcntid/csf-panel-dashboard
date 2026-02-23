/**
 * Migrasi sekali jalan: ubah FK transactions_to_zains (id_program & id_kantor)
 * agar ON UPDATE CASCADE — boleh edit id_program_zains di Kategori Target
 * dan id_kantor_zains di Klinik tanpa error FK.
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

async function run() {
  try {
    // 1. FK id_program -> master_target_categories(id_program_zains)
    console.log('🔄 Memperbaiki FK transactions_to_zains.id_program -> master_target_categories...');
    await sql.unsafe(`
      ALTER TABLE transactions_to_zains
        DROP CONSTRAINT IF EXISTS transactions_to_zains_id_program_fkey;
    `);
    await sql.unsafe(`
      ALTER TABLE transactions_to_zains
        ADD CONSTRAINT transactions_to_zains_id_program_fkey
        FOREIGN KEY (id_program)
        REFERENCES master_target_categories(id_program_zains)
        ON DELETE SET NULL
        ON UPDATE CASCADE;
    `);
    console.log('✅ id_program: ON UPDATE CASCADE.');

    // 2. FK id_kantor -> clinics(id_kantor_zains)
    console.log('🔄 Memperbaiki FK transactions_to_zains.id_kantor -> clinics...');
    await sql.unsafe(`
      ALTER TABLE transactions_to_zains
        DROP CONSTRAINT IF EXISTS transactions_to_zains_id_kantor_fkey;
    `);
    await sql.unsafe(`
      ALTER TABLE transactions_to_zains
        ADD CONSTRAINT transactions_to_zains_id_kantor_fkey
        FOREIGN KEY (id_kantor)
        REFERENCES clinics(id_kantor_zains)
        ON DELETE SET NULL
        ON UPDATE CASCADE;
    `);
    console.log('✅ id_kantor: ON UPDATE CASCADE.');
    console.log('✅ Selesai. Edit id_program_zains (Kategori Target) dan id_kantor_zains (Klinik) sekarang aman.');
  } catch (e) {
    console.error('❌ Error:', e);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

run();
