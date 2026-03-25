-- Indeks disarankan untuk query daftar transaksi & pasien (Neon / PostgreSQL).
-- Jalankan manual di SQL Editor setelah review. Gunakan CONCURRENTLY di production
-- untuk mengurangi locking (tidak bisa di dalam transaksi).
--
-- Opsional pencarian teks (ILIKE '%x%'): aktifkan pg_trgm + indeks GIN — hanya jika
-- pencarian pasien/transaksi masih lambat setelah indeks di bawah.

-- CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Pasien: filter klinik + urut last_visit
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_patients_clinic_last_visit
  ON patients (clinic_id, last_visit_at DESC NULLS LAST);

-- Transaksi: filter klinik + rentang tanggal + urut
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_clinic_trx_date
  ON transactions (clinic_id, trx_date DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_trx_date
  ON transactions (trx_date DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_patient_id
  ON transactions (patient_id);

-- JOIN / EXISTS ke Zains dari transaksi
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_to_zains_transaction_id
  ON transactions_to_zains (transaction_id);

-- Transaksi ke Zains: filter tanggal (sesuaikan jika kolom bertipe timestamp tz)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_to_zains_tgl
  ON transactions_to_zains (tgl_transaksi DESC);

-- --- Opsional: trigram untuk ILIKE '%term%' (butuh extension pg_trgm) ---
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_patients_full_name_trgm ON patients USING gin (full_name gin_trgm_ops);
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_patients_erm_no_trgm ON patients USING gin (erm_no gin_trgm_ops);
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_trx_no_trgm ON transactions USING gin (trx_no gin_trgm_ops);
