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

const migrationSQL = `
-- =============================================
-- 1. SETUP & CLEANUP
-- =============================================
DROP TABLE IF EXISTS app_settings CASCADE;
DROP TABLE IF EXISTS system_logs CASCADE;
DROP TABLE IF EXISTS public_holidays CASCADE;
DROP TABLE IF EXISTS clinic_bpjs_realizations CASCADE;
DROP TABLE IF EXISTS clinic_daily_targets CASCADE;
DROP TABLE IF EXISTS clinic_target_configs CASCADE;
DROP TABLE IF EXISTS master_target_categories CASCADE;
DROP TABLE IF EXISTS clinic_targets CASCADE; -- Old Table Cleanup
DROP TABLE IF EXISTS clinic_insurance_mappings CASCADE;
DROP TABLE IF EXISTS master_insurance_types CASCADE;
DROP TABLE IF EXISTS clinic_poly_mappings CASCADE;
DROP TABLE IF EXISTS master_polies CASCADE;
DROP TABLE IF EXISTS sources CASCADE;
DROP TABLE IF EXISTS transactions_to_zains CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS patients CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS clinics CASCADE;

-- =============================================
-- 2. TABLE: CLINICS (Master Data Klinik)
-- =============================================
CREATE TABLE clinics (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    location VARCHAR(100),
    login_url VARCHAR(255) NOT NULL DEFAULT 'https://csf.eclinic.id/login',
    username VARCHAR(100) NOT NULL,
    password_encrypted TEXT NOT NULL,
    kode_coa VARCHAR(50),
    id_kantor_zains VARCHAR(100) UNIQUE,
    coa_qris VARCHAR(50),
    id_rekening VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    last_scraped_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- 3. TABLE: USERS (Manajemen User & SSO)
-- =============================================
CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(100),
    role VARCHAR(50) NOT NULL DEFAULT 'clinic_manager',
    clinic_id BIGINT REFERENCES clinics(id) ON DELETE SET NULL,
    google_id VARCHAR(255),
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- 4. TABLE: PATIENTS (Master Pasien untuk Retensi)
-- =============================================
CREATE TABLE patients (
    id BIGSERIAL PRIMARY KEY,
    clinic_id BIGINT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    erm_no VARCHAR(50) NOT NULL,
    full_name VARCHAR(255),
    first_visit_at DATE NOT NULL,
    last_visit_at DATE NOT NULL,
    visit_count INT DEFAULT 1,
    id_donatur_zains VARCHAR(100) UNIQUE,
    erm_no_for_zains VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_patient_per_clinic UNIQUE (clinic_id, erm_no)
);

-- Index untuk erm_no_for_zains
CREATE INDEX IF NOT EXISTS idx_patients_erm_no_for_zains ON patients(erm_no_for_zains);

-- =============================================
-- 5. CONFIG: POLYCLINIC MAPPING
-- =============================================
CREATE TABLE master_polies (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    code VARCHAR(50),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- 5a. MASTER TARGET CATEGORIES
-- =============================================
CREATE TABLE master_target_categories (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    kode_coa VARCHAR(50),
    id_program_zains VARCHAR(100) UNIQUE,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE clinic_poly_mappings (
    id BIGSERIAL PRIMARY KEY,
    clinic_id BIGINT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    raw_poly_name VARCHAR(100) NOT NULL,
    master_poly_id BIGINT REFERENCES master_polies(id) ON DELETE SET NULL,
    is_revenue_center BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_mapping_per_clinic UNIQUE (clinic_id, raw_poly_name)
);

-- =============================================
-- 5b. CONFIG: INSURANCE TYPE MAPPING
-- =============================================
CREATE TABLE master_insurance_types (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    code VARCHAR(50),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE clinic_insurance_mappings (
    id BIGSERIAL PRIMARY KEY,
    clinic_id BIGINT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    raw_insurance_name VARCHAR(100) NOT NULL,
    master_insurance_id BIGINT REFERENCES master_insurance_types(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_insurance_mapping_per_clinic UNIQUE (clinic_id, raw_insurance_name)
);

-- =============================================
-- 5c. MASTER SOURCES (Sumber Target Harian)
-- =============================================

CREATE TABLE sources (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- 5b. MASTER TARGET CONFIGURATION (DINAMIS & HISTORICAL)
-- PERUBAHAN: Sekarang relate dengan POLI bukan kategori layanan
-- =============================================

-- 2. Config Tarif Dasar Per Klinik Per Poli Per Tahun (Base Rate)
-- PERUBAHAN PENTING: Sekarang menggunakan master_poly_id bukan target_category_id
-- Ini menangani kasus: Tarif 2025 beda dengan Tarif 2026, dan tarif per POLI.
CREATE TABLE clinic_target_configs (
    id BIGSERIAL PRIMARY KEY,
    clinic_id BIGINT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    master_poly_id BIGINT NOT NULL REFERENCES master_polies(id) ON DELETE CASCADE,
    
    target_year INT NOT NULL,           -- Tahun Berlaku (e.g., 2026)
    base_rate DECIMAL(15, 2) DEFAULT 0, -- Tarif dasar pengali untuk tahun tersebut (Tarif Layanan Klinik)
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Constraint: Untuk 1 klinik & 1 poli, hanya boleh ada 1 config per TAHUN.
    CONSTRAINT unique_config_per_clinic_poly_year UNIQUE (clinic_id, master_poly_id, target_year)
);

-- 3. Data Target Harian (Realisasi/Rencana Harian)
-- PERUBAHAN: Sekarang menggunakan master_poly_id dan source_id
-- UPDATE: Mendukung mode harian (per tanggal) dan kumulatif (bulan dan tahun saja)
CREATE TABLE clinic_daily_targets (
    id BIGSERIAL PRIMARY KEY,
    clinic_id BIGINT REFERENCES clinics(id) ON DELETE CASCADE,
    master_poly_id BIGINT REFERENCES master_polies(id) ON DELETE CASCADE,
    source_id BIGINT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    insurance_type_id BIGINT REFERENCES master_insurance_types(id) ON DELETE SET NULL,
    
    -- Mode Target: 'daily' untuk target harian per tanggal, 'cumulative' untuk target kumulatif bulanan
    target_type VARCHAR(20) NOT NULL DEFAULT 'daily' CHECK (target_type IN ('daily', 'cumulative')),
    
    -- Untuk mode HARIAN: target_date digunakan (target_month dan target_year diabaikan)
    target_date DATE,                    -- Tanggal spesifik untuk target harian
    
    -- Untuk mode KUMULATIF: target_month dan target_year digunakan (target_date diabaikan)
    target_month INT CHECK (target_month IS NULL OR (target_month >= 1 AND target_month <= 12)), -- Bulan (1-12) untuk target kumulatif
    target_year INT,                     -- Tahun untuk target kumulatif

    -- Variabel Target
    target_visits INT DEFAULT 0, -- Rencana Jumlah Kunjungan (Kunjungan Layanan Klinik)
    tipe_donatur VARCHAR(50),    -- retail / corporate / community
    
    -- Hasil Perhitungan
    -- Value = target_visits * (base_rate dari config tahun ybs)
    target_revenue DECIMAL(15, 2) DEFAULT 0, -- Total Target Pendapatan (Revenue Layanan Klinik)
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Optimasi Indexing (High Performance Reporting)
CREATE INDEX idx_daily_target_date ON clinic_daily_targets(target_date);
CREATE INDEX idx_daily_target_period ON clinic_daily_targets(clinic_id, target_year, target_month);
CREATE INDEX idx_daily_target_source ON clinic_daily_targets(source_id);
CREATE INDEX idx_daily_target_type ON clinic_daily_targets(target_type);

-- Unique Indexes untuk clinic_daily_targets (partial indexes untuk daily dan cumulative)
CREATE UNIQUE INDEX idx_unique_daily_target ON clinic_daily_targets(clinic_id, master_poly_id, target_date, source_id) 
    WHERE target_type = 'daily' AND target_date IS NOT NULL;
CREATE UNIQUE INDEX idx_unique_cumulative_target ON clinic_daily_targets(clinic_id, master_poly_id, target_month, target_year, source_id) 
    WHERE target_type = 'cumulative' AND target_month IS NOT NULL AND target_year IS NOT NULL;

-- Index untuk clinic_target_configs
CREATE INDEX idx_target_config_lookup ON clinic_target_configs(clinic_id, master_poly_id, target_year);

-- =============================================
-- 5d. REALISASI KAPITASI BPJS (Gaji Buta per Bulan per Klinik)
-- =============================================
CREATE TABLE clinic_bpjs_realizations (
    id BIGSERIAL PRIMARY KEY,
    clinic_id BIGINT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    month INT NOT NULL CHECK (month >= 1 AND month <= 12),
    year INT NOT NULL,
    total_peserta_terdaftar INT DEFAULT 0,
    total_kapitasi_diterima DECIMAL(15, 2) DEFAULT 0,
    pbi_count INT DEFAULT 0,
    non_pbi_count INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT unique_bpjs_realization_per_clinic_month_year UNIQUE (clinic_id, month, year)
);

CREATE INDEX idx_bpjs_realization_clinic_period ON clinic_bpjs_realizations(clinic_id, year, month);

-- =============================================
-- 6. TABLE: TRANSACTIONS (PARTITIONED BY DATE FOR SUPER FAST QUERIES)
-- =============================================
-- PENTING: Tabel ini menggunakan PARTITION BY RANGE untuk optimasi performa
-- Setiap partisi berisi data 1 bulan, sehingga query hanya scan partisi yang relevan
CREATE TABLE transactions (
    id BIGSERIAL NOT NULL,
    clinic_id BIGINT NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
    patient_id BIGINT REFERENCES patients(id) ON DELETE SET NULL,
    poly_id BIGINT REFERENCES master_polies(id) ON DELETE SET NULL,
    insurance_type_id BIGINT REFERENCES master_insurance_types(id) ON DELETE SET NULL,
    
    -- === IDENTITAS TRANSAKSI ===
    trx_date DATE NOT NULL,
    trx_no VARCHAR(50),
    trx_time TIME,
    erm_no VARCHAR(50) NOT NULL,
    patient_name VARCHAR(255),
    insurance_type VARCHAR(100),
    polyclinic VARCHAR(100),
    payment_method VARCHAR(100),
    voucher_code VARCHAR(100),
    
    -- === 1. JUMLAH TAGIHAN ===
    bill_regist DECIMAL(15, 2) DEFAULT 0,
    bill_action DECIMAL(15, 2) DEFAULT 0,
    bill_lab    DECIMAL(15, 2) DEFAULT 0,
    bill_drug   DECIMAL(15, 2) DEFAULT 0,
    bill_alkes  DECIMAL(15, 2) DEFAULT 0,
    bill_mcu    DECIMAL(15, 2) DEFAULT 0,
    bill_radio  DECIMAL(15, 2) DEFAULT 0,
    bill_total  DECIMAL(15, 2) DEFAULT 0,
    
    -- === 1a. DISKON TAGIHAN ===
    bill_regist_discount DECIMAL(15, 2) DEFAULT 0,
    bill_action_discount DECIMAL(15, 2) DEFAULT 0,
    bill_lab_discount    DECIMAL(15, 2) DEFAULT 0,
    bill_drug_discount   DECIMAL(15, 2) DEFAULT 0,
    bill_alkes_discount  DECIMAL(15, 2) DEFAULT 0,
    bill_mcu_discount    DECIMAL(15, 2) DEFAULT 0,
    bill_radio_discount  DECIMAL(15, 2) DEFAULT 0,

    -- === 2. JUMLAH JAMINAN / BPJS ===
    covered_regist DECIMAL(15, 2) DEFAULT 0,
    covered_action DECIMAL(15, 2) DEFAULT 0,
    covered_lab    DECIMAL(15, 2) DEFAULT 0,
    covered_drug   DECIMAL(15, 2) DEFAULT 0,
    covered_alkes  DECIMAL(15, 2) DEFAULT 0,
    covered_mcu    DECIMAL(15, 2) DEFAULT 0,
    covered_radio  DECIMAL(15, 2) DEFAULT 0,
    covered_total  DECIMAL(15, 2) DEFAULT 0,

    -- === 3. JUMLAH PEMBAYARAN / TUNAI ===
    paid_regist     DECIMAL(15, 2) DEFAULT 0,
    paid_action     DECIMAL(15, 2) DEFAULT 0,
    paid_lab        DECIMAL(15, 2) DEFAULT 0,
    paid_drug       DECIMAL(15, 2) DEFAULT 0,
    paid_alkes      DECIMAL(15, 2) DEFAULT 0,
    paid_mcu        DECIMAL(15, 2) DEFAULT 0,
    paid_radio      DECIMAL(15, 2) DEFAULT 0,
    paid_rounding   DECIMAL(15, 2) DEFAULT 0,
    paid_discount   DECIMAL(15, 2) DEFAULT 0,
    paid_tax        DECIMAL(15, 2) DEFAULT 0,
    paid_voucher_amt DECIMAL(15, 2) DEFAULT 0,
    paid_total      DECIMAL(15, 2) DEFAULT 0,

    -- === 4. JUMLAH PIUTANG ===
    receivable_regist DECIMAL(15, 2) DEFAULT 0,
    receivable_action DECIMAL(15, 2) DEFAULT 0,
    receivable_lab    DECIMAL(15, 2) DEFAULT 0,
    receivable_drug   DECIMAL(15, 2) DEFAULT 0,
    receivable_alkes  DECIMAL(15, 2) DEFAULT 0,
    receivable_mcu    DECIMAL(15, 2) DEFAULT 0,
    receivable_radio  DECIMAL(15, 2) DEFAULT 0,
    receivable_total  DECIMAL(15, 2) DEFAULT 0,

    -- === SINKRONISASI & LOGGING ===
    raw_json_data JSONB,
    input_type VARCHAR(50) DEFAULT 'scrap', -- 'scrap' atau 'upload' untuk membedakan sumber data
    zains_synced BOOLEAN DEFAULT false,
    zains_sync_at TIMESTAMP WITH TIME ZONE,
    zains_response JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- PENTING: Primary Key pada partitioned table HARUS menyertakan kolom partisi (trx_date)
    PRIMARY KEY (id, trx_date),
    CONSTRAINT unique_transaction_entry UNIQUE (clinic_id, erm_no, trx_date, polyclinic, bill_total)
) PARTITION BY RANGE (trx_date);

-- =============================================
-- 6b. CREATE PARTITIONS FOR TRANSACTIONS (Monthly Partitions)
-- =============================================
-- Partisi untuk 12 bulan ke depan (dari Jan 2026 - Des 2026)
-- Partisi akan dibuat otomatis setiap bulan via cron job

-- Partisi untuk 2025 (untuk data historis jika ada)
CREATE TABLE IF NOT EXISTS transactions_y2025m12 PARTITION OF transactions
    FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

-- Partisi untuk 2026
CREATE TABLE IF NOT EXISTS transactions_y2026m01 PARTITION OF transactions
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

CREATE TABLE IF NOT EXISTS transactions_y2026m02 PARTITION OF transactions
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

CREATE TABLE IF NOT EXISTS transactions_y2026m03 PARTITION OF transactions
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

CREATE TABLE IF NOT EXISTS transactions_y2026m04 PARTITION OF transactions
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

CREATE TABLE IF NOT EXISTS transactions_y2026m05 PARTITION OF transactions
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

CREATE TABLE IF NOT EXISTS transactions_y2026m06 PARTITION OF transactions
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

CREATE TABLE IF NOT EXISTS transactions_y2026m07 PARTITION OF transactions
    FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');

CREATE TABLE IF NOT EXISTS transactions_y2026m08 PARTITION OF transactions
    FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');

CREATE TABLE IF NOT EXISTS transactions_y2026m09 PARTITION OF transactions
    FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');

CREATE TABLE IF NOT EXISTS transactions_y2026m10 PARTITION OF transactions
    FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');

CREATE TABLE IF NOT EXISTS transactions_y2026m11 PARTITION OF transactions
    FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');

CREATE TABLE IF NOT EXISTS transactions_y2026m12 PARTITION OF transactions
    FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');

-- Partisi untuk 2027 (untuk persiapan tahun depan)
CREATE TABLE IF NOT EXISTS transactions_y2027m01 PARTITION OF transactions
    FOR VALUES FROM ('2027-01-01') TO ('2027-02-01');

CREATE TABLE IF NOT EXISTS transactions_y2027m02 PARTITION OF transactions
    FOR VALUES FROM ('2027-02-01') TO ('2027-03-01');

CREATE TABLE IF NOT EXISTS transactions_y2027m03 PARTITION OF transactions
    FOR VALUES FROM ('2027-03-01') TO ('2027-04-01');

-- =============================================
-- 6c. INDEXES FOR TRANSACTIONS (Optimized for Dashboard Queries)
-- =============================================
-- Index di parent table akan otomatis diterapkan ke semua partisi
CREATE INDEX idx_trx_date_partition ON transactions(trx_date);
CREATE INDEX idx_trx_clinic_partition ON transactions(clinic_id);
CREATE INDEX idx_trx_poly_partition ON transactions(polyclinic);
CREATE INDEX idx_trx_poly_id_partition ON transactions(poly_id);
CREATE INDEX idx_trx_synced_partition ON transactions(zains_synced);

-- Composite Index untuk Dashboard Queries (Super Fast)
-- Index ini membuat filter Klinik + Tanggal menjadi sangat cepat
CREATE INDEX idx_transactions_dashboard ON transactions(clinic_id, trx_date, payment_method);
CREATE INDEX idx_transactions_date_clinic ON transactions(trx_date, clinic_id);

-- =============================================
-- 6a. TABLE: TRANSACTIONS TO ZAINS
-- =============================================
-- CATATAN: transaction_id tidak menggunakan FOREIGN KEY constraint karena
-- transactions adalah partitioned table. Relasi tetap valid secara logis,
-- dan kita menggunakan index untuk performa JOIN yang optimal.
CREATE TABLE transactions_to_zains (
    id BIGSERIAL PRIMARY KEY,
    transaction_id BIGINT, -- Relasi logis ke transactions(id), tanpa FK constraint
    id_transaksi VARCHAR(100),
    id_program VARCHAR(100) REFERENCES master_target_categories(id_program_zains) ON DELETE SET NULL ON UPDATE CASCADE,
    id_kantor VARCHAR(100) REFERENCES clinics(id_kantor_zains) ON DELETE SET NULL ON UPDATE CASCADE,
    tgl_transaksi DATE,
    id_donatur VARCHAR(100) REFERENCES patients(id_donatur_zains) ON DELETE SET NULL,
    nominal_transaksi INTEGER,
    id_rekening VARCHAR(50),
    synced BOOLEAN DEFAULT false,
    todo_zains BOOLEAN DEFAULT true,
    nama_pasien VARCHAR(255),
    no_erm VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Index untuk performa JOIN dengan transactions (meskipun tanpa FK constraint)
CREATE INDEX idx_transactions_to_zains_transaction ON transactions_to_zains(transaction_id);
CREATE INDEX idx_transactions_to_zains_synced ON transactions_to_zains(synced);

-- Catatan: Karena transactions adalah partitioned table, kita tidak bisa membuat
-- FOREIGN KEY constraint. Tapi relasi tetap valid secara logis, dan
-- aplikasi harus memastikan data integrity melalui business logic.

-- =============================================
-- 7. TABLE: SYSTEM LOGS
-- =============================================
CREATE TABLE system_logs (
    id BIGSERIAL PRIMARY KEY,
    clinic_id BIGINT REFERENCES clinics(id) ON DELETE SET NULL,
    process_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL,
    message TEXT,
    payload JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- 8. TABLE: PUBLIC HOLIDAYS (Hari Libur Nasional)
-- =============================================
CREATE TABLE public_holidays (
    id BIGSERIAL PRIMARY KEY,
    holiday_date DATE NOT NULL,
    year INT NOT NULL,
    description VARCHAR(255) NOT NULL,
    is_national_holiday BOOLEAN DEFAULT true, -- true untuk hari libur nasional, false untuk cuti bersama
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_holiday_date UNIQUE (holiday_date)
);

CREATE INDEX idx_holiday_year ON public_holidays(year);
CREATE INDEX idx_holiday_date ON public_holidays(holiday_date);

-- =============================================
-- 8a. TABLE: APP SETTINGS (Toggle & konfigurasi global)
-- =============================================
CREATE TABLE app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
INSERT INTO app_settings (key, value) VALUES ('zains_transaction_sync_enabled', 'true');

-- =============================================
-- 9. MATERIALIZED VIEWS (Pre-calculated Summary for Fast Dashboard)
-- =============================================
-- Materialized View untuk rekapan harian - membuat query dashboard tahunan sangat cepat
-- Hanya menghitung ~365 baris rekapan per tahun, bukan jutaan baris transaksi
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_revenue_summary AS
SELECT 
    clinic_id,
    trx_date,
    EXTRACT(YEAR FROM trx_date)::INTEGER as tahun,
    EXTRACT(MONTH FROM trx_date)::INTEGER as bulan,
    COUNT(id) as total_patients,
    SUM(bill_total) as total_revenue,
    SUM(paid_total) as total_cash,
    SUM(bill_total - paid_total) as total_receivable,
    SUM(bill_regist) as total_bill_regist,
    SUM(bill_action) as total_bill_action,
    SUM(bill_lab) as total_bill_lab,
    SUM(bill_drug) as total_bill_drug,
    SUM(covered_total) as total_covered,
    COUNT(CASE WHEN payment_method ILIKE '%qris%' THEN 1 END) as total_qris_transactions
FROM transactions
GROUP BY clinic_id, trx_date;

-- Index pada Materialized View untuk akses cepat
CREATE INDEX IF NOT EXISTS idx_mv_summary_clinic_date ON mv_daily_revenue_summary(clinic_id, trx_date);
CREATE INDEX IF NOT EXISTS idx_mv_summary_year ON mv_daily_revenue_summary(tahun);
CREATE INDEX IF NOT EXISTS idx_mv_summary_clinic_year ON mv_daily_revenue_summary(clinic_id, tahun);
`;

async function migrate() {
  try {
    console.log('🚀 Memulai migrasi database...');
    
    // Split SQL by semicolon, but handle multi-line statements properly
    // Remove comments first
    const sqlWithoutComments = migrationSQL
      .split('\n')
      .map(line => {
        const commentIndex = line.indexOf('--');
        if (commentIndex >= 0) {
          return line.substring(0, commentIndex);
        }
        return line;
      })
      .join('\n');
    
    // Split by semicolon, but keep track of parentheses depth
    const statements: string[] = [];
    let currentStatement = '';
    let depth = 0;
    let inSingleQuote = false;
    let inDoubleQuote = false;
    
    for (let i = 0; i < sqlWithoutComments.length; i++) {
      const char = sqlWithoutComments[i];
      const prevChar = i > 0 ? sqlWithoutComments[i - 1] : '';
      
      // Track quotes (but not escaped quotes)
      if (char === "'" && prevChar !== '\\') {
        inSingleQuote = !inSingleQuote;
      } else if (char === '"' && prevChar !== '\\') {
        inDoubleQuote = !inDoubleQuote;
      }
      
      // Track parentheses depth (only if not in quotes)
      if (!inSingleQuote && !inDoubleQuote) {
        if (char === '(') {
          depth++;
        } else if (char === ')') {
          depth--;
        }
      }
      
      currentStatement += char;
      
      // If we hit a semicolon and we're at depth 0 (not inside parentheses) and not in quotes
      if (char === ';' && depth === 0 && !inSingleQuote && !inDoubleQuote) {
        const trimmed = currentStatement.trim();
        if (trimmed && trimmed.length > 1) { // More than just ";"
          statements.push(trimmed);
        }
        currentStatement = '';
      }
    }
    
    // Add any remaining statement
    const remaining = currentStatement.trim();
    if (remaining && remaining.length > 0) {
      statements.push(remaining);
    }

    console.log(`📝 Menemukan ${statements.length} statement SQL...`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement && statement.trim().length > 0) {
        try {
          // Execute raw SQL using postgres client
          await sql.unsafe(statement);
          
          const preview = statement.substring(0, 50).replace(/\s+/g, ' ').trim();
          console.log(`✅ Statement ${i + 1}/${statements.length}: ${preview}...`);
        } catch (error: any) {
          // Ignore "does not exist" errors for DROP TABLE
          if (error.message && error.message.includes('does not exist')) {
            const preview = statement.substring(0, 50).replace(/\s+/g, ' ').trim();
            console.log(`⚠️  Statement ${i + 1}/${statements.length}: ${preview}... (skip - table tidak ada)`);
          } else {
            const preview = statement.substring(0, 100).replace(/\s+/g, ' ').trim();
            console.error(`❌ Error pada statement ${i + 1}: ${preview}`);
            console.error(`   Error: ${error.message}`);
            throw error;
          }
        }
      }
    }

    // Close connection
    await sql.end();

    console.log('✅ Migrasi database berhasil!');
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error saat migrasi:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack);
    }
    process.exit(1);
  }
}

migrate();
