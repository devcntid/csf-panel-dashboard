# Setup Cron-Job.org untuk Scrap Queue (Free Tier)

## Overview

Karena Vercel Hobby hanya support 1 cron job per hari, kita menggunakan **cron-job.org** (free, unlimited) untuk wake dan trigger Railway service setiap 30 menit.

## Kenapa Cron-Job.org?

✅ **Free tier:**
- Unlimited cron jobs
- Unlimited executions
- Tidak ada limit frekuensi
- Reliable dan stable

✅ **Mudah setup:**
- Web interface yang user-friendly
- Support HTTP GET/POST
- Support custom headers dan body

---

## Step-by-Step Setup

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
   - **Execution schedule**: Pilih **"Custom"** (untuk lebih presisi)
   - **Crontab expression**: `55,25 0-13 * * 1-6`
     - Penjelasan: Setiap 30 menit (di menit 55 dan 25), jam 0-13 UTC (07:00-20:00 WIB), Senin-Sabtu
   - **Atau** pakai **"Every X minutes"**:
     - **Every**: `30` minutes
     - **Starting at**: `07:55` (WIB)
     - **Ending at**: `20:55` (WIB)
     - **Days**: Pilih **Monday, Tuesday, Wednesday, Thursday, Friday, Saturday**
       - Uncheck Sunday
   - **Timezone**: Pastikan set ke **Asia/Jakarta** (WIB)

   **Advanced (Optional):**
   - **Timeout**: `10` seconds
   - **Retry on failure**: ✅ (optional)
   - **Notifications**: (optional, bisa set email jika gagal)

3. Klik **"Create cronjob"**

**Hasil:** Cron job akan wake Railway service setiap 30 menit, mulai 5 menit sebelum scraping (07:55, 08:25, 08:55, ..., 20:55 WIB)

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
   - **Execution schedule**: Pilih **"Custom"** (untuk lebih presisi)
   - **Crontab expression**: `*/30 1-14 * * 1-6`
     - Penjelasan: Setiap 30 menit, jam 1-14 UTC (08:00-21:00 WIB), Senin-Sabtu
   - **Atau** pakai **"Every X minutes"**:
     - **Every**: `30` minutes
     - **Starting at**: `08:00` (WIB)
     - **Ending at**: `21:00` (WIB)
     - **Days**: Pilih **Monday, Tuesday, Wednesday, Thursday, Friday, Saturday**
       - Uncheck Sunday
   - **Timezone**: Pastikan set ke **Asia/Jakarta** (WIB)

   **Advanced (Optional):**
   - **Timeout**: `10` seconds
   - **Retry on failure**: ✅ (optional)
   - **Notifications**: (optional)

3. Klik **"Create cronjob"**

**Hasil:** Cron job akan trigger scraping setiap 30 menit (08:00, 08:30, 09:00, ..., 21:00 WIB)

---

## Verifikasi Setup

### 1. Test Wake Endpoint

```bash
curl https://csf-panel-dashboard-production.up.railway.app/wake
```

**Expected response:**
```json
{
  "success": true,
  "message": "Service woken up",
  "timestamp": "2026-02-03T..."
}
```

### 2. Test Trigger Endpoint

```bash
curl -X POST https://csf-panel-dashboard-production.up.railway.app/trigger \
  -H "Content-Type: application/json" \
  -d '{"isCron":true}'
```

**Expected response:**
```json
{
  "success": true,
  "message": "Scrap queue worker triggered",
  "isCron": true
}
```

### 3. Cek Cron Job Execution History

1. Buka **cron-job.org** → Dashboard
2. Klik pada cron job yang sudah dibuat
3. Tab **"Execution history"** → Cek apakah ada execution yang sukses
4. Harus ada status **"Success"** (green)

---

## Schedule Reference

### Wake Service (5 menit sebelum scraping)
- **Time**: 07:55, 08:25, 08:55, 09:25, ..., 20:55 WIB
- **Frequency**: Setiap 30 menit
- **Days**: Senin-Sabtu
- **Method**: GET
- **URL**: `https://csf-panel-dashboard-production.up.railway.app/wake`

### Trigger Scraping
- **Time**: 08:00, 08:30, 09:00, 09:30, ..., 21:00 WIB
- **Frequency**: Setiap 30 menit
- **Days**: Senin-Sabtu
- **Method**: POST
- **URL**: `https://csf-panel-dashboard-production.up.railway.app/trigger`
- **Body**: `{"isCron":true}`

**Timeline:**
```
07:55 WIB → Wake service
08:00 WIB → Trigger scraping
08:25 WIB → Wake service
08:30 WIB → Trigger scraping
...
20:55 WIB → Wake service
21:00 WIB → Trigger scraping (terakhir)
```

---

## Troubleshooting

### Problem: Cron job tidak jalan

**Solusi:**
1. Cek cron-job.org Dashboard → Execution history
2. Pastikan cron job status **"Active"** (bukan "Paused")
3. Cek URL sudah benar (test manual dengan curl)
4. Pastikan Railway service accessible (test health check)

### Problem: Wake/Trigger gagal

**Solusi:**
1. Cek Railway service status: Railway Dashboard → Service → Status
2. Pastikan service **"Active"**
3. Test endpoint manual: `curl https://<railway-url>/wake`
4. Cek Railway logs untuk error

### Problem: Schedule tidak tepat

**Solusi:**
1. Cron-job.org menggunakan UTC timezone
2. WIB = UTC + 7
3. Contoh: 08:00 WIB = 01:00 UTC
4. Atau gunakan timezone selector di cron-job.org (jika tersedia)

---

## Monitoring

### Cron-Job.org Dashboard

1. **Execution History:**
   - Cron-job.org → Dashboard → Cron job → Execution history
   - Cek status: Success (green) atau Failed (red)
   - Cek response time

2. **Statistics:**
   - Cron-job.org → Dashboard → Statistics
   - Total executions, success rate, dll

### Railway Logs

1. **Railway Dashboard** → Service → Deployments → View Logs
2. Cek log untuk:
   - `[Railway Worker] Service woken up via /wake endpoint`
   - `[Railway Worker] Starting scrap queue worker (cron: true)`

### Database Monitoring

```sql
-- Cek queue status
SELECT 
  status,
  COUNT(*) as count,
  MAX(created_at) as latest
FROM scrap_queue
WHERE requested_by = 'cron'
GROUP BY status;

-- Cek execution time
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
  AND requested_by = 'cron'
ORDER BY completed_at DESC
LIMIT 10;
```

---

## Alternative: GitHub Actions (Jika Cron-Job.org Tidak Cocok)

Jika cron-job.org tidak cocok, bisa pakai **GitHub Actions** (free untuk public repo, atau 2000 minutes/month untuk private):

1. Buat workflow di `.github/workflows/scrap-queue-cron.yml`
2. Schedule: `*/30 1-14 * * 1-6` (setiap 30 menit, 01:00-14:00 UTC)
3. Action: HTTP call ke Railway service

**Tapi cron-job.org lebih mudah dan tidak ada limit!**

---

## Checklist

- [ ] Daftar di cron-job.org (free)
- [ ] Buat cron job "Wake Railway Service" (GET, setiap 30 menit, 07:55-20:55 WIB)
- [ ] Buat cron job "Trigger Scrap Queue" (POST, setiap 30 menit, 08:00-21:00 WIB)
- [ ] Test wake endpoint → sukses
- [ ] Test trigger endpoint → sukses
- [ ] Cek execution history di cron-job.org → sukses
- [ ] Cek Railway logs → ada log wake dan trigger
- [ ] Cek database → queue items ter-proses

---

## Related Documentation

- **Setup Recap**: `docs/SETUP_RECAP.md`
- **Railway Setup**: `docs/RAILWAY_SETUP.md`
- **Railway Free Optimization**: `docs/RAILWAY_FREE_OPTIMIZATION.md`
- **Crontab Reference**: `docs/CRON_JOB_ORG_CRONTAB.md` (untuk format crontab yang benar)
