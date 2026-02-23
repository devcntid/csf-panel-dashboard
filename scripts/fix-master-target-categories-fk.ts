/**
 * Migrasi sekali jalan: ubah FK transactions_to_zains.id_program
 * agar ON UPDATE CASCADE (boleh edit id_program_zains di master_target_categories).
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
    console.log('🔄 Memperbaiki FK transactions_to_zains -> master_target_categories...');
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
    console.log('✅ Constraint FK diperbarui (ON UPDATE CASCADE). Edit id_program_zains di Kategori Target sekarang aman.');
  } catch (e) {
    console.error('❌ Error:', e);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

run();
