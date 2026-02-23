-- =============================================
-- Fix: Allow updating id_program_zains di master_target_categories
-- tanpa melanggar FK di transactions_to_zains
--
-- Penyebab error: transactions_to_zains.id_program REFERENCES 
-- master_target_categories(id_program_zains) tanpa ON UPDATE CASCADE,
-- jadi saat id_program_zains diubah, PostgreSQL menolak.
--
-- Jalankan script ini sekali di database Anda (psql atau client SQL).
-- =============================================

-- 1. Hapus constraint lama
ALTER TABLE transactions_to_zains
  DROP CONSTRAINT IF EXISTS transactions_to_zains_id_program_fkey;

-- 2. Tambah constraint baru dengan ON UPDATE CASCADE
--    Saat id_program_zains di master_target_categories di-update,
--    semua baris di transactions_to_zains yang mereferensi nilai lama
--    akan otomatis di-update ke nilai baru.
ALTER TABLE transactions_to_zains
  ADD CONSTRAINT transactions_to_zains_id_program_fkey
  FOREIGN KEY (id_program)
  REFERENCES master_target_categories(id_program_zains)
  ON DELETE SET NULL
  ON UPDATE CASCADE;
