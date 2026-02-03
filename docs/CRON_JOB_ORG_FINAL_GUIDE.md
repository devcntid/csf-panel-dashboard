# Panduan Lengkap: Setup Cron-Job.org untuk Scrap Queue

## 📋 Overview

Setup cron-job.org untuk menjalankan scraping otomatis:
- **Schedule**: Setiap 30 menit, Senin-Sabtu, 08:00-21:00 WIB
- **2 Cron Jobs**: Wake service (5 menit sebelum) + Trigger scraping

---

## 🎯 Requirements

- **Frequency**: Setiap 30 menit
- **Days**: Senin-Sabtu (Monday-Saturday)
- **Time Range**: 08:00-21:00 WIB
- **Wake Service**: 5 menit sebelum scraping (07:55, 08:25, 08:55, ..., 20:55 WIB)
- **Trigger Scraping**: 08:00, 08:30, 09:00, ..., 21:00 WIB

---

## 🚀 Step-by-Step Setup

### Step 1: Daftar di Cron-Job.org

1. Buka **https://cron-job.org**
2. Klik **"Sign Up"** (gratis, unlimited)
3. Daftar dengan email atau GitHub
4. Verifikasi email jika diperlukan
5. Login ke dashboard

---

### Step 2: Buat Cron Job 1 - Wake Railway Service

**Tujuan:** Wake Railway service 5 menit sebelum scraping dimulai

1. Klik **"Create cronjob"** (tombol hijau di kanan atas)

2. **Basic Settings:**
   - **Title**: `Wake Railway Service`
   - **Address (URL)**: `https://csf-panel-dashboard-production.up.railway.app/wake`
   - **Request method**: `GET`
   - **Request headers**: (kosongkan)
   - **Enable job**: ✅ (aktifkan)

3. **Execution Schedule:**
   - Pilih **"Custom"** (radio button)
   - Klik **"Edit crontab"** atau isi manual:
   
   **Crontab Expression:**
   ```
   55,25 0-13 * * 1-6
   ```
   
   **Penjelasan:**
   - `55,25` = di menit 55 dan 25 (setiap 30 menit)
   - `0-13` = jam 0-13 UTC (07:00-20:00 WIB)
   - `*` = setiap hari dalam bulan
   - `*` = setiap bulan
   - `1-6` = Senin-Sabtu (1=Monday, 6=Saturday)

   **Hasil:**
   - 00:55 UTC = 07:55 WIB ✅
   - 01:25 UTC = 08:25 WIB ✅
   - 01:55 UTC = 08:55 WIB ✅
   - ...
   - 13:55 UTC = 20:55 WIB ✅

4. **Timezone:**
   - Pastikan set ke **UTC** (cron-job.org menggunakan UTC)
   - Atau jika ada option, pilih **Asia/Jakarta** (WIB = UTC+7)

5. **Advanced Settings (Optional):**
   - **Timeout**: `10` seconds
   - **Retry on failure**: ✅ (optional, untuk reliability)
   - **Save responses in job history**: ✅ (untuk monitoring)

6. **Notifications (Optional):**
   - **Notify me when execution fails**: ✅ (optional)
   - **Notify after**: `1` failure

7. Klik **"Create cronjob"**

**Verifikasi:**
- Cek **"Next executions"** di bawah form
- Harus menunjukkan: 07:55, 08:25, 08:55, ..., 20:55 WIB

---

### Step 3: Buat Cron Job 2 - Trigger Scrap Queue

**Tujuan:** Trigger Railway service untuk menjalankan scrap queue worker

1. Klik **"Create cronjob"** lagi

2. **Basic Settings:**
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
   - **Enable job**: ✅ (aktifkan)

3. **Execution Schedule:**
   - Pilih **"Custom"** (radio button)
   - Klik **"Edit crontab"** atau isi manual:
   
   **Crontab Expression:**
   ```
   0,30 1-14 * * 1-6
   ```
   
   **Penjelasan:**
   - `0,30` = di menit 0 dan 30 (setiap 30 menit)
   - `1-14` = jam 1-14 UTC (08:00-21:00 WIB)
   - `*` = setiap hari dalam bulan
   - `*` = setiap bulan
   - `1-6` = Senin-Sabtu

   **Hasil:**
   - 01:00 UTC = 08:00 WIB ✅
   - 01:30 UTC = 08:30 WIB ✅
   - 02:00 UTC = 09:00 WIB ✅
   - ...
   - 14:00 UTC = 21:00 WIB ✅

4. **Timezone:**
   - Pastikan set ke **UTC** (sama seperti Wake Service)

5. **Advanced Settings (Optional):**
   - **Timeout**: `10` seconds
   - **Retry on failure**: ✅ (optional)
   - **Save responses in job history**: ✅ (untuk monitoring)

6. **Notifications (Optional):**
   - **Notify me when execution fails**: ✅ (optional)

7. Klik **"Create cronjob"**

**Verifikasi:**
- Cek **"Next executions"** di bawah form
- Harus menunjukkan: 08:00, 08:30, 09:00, ..., 21:00 WIB

---

## 📅 Timeline yang Benar

```
07:55 WIB (00:55 UTC) → Wake service
08:00 WIB (01:00 UTC) → Trigger scraping
08:25 WIB (01:25 UTC) → Wake service
08:30 WIB (01:30 UTC) → Trigger scraping
08:55 WIB (01:55 UTC) → Wake service
09:00 WIB (02:00 UTC) → Trigger scraping
...
20:55 WIB (13:55 UTC) → Wake service
21:00 WIB (14:00 UTC) → Trigger scraping (terakhir)
```

**Total executions per hari:**
- Wake: 27 kali (07:55 - 20:55)
- Trigger: 27 kali (08:00 - 21:00)

---

## ✅ Verifikasi Setup

### 1. Test Endpoints Manual

Sebelum setup cron, test manual dulu:

```bash
# Test Wake
curl https://csf-panel-dashboard-production.up.railway.app/wake

# Expected:
# {"success":true,"message":"Service woken up","timestamp":"..."}

# Test Trigger
curl -X POST https://csf-panel-dashboard-production.up.railway.app/trigger \
  -H "Content-Type: application/json" \
  -d '{"isCron":true}'

# Expected:
# {"success":true,"message":"Scrap queue worker triggered","isCron":true}
```

### 2. Cek Cron Job Status

1. Cron-job.org Dashboard → **Cronjobs**
2. Pastikan kedua cron job status: **"Active"** (bukan "Paused")
3. Cek **"Next executions"** untuk konfirmasi schedule

### 3. Cek Execution History

1. Cron-job.org Dashboard → **Cronjobs** → Klik pada cron job
2. Tab **"Execution history"**
3. Harus ada execution dengan status:
   - ✅ **"Success"** (green) = sukses
   - ❌ **"Failed"** (red) = gagal (cek error message)

### 4. Monitor Railway Logs

1. Railway Dashboard → Service → **Deployments** → **View Logs**
2. Filter: `[Railway Worker]`
3. Harus ada log:
   ```
   [Railway Worker] Service woken up via /wake endpoint
   [Railway Worker] Starting scrap queue worker (cron: true)
   ```

### 5. Cek Database

```sql
-- Cek queue items yang ter-enqueue
SELECT 
  id,
  clinic_id,
  status,
  requested_by,
  created_at,
  started_at,
  completed_at
FROM scrap_queue
WHERE requested_by = 'cron'
ORDER BY created_at DESC
LIMIT 10;
```

---

## 🔍 Troubleshooting

### Problem: Cron job tidak jalan

**Solusi:**
1. Cek cron-job.org Dashboard → Execution history
2. Pastikan cron job status **"Active"** (bukan "Paused")
3. Cek URL sudah benar (test manual dengan curl)
4. Pastikan Railway service accessible (test health check)

### Problem: Wake/Trigger gagal (502/503)

**Solusi:**
1. Cek Railway service status: Railway Dashboard → Service → Status
2. Pastikan service **"Active"**
3. Test endpoint manual: `curl https://.../wake`
4. Cek Railway logs untuk error
5. Pastikan PORT tidak mismatch (lihat `docs/RAILWAY_PORT_FIX.md`)

### Problem: Schedule tidak tepat

**Solusi:**
1. Cron-job.org menggunakan UTC timezone
2. WIB = UTC + 7
3. Contoh: 08:00 WIB = 01:00 UTC
4. Atau gunakan timezone selector di cron-job.org (jika tersedia)

### Problem: Execution history menunjukkan "Failed"

**Solusi:**
1. Klik pada execution yang failed
2. Cek error message
3. Common errors:
   - **502/503**: Railway service tidak accessible (cek service status)
   - **Timeout**: Request terlalu lama (increase timeout di cron-job.org)
   - **Connection refused**: URL salah atau service down

---

## 📊 Monitoring

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
   - `[Railway Worker] Running enqueue-today...`
   - `[Railway Worker] Running scrap:github:queue...`

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

## ✅ Checklist Setup

### Pre-Setup
- [ ] Railway service deployed dan running
- [ ] Railway service URL sudah diketahui: `https://csf-panel-dashboard-production.up.railway.app`
- [ ] Test `/health` endpoint → 200 OK
- [ ] Test `/wake` endpoint → 200 OK
- [ ] Test `/trigger` endpoint → 200 OK

### Cron-Job.org Setup
- [ ] Daftar di cron-job.org (free)
- [ ] Buat cron job "Wake Railway Service":
  - [ ] URL: `https://csf-panel-dashboard-production.up.railway.app/wake`
  - [ ] Method: GET
  - [ ] Crontab: `55,25 0-13 * * 1-6`
  - [ ] Status: Active
- [ ] Buat cron job "Trigger Scrap Queue":
  - [ ] URL: `https://csf-panel-dashboard-production.up.railway.app/trigger`
  - [ ] Method: POST
  - [ ] Headers: `Content-Type: application/json`
  - [ ] Body: `{"isCron":true}`
  - [ ] Crontab: `0,30 1-14 * * 1-6`
  - [ ] Status: Active

### Verification
- [ ] Cek "Next executions" → schedule benar
- [ ] Tunggu execution pertama (atau trigger manual)
- [ ] Cek execution history → status Success
- [ ] Cek Railway logs → ada log wake dan trigger
- [ ] Cek database → queue items ter-proses

---

## 🎯 Quick Reference

### Crontab Expressions

**Wake Service:**
```
55,25 0-13 * * 1-6
```
- Setiap 30 menit (di menit 55 dan 25)
- Jam 0-13 UTC (07:00-20:00 WIB)
- Senin-Sabtu

**Trigger Scraping:**
```
0,30 1-14 * * 1-6
```
- Setiap 30 menit (di menit 0 dan 30)
- Jam 1-14 UTC (08:00-21:00 WIB)
- Senin-Sabtu

### URLs

- **Wake**: `https://csf-panel-dashboard-production.up.railway.app/wake`
- **Trigger**: `https://csf-panel-dashboard-production.up.railway.app/trigger`
- **Health**: `https://csf-panel-dashboard-production.up.railway.app/health`

### Timezone

- **Cron-job.org**: UTC
- **WIB**: UTC + 7
- **Conversion**: WIB time - 7 hours = UTC time

---

## 📚 Related Documentation

- **Railway Setup**: `docs/RAILWAY_SETUP.md`
- **Railway Port Fix**: `docs/RAILWAY_PORT_FIX.md`
- **Railway Troubleshooting**: `docs/RAILWAY_TROUBLESHOOTING.md`
- **Setup Recap**: `docs/SETUP_RECAP.md`

---

## 💡 Tips

1. **Enable Notifications:**
   - Set email notification untuk failed executions
   - Akan membantu detect masalah lebih cepat

2. **Save Responses:**
   - Enable "Save responses in job history"
   - Berguna untuk debugging jika ada masalah

3. **Monitor Regularly:**
   - Cek execution history setiap hari
   - Pastikan success rate > 95%

4. **Test Before Production:**
   - Test manual dulu sebelum enable cron
   - Pastikan semua endpoint accessible

---

**Setup selesai! Sistem akan otomatis scraping setiap 30 menit, Senin-Sabtu, 08:00-21:00 WIB.** 🎉
