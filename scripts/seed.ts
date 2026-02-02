import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!databaseUrl) {
  console.error('❌ DATABASE_URL atau POSTGRES_URL tidak ditemukan di .env.local');
  process.exit(1);
}

const sql = neon(databaseUrl);

async function seed() {
  try {
    console.log('🌱 Memulai seed database...');

    // A. Insert Clinics (dengan proteksi duplicate berdasarkan name)
    console.log('📝 Seeding clinics...');
    
    const clinicsData = [
      {
        name: 'Klinik Cita Sehat Surabaya',
        location: 'PRATAMA RAWAT INAP CITA SEHAT SURABAYA',
        login_url: 'https://csf.eclinic.id/login',
        username: 'harini_t',
        password_encrypted: 'H4rini0k!_',
        kode_coa: '101.01.002.030',
        id_kantor_zains: '107',
        coa_qris: '101.09.007.000',
        id_rekening: '10109007000',
        is_active: true
      },
      {
        name: 'Klinik Cita Sehat Semarang',
        location: 'PRATAMA CITA SEHAT SEMARANG',
        login_url: 'https://csf.eclinic.id/login',
        username: 'hariniiii',
        password_encrypted: 'H4rini0k!_',
        kode_coa: '101.01.002.028',
        id_kantor_zains: '105',
        coa_qris: '101.09.006.000',
        id_rekening: '10109006000',
        is_active: true
      },
      {
        name: 'Klinik Cita Sehat Jakarta',
        location: 'PRATAMA CITA SEHAT JAKARTA',
        login_url: 'https://csf.eclinic.id/login',
        username: 'harini',
        password_encrypted: 'H4rini0k!_',
        kode_coa: '101.01.002.013',
        id_kantor_zains: '97',
        coa_qris: '101.09.003.000',
        id_rekening: '10109003000',
        is_active: true
      },
      {
        name: 'Klinik Cita Sehat Medan',
        location: 'CITA SEHAT MEDAN',
        login_url: 'https://csf.eclinic.id/login',
        username: 'harinii',
        password_encrypted: 'H4rini0k!_',
        kode_coa: '101.01.002.023',
        id_kantor_zains: '101',
        coa_qris: '101.09.004.000',
        id_rekening: '10109004000',
        is_active: true
      },
      {
        name: 'Klinik Cita Sehat Pekanbaru',
        location: 'CITASEHAT PEKANBARU',
        login_url: 'https://csf.eclinic.id/login',
        username: 'harini_t4',
        password_encrypted: 'H4rini0k!_',
        kode_coa: '101.01.002.026',
        id_kantor_zains: '104',
        coa_qris: '101.09.005.000',
        id_rekening: '10109005000',
        is_active: true
      },
      {
        name: 'Klinik Cita Sehat Yogyakarta',
        location: 'PRATAMA CITA SEHAT YOGYAKARTA - PLERET',
        login_url: 'https://csf.eclinic.id/login',
        username: 'harini_t2',
        password_encrypted: 'H4rini0k!_',
        kode_coa: '101.01.002.032',
        id_kantor_zains: '109',
        coa_qris: '101.09.008.000',
        id_rekening: '10109008000',
        is_active: true
      }
    ];
    
    for (const clinic of clinicsData) {
      // Check if clinic already exists
      const existing = await sql`
        SELECT id FROM clinics WHERE name = ${clinic.name} LIMIT 1
      `;
      
      if (existing.length > 0) {
        // Update existing clinic
        await sql`
          UPDATE clinics 
          SET 
            location = ${clinic.location},
            login_url = ${clinic.login_url},
            username = ${clinic.username},
            password_encrypted = ${clinic.password_encrypted},
            kode_coa = ${clinic.kode_coa},
            id_kantor_zains = ${clinic.id_kantor_zains},
            coa_qris = ${clinic.coa_qris || null},
            id_rekening = ${clinic.id_rekening || null},
            is_active = ${clinic.is_active},
            updated_at = NOW()
          WHERE name = ${clinic.name}
        `;
      } else {
        // Insert new clinic
        await sql`
          INSERT INTO clinics (name, location, login_url, username, password_encrypted, kode_coa, id_kantor_zains, coa_qris, id_rekening, is_active)
          VALUES (
            ${clinic.name},
            ${clinic.location},
            ${clinic.login_url},
            ${clinic.username},
            ${clinic.password_encrypted},
            ${clinic.kode_coa},
            ${clinic.id_kantor_zains},
            ${clinic.coa_qris || null},
            ${clinic.id_rekening || null},
            ${clinic.is_active}
          )
        `;
      }
    }
    
    console.log('✅ Clinics seeded');

    // B. Master Polies (dengan proteksi duplicate)
    console.log('📝 Seeding master_polies...');
    await sql`
      INSERT INTO master_polies (name, code) 
      VALUES 
        ('Poli Umum', 'GP'), 
        ('Poli Gigi', 'DENTAL'), 
        ('Poli KIA/Kebidanan', 'KIA'), 
        ('Laboratorium', 'LAB'), 
        ('Radiologi', 'RAD'), 
        ('Apotek', 'PHARM')
      ON CONFLICT (name) DO NOTHING
    `;
    console.log('✅ Master polies seeded');

    // B0. Master Insurance Types (dengan proteksi duplicate)
    console.log('📝 Seeding master_insurance_types...');
    await sql`
      INSERT INTO master_insurance_types (name, code) 
      VALUES 
        ('BPJS', 'BPJS'), 
        ('UMUM', 'UMUM'), 
        ('ASURANSI', 'ASURANSI'), 
        ('KIS', 'KIS')
      ON CONFLICT (name) DO NOTHING
    `;
    console.log('✅ Master insurance types seeded');

    // B1. Master Target Categories (dengan proteksi duplicate)
    console.log('📝 Seeding master_target_categories...');
    await sql`
      INSERT INTO master_target_categories (name, kode_coa, id_program_zains, description) 
      VALUES 
        ('Tindakan', '401.04.002.020', '30', ''),
        ('Laboratorium', '401.04.002.021', '31', ''),
        ('Obat-obatan', '401.04.002.022', '32', NULL),
        ('Alat Kesehatan', '401.04.002.023', '33', NULL),
        ('MCU', '401.04.002.024', '34', NULL),
        ('Pembulatan', '401.04.002.025', '35', NULL)
      ON CONFLICT (name) DO UPDATE
      SET 
        kode_coa = EXCLUDED.kode_coa,
        id_program_zains = EXCLUDED.id_program_zains
    `;
    console.log('✅ Master target categories seeded');

    // B2. Sources (Sumber Target Harian)
    console.log('📝 Seeding sources...');
    await sql`
      INSERT INTO sources (name)
      VALUES 
        ('SE Klinik'),
        ('SE Ambulance'),
        ('Fundraising Project'),
        ('Fundraising Digital')
      ON CONFLICT (name) DO NOTHING
    `;
    console.log('✅ Sources seeded');

    // C. Clinic Poly Mappings (dengan proteksi duplicate)
    console.log('📝 Seeding clinic_poly_mappings...');
    
    // Get all clinics and polies
    const allClinics = await sql`
      SELECT id, name FROM clinics ORDER BY id
    `;
    const allPolies = await sql`
      SELECT id, name FROM master_polies ORDER BY id
    `;
    
    // Mapping polies untuk setiap klinik
    // Pastikan selalu ada tepat 60 baris mapping (6 klinik × 10 raw_poly_name)
    const rawMappings = [
      'Poli Umum',
      'POLI UMUM',
      'Poli Gigi',
      'POLI GIGI',
      'Poli KIA',
      'POLI KIA',
      'Laboratorium',
      'LABORATORIUM',
      'Apotek',
      'FARMASI',
    ];

    for (const clinic of allClinics) {
      for (const rawName of rawMappings) {
        const masterName =
          rawName.toUpperCase().includes('UMUM') ? 'Poli Umum' :
          rawName.toUpperCase().includes('GIGI') ? 'Poli Gigi' :
          rawName.toUpperCase().includes('KIA') ? 'Poli KIA/Kebidanan' :
          rawName.toUpperCase().includes('LABORATORIUM') ? 'Laboratorium' :
          'Apotek';

        const masterPoly = allPolies.find((p: any) => p.name === masterName);
        if (masterPoly) {
          await sql`
            INSERT INTO clinic_poly_mappings (clinic_id, raw_poly_name, master_poly_id, is_revenue_center) 
            VALUES (${clinic.id}, ${rawName}, ${masterPoly.id}, true)
            ON CONFLICT (clinic_id, raw_poly_name) DO NOTHING
          `;
        }
      }
    }
    console.log('✅ Clinic poly mappings seeded');

    // C1. Clinic Insurance Mappings (dengan proteksi duplicate)
    console.log('📝 Seeding clinic_insurance_mappings...');
    
    // Get all clinics and insurance types
    const allClinicsForInsurance = await sql`
      SELECT id, name FROM clinics ORDER BY id
    `;
    const allInsuranceTypes = await sql`
      SELECT id, name FROM master_insurance_types ORDER BY id
    `;
    
    // Mapping insurance types untuk setiap klinik
    const rawInsuranceMappings = [
      'BPJS',
      'bpjs',
      'BPJS Kesehatan',
      'UMUM',
      'umum',
      'TUNAI',
      'Asuransi',
      'ASURANSI',
      'KIS',
      'kis',
    ];

    for (const clinic of allClinicsForInsurance) {
      for (const rawName of rawInsuranceMappings) {
        const masterName =
          rawName.toUpperCase().includes('BPJS') ? 'BPJS' :
          rawName.toUpperCase().includes('UMUM') || rawName.toUpperCase().includes('TUNAI') ? 'UMUM' :
          rawName.toUpperCase().includes('ASURANSI') ? 'ASURANSI' :
          rawName.toUpperCase().includes('KIS') ? 'KIS' :
          'UMUM';

        const masterInsurance = allInsuranceTypes.find((i: any) => i.name === masterName);
        if (masterInsurance) {
          await sql`
            INSERT INTO clinic_insurance_mappings (clinic_id, raw_insurance_name, master_insurance_id) 
            VALUES (${clinic.id}, ${rawName}, ${masterInsurance.id})
            ON CONFLICT (clinic_id, raw_insurance_name) DO NOTHING
          `;
        }
      }
    }
    console.log('✅ Clinic insurance mappings seeded');

    // D. Insert Patients (harus dibuat dulu sebelum transactions)
    console.log('📝 Seeding patients...');
    
    const patientsData = [
      { clinic_name: 'Klinik Cita Sehat Surabaya', erm_no: '00116909', full_name: 'M. NURHADI', visit_date: '2026-01-20' },
      { clinic_name: 'Klinik Cita Sehat Surabaya', erm_no: '00115853', full_name: 'NIKEN ARDYANA PUSPITA SARI', visit_date: '2026-01-20' },
      { clinic_name: 'Klinik Cita Sehat Semarang', erm_no: '00200001', full_name: 'SAMPLE PATIENT SEMARANG', visit_date: '2026-01-15' },
      { clinic_name: 'Klinik Cita Sehat Jakarta', erm_no: '00300001', full_name: 'SAMPLE PATIENT JAKARTA', visit_date: '2026-01-18' },
      { clinic_name: 'Klinik Cita Sehat Medan', erm_no: '00400001', full_name: 'SAMPLE PATIENT MEDAN', visit_date: '2026-01-19' },
    ];
    
    for (const patient of patientsData) {
      const clinic = await sql`
        SELECT id FROM clinics WHERE name = ${patient.clinic_name} LIMIT 1
      `;
      
      if (clinic.length > 0) {
        await sql`
          INSERT INTO patients (clinic_id, erm_no, full_name, first_visit_at, last_visit_at, visit_count)
          VALUES (
            ${clinic[0].id},
            ${patient.erm_no},
            ${patient.full_name},
            ${patient.visit_date},
            ${patient.visit_date},
            1
          )
          ON CONFLICT (clinic_id, erm_no) DO NOTHING
        `;
      }
    }
    console.log('✅ Patients seeded');

    // D1. Insert Transactions (dengan proteksi duplicate)
    console.log('📝 Seeding transactions...');
    
    const transactionsData = [
      {
        clinic_name: 'Klinik Cita Sehat Surabaya',
        trx_date: '2026-01-20',
        trx_no: 'NT-0000049995',
        erm_no: '00116909',
        patient_name: 'M. NURHADI',
        insurance_type: 'BPJS',
        polyclinic: 'Poli Umum',
        payment_method: 'TUNAI',
        bill_action: 15000,
        bill_total: 15000,
        paid_action: 15000,
        paid_total: 15000,
        zains_synced: true
      },
      {
        clinic_name: 'Klinik Cita Sehat Surabaya',
        trx_date: '2026-01-20',
        trx_no: '-',
        erm_no: '00115853',
        patient_name: 'NIKEN ARDYANA PUSPITA SARI',
        insurance_type: 'BPJS',
        polyclinic: 'Poli Umum',
        payment_method: '-',
        bill_action: 15000,
        bill_total: 15000,
        covered_action: 15000,
        covered_total: 15000,
        paid_total: 0,
        zains_synced: false
      },
      {
        clinic_name: 'Klinik Cita Sehat Semarang',
        trx_date: '2026-01-15',
        trx_no: 'NT-0000050001',
        erm_no: '00200001',
        patient_name: 'SAMPLE PATIENT SEMARANG',
        insurance_type: 'UMUM',
        polyclinic: 'Poli Gigi',
        payment_method: 'TUNAI',
        bill_action: 25000,
        bill_total: 25000,
        paid_action: 25000,
        paid_total: 25000,
        zains_synced: true
      },
    ];
    
    for (const trx of transactionsData) {
      const clinic = await sql`
        SELECT id FROM clinics WHERE name = ${trx.clinic_name} LIMIT 1
      `;
      
      if (clinic.length > 0) {
        const patient = await sql`
          SELECT id FROM patients WHERE clinic_id = ${clinic[0].id} AND erm_no = ${trx.erm_no} LIMIT 1
        `;
        
        // Get poly_id from master_polies based on polyclinic name
        const poly = await sql`
          SELECT mp.id 
          FROM master_polies mp
          JOIN clinic_poly_mappings cpm ON cpm.master_poly_id = mp.id
          WHERE cpm.clinic_id = ${clinic[0].id} 
            AND cpm.raw_poly_name = ${trx.polyclinic}
          LIMIT 1
        `;
        
        // Get insurance_type_id from master_insurance_types based on insurance_type name
        const insurance = await sql`
          SELECT mit.id 
          FROM master_insurance_types mit
          JOIN clinic_insurance_mappings cim ON cim.master_insurance_id = mit.id
          WHERE cim.clinic_id = ${clinic[0].id} 
            AND cim.raw_insurance_name = ${trx.insurance_type}
          LIMIT 1
        `;
        
        const patientId = patient.length > 0 ? patient[0].id : null;
        const polyId = poly.length > 0 ? poly[0].id : null;
        const insuranceTypeId = insurance.length > 0 ? insurance[0].id : null;
        
        if (trx.covered_action !== undefined) {
          await sql`
            INSERT INTO transactions (
              clinic_id, patient_id, poly_id, insurance_type_id, trx_date, trx_no, erm_no, patient_name, 
              insurance_type, polyclinic, payment_method, 
              bill_action, bill_total, covered_action, covered_total, paid_action, paid_total, zains_synced
            ) 
            VALUES (
              ${clinic[0].id},
              ${patientId},
              ${polyId},
              ${insuranceTypeId},
              ${trx.trx_date},
              ${trx.trx_no},
              ${trx.erm_no},
              ${trx.patient_name},
              ${trx.insurance_type},
              ${trx.polyclinic},
              ${trx.payment_method},
              ${trx.bill_action},
              ${trx.bill_total},
              ${trx.covered_action},
              ${trx.covered_total},
              ${trx.paid_action || 0},
              ${trx.paid_total},
              ${trx.zains_synced}
            )
            ON CONFLICT (clinic_id, erm_no, trx_date, polyclinic, bill_total) DO NOTHING
          `;
        } else {
          await sql`
            INSERT INTO transactions (
              clinic_id, patient_id, poly_id, insurance_type_id, trx_date, trx_no, erm_no, patient_name, 
              insurance_type, polyclinic, payment_method, 
              bill_action, bill_total, paid_action, paid_total, zains_synced
            ) 
            VALUES (
              ${clinic[0].id},
              ${patientId},
              ${polyId},
              ${insuranceTypeId},
              ${trx.trx_date},
              ${trx.trx_no},
              ${trx.erm_no},
              ${trx.patient_name},
              ${trx.insurance_type},
              ${trx.polyclinic},
              ${trx.payment_method},
              ${trx.bill_action},
              ${trx.bill_total},
              ${trx.paid_action || 0},
              ${trx.paid_total},
              ${trx.zains_synced}
            )
            ON CONFLICT (clinic_id, erm_no, trx_date, polyclinic, bill_total) DO NOTHING
          `;
        }
      }
    }
    console.log('✅ Transactions seeded');

    // E. Insert Target Config & Data (dengan proteksi duplicate)
    // Sekarang menggunakan master_polies bukan master_target_categories
    console.log('📝 Seeding clinic_target_configs...');
    
    // Get all polies untuk config
    const polyUmum = await sql`SELECT id FROM master_polies WHERE name = 'Poli Umum' LIMIT 1`;
    const polyApotek = await sql`SELECT id FROM master_polies WHERE name = 'Apotek' LIMIT 1`;
    const polyKIA = await sql`SELECT id FROM master_polies WHERE name = 'Poli KIA/Kebidanan' LIMIT 1`;
    const polyLab = await sql`SELECT id FROM master_polies WHERE name = 'Laboratorium' LIMIT 1`;

    // Seed target configs untuk beberapa klinik
    const targetConfigsData = [
      { clinic_name: 'Klinik Cita Sehat Surabaya', poly_name: 'Poli Umum', year: 2026, base_rate: 50000 },
      { clinic_name: 'Klinik Cita Sehat Surabaya', poly_name: 'Poli Umum', year: 2025, base_rate: 45000 },
      { clinic_name: 'Klinik Cita Sehat Surabaya', poly_name: 'Apotek', year: 2026, base_rate: 5000000 },
      { clinic_name: 'Klinik Cita Sehat Semarang', poly_name: 'Poli Umum', year: 2026, base_rate: 55000 },
      { clinic_name: 'Klinik Cita Sehat Semarang', poly_name: 'Poli KIA/Kebidanan', year: 2026, base_rate: 60000 },
      { clinic_name: 'Klinik Cita Sehat Jakarta', poly_name: 'Poli Umum', year: 2026, base_rate: 52000 },
      { clinic_name: 'Klinik Cita Sehat Jakarta', poly_name: 'Laboratorium', year: 2026, base_rate: 75000 },
    ];

    for (const config of targetConfigsData) {
      const clinic = await sql`SELECT id FROM clinics WHERE name = ${config.clinic_name} LIMIT 1`;
      const poly = await sql`SELECT id FROM master_polies WHERE name = ${config.poly_name} LIMIT 1`;
      
      if (clinic.length > 0 && poly.length > 0) {
        try {
          await sql`
            INSERT INTO clinic_target_configs (clinic_id, master_poly_id, target_year, base_rate) 
            VALUES (${clinic[0].id}, ${poly[0].id}, ${config.year}, ${config.base_rate})
            ON CONFLICT (clinic_id, master_poly_id, target_year) DO NOTHING
          `;
        } catch (error: any) {
          // Skip jika sudah ada (unique constraint)
          if (!error.message?.includes('unique') && !error.message?.includes('duplicate')) {
            console.error(`Error seeding target config for ${config.clinic_name} - ${config.poly_name}:`, error.message);
          }
        }
      }
    }
    console.log('✅ Target configs seeded');

    // E1. Insert Daily Targets (dengan sumber)
    console.log('📝 Seeding clinic_daily_targets...');
    
    const sources = await sql`SELECT id, name FROM sources ORDER BY id`;
    
    const getSourceId = (name: string) => {
      const s = sources.find((x: any) => x.name === name);
      return s ? s.id : null;
    };

    const dailyTargetsData = [
      // Klinik Surabaya - Poli Umum dengan 4 sumber
      { clinic_name: 'Klinik Cita Sehat Surabaya', poly_name: 'Poli Umum', source_name: 'SE Klinik',            date: '2026-01-20', visits: 30, revenue: 1500000, tipe_donatur: 'retail' },
      { clinic_name: 'Klinik Cita Sehat Surabaya', poly_name: 'Poli Umum', source_name: 'SE Ambulance',         date: '2026-01-20', visits: 5,  revenue: 250000,  tipe_donatur: 'retail' },
      { clinic_name: 'Klinik Cita Sehat Surabaya', poly_name: 'Poli Umum', source_name: 'Fundraising Project',  date: '2026-01-20', visits: 10, revenue: 500000,  tipe_donatur: 'corporate' },
      { clinic_name: 'Klinik Cita Sehat Surabaya', poly_name: 'Poli Umum', source_name: 'Fundraising Digital',  date: '2026-01-20', visits: 8,  revenue: 400000,  tipe_donatur: 'digital' },

      // Klinik Jakarta - Poli Umum
      { clinic_name: 'Klinik Cita Sehat Jakarta',  poly_name: 'Poli Umum', source_name: 'SE Klinik',            date: '2026-01-20', visits: 40, revenue: 2080000, tipe_donatur: 'retail' },
      { clinic_name: 'Klinik Cita Sehat Jakarta',  poly_name: 'Poli Umum', source_name: 'Fundraising Project',  date: '2026-01-20', visits: 15, revenue: 780000,  tipe_donatur: 'corporate' },

      // Klinik Jakarta - Laboratorium
      { clinic_name: 'Klinik Cita Sehat Jakarta',  poly_name: 'Laboratorium', source_name: 'SE Klinik',         date: '2026-01-20', visits: 20, revenue: 1500000, tipe_donatur: 'retail' },
      { clinic_name: 'Klinik Cita Sehat Jakarta',  poly_name: 'Laboratorium', source_name: 'Fundraising Digital', date: '2026-01-20', visits: 5, revenue: 400000, tipe_donatur: 'digital' },

      // Klinik Semarang
      { clinic_name: 'Klinik Cita Sehat Semarang', poly_name: 'Poli Umum',        source_name: 'SE Klinik',   date: '2026-01-20', visits: 25, revenue: 1375000, tipe_donatur: 'retail' },
      { clinic_name: 'Klinik Cita Sehat Semarang', poly_name: 'Poli KIA/Kebidanan', source_name: 'SE Klinik', date: '2026-01-20', visits: 15, revenue: 900000,  tipe_donatur: 'retail' },
    ];
    
    for (const target of dailyTargetsData) {
      const clinic = await sql`SELECT id FROM clinics WHERE name = ${target.clinic_name} LIMIT 1`;
      const poly = await sql`SELECT id FROM master_polies WHERE name = ${target.poly_name} LIMIT 1`;
      const sourceId = getSourceId(target.source_name);
      
      if (clinic.length > 0 && poly.length > 0 && sourceId) {
        try {
          await sql`
            INSERT INTO clinic_daily_targets (
              clinic_id, 
              master_poly_id, 
              source_id, 
              target_type,
              target_date, 
              target_visits, 
              target_revenue, 
              tipe_donatur
            )
            VALUES (
              ${clinic[0].id}, 
              ${poly[0].id}, 
              ${sourceId}, 
              'daily',
              ${target.date}, 
              ${target.visits}, 
              ${target.revenue}, 
              ${target.tipe_donatur}
            )
          `;
        } catch (error: any) {
          // Skip jika sudah ada (unique constraint dari partial index)
          if (!error.message?.includes('unique') && !error.message?.includes('duplicate')) {
            console.error(`Error seeding daily target for ${target.clinic_name} - ${target.poly_name} - ${target.date}:`, error.message);
          }
        }
      }
    }
    console.log('✅ Daily targets seeded');

    // D2. Update transactions untuk link ke patient_id (jika belum ter-link)
    console.log('📝 Linking transactions dengan patients...');
    await sql`
      UPDATE transactions t
      SET patient_id = p.id
      FROM patients p
      WHERE t.clinic_id = p.clinic_id
        AND t.erm_no = p.erm_no
        AND t.patient_id IS NULL
    `;
    console.log('✅ Transactions linked dengan patients');

    // G. Insert Users (default seed data)
    console.log('📝 Seeding users...');
    
    // Get clinic IDs - menggunakan nama yang sesuai dengan data seed
    const clinicSurabayaId = await sql`
      SELECT id FROM clinics WHERE name = 'Klinik Cita Sehat Surabaya' LIMIT 1
    `;
    const clinicSemarangId = await sql`
      SELECT id FROM clinics WHERE name = 'Klinik Cita Sehat Semarang' LIMIT 1
    `;
    
    // Admin Klinik Cita Sehat Surabaya (menggunakan ID 1 sesuai data)
    // Note: Karena data seed menunjukkan ID 1 untuk Surabaya, kita akan menggunakan ID yang sesuai
    // Tapi untuk keamanan, kita akan lookup berdasarkan nama
    if (clinicSurabayaId.length > 0) {
      await sql`
        INSERT INTO users (email, full_name, role, clinic_id, google_id, avatar_url)
        VALUES (
          'admin_klinik_cita_sehat_bandung@csf.id',
          'Admin Klinik Cita Sehat Bandung',
          'clinic_manager',
          ${clinicSurabayaId[0].id},
          NULL,
          NULL
        )
        ON CONFLICT (email) DO NOTHING
      `;
    }
    
    // Admin Klinik Cita Sehat Semarang
    if (clinicSemarangId.length > 0) {
      await sql`
        INSERT INTO users (email, full_name, role, clinic_id, google_id, avatar_url)
        VALUES (
          'admin_klinik_cita_sehat_semarang@csf.id',
          'Admin Klinik Cita Sehat Semarang',
          'clinic_manager',
          ${clinicSemarangId[0].id},
          NULL,
          NULL
        )
        ON CONFLICT (email) DO NOTHING
      `;
    }
    
    // Finance Admin
    await sql`
      INSERT INTO users (email, full_name, role, clinic_id, google_id, avatar_url)
      VALUES (
        'finance@csf.id',
        'Admin Finance',
        'finance_admin',
        NULL,
        NULL,
        NULL
      )
      ON CONFLICT (email) DO NOTHING
    `;
    
    // Super Admin - Irvan
    await sql`
      INSERT INTO users (email, full_name, role, clinic_id, google_id, avatar_url)
      VALUES (
        'irvan@cnt.id',
        'Irvan',
        'super_admin',
        NULL,
        NULL,
        NULL
      )
      ON CONFLICT (email) DO NOTHING
    `;
    
    // Super Admin - Regi
    await sql`
      INSERT INTO users (email, full_name, role, clinic_id, google_id, avatar_url)
      VALUES (
        'regi@cnt.id',
        'Regi',
        'super_admin',
        NULL,
        NULL,
        NULL
      )
      ON CONFLICT (email) DO NOTHING
    `;
    
    // Super Admin - Dev CNT
    await sql`
      INSERT INTO users (email, full_name, role, clinic_id, google_id, avatar_url)
      VALUES (
        'dev@cnt.id',
        'Dev CNT',
        'super_admin',
        NULL,
        NULL,
        NULL
      )
      ON CONFLICT (email) DO NOTHING
    `;
    
    // Super Admin - Nendi
    await sql`
      INSERT INTO users (id, email, full_name, role, clinic_id, google_id, avatar_url, created_at)
      VALUES (
        7,
        'nendi.permana@citasehat.org',
        'Nendi',
        'super_admin',
        NULL,
        NULL,
        NULL,
        '2026-01-28 03:01:08.785332+00'
      )
      ON CONFLICT (email) DO NOTHING
    `;
    
    // Super Admin - Harini
    await sql`
      INSERT INTO users (id, email, full_name, role, clinic_id, google_id, avatar_url, created_at)
      VALUES (
        8,
        'harini.trikusindriwati@citasehat.org',
        'Harini',
        'super_admin',
        NULL,
        NULL,
        NULL,
        '2026-01-28 03:01:24.286451+00'
      )
      ON CONFLICT (email) DO NOTHING
    `;
    
    // Super Admin - Eva
    await sql`
      INSERT INTO users (id, email, full_name, role, clinic_id, google_id, avatar_url, created_at)
      VALUES (
        9,
        'eva.sitisarah@citasehat.org',
        'Eva',
        'super_admin',
        NULL,
        NULL,
        NULL,
        '2026-01-28 03:08:14.354666+00'
      )
      ON CONFLICT (email) DO NOTHING
    `;
    
    console.log('✅ Users seeded');

    // H. Insert System Logs (relate dengan clinics)
    console.log('📝 Seeding system_logs...');
    
    const systemLogsData = [
      { clinic_name: 'Klinik Cita Sehat Surabaya', process_type: 'scraping', status: 'success', message: 'Data scraping berhasil dilakukan', payload: '{"rows_scraped": 150, "duration_ms": 2500}' },
      { clinic_name: 'Klinik Cita Sehat Surabaya', process_type: 'zains_sync', status: 'success', message: 'Sinkronisasi ke Zains API berhasil', payload: '{"synced_count": 50, "failed_count": 0}' },
      { clinic_name: 'Klinik Cita Sehat Semarang', process_type: 'scraping', status: 'success', message: 'Data scraping berhasil dilakukan', payload: '{"rows_scraped": 120, "duration_ms": 2200}' },
      { clinic_name: 'Klinik Cita Sehat Jakarta', process_type: 'scraping', status: 'error', message: 'Gagal melakukan scraping - timeout', payload: '{"error": "Connection timeout", "retry_count": 3}' },
      { clinic_name: null, process_type: 'system', status: 'info', message: 'Sistem startup berhasil', payload: '{"version": "3.0.0", "started_at": "2026-01-20T08:00:00Z"}' },
    ];

    for (const log of systemLogsData) {
      let clinicId = null;
      if (log.clinic_name) {
        const clinic = await sql`SELECT id FROM clinics WHERE name = ${log.clinic_name} LIMIT 1`;
        if (clinic.length > 0) {
          clinicId = clinic[0].id;
        }
      }
      
      await sql`
        INSERT INTO system_logs (clinic_id, process_type, status, message, payload)
        VALUES (
          ${clinicId},
          ${log.process_type},
          ${log.status},
          ${log.message},
          ${log.payload}::jsonb
        )
      `;
    }
    console.log('✅ System logs seeded');

    // I. Insert Transactions to Zains (break dari transactions - 1 transaction bisa jadi banyak records)
    console.log('📝 Seeding transactions_to_zains...');
    
    // Get some transactions untuk di-seed ke transactions_to_zains
    const transactionsForZains = await sql`
      SELECT t.id, t.clinic_id, t.erm_no, t.patient_name, t.trx_date, t.bill_total, t.zains_synced,
             t.payment_method,
             c.id_kantor_zains, c.id_rekening, c.name as clinic_name,
             t.bill_action, t.bill_lab, t.bill_drug, t.bill_alkes, t.bill_mcu,
             p.id_donatur_zains
      FROM transactions t
      JOIN clinics c ON c.id = t.clinic_id
      LEFT JOIN patients p ON p.clinic_id = t.clinic_id AND p.erm_no = t.erm_no
      ORDER BY t.id
      LIMIT 10
    `;
    
    if (transactionsForZains.length > 0) {
      // Get semua categories untuk mapping
      const categories = await sql`
        SELECT id_program_zains, name FROM master_target_categories
      `;
      
      const categoryMap: Record<string, string> = {}
      for (const cat of categories) {
        if (cat.name === 'Tindakan') categoryMap['action'] = cat.id_program_zains
        if (cat.name === 'Laboratorium') categoryMap['lab'] = cat.id_program_zains
        if (cat.name === 'Obat-obatan') categoryMap['drug'] = cat.id_program_zains
        if (cat.name === 'Alat Kesehatan') categoryMap['alkes'] = cat.id_program_zains
        if (cat.name === 'MCU') categoryMap['mcu'] = cat.id_program_zains
      }
      
      let totalZainsRecords = 0
      
      for (const trx of transactionsForZains) {
        // Break transaction menjadi multiple records berdasarkan bill_* yang > 0
        const breaks: Array<{program: string | null, amount: number}> = []
        
        if (trx.bill_action && Number(trx.bill_action) > 0) {
          breaks.push({ program: categoryMap['action'] || null, amount: Number(trx.bill_action) })
        }
        if (trx.bill_lab && Number(trx.bill_lab) > 0) {
          breaks.push({ program: categoryMap['lab'] || null, amount: Number(trx.bill_lab) })
        }
        if (trx.bill_drug && Number(trx.bill_drug) > 0) {
          breaks.push({ program: categoryMap['drug'] || null, amount: Number(trx.bill_drug) })
        }
        if (trx.bill_alkes && Number(trx.bill_alkes) > 0) {
          breaks.push({ program: categoryMap['alkes'] || null, amount: Number(trx.bill_alkes) })
        }
        if (trx.bill_mcu && Number(trx.bill_mcu) > 0) {
          breaks.push({ program: categoryMap['mcu'] || null, amount: Number(trx.bill_mcu) })
        }
        
        // Jika tidak ada break, buat 1 record default
        if (breaks.length === 0) {
          breaks.push({ program: categoryMap['action'] || null, amount: Number(trx.bill_total) || 0 })
        }
        
        // Insert multiple records untuk 1 transaction
        // Hanya isi id_rekening jika payment_method adalah QRIS
        const paymentMethod = (trx as any).payment_method || ''
        const idRekening = paymentMethod.toUpperCase().includes('QRIS') ? (trx as any).id_rekening : null
        
        for (let i = 0; i < breaks.length; i++) {
          const breakItem = breaks[i]
          await sql`
            INSERT INTO transactions_to_zains (
              transaction_id, id_transaksi, id_program, id_kantor, tgl_transaksi, 
              id_donatur, nominal_transaksi, id_rekening, synced, nama_pasien, no_erm, created_at, updated_at
            )
            VALUES (
              ${trx.id},
              ${`TRX-${trx.id}-${i + 1}`},
              ${breakItem.program},
              ${trx.id_kantor_zains},
              ${trx.trx_date},
              ${trx.id_donatur_zains || null},
              ${Math.round(breakItem.amount)},
              ${idRekening},
              ${trx.zains_synced || false},
              ${trx.patient_name},
              ${trx.erm_no},
              NOW(),
              NOW()
            )
          `
          totalZainsRecords++
        }
      }
      console.log(`✅ Transactions to Zains seeded (${totalZainsRecords} records from ${transactionsForZains.length} transactions)`);
    } else {
      console.log('⚠️  No transactions found, skipping transactions_to_zains seed');
    }

    // I. Insert Public Holidays (Hari Libur Nasional dan Cuti Bersama 2026)
    console.log('📝 Seeding public_holidays...');
    
    const publicHolidays2026 = [
      // Hari Libur Nasional
      { date: '2026-01-01', year: 2026, description: 'Tahun Baru Masehi', is_national_holiday: true },
      { date: '2026-02-10', year: 2026, description: 'Tahun Baru Imlek 2577 Kongzili', is_national_holiday: true },
      { date: '2026-03-28', year: 2026, description: 'Hari Raya Nyepi Tahun Baru Saka 1948', is_national_holiday: true },
      { date: '2026-04-10', year: 2026, description: 'Isra Mi\'raj Nabi Muhammad SAW', is_national_holiday: true },
      { date: '2026-05-01', year: 2026, description: 'Hari Buruh Internasional', is_national_holiday: true },
      { date: '2026-05-05', year: 2026, description: 'Hari Raya Waisak 2570', is_national_holiday: true },
      { date: '2026-05-16', year: 2026, description: 'Kenaikan Isa Almasih', is_national_holiday: true },
      { date: '2026-06-01', year: 2026, description: 'Hari Lahir Pancasila', is_national_holiday: true },
      { date: '2026-06-17', year: 2026, description: 'Hari Raya Idul Fitri 1447 Hijriyah', is_national_holiday: true },
      { date: '2026-06-18', year: 2026, description: 'Hari Raya Idul Fitri 1447 Hijriyah', is_national_holiday: true },
      { date: '2026-07-09', year: 2026, description: 'Hari Raya Idul Adha 1447 Hijriyah', is_national_holiday: true },
      { date: '2026-08-17', year: 2026, description: 'Hari Kemerdekaan Republik Indonesia', is_national_holiday: true },
      { date: '2026-09-01', year: 2026, description: 'Tahun Baru Islam 1448 Hijriyah', is_national_holiday: true },
      { date: '2026-11-15', year: 2026, description: 'Maulid Nabi Muhammad SAW', is_national_holiday: true },
      { date: '2026-12-25', year: 2026, description: 'Hari Raya Natal', is_national_holiday: true },
      
      // Cuti Bersama (Lengkap 2026)
      { date: '2026-02-11', year: 2026, description: 'Cuti Bersama Tahun Baru Imlek', is_national_holiday: false },
      { date: '2026-03-29', year: 2026, description: 'Cuti Bersama Hari Raya Nyepi', is_national_holiday: false },
      { date: '2026-06-19', year: 2026, description: 'Cuti Bersama Idul Fitri', is_national_holiday: false },
      { date: '2026-06-20', year: 2026, description: 'Cuti Bersama Idul Fitri', is_national_holiday: false },
      { date: '2026-06-21', year: 2026, description: 'Cuti Bersama Idul Fitri', is_national_holiday: false },
      { date: '2026-12-24', year: 2026, description: 'Cuti Bersama Hari Raya Natal', is_national_holiday: false },
      { date: '2026-12-26', year: 2026, description: 'Cuti Bersama Hari Raya Natal', is_national_holiday: false },
    ];

    for (const holiday of publicHolidays2026) {
      try {
        await sql`
          INSERT INTO public_holidays (holiday_date, year, description, is_national_holiday)
          VALUES (${holiday.date}, ${holiday.year}, ${holiday.description}, ${holiday.is_national_holiday})
          ON CONFLICT (holiday_date) DO NOTHING
        `;
      } catch (error: any) {
        if (!error.message?.includes('unique') && !error.message?.includes('duplicate')) {
          console.error(`Error seeding holiday ${holiday.date}:`, error.message);
        }
      }
    }
    console.log(`✅ Public holidays seeded (${publicHolidays2026.length} hari libur)`);

    console.log('✅ Seed database berhasil!');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error saat seed:', error.message);
    if (error.message) {
      console.error('Detail:', error.message);
    }
    process.exit(1);
  }
}

seed();
