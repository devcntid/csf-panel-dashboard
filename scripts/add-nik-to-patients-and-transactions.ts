import * as dotenv from 'dotenv';
import postgres from 'postgres';

// Load environment variables
dotenv.config({ path: '.env.local' });

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!databaseUrl) {
  console.error('❌ DATABASE_URL atau POSTGRES_URL tidak ditemukan di .env.local');
  process.exit(1);
}

// Use postgres client for raw SQL execution
const sql = postgres(databaseUrl);

async function addNikColumns() {
  try {
    console.log('🔄 Menambahkan kolom NIK ke tabel patients dan transactions...');

    // Tambah kolom nik ke patients jika belum ada
    const patientNikColumn = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'patients' AND column_name = 'nik'
    `;

    if (patientNikColumn.length === 0) {
      await sql`ALTER TABLE patients ADD COLUMN nik VARCHAR(20)`;
      console.log('✅ Kolom nik berhasil ditambahkan ke tabel patients');
    } else {
      console.log('ℹ️  Kolom nik di tabel patients sudah ada, dilewati');
    }

    // Tambah index untuk nik di patients
    try {
      await sql`CREATE INDEX IF NOT EXISTS idx_patients_nik ON patients(nik)`;
      console.log('✅ Index idx_patients_nik berhasil dibuat');
    } catch (error: any) {
      if (error.message && error.message.includes('already exists')) {
        console.log('ℹ️  Index idx_patients_nik sudah ada, dilewati');
      } else {
        throw error;
      }
    }

    // Tambah kolom nik ke transactions jika belum ada
    const trxNikColumn = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'transactions' AND column_name = 'nik'
    `;

    if (trxNikColumn.length === 0) {
      await sql`ALTER TABLE transactions ADD COLUMN nik VARCHAR(20)`;
      console.log('✅ Kolom nik berhasil ditambahkan ke tabel transactions');
    } else {
      console.log('ℹ️  Kolom nik di tabel transactions sudah ada, dilewati');
    }

    // Tambah index untuk nik di transactions
    try {
      await sql`CREATE INDEX IF NOT EXISTS idx_trx_nik_partition ON transactions(nik)`;
      console.log('✅ Index idx_trx_nik_partition berhasil dibuat');
    } catch (error: any) {
      if (error.message && error.message.includes('already exists')) {
        console.log('ℹ️  Index idx_trx_nik_partition sudah ada, dilewati');
      } else {
        throw error;
      }
    }

    console.log('✅ Migration NIK selesai!');
    await sql.end();
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error saat migration NIK:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
    await sql.end();
    process.exit(1);
  }
}

addNikColumns();

