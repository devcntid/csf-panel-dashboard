# Railway Setup untuk Scrap Queue System

## Overview

Sistem scraping sekarang menggunakan **Railway** sepenuhnya untuk:
- **Cron scheduled**: Otomatis setiap 30 menit (08:00–21:00 WIB, Senin–Sabtu)
- **Insidental**: Trigger manual dari UI Vercel via HTTP endpoint

## Architecture

```
┌─────────────────┐
│  Vercel (UI)    │
│  /api/scrap/    │
│  /api/scrap/    │
│  run-queue      │
└────────┬────────┘
         │ HTTP POST
         │ (insidental)
         ↓
┌─────────────────┐
│  Railway Service│
│  server.js      │
│  Port 3001      │
└────────┬────────┘
         │
         ├─→ Enqueue (cron only)
         └─→ Process Queue
                ↓
         ┌──────────────┐
         │  Database    │
         │  scrap_queue │
         └──────────────┘
```

## Setup di Railway

### 1. Buat Service Baru untuk Worker

1. Buka **Railway Dashboard** → Project kamu
2. Klik **"New"** → **"Empty Service"**
3. Beri nama: `scrap-queue-worker`
4. Pilih **"Deploy from GitHub repo"** (atau connect repository)
5. Pilih repository dan branch yang sama dengan project utama

### 2. Konfigurasi Service

#### A. Environment Variables

Di Railway Dashboard → Service `scrap-queue-worker` → **Variables** tab, tambahkan:

```
NODE_ENV=production
PORT=3001
PROCESS_LIMIT=6

# Database (sama dengan di Vercel)
DATABASE_URL=<connection string Neon Postgres>
POSTGRES_URL=<sama dengan DATABASE_URL>
NEXT_PUBLIC_DATABASE_URL=<sama dengan DATABASE_URL>

# Optional: untuk tracking
RAILWAY_RUN_ID=${{RAILWAY_RUN_ID}}
```

**Cara ambil DATABASE_URL:**
- Buka Vercel → Project → Settings → Environment Variables
- Copy value `DATABASE_URL`
- Paste ke Railway Variables

#### B. Service Settings

1. **Start Command:**
   ```
   pnpm install && pnpm railway:worker
   ```
   Atau jika Railway auto-detect:
   - Railway akan otomatis detect `server.js` sebagai entry point
   - Pastikan `package.json` punya script `railway:worker`

2. **Health Check Path:**
   ```
   /health
   ```

3. **Port:**
   - Railway akan auto-assign port via `PORT` environment variable
   - Service akan expose public URL otomatis

### 3. Setup Railway Cron (Scheduled Task)

Railway tidak punya built-in cron, jadi kita pakai **Railway Cron** atau **external cron service**.

#### Opsi A: Railway Cron (Recommended)

1. Di Railway Dashboard → Project → **"New"** → **"Cron Job"**
2. **Name**: `scrap-queue-cron`
3. **Schedule**: `*/30 1-14 * * 1-6`
   - Ini berarti: setiap 30 menit, jam 01:00–14:00 UTC (08:00–21:00 WIB), Senin–Sabtu
4. **Command**:
   ```bash
   curl -X POST https://<your-railway-service-url>/trigger -H "Content-Type: application/json" -d '{"isCron":true}'
   ```
   Ganti `<your-railway-service-url>` dengan URL service `scrap-queue-worker` yang kamu dapat dari Railway

5. **Environment Variables**: Copy semua env vars dari service `scrap-queue-worker`

#### Opsi B: External Cron Service (Alternatif)

Jika Railway Cron tidak tersedia, bisa pakai:
- **Cron-job.org** (free)
- **EasyCron** (free tier)
- **GitHub Actions** (hanya untuk trigger, bukan untuk run Playwright)

Setup di cron-job.org:
1. Daftar di https://cron-job.org
2. Create new cron job
3. **URL**: `https://<your-railway-service-url>/trigger`
4. **Method**: POST
5. **Body** (JSON):
   ```json
   {"isCron":true}
   ```
6. **Schedule**: `*/30 1-14 * * 1-6` (atau set via UI)
7. **Headers**: `Content-Type: application/json`

### 4. Dapatkan Service URL

1. Di Railway Dashboard → Service `scrap-queue-worker`
2. Klik tab **"Settings"** → **"Networking"**
3. Copy **Public Domain** atau **Custom Domain** (jika sudah setup)
4. Format: `https://scrap-queue-worker-production.up.railway.app`

**Contoh URL lengkap:**
```
https://scrap-queue-worker-production.up.railway.app/trigger
https://scrap-queue-worker-production.up.railway.app/health
```

---

## Setup di Vercel

### 1. Environment Variables

Di Vercel Dashboard → Project → **Settings** → **Environment Variables**, tambahkan:

```
RAILWAY_SERVICE_URL=https://<your-railway-service-url>
```

**Contoh:**
```
RAILWAY_SERVICE_URL=https://scrap-queue-worker-production.up.railway.app
```

**Penting:** 
- Jangan tambahkan `/trigger` di akhir URL
- Hanya base URL saja
- Pastikan sudah di-set untuk **Production**, **Preview**, dan **Development**

### 2. Redeploy

Setelah menambah env var, **redeploy** aplikasi:
1. Vercel Dashboard → **Deployments**
2. Klik **"..."** pada deployment terbaru → **"Redeploy"**
3. Atau push commit baru untuk trigger auto-deploy

---

## Testing

### 1. Test Health Check

```bash
curl https://<your-railway-service-url>/health
```

**Expected response:**
```json
{"status":"ok","processing":false}
```

### 2. Test Manual Trigger (dari Terminal)

```bash
curl -X POST https://<your-railway-service-url>/trigger \
  -H "Content-Type: application/json" \
  -d '{"isCron":false}'
```

**Expected response:**
```json
{"success":true,"message":"Scrap queue worker triggered","isCron":false}
```

### 3. Test dari UI Vercel

1. Buka aplikasi di Vercel → **Dashboard** → **Konfigurasi** → tab **"System Logs"**
2. Klik tombol **"Jalankan Scrap Queue"**
3. Harus muncul toast: **"Scrap queue worker telah di-trigger via Railway..."**

### 4. Test Cron (Scheduled)

1. Tunggu sampai waktu cron (atau trigger manual di Railway Cron)
2. Cek logs di Railway Dashboard → Service `scrap-queue-worker` → **Deployments** → **View Logs**
3. Harus ada log:
   ```
   [Railway Worker] Starting scrap queue worker (cron: true)
   [Railway Worker] Running enqueue-today...
   [Railway Worker] Running scrap:github:queue...
   ```

### 5. Cek Database

```sql
SELECT * FROM scrap_queue 
ORDER BY created_at DESC 
LIMIT 10;
```

Harus ada row baru dengan:
- `status = 'processing'` atau `'completed'`
- `requested_by = 'cron'` (untuk cron) atau `'UI'` (untuk insidental)

---

## Monitoring

### Railway Dashboard

1. **Service Logs:**
   - Railway Dashboard → Service `scrap-queue-worker` → **Deployments** → **View Logs**
   - Real-time logs dari worker

2. **Metrics:**
   - Railway Dashboard → Service `scrap-queue-worker` → **Metrics**
   - CPU, Memory, Network usage

3. **Deployments:**
   - Railway Dashboard → Service `scrap-queue-worker` → **Deployments**
   - History deploy dan status

### Database Monitoring

```sql
-- Cek queue status
SELECT 
  status,
  COUNT(*) as count,
  MAX(created_at) as latest
FROM scrap_queue
GROUP BY status;

-- Cek failed jobs
SELECT * FROM scrap_queue 
WHERE status = 'failed' 
ORDER BY created_at DESC 
LIMIT 10;

-- Cek processing time
SELECT 
  id,
  clinic_id,
  requested_by,
  status,
  started_at,
  completed_at,
  EXTRACT(EPOCH FROM (completed_at - started_at)) as duration_seconds
FROM scrap_queue
WHERE status = 'completed'
ORDER BY completed_at DESC
LIMIT 10;
```

---

## Troubleshooting

### Problem: Service tidak bisa diakses (404/502)

**Solusi:**
1. Cek Railway Dashboard → Service → **Settings** → **Networking**
2. Pastikan service sudah **deployed** dan **running**
3. Cek logs untuk error: Railway Dashboard → **Deployments** → **View Logs**
4. Pastikan `PORT` env var sudah di-set (Railway auto-assign, tapi bisa manual)

### Problem: Health check gagal

**Solusi:**
1. Cek apakah `server.js` sudah ter-deploy
2. Cek logs: Railway Dashboard → **Deployments** → **View Logs**
3. Pastikan `pnpm railway:worker` command berjalan dengan benar

### Problem: Trigger dari Vercel gagal

**Solusi:**
1. Cek `RAILWAY_SERVICE_URL` di Vercel env vars
2. Pastikan format benar: `https://...` (tanpa `/trigger` di akhir)
3. Test manual dengan `curl` (lihat Testing section)
4. Cek Vercel logs: Vercel Dashboard → **Deployments** → **View Logs**

### Problem: Cron tidak jalan

**Solusi:**
1. Cek Railway Cron job status: Railway Dashboard → **Cron Jobs**
2. Cek logs cron job
3. Test manual trigger dulu (pastikan service URL benar)
4. Jika pakai external cron (cron-job.org), cek dashboard mereka untuk execution history

### Problem: Job stuck di "processing"

**Solusi:**
1. Cek Railway logs untuk error
2. Cek database untuk `error_message`:
   ```sql
   SELECT * FROM scrap_queue WHERE status = 'processing' ORDER BY started_at DESC;
   ```
3. Jika stuck > 1 jam, bisa manual update status:
   ```sql
   UPDATE scrap_queue 
   SET status = 'failed', 
       error_message = 'Timeout: manually reset'
   WHERE status = 'processing' 
     AND started_at < NOW() - INTERVAL '1 hour';
   ```

### Problem: Database connection error

**Solusi:**
1. Cek `DATABASE_URL` di Railway env vars
2. Pastikan sama dengan di Vercel
3. Test connection:
   ```bash
   # Di Railway service, bisa test via logs atau SSH
   node -e "require('@/lib/db').sql`SELECT 1`"
   ```

---

## Cost Estimation

### Railway Pricing (per bulan)

- **Service**: ~$5–20 (tergantung usage)
- **Cron**: Free (jika pakai Railway Cron) atau $0 (external cron)
- **Database**: Sudah ada (Neon Postgres, terpisah)

**Total estimasi:** ~$5–20/bulan untuk worker service

---

## Checklist Setup

- [ ] Railway service `scrap-queue-worker` dibuat
- [ ] Environment variables di-set di Railway (DATABASE_URL, dll)
- [ ] Service deployed dan running
- [ ] Health check endpoint (`/health`) accessible
- [ ] Railway Cron job dibuat (atau external cron)
- [ ] Cron schedule: `*/30 1-14 * * 1-6` (08:00–21:00 WIB, Senin–Sabtu)
- [ ] `RAILWAY_SERVICE_URL` di-set di Vercel env vars
- [ ] Vercel di-redeploy setelah set env var
- [ ] Test health check → sukses
- [ ] Test manual trigger dari terminal → sukses
- [ ] Test trigger dari UI Vercel → sukses
- [ ] Test cron (tunggu schedule atau trigger manual) → sukses
- [ ] Cek database: queue items ter-proses → sukses

---

## Migration dari GitHub Actions

Setelah setup Railway selesai:

1. **Disable GitHub Actions workflow** (optional):
   - GitHub → Repository → **Settings** → **Actions** → **General**
   - Atau rename `.github/workflows/scrap-queue.yml` ke `.github/workflows/scrap-queue.yml.disabled`

2. **Hapus GitHub Secrets** (optional):
   - GitHub → Repository → **Settings** → **Secrets and variables** → **Actions**
   - Bisa dihapus atau dibiarkan untuk backup

3. **Hapus env vars di Vercel** (optional):
   - `GITHUB_ACTIONS_TOKEN`
   - `GITHUB_REPO`
   - `GITHUB_REF`

---

## Support

Jika ada masalah:
1. Cek **Railway logs** terlebih dahulu
2. Cek **database** untuk error messages
3. Test **health check** dan **manual trigger**
4. Pastikan semua **env vars** sudah benar
