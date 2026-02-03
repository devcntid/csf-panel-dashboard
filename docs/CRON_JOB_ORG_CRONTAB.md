# Konfigurasi Crontab untuk Cron-Job.org

## ⚠️ Penting: Format Crontab yang Benar

Dari screenshot, kamu sudah set `*/15 1-14 * * 1-6`, tapi ini **BELUM BENAR**. Berikut konfigurasi yang benar:

---

## 1. Wake Railway Service (GET)

**Tujuan:** Wake service 5 menit sebelum scraping dimulai

### Opsi A: Pakai "Every X minutes" (Lebih Mudah)

1. **Execution schedule**: Pilih **"Every X minutes"**
2. **Every**: `30` minutes
3. **Starting at**: `07:55` (WIB)
4. **Ending at**: `20:55` (WIB)
5. **Days**: Monday-Saturday (uncheck Sunday)

**Hasil:** Cron akan jalan di 07:55, 08:25, 08:55, 09:25, ..., 20:55 WIB

### Opsi B: Pakai Custom Crontab (Lebih Presisi)

Jika cron-job.org tidak support "Every X minutes" dengan start time, pakai custom crontab:

**Crontab expression:**
```
55,25 0-13 * * 1-6
```

**Penjelasan:**
- `55,25` = di menit 55 dan 25 (setiap 30 menit)
- `0-13` = jam 0-13 UTC (07:00-20:00 WIB)
- `*` = setiap hari dalam bulan
- `*` = setiap bulan
- `1-6` = Senin-Sabtu

**Hasil:** 
- 00:55 UTC = 07:55 WIB ✅
- 01:25 UTC = 08:25 WIB ✅
- 01:55 UTC = 08:55 WIB ✅
- ...
- 13:55 UTC = 20:55 WIB ✅

---

## 2. Trigger Scrap Queue (POST)

**Tujuan:** Trigger scraping setiap 30 menit

### Opsi A: Pakai "Every X minutes" (Lebih Mudah)

1. **Execution schedule**: Pilih **"Every X minutes"**
2. **Every**: `30` minutes
3. **Starting at**: `08:00` (WIB)
4. **Ending at**: `21:00` (WIB)
5. **Days**: Monday-Saturday (uncheck Sunday)

**Hasil:** Cron akan jalan di 08:00, 08:30, 09:00, 09:30, ..., 21:00 WIB

### Opsi B: Pakai Custom Crontab (Lebih Presisi)

**Crontab expression:**
```
*/30 1-14 * * 1-6
```

**Penjelasan:**
- `*/30` = setiap 30 menit (di menit 0 dan 30)
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

---

## ⚠️ Koreksi untuk Screenshot

Dari screenshot yang kamu kirim:
- ❌ **Salah**: `*/15 1-14 * * 1-6` (setiap 15 menit)
- ✅ **Benar untuk Trigger**: `*/30 1-14 * * 1-6` (setiap 30 menit)

**Masalah:**
1. `*/15` = setiap 15 menit (salah, harus `*/30`)
2. Hours `1-14` = benar (08:00-21:00 WIB)
3. Days `1-6` = benar (Senin-Sabtu)

**Untuk Wake Service:**
- ❌ **Salah**: `*/15 1-14 * * 1-6`
- ✅ **Benar**: `55,25 0-13 * * 1-6` (5 menit sebelum scraping)

---

## 📋 Timeline yang Benar

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

---

## ✅ Checklist Setup

### Wake Service Cron Job
- [ ] URL: `https://csf-panel-dashboard-production.up.railway.app/wake`
- [ ] Method: `GET`
- [ ] Schedule: 
  - Opsi A: "Every 30 minutes", Start 07:55, End 20:55 WIB
  - Opsi B: Custom crontab `55,25 0-13 * * 1-6`
- [ ] Days: Monday-Saturday (uncheck Sunday)
- [ ] Timezone: Asia/Jakarta (WIB)

### Trigger Scraping Cron Job
- [ ] URL: `https://csf-panel-dashboard-production.up.railway.app/trigger`
- [ ] Method: `POST`
- [ ] Headers: `Content-Type: application/json`
- [ ] Body: `{"isCron":true}`
- [ ] Schedule:
  - Opsi A: "Every 30 minutes", Start 08:00, End 21:00 WIB
  - Opsi B: Custom crontab `*/30 1-14 * * 1-6`
- [ ] Days: Monday-Saturday (uncheck Sunday)
- [ ] Timezone: Asia/Jakarta (WIB)

---

## 🔍 Verifikasi

Setelah setup, cek "Next executions" di cron-job.org:

**Wake Service harus show:**
- 07:55, 08:25, 08:55, 09:25, ..., 20:55 WIB

**Trigger Scraping harus show:**
- 08:00, 08:30, 09:00, 09:30, ..., 21:00 WIB

Jika tidak sesuai, perbaiki schedule-nya!
