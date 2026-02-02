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

async function addClinicFields() {
  try {
    console.log('🔄 Menambahkan kolom coa_qris dan id_rekening ke tabel clinics...');

    // Check if columns already exist
    const checkCoaQris = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'clinics' AND column_name = 'coa_qris'
    `;
    
    const checkIdRekening = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'clinics' AND column_name = 'id_rekening'
    `;

    if (checkCoaQris.length === 0) {
      await sql`ALTER TABLE clinics ADD COLUMN coa_qris VARCHAR(50)`;
      console.log('✅ Kolom coa_qris berhasil ditambahkan');
    } else {
      console.log('ℹ️  Kolom coa_qris sudah ada, dilewati');
    }

    if (checkIdRekening.length === 0) {
      await sql`ALTER TABLE clinics ADD COLUMN id_rekening VARCHAR(50)`;
      console.log('✅ Kolom id_rekening berhasil ditambahkan');
    } else {
      console.log('ℹ️  Kolom id_rekening sudah ada, dilewati');
    }

    // Update existing clinics with coa_qris and id_rekening values
    console.log('🔄 Mengupdate data klinik yang sudah ada...');
    
    const updateData = [
      { name: 'Klinik Cita Sehat Jakarta', coa_qris: '101.09.003.000', id_rekening: '10109003000' },
      { name: 'Klinik Cita Sehat Medan', coa_qris: '101.09.004.000', id_rekening: '10109004000' },
      { name: 'Klinik Cita Sehat Pekanbaru', coa_qris: '101.09.005.000', id_rekening: '10109005000' },
      { name: 'Klinik Cita Sehat Semarang', coa_qris: '101.09.006.000', id_rekening: '10109006000' },
      { name: 'Klinik Cita Sehat Surabaya', coa_qris: '101.09.007.000', id_rekening: '10109007000' },
      { name: 'Klinik Cita Sehat Yogyakarta', coa_qris: '101.09.008.000', id_rekening: '10109008000' },
    ];

    for (const clinic of updateData) {
      await sql`
        UPDATE clinics 
        SET coa_qris = ${clinic.coa_qris}, id_rekening = ${clinic.id_rekening}, updated_at = NOW()
        WHERE name = ${clinic.name}
      `;
      console.log(`✅ Updated: ${clinic.name}`);
    }

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

addClinicFields();
