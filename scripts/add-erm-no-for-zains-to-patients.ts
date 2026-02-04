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

async function addErmNoForZains() {
  try {
    console.log('🔄 Menambahkan kolom erm_no_for_zains ke tabel patients...');

    // Check if column already exists
    const checkColumn = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'patients' AND column_name = 'erm_no_for_zains'
    `;

    if (checkColumn.length === 0) {
      await sql`ALTER TABLE patients ADD COLUMN erm_no_for_zains VARCHAR(100)`;
      console.log('✅ Kolom erm_no_for_zains berhasil ditambahkan');
    } else {
      console.log('ℹ️  Kolom erm_no_for_zains sudah ada, dilewati');
    }

    // Update existing patients dengan erm_no_for_zains = clinic_id + erm_no
    console.log('🔄 Mengupdate data patients yang sudah ada dengan erm_no_for_zains...');
    
    await sql`
      UPDATE patients 
      SET erm_no_for_zains = clinic_id::text || erm_no,
          updated_at = NOW()
      WHERE erm_no_for_zains IS NULL OR erm_no_for_zains = ''
    `;

    const updateResult = await sql`SELECT COUNT(*) as count FROM patients WHERE erm_no_for_zains IS NOT NULL`;
    const count = updateResult[0]?.count || 0;
    console.log(`✅ Updated ${count} patients dengan erm_no_for_zains`);

    // Create index untuk performa query
    console.log('🔄 Membuat index untuk erm_no_for_zains...');
    try {
      await sql`CREATE INDEX IF NOT EXISTS idx_patients_erm_no_for_zains ON patients(erm_no_for_zains)`;
      console.log('✅ Index berhasil dibuat');
    } catch (error: any) {
      if (error.message && error.message.includes('already exists')) {
        console.log('ℹ️  Index sudah ada, dilewati');
      } else {
        throw error;
      }
    }

    console.log('✅ Migration selesai!');
    await sql.end();
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error saat migration:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
    await sql.end();
    process.exit(1);
  }
}

addErmNoForZains();
