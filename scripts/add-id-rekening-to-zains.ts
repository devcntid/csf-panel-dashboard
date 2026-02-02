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

async function addIdRekeningToZains() {
  try {
    console.log('🔄 Menambahkan kolom id_rekening ke tabel transactions_to_zains...');

    // Check if column already exists
    const checkColumn = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'transactions_to_zains' AND column_name = 'id_rekening'
    `;

    if (checkColumn.length === 0) {
      // Add column
      await sql`ALTER TABLE transactions_to_zains ADD COLUMN id_rekening VARCHAR(50)`;
      console.log('✅ Kolom id_rekening berhasil ditambahkan');
      
      // Note: Tidak menambahkan foreign key constraint karena id_rekening di clinics tidak UNIQUE
      // Kolom id_rekening tetap bisa digunakan untuk relasi logis tanpa constraint database
      console.log('ℹ️  Kolom id_rekening ditambahkan tanpa foreign key constraint (relasi logis saja)');
    } else {
      console.log('ℹ️  Kolom id_rekening sudah ada, dilewati');
    }

    // Update existing records: isi id_rekening hanya untuk transaksi dengan payment_method QRIS
    console.log('🔄 Mengupdate data transactions_to_zains yang sudah ada...');
    
    const updateResult = await sql`
      UPDATE transactions_to_zains tz
      SET id_rekening = c.id_rekening
      FROM transactions t
      JOIN clinics c ON c.id = t.clinic_id
      WHERE tz.transaction_id = t.id
        AND t.payment_method IS NOT NULL
        AND UPPER(t.payment_method) LIKE '%QRIS%'
        AND c.id_rekening IS NOT NULL
        AND tz.id_rekening IS NULL
    `;
    
    console.log(`✅ Updated ${updateResult.count || 0} records dengan id_rekening untuk payment_method QRIS`);

    console.log('✅ Migration selesai!');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error saat migration:', error.message);
    if (error.message) {
      console.error('Detail:', error.message);
    }
    process.exit(1);
  }
}

addIdRekeningToZains();
