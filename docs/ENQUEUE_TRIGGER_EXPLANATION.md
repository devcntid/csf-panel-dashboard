# Penjelasan: Enqueue Dipicu dari Cron Apa?

## 🎯 Jawaban Singkat

**Enqueue dipicu dari Cron-Job.org cron job "Trigger Scrap Queue"** yang trigger Railway endpoint `/trigger` dengan body `{"isCron":true}`.

---

## 🔄 Flow Lengkap

### 1. Cron-Job.org Cron Job

**Cron Job:** `Trigger Scrap Queue`

**Konfigurasi:**
- **URL**: `https://csf-panel-dashboard-production.up.railway.app/trigger`
- **Method**: `POST`
- **Body**: `{"isCron":true}`
- **Schedule**: `0,30 1-14 * * 1-6` (setiap 30 menit, 08:00-21:00 WIB, Senin-Sabtu)

**Execution:**
```
08:00 WIB → Cron-job.org trigger POST /trigger dengan {"isCron":true}
08:30 WIB → Cron-job.org trigger POST /trigger dengan {"isCron":true}
09:00 WIB → Cron-job.org trigger POST /trigger dengan {"isCron":true}
...
21:00 WIB → Cron-job.org trigger POST /trigger dengan {"isCron":true}
```

---

### 2. Railway Server Menerima Request

**Endpoint:** `POST /trigger`

**Code di `server.js`:**
```javascript
// Trigger endpoint
if (req.method === 'POST' && pathname === '/trigger') {
  // Parse body
  const data = JSON.parse(body)
  const isCron = data.isCron === true  // true jika dari cron
  
  // Run async
  runScrapQueue(isCron).catch(...)
}
```

---

### 3. Server.js Check isCron Flag

**Code di `server.js`:**
```javascript
async function runScrapQueue(isCron = false) {
  // Jika cron, enqueue dulu
  if (isCron) {
    console.log('[Railway Worker] Running enqueue-today...')
    // Run: pnpm scrap:enqueue-today
    await runEnqueueToday()
  }
  
  // Run scrap queue worker
  console.log('[Railway Worker] Running scrap:github:queue...')
  await runScrapQueueWorker()
}
```

**Logic:**
- Jika `isCron: true` → **Enqueue dulu**, lalu process queue
- Jika `isCron: false` → **Tidak enqueue**, langsung process queue (untuk insidental)

---

## 📋 Summary

### Enqueue Dipicu Dari:

1. **Cron-Job.org Cron Job "Trigger Scrap Queue"**
   - Schedule: Setiap 30 menit, 08:00-21:00 WIB, Senin-Sabtu
   - Action: POST ke Railway `/trigger` dengan `{"isCron":true}`

2. **Railway Server.js**
   - Menerima request dengan `isCron: true`
   - Run `pnpm scrap:enqueue-today` sebelum process queue

### Enqueue TIDAK Dipicu Dari:

- ❌ Manual trigger dari UI (karena `isCron: false`)
- ❌ Insidental scraping (karena `isCron: false`)
- ❌ Wake service endpoint (karena hanya GET `/wake`)

---

## 🔍 Verifikasi

### Cek Cron Job di Cron-Job.org

1. Login ke **cron-job.org**
2. Dashboard → **Cronjobs**
3. Cari cron job **"Trigger Scrap Queue"**
4. Cek:
   - Status: **"Active"** ✅
   - URL: `https://csf-panel-dashboard-production.up.railway.app/trigger`
   - Method: **POST**
   - Body: `{"isCron":true}`
   - Schedule: `0,30 1-14 * * 1-6`

### Cek Execution History

1. Cron-job.org → **Cronjobs** → **"Trigger Scrap Queue"**
2. Tab **"Execution history"**
3. Harus ada execution setiap 30 menit dengan status **"Success"**

### Cek Railway Logs

1. Railway Dashboard → Service → **Deployments** → **View Logs**
2. Filter: `enqueue`
3. Harus ada log setiap 30 menit:
   ```
   [Railway Worker] Running enqueue-today...
   Enqueue scrap_queue untuk tanggal 2026-02-03 (WIB)
   ✅ Enqueue scrap_queue untuk hari ini selesai
   ```

---

## 📊 Timeline Lengkap

```
08:00 WIB (01:00 UTC)
  ↓
Cron-job.org trigger POST /trigger dengan {"isCron":true}
  ↓
Railway server.js menerima request
  ↓
runScrapQueue(isCron: true)
  ↓
┌─────────────────────────────────┐
│ Step 1: Enqueue                 │
│ - Run: pnpm scrap:enqueue-today│
│ - Insert 6 jobs ke scrap_queue │
└─────────────────────────────────┘
  ↓
┌─────────────────────────────────┐
│ Step 2: Process Queue           │
│ - Run: pnpm scrap:github:queue │
│ - Process 6 items (sequential)  │
└─────────────────────────────────┘
  ↓
08:12 WIB → Selesai

08:30 WIB (01:30 UTC)
  ↓
Cron-job.org trigger lagi
  ↓
Repeat...
```

---

## ⚠️ Important Notes

### isCron Flag

**`isCron: true`** → Enqueue + Process
- Dipicu dari cron-job.org
- Enqueue dulu, lalu process queue
- Untuk scheduled scraping

**`isCron: false`** → Process Only
- Dipicu dari manual trigger (UI)
- Tidak enqueue, langsung process existing queue
- Untuk insidental scraping

### Enqueue Logic

**Code di `enqueue-today-scrap-queue.ts`:**
- Insert jobs hanya jika **belum ada pending/processing** untuk tanggal yang sama
- Jika semua completed, akan insert lagi (untuk re-scrape)
- Skip jika hari libur

---

## 🎯 Kesimpulan

**Enqueue dipicu dari:**
- ✅ **Cron-Job.org cron job "Trigger Scrap Queue"**
- ✅ **Setiap 30 menit** (08:00-21:00 WIB, Senin-Sabtu)
- ✅ **Via POST `/trigger` dengan `{"isCron":true}`**

**Tidak dipicu dari:**
- ❌ Manual trigger (karena `isCron: false`)
- ❌ Wake service (karena hanya GET request)

---

## 📚 Related Documentation

- **Cron Setup**: `docs/CRON_JOB_ORG_FINAL_GUIDE.md`
- **Scrap Flow**: `docs/SCRAP_FLOW_EXPLANATION.md`
- **Queue Optimization**: `docs/QUEUE_OPTIMIZATION.md`
