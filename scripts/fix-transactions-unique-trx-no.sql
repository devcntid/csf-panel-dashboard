-- Ganti deduplikasi transaksi: unik per (klinik, nomor transaksi, tanggal).
-- Sebelumnya (clinic_id, erm_no, trx_date, polyclinic, bill_total) membuat dua trx_no berbeda
-- untuk pasien/tanggal/poli/total yang sama tertimpa (perilaku upsert salah).

-- =============================================================================
-- 1) Isi trx_no yang kosong — string kosong '' dianggap sama di UNIQUE, jadi bentrok
-- =============================================================================
UPDATE transactions
SET trx_no = 'legacy-empty-' || id::text
WHERE trx_no IS NULL OR TRIM(trx_no) = '';

-- =============================================================================
-- 2) Selesaikan duplikat tersisa (trx_no + tanggal + klinik sama, id beda)
--    Baris pertama (id terkecil) tetap; sisanya dapat sufiks unik.
-- =============================================================================
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY clinic_id, trx_no, trx_date
      ORDER BY id
    ) AS rn
  FROM transactions
)
UPDATE transactions t
SET trx_no = t.trx_no || '-dup-' || t.id::text
FROM ranked r
WHERE t.id = r.id
  AND r.rn > 1;

-- Verifikasi (harus 0 baris):
-- SELECT clinic_id, trx_no, trx_date, COUNT(*) AS n
-- FROM transactions
-- GROUP BY 1, 2, 3
-- HAVING COUNT(*) > 1;

-- =============================================================================
-- 3) Ganti constraint
-- =============================================================================
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS unique_transaction_entry;

ALTER TABLE transactions
  ADD CONSTRAINT unique_transaction_entry UNIQUE (clinic_id, trx_no, trx_date);
