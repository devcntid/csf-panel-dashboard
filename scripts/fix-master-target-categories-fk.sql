-- =============================================
-- Fix: Allow updating id_program_zains (master_target_categories)
-- dan id_kantor_zains (clinics) tanpa melanggar FK di transactions_to_zains
--
-- Constraint lama tidak punya ON UPDATE CASCADE, jadi saat nilai di master
-- diubah, PostgreSQL menolak. Script ini menambah ON UPDATE CASCADE.
--
-- Jalankan script ini sekali di database Anda (psql atau client SQL).
-- Atau gunakan: npm run migrate:fix-fk
-- =============================================

-- 1. FK id_program -> master_target_categories(id_program_zains)
ALTER TABLE transactions_to_zains
  DROP CONSTRAINT IF EXISTS transactions_to_zains_id_program_fkey;
ALTER TABLE transactions_to_zains
  ADD CONSTRAINT transactions_to_zains_id_program_fkey
  FOREIGN KEY (id_program)
  REFERENCES master_target_categories(id_program_zains)
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- 2. FK id_kantor -> clinics(id_kantor_zains)
ALTER TABLE transactions_to_zains
  DROP CONSTRAINT IF EXISTS transactions_to_zains_id_kantor_fkey;
ALTER TABLE transactions_to_zains
  ADD CONSTRAINT transactions_to_zains_id_kantor_fkey
  FOREIGN KEY (id_kantor)
  REFERENCES clinics(id_kantor_zains)
  ON DELETE SET NULL
  ON UPDATE CASCADE;
