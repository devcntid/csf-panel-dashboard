# Setup Recap Lengkap: Vercel + Railway

## 📋 Overview

Setelah deploy berhasil, berikut semua yang perlu di-setup untuk sistem scraping berjalan dengan sempurna.

---

## 🚀 1. Setup di Railway

### A. Environment Variables

Di **Railway Dashboard** → Service `scrap-queue-worker` → Tab **"Variables"**, tambahkan:

#### Required (Wajib):

```
NODE_ENV=production
PORT=3001
PROCESS_LIMIT=6

# Database (copy dari Vercel)
DATABASE_URL=<paste dari Vercel>
POSTGRES_URL=<sama dengan DATABASE_URL>
NEXT_PUBLIC_DATABASE_URL=<sama dengan DATABASE_URL>
```

#### Optional (Opsional):

```
IDLE_TIMEOUT=300000
```
- Default: `300000` (5 menit dalam milliseconds)
- Untuk optimasi Railway Free tier

**Cara ambil DATABASE_URL:**
1. Buka **Vercel Dashboard** → Project → **Settings** → **Environment Variables**
2. Cari `DATABASE_URL`
3. Klik icon **👁️ (eye)** untuk reveal value
4. **Copy** seluruh value
5. **Paste** ke Railway Variables

### B. Dapatkan Railway Service URL

1. Di **Railway Dashboard** → Service `scrap-queue-worker`
2. Klik tab **"Settings"** → **"Networking"**
3. Copy **Public Domain** (contoh: `https://scrap-queue-worker-production.up.railway.app`)
4. **Simpan URL ini** untuk step berikutnya (tanpa `/trigger` di akhir)

**Format URL:**
```
https://scrap-queue-worker-production.up.railway.app
```

**Jangan tambahkan `/trigger` atau path lain di akhir URL!**

---

## 🌐 2. Setup di Vercel

### A. Environment Variables

Di **Vercel Dashboard** → Project → **Settings** → **Environment Variables**, tambahkan:

#### Required (Wajib):

```
RAILWAY_SERVICE_URL=https://<railway-service-url>
```

**Contoh:**
```
RAILWAY_SERVICE_URL=https://scrap-queue-worker-production.up.railway.app
```

**Penting:**
- Format: `https://...` (tanpa `/trigger` di akhir)
- Hanya base URL saja
- Pastikan sudah di-set untuk **Production**, **Preview**, dan **Development**

### B. Vercel Cron Jobs

Vercel Cron sudah dikonfigurasi di `vercel.json`:

1. **Wake Railway** (5 menit sebelum scraping)
   - Path: `/api/cron/wake-railway`
   - Schedule: `55 7-20 * * 1-6` (07:55-20:55 WIB, Senin-Sabtu, setiap 30 menit)

2. **Trigger Scrap Queue** (scraping setiap 30 menit)
   - Path: `/api/cron/trigger-scrap-queue`
   - Schedule: `*/30 1-14 * * 1-6` (setiap 30 menit, 01:00-14:00 UTC = 08:00-21:00 WIB, Senin-Sabtu)

3. **Create Partition** (bulanan)
   - Path: `/api/cron/create-partition`
   - Schedule: `0 0 25 * *` (tanggal 25 setiap bulan)

4. **Refresh Materialized View** (harian)
   - Path: `/api/cron/refresh-materialized-view`
   - Schedule: `0 2 * * *` (jam 2 pagi setiap hari)

**Vercel Cron akan otomatis aktif setelah deploy!**

### C. Redeploy Vercel

Setelah menambah environment variable `RAILWAY_SERVICE_URL`:

1. **Vercel Dashboard** → **Deployments**
2. Klik **"..."** pada deployment terbaru → **"Redeploy"**
3. Atau push commit baru untuk trigger auto-deploy

---

## ✅ 3. Checklist Setup Setelah Deploy

### Railway Setup

- [ ] Railway service `scrap-queue-worker` sudah dibuat dan deployed
- [ ] Environment variables di-set di Railway:
  - [ ] `NODE_ENV=production`
  - [ ] `PORT=3001`
  - [ ] `PROCESS_LIMIT=6`
  - [ ] `DATABASE_URL` (copy dari Vercel)
  - [ ] `POSTGRES_URL` (sama dengan DATABASE_URL)
  - [ ] `NEXT_PUBLIC_DATABASE_URL` (sama dengan DATABASE_URL)
  - [ ] `IDLE_TIMEOUT=300000` (optional)
- [ ] Railway Service URL sudah di-copy (dari Settings → Networking)
- [ ] Service status: **"Active"** (green)

### Vercel Setup

- [ ] Environment variable `RAILWAY_SERVICE_URL` sudah di-set di Vercel
- [ ] Format URL benar: `https://...` (tanpa `/trigger`)
- [ ] Environment: Production, Preview, Development (semua)
- [ ] Vercel sudah di-redeploy setelah set env var
- [ ] Vercel Cron jobs aktif (cek di Vercel Dashboard → Settings → Cron Jobs)

### Testing

- [ ] Test Railway health check:
  ```bash
  curl https://<railway-service-url>/health
  ```
  Expected: `{"status":"ok","processing":false,...}`

- [ ] Test Railway wake endpoint:
  ```bash
  curl https://<railway-service-url>/wake
  ```
  Expected: `{"success":true,"message":"Service woken up",...}`

- [ ] Test trigger dari UI Vercel:
  - Buka Dashboard → Konfigurasi → System Logs
  - Klik tombol "Jalankan Scrap Queue"
  - Harus muncul toast: "Scrap queue worker telah di-trigger via Railway..."

- [ ] Test Vercel Cron (tunggu schedule atau trigger manual):
  - Cek Vercel Dashboard → Logs
  - Harus ada log dari `/api/cron/wake-railway` dan `/api/cron/trigger-scrap-queue`

- [ ] Cek database:
  ```sql
  SELECT * FROM scrap_queue 
  ORDER BY created_at DESC 
  LIMIT 10;
  ```
  Harus ada row baru dengan status `processing` atau `completed`

---

## 📝 4. Ringkasan Environment Variables

### Railway Environment Variables

| Variable | Value | Required | Sumber |
|----------|-------|----------|--------|
| `NODE_ENV` | `production` | ✅ | Manual |
| `PORT` | `3001` | ✅ | Manual |
| `PROCESS_LIMIT` | `6` | ✅ | Manual |
| `DATABASE_URL` | `postgresql://...` | ✅ | Copy dari Vercel |
| `POSTGRES_URL` | `postgresql://...` | ✅ | Copy dari Vercel |
| `NEXT_PUBLIC_DATABASE_URL` | `postgresql://...` | ⚠️ | Copy dari Vercel |
| `IDLE_TIMEOUT` | `300000` | ❌ | Optional (default: 300000) |

### Vercel Environment Variables

| Variable | Value | Required | Sumber |
|----------|-------|----------|--------|
| `RAILWAY_SERVICE_URL` | `https://...` | ✅ | Copy dari Railway |
| `DATABASE_URL` | `postgresql://...` | ✅ | Sudah ada (dari setup sebelumnya) |
| `POSTGRES_URL` | `postgresql://...` | ✅ | Sudah ada (dari setup sebelumnya) |

---

## 🔍 5. Monitoring & Troubleshooting

### Cek Railway Service Status

1. **Railway Dashboard** → Service `scrap-queue-worker`
2. Status harus **"Active"** (green)
3. Cek logs: **Deployments** → **View Logs**

### Cek Vercel Cron Jobs

1. **Vercel Dashboard** → Project → **Settings** → **Cron Jobs**
2. Pastikan semua cron jobs aktif:
   - ✅ `/api/cron/wake-railway`
   - ✅ `/api/cron/trigger-scrap-queue`
   - ✅ `/api/cron/create-partition`
   - ✅ `/api/cron/refresh-materialized-view`

### Cek Railway Usage (Free Tier)

1. **Railway Dashboard** → Project → **Usage**
2. Cek **Compute Hours** per bulan
3. Pastikan masih di bawah **500 hours/month**

### Common Issues

**Problem: Trigger dari UI gagal**
- Cek `RAILWAY_SERVICE_URL` di Vercel env vars
- Pastikan format benar: `https://...` (tanpa `/trigger`)
- Test manual: `curl https://<railway-url>/health`

**Problem: Cron tidak jalan**
- Cek Vercel Dashboard → Settings → Cron Jobs
- Pastikan cron jobs aktif
- Cek Vercel logs untuk error

**Problem: Railway service tidak wake**
- Cek Railway Dashboard → Service → Status
- Pastikan service "Active"
- Test wake endpoint: `curl https://<railway-url>/wake`

---

## 📚 6. Dokumentasi Terkait

- **Railway Setup**: `docs/RAILWAY_SETUP.md`
- **Railway Build Fix**: `docs/RAILWAY_BUILD_FIX.md`
- **Railway Free Optimization**: `docs/RAILWAY_FREE_OPTIMIZATION.md`
- **Local Env Setup**: `docs/LOCAL_ENV_SETUP.md`

---

## 🎯 Quick Reference

### Railway Service URL
- **Lokasi**: Railway Dashboard → Service → Settings → Networking → Public Domain
- **Format**: `https://scrap-queue-worker-production.up.railway.app`
- **Digunakan di**: Vercel env var `RAILWAY_SERVICE_URL`

### Vercel Environment Variables
- **Lokasi**: Vercel Dashboard → Project → Settings → Environment Variables
- **Required**: `RAILWAY_SERVICE_URL`
- **Set untuk**: Production, Preview, Development

### Vercel Cron Jobs
- **Lokasi**: `vercel.json` (sudah dikonfigurasi)
- **Auto-active**: Setelah deploy
- **Cek status**: Vercel Dashboard → Settings → Cron Jobs

---

## ✅ Final Checklist

Setelah semua setup selesai:

- [ ] Railway service deployed dan running
- [ ] Railway env vars sudah di-set (7 variables)
- [ ] Railway Service URL sudah di-copy
- [ ] Vercel env var `RAILWAY_SERVICE_URL` sudah di-set
- [ ] Vercel sudah di-redeploy
- [ ] Test health check → sukses
- [ ] Test wake endpoint → sukses
- [ ] Test trigger dari UI → sukses
- [ ] Test Vercel Cron → sukses (tunggu schedule atau trigger manual)
- [ ] Cek database: queue items ter-proses → sukses

**Sistem siap digunakan! 🎉**
