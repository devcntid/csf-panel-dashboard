import * as dotenv from 'dotenv';
import postgres from 'postgres';

// Load environment variables
dotenv.config({ path: '.env.local' });

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!databaseUrl) {
  console.error('❌ DATABASE_URL atau POSTGRES_URL tidak ditemukan di .env.local');
  process.exit(1);
}

const sql = postgres(databaseUrl);

async function addSummaryFields() {
  try {
    console.log('🔄 Menambahkan kolom summary ke tabel sources dan clinics...');

    // ====== Tambah kolom di tabel sources ======
    const sourceColumns = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'sources'
    `;

    const sourceCols = new Set(sourceColumns.map((c: any) => c.column_name));

    if (!sourceCols.has('slug')) {
      await sql`ALTER TABLE sources ADD COLUMN slug VARCHAR(100) UNIQUE`;
      console.log('✅ Kolom sources.slug berhasil ditambahkan');
    } else {
      console.log('ℹ️  Kolom sources.slug sudah ada, dilewati');
    }

    if (!sourceCols.has('category')) {
      await sql`ALTER TABLE sources ADD COLUMN category VARCHAR(50)`;
      console.log('✅ Kolom sources.category berhasil ditambahkan');
    } else {
      console.log('ℹ️  Kolom sources.category sudah ada, dilewati');
    }

    if (!sourceCols.has('mode')) {
      await sql`ALTER TABLE sources ADD COLUMN mode VARCHAR(50)`;
      console.log('✅ Kolom sources.mode berhasil ditambahkan');
    } else {
      console.log('ℹ️  Kolom sources.mode sudah ada, dilewati');
    }

    if (!sourceCols.has('coa_debet')) {
      await sql`ALTER TABLE sources ADD COLUMN coa_debet TEXT`;
      console.log('✅ Kolom sources.coa_debet berhasil ditambahkan');
    } else {
      console.log('ℹ️  Kolom sources.coa_debet sudah ada, dilewati');
    }

    if (!sourceCols.has('coa_kredit')) {
      await sql`ALTER TABLE sources ADD COLUMN coa_kredit TEXT`;
      console.log('✅ Kolom sources.coa_kredit berhasil ditambahkan');
    } else {
      console.log('ℹ️  Kolom sources.coa_kredit sudah ada, dilewati');
    }

    if (!sourceCols.has('summary_order')) {
      await sql`ALTER TABLE sources ADD COLUMN summary_order INT`;
      console.log('✅ Kolom sources.summary_order berhasil ditambahkan');
    } else {
      console.log('ℹ️  Kolom sources.summary_order sudah ada, dilewati');
    }

    // ====== Tambah kolom di tabel clinics ======
    const clinicColumns = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'clinics'
    `;

    const clinicCols = new Set(clinicColumns.map((c: any) => c.column_name));

    if (!clinicCols.has('summary_alias')) {
      await sql`ALTER TABLE clinics ADD COLUMN summary_alias VARCHAR(50)`;
      console.log('✅ Kolom clinics.summary_alias berhasil ditambahkan');
    } else {
      console.log('ℹ️  Kolom clinics.summary_alias sudah ada, dilewati');
    }

    if (!clinicCols.has('summary_order')) {
      await sql`ALTER TABLE clinics ADD COLUMN summary_order INT`;
      console.log('✅ Kolom clinics.summary_order berhasil ditambahkan');
    } else {
      console.log('ℹ️  Kolom clinics.summary_order sudah ada, dilewati');
    }

    if (!clinicCols.has('include_in_se_summary')) {
      await sql`ALTER TABLE clinics ADD COLUMN include_in_se_summary BOOLEAN DEFAULT true`;
      console.log('✅ Kolom clinics.include_in_se_summary berhasil ditambahkan');
    } else {
      console.log('ℹ️  Kolom clinics.include_in_se_summary sudah ada, dilewati');
    }

    // Kolom opsional untuk konfigurasi COA SE per klinik (dinamis per baris).
    if (!clinicCols.has('se_receipt_coa_debet')) {
      await sql`ALTER TABLE clinics ADD COLUMN se_receipt_coa_debet TEXT`;
      console.log('✅ Kolom clinics.se_receipt_coa_debet berhasil ditambahkan');
    } else {
      console.log('ℹ️  Kolom clinics.se_receipt_coa_debet sudah ada, dilewati');
    }

    if (!clinicCols.has('se_receipt_coa_kredit')) {
      await sql`ALTER TABLE clinics ADD COLUMN se_receipt_coa_kredit TEXT`;
      console.log('✅ Kolom clinics.se_receipt_coa_kredit berhasil ditambahkan');
    } else {
      console.log('ℹ️  Kolom clinics.se_receipt_coa_kredit sudah ada, dilewati');
    }

    // ====== Seed nilai awal untuk sources ======
    console.log('🔄 Mengupdate konfigurasi awal sources untuk summary...');

    await sql`
      UPDATE sources
      SET 
        slug = 'se_klinik',
        category = 'SE',
        mode = 'per_clinic',
        -- COA untuk SE Klinik dibuat dinamis per klinik melalui clinics.se_receipt_coa_*,
        -- jadi di level sumber cukup simpan meta umum & urutan.
        summary_order = COALESCE(summary_order, 10)
      WHERE name = 'SE Klinik'
    `;

    await sql`
      UPDATE sources
      SET 
        slug = 'se_ambulance',
        category = 'SE',
        mode = 'single',
        summary_order = COALESCE(summary_order, 20)
      WHERE name = 'SE Ambulance'
    `;

    await sql`
      UPDATE sources
      SET 
        slug = 'fundraising_project',
        category = 'FUNDRAISING',
        mode = 'single',
        summary_order = COALESCE(summary_order, 30)
      WHERE name = 'Fundraising Project'
    `;

    await sql`
      UPDATE sources
      SET 
        slug = 'fundraising_digital',
        category = 'FUNDRAISING',
        mode = 'single',
        summary_order = COALESCE(summary_order, 40)
      WHERE name = 'Fundraising Digital'
    `;

    // ====== Seed alias & urutan klinik ======
    console.log('🔄 Mengupdate summary_alias & summary_order untuk clinics...');

    const clinicSummaryConfig = [
      { name: 'Klinik Cita Sehat Jakarta', alias: 'JAKTIM', order: 10 },
      { name: 'Klinik Cita Sehat Semarang', alias: 'SEMARANG', order: 20 },
      { name: 'Klinik Cita Sehat Surabaya', alias: 'SURABAYA', order: 30 },
      { name: 'Klinik Cita Sehat Yogyakarta', alias: 'YOGYA', order: 40 },
      { name: 'Klinik Cita Sehat Medan', alias: 'MEDAN', order: 50 },
      { name: 'Klinik Cita Sehat Pekanbaru', alias: 'PEKANBARU', order: 60 },
    ];

    for (const cfg of clinicSummaryConfig) {
      await sql`
        UPDATE clinics
        SET 
          summary_alias = ${cfg.alias},
          summary_order = ${cfg.order},
          include_in_se_summary = COALESCE(include_in_se_summary, true)
        WHERE name = ${cfg.name}
      `;
      console.log(`✅ Klinik ${cfg.name} diupdate sebagai ${cfg.alias}`);
    }

    // Seed sample formula COA khusus untuk Klinik Jakarta Timur (Klinik Cita Sehat Jakarta).
    // Mengikuti contoh URL:
    // only_coa_debet=101.01.002.013,101.02.003.000
    // only_coa_kredit=401.04.002.020,401.04.002.021,401.04.002.022,401.04.002.022,401.04.002.024,...
    await sql`
      UPDATE clinics
      SET 
        se_receipt_coa_debet = '101.01.002.013,101.02.003.000',
        se_receipt_coa_kredit = '401.04.002.020,401.04.002.021,401.04.002.022,401.04.002.022,401.04.002.024,401.04.002.006,401.04.002.007,401.04.002.008,401.04.002.009,401.04.002.010,401.04.002.011,401.04.002.012,401.04.002.013,401.04.002.014,401.04.002.015,401.04.002.016,401.04.002.017,401.04.002.001,401.04.002.002,401.04.002.005,401.04.002.011,401.04.002.012,401.04.002.009,401.04.002.003'
      WHERE name = 'Klinik Cita Sehat Jakarta'
    `;
    console.log('✅ Sample COA SE Klinik di-seed khusus untuk Klinik Cita Sehat Jakarta (JAKTIM)');

    console.log('✅ Penambahan kolom dan seed summary selesai!');
    await sql.end();
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error saat menambahkan kolom summary:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    await sql.end();
    process.exit(1);
  }
}

addSummaryFields();

