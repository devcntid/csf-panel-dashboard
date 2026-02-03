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
                        │ HTTP POST (trigger insidental)
                        ↓
┌─────────────────────────────────────────────────────────┐
│              RAILWAY (Worker + Cron)                    │
│  - server.js (HTTP server untuk trigger)                │
│  - Playwright scraping (jalan di Railway, bukan Vercel) │
│  - Cron job (scheduled setiap 30 menit via cron-job.org) │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ↓
              ┌──────────────────┐
              │  Neon Postgres   │
              │  (Database)      │
              └──────────────────┘
```

## 🚀 Fitur Utama

### 1. Scraping Otomatis (Scheduled)
- **Jadwal**: Setiap 30 menit, Senin-Sabtu, 08:00-21:00 WIB
- **Trigger**: Cron-job.org → Railway `/trigger` endpoint
- **Proses**: 
  - Enqueue jobs untuk semua klinik aktif
  - Process queue items secara sequential
  - Skip hari libur (berdasarkan `public_holidays` table)

### 2. Scraping Manual (Insidental)
- **Trigger**: Button "Jalankan Scrap Queue" di halaman Konfigurasi
- **Proses**: Langsung trigger Railway worker tanpa menunggu cron
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
- Railway account (untuk worker)
- Vercel account (untuk frontend)
- Cron-job.org account (untuk scheduled cron)

### Environment Variables

#### Vercel
```
DATABASE_URL=<neon_postgres_connection_string>
POSTGRES_URL=<sama dengan DATABASE_URL>
NEXT_PUBLIC_DATABASE_URL=<sama dengan DATABASE_URL>
RAILWAY_SERVICE_URL=<railway_worker_url>
```

#### Railway
```
NODE_ENV=production
PORT=<auto-assigned oleh Railway>
PROCESS_LIMIT=6
DATABASE_URL=<neon_postgres_connection_string>
POSTGRES_URL=<sama dengan DATABASE_URL>
NEXT_PUBLIC_DATABASE_URL=<sama dengan DATABASE_URL>
IDLE_TIMEOUT=300000
SCRAPERAPI_KEY=<scraperapi_api_key>      # Optional: untuk bypass Cloudflare via ScraperAPI proxy
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

### Railway Setup

1. **Create Service:**
   - New → Empty Service
   - Name: `scrap-queue-worker`
   - Deploy from GitHub repo

2. **Configure:**
   - Start Command: `pnpm railway:worker`
   - Builder: Dockerfile
   - Set environment variables

3. **Cron Setup (cron-job.org):**
   - **Wake Service**: `55,25 0-13 * * 1-6` (07:55 & 20:55 WIB, Senin-Sabtu)
     - URL: `https://<railway-url>/wake`
   - **Trigger Scrap**: `*/30 1-14 * * 1-6` (08:00-21:00 WIB setiap 30 menit, Senin-Sabtu)
     - URL: `https://<railway-url>/trigger`
     - Method: POST
     - Body: `{"isCron":true}`

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

## 📊 Queue System

### Flow Scraping

1. **Cron Trigger** (setiap 30 menit):
   - Cron-job.org → POST `/trigger` dengan `{"isCron":true}`
   - Railway worker enqueue jobs untuk semua klinik aktif
   - Railway worker process queue items secara sequential

2. **Manual Trigger**:
   - UI Vercel → POST `/api/scrap/run-queue`
   - Vercel API → POST Railway `/trigger` dengan `{"isCron":false}`
   - Railway worker langsung process queue tanpa enqueue

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

### Railway 502 Error
- Pastikan server listen di `0.0.0.0`, bukan `localhost`
- Cek Playwright installation di Dockerfile
- Pastikan PORT environment variable tidak conflict

### Cloudflare Challenge Timeout
- **Playwright Extra Stealth**: Menggunakan `playwright-extra` dengan `playwright-extra-plugin-stealth` untuk menyembunyikan browser automation fingerprint
- Script sudah handle "Tunggu sebentar..." (Bahasa Indonesia)
- Timeout ditingkatkan menjadi 120 detik
- Browser context dikonfigurasi tanpa custom headers (menggunakan default Playwright)
- Jika masih timeout, pertimbangkan menggunakan proxy service (lihat `docs/CLOUDFLARE_BYPASS_OPTIONS.md`)

### Queue Items Tidak Terproses
- Cek Railway logs untuk error
- Pastikan `PROCESS_LIMIT` sesuai jumlah klinik
- Cek database connection di Railway

## 📝 Notes

- Scraping menggunakan Playwright dengan headless browser
- Data di-insert dengan idempotency (ON CONFLICT) untuk mencegah duplicate
- Queue system memastikan tidak ada concurrent scraping untuk klinik yang sama
- Auto-sleep optimization untuk Railway Free tier (IDLE_TIMEOUT)

## 🔗 Links

- **Vercel Dashboard**: https://vercel.com
- **Railway Dashboard**: https://railway.app
- **Cron-Job.org**: https://cron-job.org
- **Neon Dashboard**: https://console.neon.tech
