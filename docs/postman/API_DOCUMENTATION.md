# Dokumentasi API Insert Transaction

## Endpoint: POST `/api/transactions/insert`

Endpoint ini digunakan untuk insert transaksi secara manual dengan logika yang sama persis seperti proses scrap. Endpoint ini akan melakukan:

1. Insert/update patient dengan logika `first_visit_at`, `last_visit_at`, dan `visit_count`
2. Insert/update transaction dengan semua field yang diperlukan
3. Insert ke `transactions_to_zains` untuk setiap kategori pembayaran yang memiliki nilai > 0
4. Sync patient ke Zains jika diperlukan (workflow integration)

---

## Request

### Headers

```
Content-Type: application/json
```

### Body Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `clinic_id` | number | Yes | ID klinik yang akan digunakan |
| `transaction_data` | array | Yes | Array berisi data transaksi (minimal 1 item) |

### Transaction Data Object

Setiap item dalam `transaction_data` array harus memiliki struktur berikut:

#### Field Wajib

| Field | Type | Required | Description | Contoh |
|-------|------|----------|-------------|---------|
| `trx_date` | string | Yes | Tanggal transaksi (format: YYYY-MM-DD atau ISO date) | `"2026-01-28"` |
| `erm_no` | string | Yes | Nomor eRM pasien | `"ERM001"` |
| `patient_name` | string | Yes | Nama pasien | `"John Doe"` |

#### Field Optional (Nilai Default: 0 atau null)

**Informasi Transaksi:**
- `trx_no` (string): Nomor transaksi
- `insurance_type` (string): Jenis asuransi
- `polyclinic` (string): Ruangan/Poli
- `payment_method` (string): Metode pembayaran
- `voucher_code` (string): Kode voucher (gunakan `"-"` jika tidak ada)

**Jumlah Tagihan (Bill):**
- `bill_regist` (number): Tagihan Karcis
- `bill_action` (number): Tagihan Tindakan
- `bill_lab` (number): Tagihan Laboratorium
- `bill_drug` (number): Tagihan Obat
- `bill_alkes` (number): Tagihan Alkes
- `bill_mcu` (number): Tagihan MCU
- `bill_radio` (number): Tagihan Radiologi
- `bill_total` (number): Total Tagihan

**Jumlah Jaminan (Covered):**
- `covered_regist` (number): Jaminan Karcis
- `covered_action` (number): Jaminan Tindakan
- `covered_lab` (number): Jaminan Laboratorium
- `covered_drug` (number): Jaminan Obat
- `covered_alkes` (number): Jaminan Alkes
- `covered_mcu` (number): Jaminan MCU
- `covered_radio` (number): Jaminan Radiologi
- `covered_total` (number): Total Jaminan

**Jumlah Pembayaran (Paid):**
- `paid_regist` (number): Pembayaran Karcis
- `paid_action` (number): Pembayaran Tindakan
- `paid_lab` (number): Pembayaran Laboratorium
- `paid_drug` (number): Pembayaran Obat
- `paid_alkes` (number): Pembayaran Alkes
- `paid_mcu` (number): Pembayaran MCU
- `paid_radio` (number): Pembayaran Radiologi
- `paid_rounding` (number): Pembulatan
- `paid_discount` (number): Diskon
- `paid_tax` (number): PPN
- `paid_voucher_amt` (number): Nilai Voucher
- `paid_total` (number): Total Pembayaran

**Jumlah Piutang (Receivable):**
- `receivable_regist` (number): Piutang Karcis
- `receivable_action` (number): Piutang Tindakan
- `receivable_lab` (number): Piutang Laboratorium
- `receivable_drug` (number): Piutang Obat
- `receivable_alkes` (number): Piutang Alkes
- `receivable_mcu` (number): Piutang MCU
- `receivable_radio` (number): Piutang Radiologi
- `receivable_total` (number): Total Piutang

**Catatan:**
- Field dapat menggunakan format dari scrap (misalnya `"Jumlah Tagihan ( Rp. ) - Karcis"`) atau format snake_case (misalnya `bill_regist`)
- Jika `paid_discount > 0`, sistem akan otomatis menghitung `paid_action_after_discount = paid_action - paid_discount`
- Jika `payment_method` mengandung "QRIS", sistem akan otomatis mengisi `id_rekening` di `transactions_to_zains`

---

## Response

### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Insert transaksi berhasil",
  "data": {
    "total_processed": 1,
    "inserted": 1,
    "zains_inserted": 4,
    "skipped": 0,
    "errors": null
  }
}
```

**Response Fields:**
- `total_processed` (number): Total transaksi yang diproses
- `inserted` (number): Total transaksi yang berhasil di-insert
- `zains_inserted` (number): Total record yang di-insert ke `transactions_to_zains`
- `skipped` (number): Total transaksi yang di-skip karena error
- `errors` (array|null): Array berisi detail error jika ada (optional)

### Error Responses

#### 400 Bad Request - Missing Required Fields

```json
{
  "error": "clinic_id harus diisi"
}
```

atau

```json
{
  "error": "transaction_data harus berupa array yang tidak kosong"
}
```

#### 404 Not Found - Clinic Not Found

```json
{
  "error": "Clinic tidak ditemukan atau tidak aktif"
}
```

#### 500 Internal Server Error

```json
{
  "error": "Internal server error",
  "details": "Error message details"
}
```

---

## Contoh Request

### Contoh 1: Single Transaction

```json
{
  "clinic_id": 1,
  "transaction_data": [
    {
      "trx_date": "2026-01-28",
      "trx_no": "TRX001",
      "erm_no": "ERM001",
      "patient_name": "John Doe",
      "insurance_type": "BPJS",
      "polyclinic": "Poli Umum",
      "payment_method": "Tunai",
      "voucher_code": "-",
      "bill_regist": 50000,
      "bill_action": 100000,
      "bill_lab": 75000,
      "bill_drug": 50000,
      "bill_alkes": 0,
      "bill_mcu": 0,
      "bill_radio": 0,
      "bill_total": 275000,
      "covered_regist": 0,
      "covered_action": 50000,
      "covered_lab": 0,
      "covered_drug": 0,
      "covered_alkes": 0,
      "covered_mcu": 0,
      "covered_radio": 0,
      "covered_total": 50000,
      "paid_regist": 50000,
      "paid_action": 100000,
      "paid_lab": 75000,
      "paid_drug": 50000,
      "paid_alkes": 0,
      "paid_mcu": 0,
      "paid_radio": 0,
      "paid_rounding": 0,
      "paid_discount": 0,
      "paid_tax": 0,
      "paid_voucher_amt": 0,
      "paid_total": 275000,
      "receivable_regist": 0,
      "receivable_action": 0,
      "receivable_lab": 0,
      "receivable_drug": 0,
      "receivable_alkes": 0,
      "receivable_mcu": 0,
      "receivable_radio": 0,
      "receivable_total": 0
    }
  ]
}
```

### Contoh 2: Multiple Transactions

```json
{
  "clinic_id": 1,
  "transaction_data": [
    {
      "trx_date": "2026-01-28",
      "trx_no": "TRX001",
      "erm_no": "ERM001",
      "patient_name": "John Doe",
      "insurance_type": "BPJS",
      "polyclinic": "Poli Umum",
      "payment_method": "Tunai",
      "bill_regist": 50000,
      "bill_action": 100000,
      "bill_total": 150000,
      "paid_regist": 50000,
      "paid_action": 100000,
      "paid_total": 150000
    },
    {
      "trx_date": "2026-01-28",
      "trx_no": "TRX002",
      "erm_no": "ERM002",
      "patient_name": "Jane Smith",
      "insurance_type": "Mandiri",
      "polyclinic": "Poli Gigi",
      "payment_method": "QRIS",
      "bill_regist": 75000,
      "bill_action": 150000,
      "bill_total": 225000,
      "paid_regist": 75000,
      "paid_action": 150000,
      "paid_discount": 10000,
      "paid_total": 215000
    }
  ]
}
```

### Contoh 3: Menggunakan Format dari Scrap

```json
{
  "clinic_id": 1,
  "transaction_data": [
    {
      "Tanggal": "28 January 2026",
      "No Transaksi": "TRX001",
      "No. eRM": "ERM001",
      "Nama Pasien": "John Doe",
      "Asuransi": "BPJS",
      "Ruangan / Poli": "Poli Umum",
      "Metode Pembayaran": "Tunai",
      "Voucher": "-",
      "Jumlah Tagihan ( Rp. ) - Karcis": "50,000",
      "Jumlah Tagihan ( Rp. ) - Tindakan": "100,000",
      "Jumlah Tagihan ( Rp. ) - Total": "150,000",
      "Jumlah Pembayaran ( Rp. ) - Karcis": "50,000",
      "Jumlah Pembayaran ( Rp. ) - Tindakan": "100,000",
      "Jumlah Pembayaran ( Rp. ) - Total": "150,000"
    }
  ]
}
```

---

## Logika Insert

### 1. Patient Insert/Update

- Jika patient baru: Insert dengan `first_visit_at`, `last_visit_at` = tanggal transaksi, `visit_count` = 1
- Jika patient sudah ada: Update `last_visit_at` jika tanggal transaksi lebih baru, `first_visit_at` jika tanggal transaksi lebih lama
- `visit_count` akan di-increment hanya jika transaksi benar-benar baru (bukan duplicate)

### 2. Transaction Insert/Update

- Insert transaction dengan semua field yang diberikan
- Jika terjadi conflict (berdasarkan `clinic_id`, `erm_no`, `trx_date`, `polyclinic`, `bill_total`), akan melakukan update
- `input_type` akan diset ke `'manual'` untuk membedakan dengan data dari scrap

### 3. Transactions to Zains

- Hanya insert ke `transactions_to_zains` untuk kategori pembayaran yang memiliki nilai > 0
- Mapping kategori:
  - Karcis → `id_program` dari master_target_categories
  - Tindakan → `id_program` dari master_target_categories (menggunakan `paid_action_after_discount` jika ada diskon)
  - Laboratorium → `id_program` dari master_target_categories
  - Obat-obatan → `id_program` dari master_target_categories
  - Alat Kesehatan → `id_program` dari master_target_categories
  - MCU → `id_program` dari master_target_categories
  - Radiologi → `id_program` dari master_target_categories
  - Pembulatan → `id_program` dari master_target_categories
- Jika `payment_method` mengandung "QRIS", `id_rekening` akan diisi
- Jika patient belum punya `id_donatur_zains` dan ada insert ke `transactions_to_zains`, akan trigger sync ke Zains

### 4. Poly dan Insurance Mapping

- `poly_id` akan dicari dari `clinic_poly_mappings` berdasarkan `raw_poly_name`
- `insurance_type_id` akan dicari dari `clinic_insurance_mappings` berdasarkan `raw_insurance_name`

---

## Catatan Penting

1. **Format Angka**: Sistem akan otomatis menghapus koma dari angka (format Indonesia), jadi `"50,000"` akan di-parse menjadi `50000`

2. **Format Tanggal**: Menerima format:
   - ISO date: `"2026-01-28"`
   - Date string: `"28 January 2026"` atau `"28 Januari 2026"`

3. **Duplicate Handling**: Transaksi dianggap duplicate jika memiliki kombinasi yang sama:
   - `clinic_id`
   - `erm_no`
   - `trx_date`
   - `polyclinic`
   - `bill_total`

4. **Error Handling**: Jika ada error pada salah satu transaksi, transaksi tersebut akan di-skip dan error akan dicatat di response. Transaksi lainnya akan tetap diproses.

5. **Zains Integration**: Pastikan clinic memiliki `id_kantor_zains` yang valid untuk insert ke `transactions_to_zains`

---

## Import Postman Collection

File Postman collection tersedia di: `docs/postman/Transactions Insert API.postman_collection.json`

Untuk import:
1. Buka Postman
2. Klik Import
3. Pilih file `Transactions Insert API.postman_collection.json`
4. Collection akan muncul dengan semua contoh request dan response

---

## Testing

### cURL Example

```bash
curl -X POST http://localhost:3000/api/transactions/insert \
  -H "Content-Type: application/json" \
  -d '{
    "clinic_id": 1,
    "transaction_data": [
      {
        "trx_date": "2026-01-28",
        "trx_no": "TRX001",
        "erm_no": "ERM001",
        "patient_name": "John Doe",
        "insurance_type": "BPJS",
        "polyclinic": "Poli Umum",
        "payment_method": "Tunai",
        "bill_regist": 50000,
        "bill_action": 100000,
        "bill_total": 150000,
        "paid_regist": 50000,
        "paid_action": 100000,
        "paid_total": 150000
      }
    ]
  }'
```
