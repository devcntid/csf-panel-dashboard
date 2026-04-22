-- Migrasi: izinkan beberapa baris per (clinic_id, trx_no, trx_date) via kolom trx_line_no.
-- Kasus: satu trx_no bisa punya beberapa baris jika erm_no berbeda (pasien beda)
-- atau trx_line_no berbeda (item beda dalam invoice yang sama).

-- =============================================================================
-- 1) Tambah kolom trx_line_no — data lama default 1
-- =============================================================================
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS trx_line_no INT NOT NULL DEFAULT 1;

-- =============================================================================
-- 2) Selesaikan duplikat yang mungkin muncul di constraint baru
--    (clinic_id, trx_no, trx_date, erm_no, trx_line_no).
--    Baris pertama (id terkecil) tetap line_no=1; sisanya naik urut.
-- =============================================================================
WITH ranked AS (
  SELECT
    id,
    trx_date,
    ROW_NUMBER() OVER (
      PARTITION BY clinic_id, trx_no, trx_date, erm_no
      ORDER BY id
    ) AS rn
  FROM transactions
)
UPDATE transactions t
SET trx_line_no = r.rn
FROM ranked r
WHERE t.id = r.id
  AND t.trx_date = r.trx_date
  AND r.rn > 1;

-- Verifikasi (harus 0 baris):
-- SELECT clinic_id, trx_no, trx_date, erm_no, trx_line_no, COUNT(*) AS n
-- FROM transactions
-- GROUP BY 1, 2, 3, 4, 5
-- HAVING COUNT(*) > 1;

-- =============================================================================
-- 3) Ganti constraint
-- =============================================================================
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS unique_transaction_entry;

ALTER TABLE transactions
  ADD CONSTRAINT unique_transaction_entry UNIQUE (clinic_id, trx_no, trx_date, erm_no, trx_line_no);
