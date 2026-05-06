-- ============================================================
-- Migration: Ganti UNIQUE constraint ke payment_method
-- Jalankan MANUAL di database (jangan via npm run migrate)
-- ============================================================

-- 1. Isi NULL payment_method dengan ''
UPDATE transactions SET payment_method = '' WHERE payment_method IS NULL;

-- 2. Tambah NOT NULL + DEFAULT
ALTER TABLE transactions ALTER COLUMN payment_method SET NOT NULL;
ALTER TABLE transactions ALTER COLUMN payment_method SET DEFAULT '';

-- 3. Handle duplikat existing (jika ada rows dgn clinic+trx_no+date+erm+payment_method sama)
--    Hapus duplikat, sisakan yang id terbesar (paling baru)
DELETE FROM transactions t1
USING transactions t2
WHERE t1.clinic_id = t2.clinic_id
  AND t1.trx_no = t2.trx_no
  AND t1.trx_date = t2.trx_date
  AND t1.erm_no = t2.erm_no
  AND t1.payment_method = t2.payment_method
  AND t1.id < t2.id;

-- 4. Drop constraint lama, buat constraint baru
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS unique_transaction_entry;
ALTER TABLE transactions
  ADD CONSTRAINT unique_transaction_entry
  UNIQUE (clinic_id, trx_no, trx_date, erm_no, payment_method);
