# Quick Setup Guide: Railway + Vercel + Cron-Job.org

## ✅ URL yang Benar untuk Cron-Job.org

Dari screenshot Railway, service URL kamu adalah:
```
https://csf-panel-dashboard-production.up.railway.app
```

### Endpoint yang Tersedia:

1. **Wake Service** (GET):
   ```
   https://csf-panel-dashboard-production.up.railway.app/wake
   ```

2. **Trigger Scraping** (POST):
   ```
   https://csf-panel-dashboard-production.up.railway.app/trigger
   ```

3. **Health Check** (GET):
   ```
   https://csf-panel-dashboard-production.up.railway.app/health
   ```

---

## 🔧 Environment Variables Setup

### 1. Railway Environment Variables

Buka **Railway Dashboard** → Service `csf-panel-dashboard` → Tab **"Variables"**

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

**Cara ambil DATABASE_URL dari Vercel:**
1. Buka **Vercel Dashboard** → Project → **Settings** → **Environment Variables**
2. Cari `DATABASE_URL`
3. Klik icon **👁️ (eye)** untuk reveal value
4. **Copy** seluruh value
5. **Paste** ke Railway Variables

---

### 2. Vercel Environment Variables

Buka **Vercel Dashboard** → Project → **Settings** → **Environment Variables**

#### Required (Wajib):

```
RAILWAY_SERVICE_URL=https://csf-panel-dashboard-production.up.railway.app
```

**Penting:**
- ✅ Format: `https://...` (tanpa `/trigger` atau path lain di akhir)
- ✅ Hanya base URL saja
- ✅ Pastikan sudah di-set untuk **Production**, **Preview**, dan **Development**

**Tidak perlu tambahan env vars lain di Vercel** (DATABASE_URL sudah ada dari setup sebelumnya)

---

## 📅 Setup Cron-Job.org

### Step 1: Daftar di Cron-Job.org

1. Buka **https://cron-job.org**
2. Klik **"Sign Up"** (gratis)
3. Daftar dengan email atau GitHub
4. Verifikasi email jika diperlukan

### Step 2: Buat Cron Job 1 - Wake Railway Service

**Tujuan:** Wake Railway service 5 menit sebelum scraping dimulai

1. Setelah login, klik **"Create cronjob"**
2. Isi form:

   **Basic Settings:**
   - **Title**: `Wake Railway Service`
   - **Address (URL)**: `https://csf-panel-dashboard-production.up.railway.app/wake`
   - **Request method**: `GET`
   - **Request headers**: (kosongkan)

   **Schedule:**
   - **Execution schedule**: Pilih **"Every X minutes"**
   - **Every**: `30` minutes
   - **Starting at**: `07:55` (WIB)
   - **Ending at**: `20:55` (WIB)
   - **Days**: Pilih **Monday, Tuesday, Wednesday, Thursday, Friday, Saturday**
     - Uncheck Sunday

   **Advanced (Optional):**
   - **Timeout**: `10` seconds
   - **Retry on failure**: ✅ (optional)

3. Klik **"Create cronjob"**

### Step 3: Buat Cron Job 2 - Trigger Scrap Queue

**Tujuan:** Trigger Railway service untuk menjalankan scrap queue worker

1. Klik **"Create cronjob"** lagi
2. Isi form:

   **Basic Settings:**
   - **Title**: `Trigger Scrap Queue`
   - **Address (URL)**: `https://csf-panel-dashboard-production.up.railway.app/trigger`
   - **Request method**: `POST`
   - **Request headers**: 
     ```
     Content-Type: application/json
     ```
   - **Request body**: 
     ```json
     {"isCron":true}
     ```

   **Schedule:**
   - **Execution schedule**: Pilih **"Every X minutes"**
   - **Every**: `30` minutes
   - **Starting at**: `08:00` (WIB)
   - **Ending at**: `21:00` (WIB)
   - **Days**: Pilih **Monday, Tuesday, Wednesday, Thursday, Friday, Saturday**
     - Uncheck Sunday

   **Advanced (Optional):**
   - **Timeout**: `10` seconds
   - **Retry on failure**: ✅ (optional)

3. Klik **"Create cronjob"**

---

## ✅ Checklist Setup

### Railway Setup
- [ ] Environment variables di-set di Railway:
  - [ ] `NODE_ENV=production`
  - [ ] `PORT=3001`
  - [ ] `PROCESS_LIMIT=6`
  - [ ] `DATABASE_URL` (copy dari Vercel)
  - [ ] `POSTGRES_URL` (sama dengan DATABASE_URL)
  - [ ] `NEXT_PUBLIC_DATABASE_URL` (sama dengan DATABASE_URL)
  - [ ] `IDLE_TIMEOUT=300000` (optional)
- [ ] Service status: **"Active"** (green)

### Vercel Setup
- [ ] Environment variable `RAILWAY_SERVICE_URL` sudah di-set
- [ ] Format URL benar: `https://csf-panel-dashboard-production.up.railway.app` (tanpa `/trigger`)
- [ ] Environment: Production, Preview, Development (semua)
- [ ] Vercel sudah di-redeploy setelah set env var

### Cron-Job.org Setup
- [ ] Daftar di cron-job.org (free)
- [ ] Buat cron job "Wake Railway Service" (GET, setiap 30 menit, 07:55-20:55 WIB)
- [ ] Buat cron job "Trigger Scrap Queue" (POST, setiap 30 menit, 08:00-21:00 WIB)

### Testing
- [ ] Test Railway health check:
  ```bash
  curl https://csf-panel-dashboard-production.up.railway.app/health
  ```
  Expected: `{"status":"ok","processing":false,...}`

- [ ] Test Railway wake endpoint:
  ```bash
  curl https://csf-panel-dashboard-production.up.railway.app/wake
  ```
  Expected: `{"success":true,"message":"Service woken up",...}`

- [ ] Test trigger dari UI Vercel:
  - Buka Dashboard → Konfigurasi → System Logs
  - Klik tombol "Jalankan Scrap Queue"
  - Harus muncul toast: "Scrap queue worker telah di-trigger via Railway..."

---

## 📝 Ringkasan Environment Variables

### Railway (7 variables)

| Variable | Value | Required | Sumber |
|----------|-------|----------|--------|
| `NODE_ENV` | `production` | ✅ | Manual |
| `PORT` | `3001` | ✅ | Manual |
| `PROCESS_LIMIT` | `6` | ✅ | Manual |
| `DATABASE_URL` | `postgresql://...` | ✅ | Copy dari Vercel |
| `POSTGRES_URL` | `postgresql://...` | ✅ | Copy dari Vercel |
| `NEXT_PUBLIC_DATABASE_URL` | `postgresql://...` | ✅ | Copy dari Vercel |
| `IDLE_TIMEOUT` | `300000` | ❌ | Optional (default: 300000) |

### Vercel (1 variable baru)

| Variable | Value | Required | Sumber |
|----------|-------|----------|--------|
| `RAILWAY_SERVICE_URL` | `https://csf-panel-dashboard-production.up.railway.app` | ✅ | Copy dari Railway |

**Note:** `DATABASE_URL` dan `POSTGRES_URL` sudah ada di Vercel dari setup sebelumnya, tidak perlu diubah.

---

## 🎯 Quick Reference

### Railway Service URL
- **URL**: `https://csf-panel-dashboard-production.up.railway.app`
- **Lokasi**: Railway Dashboard → Service → Settings → Networking → Public Domain
- **Digunakan di**: 
  - Vercel env var `RAILWAY_SERVICE_URL`
  - Cron-job.org cron jobs

### Endpoints
- **Wake**: `GET https://csf-panel-dashboard-production.up.railway.app/wake`
- **Trigger**: `POST https://csf-panel-dashboard-production.up.railway.app/trigger`
- **Health**: `GET https://csf-panel-dashboard-production.up.railway.app/health`

---

## 🔍 Troubleshooting

### Problem: Health check gagal (404/502)

**Solusi:**
1. Cek Railway Dashboard → Service → Status (harus "Active")
2. Cek Railway logs: Railway Dashboard → Deployments → View Logs
3. Pastikan `PORT=3001` sudah di-set di Railway env vars

### Problem: Trigger dari UI gagal

**Solusi:**
1. Cek `RAILWAY_SERVICE_URL` di Vercel env vars
2. Pastikan format benar: `https://csf-panel-dashboard-production.up.railway.app` (tanpa `/trigger`)
3. Test manual: `curl https://csf-panel-dashboard-production.up.railway.app/health`
4. Redeploy Vercel setelah set env var

### Problem: Cron tidak jalan

**Solusi:**
1. Cek cron-job.org Dashboard → Execution history
2. Pastikan cron job status **"Active"** (bukan "Paused")
3. Cek URL sudah benar (test manual dengan curl)
4. Pastikan Railway service accessible (test health check)

---

## 📚 Dokumentasi Lengkap

- **Railway Setup**: `docs/RAILWAY_SETUP.md`
- **Cron-Job.org Setup**: `docs/CRON_JOB_ORG_SETUP.md`
- **Setup Recap**: `docs/SETUP_RECAP.md`
