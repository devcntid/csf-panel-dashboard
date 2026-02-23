# CSF Panel Dashboard

Dashboard untuk monitoring dan manajemen data klinik Cita Sehat Foundation dengan sistem scraping otomatis.

## 🏗️ Arsitektur

```
┌─────────────────────────────────────────────────────────┐
│                    VERCEL (Frontend + API)              │
│  - Next.js App (UI Dashboard)                          │
│  - API Routes (/api/scrap/queue, /api/scrap/run-queue) │
│  - Tidak menjalankan Playwright (aman untuk serverless) │
└───────────────────────┬─────────────────────────────────┘
                        │
                        │ Database (Neon Postgres)
                        ↓
              ┌──────────────────┐
              │  Neon Postgres   │
              │  (Database)      │
              └──────────────────┘
                        │
                        │ Queue Jobs (scrap_queue table)
                        ↓
┌─────────────────────────────────────────────────────────┐
│              LOCAL WORKER (Mac)                         │
│  - Playwright scraping (jalan di Mac lokal)             │
│  - Cron job (scheduled setiap 30 menit via crontab)    │
│  - Process queue items secara sequential                │
└─────────────────────────────────────────────────────────┘
```

## 🚀 Fitur Utama

### 1. Scraping Otomatis (Scheduled)
- **Jadwal**: Setiap 30 menit, Senin-Sabtu, 08:00-21:00 WIB
- **Trigger**: Crontab lokal di Mac → `pnpm scrap:github:queue`
- **Proses**: 
  - Enqueue jobs untuk semua klinik aktif (via cron atau manual)
  - Process queue items secara sequential
  - Skip hari libur (berdasarkan `public_holidays` table)

### 2. Scraping Manual (Insidental)
- **Trigger**: Button "Jalankan Scrap Queue" di halaman Konfigurasi
- **Proses**: Enqueue jobs ke database, lalu jalankan `pnpm scrap:github:queue` di Mac lokal
- **Use Case**: Scraping spesifik untuk klinik tertentu di luar jadwal

### 3. Queue Management
- **Table**: `scrap_queue` untuk tracking semua scraping jobs
- **Status**: `pending`, `processing`, `completed`, `failed`
- **Idempotency**: Mencegah duplicate data dengan `ON CONFLICT` clauses
- **Cleanup**: Script untuk menghapus old completed items (>7 hari)

## 📦 Setup

### Prerequisites
- Node.js 18+
- pnpm
- Neon Postgres database
- Vercel account (untuk frontend)
- Mac dengan Playwright terinstall (untuk worker)

### Environment Variables

#### Vercel
```
DATABASE_URL=<neon_postgres_connection_string>
POSTGRES_URL=<sama dengan DATABASE_URL>
NEXT_PUBLIC_DATABASE_URL=<sama dengan DATABASE_URL>

# Upstash Workflow (untuk sync patient ke Zains)
QSTASH_TOKEN=<upstash_qstash_token>
# atau
UPSTASH_QSTASH_TOKEN=<upstash_qstash_token>

# URL aplikasi untuk workflow endpoint
NEXT_PUBLIC_APP_URL=<https://your-app.vercel.app>
# atau VERCEL_URL akan otomatis digunakan jika tersedia

# Zains API Configuration
URL_API_ZAINS_PRODUCTION=<production_url>
URL_API_ZAINS_STAGING=<staging_url>
API_KEY_ZAINS=<zains_api_key>
IS_PRODUCTION=<true|false>

# Vercel Blob (untuk upload logo & background login di App Settings)
BLOB_READ_WRITE_TOKEN=<dari Vercel Dashboard → Storage → Blob>
```

#### Local Mac (untuk worker)
```
DATABASE_URL=<neon_postgres_connection_string>
POSTGRES_URL=<sama dengan DATABASE_URL>
NEXT_PUBLIC_DATABASE_URL=<sama dengan DATABASE_URL>
PROCESS_LIMIT=6
```

### Database Setup

1. **Create scrap_queue table:**
```bash
pnpm scrap:queue:table
```

2. **Seed public_holidays (optional):**
```sql
INSERT INTO public_holidays (holiday_date, year, description, is_national_holiday)
VALUES ('2025-01-01', 2025, 'Tahun Baru', true);
```

## 🛠️ Scripts

```bash
# Development
pnpm dev                    # Start Next.js dev server
pnpm build                  # Build for production

# Scraping
pnpm scrap:enqueue-today    # Enqueue jobs untuk hari ini
pnpm scrap:github:queue    # Process queue items
pnpm scrap:queue:cleanup   # Cleanup old completed items

# Database
pnpm migrate                # Run database migrations
pnpm scrap:queue:table     # Create scrap_queue table
```

## 💻 Local Worker (Mac)

Untuk menjalankan scraping di Mac (disarankan untuk menghindari blokir Cloudflare):

### Setup Awal

```bash
cd /Users/muhammadirvan/Documents/projects/csf-panel-dashboard

# 1. Install dependencies (sekali saja)
pnpm install
pnpm playwright:install

# 2. Pastikan .env.local sudah berisi DATABASE_URL yang benar
```

### Manual Run

```bash
# Enqueue jobs untuk hari ini (boleh dipanggil dari UI juga)
pnpm scrap:enqueue-today

# Process queue (Playwright jalan di Mac kamu)
pnpm scrap:github:queue
```

### Setup Cron (Otomatis)

Untuk menjalankan `scrap:github:queue` secara otomatis di Mac (setiap 30 menit, Senin-Sabtu, 08:00-21:00 WIB):

1. **Cari path `pnpm`**:
```bash
which pnpm
# Contoh output: /opt/homebrew/bin/pnpm
```

2. **Edit crontab**:
```bash
crontab -e
```

3. **Tambahkan baris berikut**:
```cron
*/30 8-21 * * 1-6 cd /Users/muhammadirvan/Documents/projects/csf-panel-dashboard && /opt/homebrew/bin/pnpm scrap:github:queue >> /Users/muhammadirvan/csf-scrap.log 2>&1
```

**Penting**: 
- Sesuaikan `/opt/homebrew/bin/pnpm` dengan path `pnpm` yang benar di Mac kamu (hasil dari `which pnpm`).
- Sesuaikan `/Users/muhammadirvan/Documents/projects/csf-panel-dashboard` dengan path folder project kamu.
- Output log akan disimpan di `/Users/muhammadirvan/csf-scrap.log`.

**Catatan**: 
- Cron ini hanya menjalankan `scrap:github:queue` (process queue).
- Untuk enqueue jobs, kamu bisa:
  - Menjalankan `pnpm scrap:enqueue-today` secara manual sebelum jam 08:00 WIB setiap hari
  - Atau setup cron terpisah untuk enqueue (misalnya jam 07:55 WIB setiap hari kerja)
  - Atau menggunakan button "Jalankan Scrap Queue" di UI Vercel (akan enqueue otomatis)

## 📊 Queue System

### Flow Scraping

1. **Cron Trigger** (setiap 30 menit):
   - Crontab lokal → `pnpm scrap:github:queue`
   - Worker process queue items secara sequential
   - Jika tidak ada pending jobs, worker akan skip

2. **Manual Trigger**:
   - UI Vercel → POST `/api/scrap/run-queue`
   - Vercel API → Enqueue jobs ke database
   - User jalankan `pnpm scrap:github:queue` di Mac lokal untuk process queue

### Queue Status

- **pending**: Menunggu diproses
- **processing**: Sedang diproses
- **completed**: Selesai dengan sukses
- **failed**: Gagal (error message tersimpan)

### Cleanup

Run cleanup script secara berkala (misalnya via cron harian):

```bash
pnpm scrap:queue:cleanup
```

Ini akan menghapus:
- Completed items > 7 hari
- Failed items > 30 hari

## 🔧 Troubleshooting

### Cloudflare Challenge Timeout
- Script sudah handle "Tunggu sebentar..." (Bahasa Indonesia)
- Timeout ditingkatkan menjadi 120 detik
- Browser context dikonfigurasi tanpa custom headers (menggunakan default Playwright)
- Jika masih timeout, pastikan Mac kamu memiliki koneksi internet yang stabil

### Queue Items Tidak Terproses
- Cek log di Mac (`/Users/muhammadirvan/csf-scrap.log` jika menggunakan cron)
- Pastikan `PROCESS_LIMIT` sesuai jumlah klinik
- Cek database connection di Mac (pastikan `.env.local` sudah benar)
- Pastikan Playwright sudah terinstall (`pnpm playwright:install`)

### Browser Launch Error
- Pastikan Playwright sudah terinstall dengan dependencies: `pnpm playwright:install`
- Jika di Mac M1/M2, pastikan menggunakan versi Playwright yang kompatibel
- Cek apakah ada process Chromium yang masih berjalan: `ps aux | grep chromium`

## 📝 Notes

- Scraping menggunakan Playwright dengan headless browser
- Data di-insert dengan idempotency (ON CONFLICT) untuk mencegah duplicate
- Queue system memastikan tidak ada concurrent scraping untuk klinik yang sama
- Worker berjalan di Mac lokal untuk menghindari deteksi Cloudflare dari IP datacenter

## 🔗 Links

- **Vercel Dashboard**: https://vercel.com
- **Neon Dashboard**: https://console.neon.tech
