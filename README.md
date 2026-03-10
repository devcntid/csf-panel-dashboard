# CSF Panel Dashboard

Dashboard untuk monitoring dan manajemen data klinik **Cita Sehat Foundation** (CSF). Data transaksi dari sistem eClinic masuk ke dashboard ini melalui **API**; penghubungnya adalah **Chrome Extension** yang dipasang di browser saat user membuka eClinic. Extension tersebut memanggil API dashboard untuk meng-insert transaksi ke sini.

---

## Product Requirements Document (PRD)

### 1. Ringkasan Produk

**CSF Panel Dashboard** adalah aplikasi web (Next.js) yang berfungsi sebagai:

- **Pusat data transaksi** dari berbagai klinik cabang Cita Sehat Foundation
- **Tujuan utama**: mengumpulkan data transaksi dari eClinic (sumber data) ke satu tempat, lalu menyinkronkannya ke sistem **Zains** (sistem donasi/keuangan)
- **Cara data masuk**: tidak ada scraping. Semua data masuk **melalui API**. Penghubung antara eClinic dan dashboard ini adalah **Chrome Extension** yang ditanam di browser; extension itulah yang memanggil API dashboard untuk insert transaksi.

### 2. Alur Data (Data Flow)

```
┌─────────────────┐      ┌─────────────────────────────────────────────────────────┐
│   eClinic       │      │              CSF Panel Dashboard (Vercel)                 │
│   (sumber data  │      │  - Next.js (UI + API)                                    │
│   transaksi)    │      │  - POST /api/transactions/insert                         │
│                 │      │  - POST /api/upload-transactions-batch (upload Excel)    │
└────────┬────────┘      └───────────────────────────┬─────────────────────────────┘
         │                                             │
         │  User buka eClinic di Chrome                │  Database (Neon Postgres)
         │  Extension baca data di halaman              │  - patients, transactions,
         │  Extension panggil API insert ──────────────►│    transactions_to_zains
         │                                             │
         │  Chrome Extension (penghubung)              ▼
         │  - Terpasang di browser                     ┌──────────────────┐
         │  - Mengambil data dari eClinic             │  Neon Postgres   │
         │  - Memanggil API dashboard untuk insert    └────────┬─────────┘
         │    transaksi ke dashboard ini                      │
                                                               │  Sync ke Zains
                                                               ▼
                                                      ┌──────────────────┐
                                                      │  API Zains       │
                                                      │  (donasi/keuangan)│
                                                      └──────────────────┘
```

**Ringkas:**

1. **Sumber data**: eClinic (aplikasi manajemen klinik).
2. **Penghubung**: **Chrome Extension** — dipasang di browser; saat user membuka eClinic, extension mengambil data transaksi dari halaman dan **memanggil API dashboard** (mis. `POST /api/transactions/insert`) untuk meng-insert data ke dashboard ini.
3. **Dashboard (aplikasi ini)**: menerima data via API, menyimpan ke database (Neon Postgres), menampilkan di UI, dan mengirim data yang relevan ke **Zains** (sinkronisasi ke sistem donasi/keuangan).
4. **Tidak ada scraping**: semua masukan data ke dashboard dilakukan **hanya melalui API** (dipanggil oleh Chrome Extension atau oleh upload manual/Excel di UI).

### 3. Fitur Utama

| Area | Deskripsi |
|------|------------|
| **Transaksi** | Daftar transaksi per klinik, filter tanggal/poli/asuransi, export Excel, upload Excel batch, detail transaksi & sync Zains |
| **Pasien** | Daftar pasien, detail pasien, riwayat kunjungan |
| **Klinik** | Master klinik cabang, dashboard per klinik |
| **Konfigurasi** | App settings, mapping poli & asuransi, master insurance type, master klinik/poli, system logs, hari libur, user management |
| **Sinkronisasi Zains** | Toggle sync ke Zains, batch sync transaksi & pasien ke API Zains (via Upstash QStash workflow) |
| **Summary & Laporan** | Summary SE (bulanan/tahunan), dashboard yayasan, fins (cashbook, jurnal), daily targets |

### 4. API untuk Penghubung (Chrome Extension)

Extension (atau integrasi lain) memanggil API dashboard untuk mengirim data transaksi:

- **POST `/api/transactions/insert`**  
  Insert transaksi secara batch. Body: `{ "clinic_id": number, "transaction_data": [ ... ] }`.  
  Setiap item di `transaction_data` berisi field transaksi (trx_date, erm_no, patient_name, bill_*, paid_*, dll).  
  Lihat dokumentasi lengkap di `docs/postman/API_DOCUMENTATION.md` dan collection Postman di `docs/postman/`.

Setelah insert:

- Dashboard menyimpan ke tabel `patients`, `transactions`, `transactions_to_zains`.
- Jika sync ke Zains aktif, pasien dan transaksi akan di-sync ke API Zains (via workflow QStash).

**Alternatif input data (tanpa extension):**

- **Upload Excel**: UI upload + **POST `/api/upload-transactions-batch`** (template bisa diambil dari **GET `/api/upload-transactions/template/:clinicId`**).

### 5. Sinkronisasi ke Zains

- Data yang sudah masuk (dari API insert/upload) dapat disinkronkan ke sistem **Zains** (API eksternal).
- Sync dijalankan melalui **Upstash QStash** (workflow): endpoint seperti `/api/sync-transactions-to-zains` dan `/api/workflow/sync-patient-to-zains` memproses antrian sync.
- Di konfigurasi dashboard ada toggle untuk mengaktifkan/nonaktifkan pengiriman data ke Zains.

---

## Arsitektur Teknis

```
┌─────────────────────────────────────────────────────────┐
│                    VERCEL (Frontend + API)               │
│  - Next.js App (UI Dashboard)                            │
│  - API Routes (transactions/insert, upload, sync Zains)   │
└───────────────────────┬─────────────────────────────────┘
                        │
                        │ Database
                        ▼
              ┌──────────────────┐
              │  Neon Postgres   │
              │  (Database)      │
              └──────────────────┘
```

- **Frontend**: Next.js (React), dashboard untuk melihat dan mengelola data.
- **Backend**: API Routes Next.js di Vercel (serverless).
- **Database**: Neon Postgres (pasien, transaksi, klinik, mapping, logs, dll).
- **Integrasi**: Chrome Extension memanggil API dashboard; dashboard memanggil API Zains untuk sync.

---

## Setup

### Prerequisites

- Node.js 18+
- pnpm
- Neon Postgres database
- Vercel account (untuk deploy)

### Environment Variables

```env
# Database (Neon)
DATABASE_URL=<neon_postgres_connection_string>
POSTGRES_URL=<sama dengan DATABASE_URL>
NEXT_PUBLIC_DATABASE_URL=<sama dengan DATABASE_URL>

# Upstash QStash (untuk sync ke Zains)
QSTASH_TOKEN=<upstash_qstash_token>
# atau
UPSTASH_QSTASH_TOKEN=<upstash_qstash_token>

# URL aplikasi (untuk workflow/callback)
NEXT_PUBLIC_APP_URL=<https://your-app.vercel.app>
# atau VERCEL_URL akan otomatis digunakan jika tersedia

# Zains API
URL_API_ZAINS_PRODUCTION=<production_url>
URL_API_ZAINS_STAGING=<staging_url>
API_KEY_ZAINS=<zains_api_key>
IS_PRODUCTION=<true|false>

# Vercel Blob (upload logo & background login)
BLOB_READ_WRITE_TOKEN=<dari Vercel Dashboard → Storage → Blob>
```

### Database

Jalankan migrasi:

```bash
pnpm migrate
```

Seed hari libur (opsional):

```sql
INSERT INTO public_holidays (holiday_date, year, description, is_national_holiday)
VALUES ('2025-01-01', 2025, 'Tahun Baru', true);
```

### Scripts

```bash
pnpm dev          # Development server
pnpm build        # Build production
pnpm start        # Start production server
pnpm migrate      # Jalankan migrasi database
pnpm seed         # Seed data (opsional)
```

---

## Dokumentasi API

- **Insert transaksi (untuk Chrome Extension / integrasi)**: `docs/postman/API_DOCUMENTATION.md`
- **Postman collection**: `docs/postman/Transactions Insert API.postman_collection.json`

---

## Ringkasan PRD

| Aspek | Keterangan |
|-------|------------|
| **Produk** | Dashboard CSF untuk monitoring & manajemen data klinik; data masuk hanya lewat API. |
| **Sumber data** | eClinic. |
| **Penghubung** | Chrome Extension di browser: baca data dari eClinic, panggil API dashboard untuk insert transaksi ke sini. |
| **Sinkronisasi** | Via API: extension/upload → dashboard (Neon) → (opsional) sync ke Zains via QStash. |
| **Tidak ada** | Scraping, Playwright, atau cara lain selain API/upload untuk memasukkan data. |

---

## Links

- **Vercel**: https://vercel.com  
- **Neon**: https://console.neon.tech  
