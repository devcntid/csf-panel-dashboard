# Penjelasan Flow Scraping: Endpoint dan Queue System

## 📋 Overview

Sistem scraping menggunakan **queue-based architecture** untuk manage multiple clinics secara efisien dan reliable.

---

## 🎯 Endpoint yang Menscrap 6 Klinik

### Endpoint Utama

**POST** `https://csf-panel-dashboard-production.up.railway.app/trigger`

**Body:**
```json
{"isCron":true}
```

**Flow:**
1. Endpoint ini trigger Railway worker
2. Jika `isCron: true`, akan:
   - **Step 1**: Run `enqueue-today` → Insert jobs ke `scrap_queue` untuk semua active clinics
   - **Step 2**: Run `scrap:github:queue` → Process queue items secara sequential

---

## 🔄 Flow Lengkap

### 1. Cron Trigger (Setiap 30 Menit)

```
Cron-Job.org
    ↓
POST /trigger dengan {"isCron":true}
    ↓
Railway Worker (server.js)
    ↓
┌─────────────────────────────────────┐
│ Step 1: Enqueue Today              │
│ - Run: pnpm scrap:enqueue-today   │
│ - Insert ke scrap_queue:           │
│   • 1 job per active clinic        │
│   • Status: 'pending'              │
│   • requested_by: 'cron'           │
│   • tgl_awal = tgl_akhir = today   │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ Step 2: Process Queue              │
│ - Run: pnpm scrap:github:queue    │
│ - Process max PROCESS_LIMIT items  │
│ - Sequential (bukan paralel)       │
│ - Update status:                   │
│   • 'pending' → 'processing'       │
│   • 'processing' → 'completed'     │
└─────────────────────────────────────┘
```

### 2. Manual/Insidental Trigger

```
UI Vercel (Button "Jalankan Scrap Queue")
    ↓
POST /api/scrap/run-queue
    ↓
POST Railway /trigger dengan {"isCron":false}
    ↓
Railway Worker (server.js)
    ↓
┌─────────────────────────────────────┐
│ Process Queue (tanpa enqueue)      │
│ - Run: pnpm scrap:github:queue    │
│ - Process existing pending items   │
│ - Tidak insert baru ke queue       │
└─────────────────────────────────────┘
```

---

## ❓ Apakah Harus Masuk ke scrap_queue?

### ✅ YA, Harus Masuk ke scrap_queue

**Alasan:**

1. **Reliability:**
   - Jika scraping gagal, job tetap ada di queue
   - Bisa di-retry tanpa kehilangan data
   - Track status per clinic

2. **Idempotency:**
   - Prevent duplicate scraping untuk tanggal yang sama
   - Cek `status IN ('pending', 'processing')` sebelum insert

3. **Monitoring:**
   - Track progress per clinic
   - Cek execution time
   - Debug failed jobs

4. **Flexibility:**
   - Bisa enqueue manual untuk specific clinic/date
   - Bisa process queue kapan saja
   - Support insidental scraping

---

## 🔀 Apakah Proses Paralel?

### ❌ TIDAK, Proses Sequential (Satu per Satu)

**Current Implementation:**

```typescript
// scripts/scrap-github-queue.ts
async function processQueue() {
  let processed = 0
  
  while (processed < PROCESS_LIMIT) {
    // Get 1 queue item
    const queueItem = await getQueueItem()
    
    // Process 1 item (sequential)
    await performScraping(...)
    
    processed++
    
    // Delay 2 detik antar items
    await new Promise(resolve => setTimeout(resolve, 2000))
  }
}
```

**Kenapa Sequential?**

1. **Resource Management:**
   - Playwright browser consume banyak memory
   - Sequential lebih aman untuk Railway free tier
   - Prevent memory overflow

2. **Rate Limiting:**
   - Target website mungkin punya rate limit
   - Sequential lebih aman

3. **Error Handling:**
   - Lebih mudah handle error per clinic
   - Tidak affect clinic lain jika 1 gagal

---

## ⚙️ Configuration

### PROCESS_LIMIT

**Default:** `6` (sesuai jumlah clinics)

**Environment Variable:**
```bash
PROCESS_LIMIT=6
```

**Behavior:**
- Process maksimal 6 items per run
- Jika ada lebih dari 6 pending items, akan di-process di run berikutnya
- Setiap cron run (30 menit) akan process max 6 items

**Timeline:**
```
08:00 → Process 6 items (sequential)
08:30 → Process 6 items berikutnya (jika ada)
09:00 → Process 6 items berikutnya (jika ada)
...
```

---

## 📊 Contoh Flow untuk 6 Clinics

### Scenario: Cron Trigger di 08:00 WIB

**Step 1: Enqueue (08:00:00)**
```sql
-- Insert 6 jobs ke scrap_queue
INSERT INTO scrap_queue (clinic_id, tgl_awal, tgl_akhir, status, requested_by)
VALUES
  (1, '2026-02-03', '2026-02-03', 'pending', 'cron'),
  (2, '2026-02-03', '2026-02-03', 'pending', 'cron'),
  (3, '2026-02-03', '2026-02-03', 'pending', 'cron'),
  (4, '2026-02-03', '2026-02-03', 'pending', 'cron'),
  (5, '2026-02-03', '2026-02-03', 'pending', 'cron'),
  (6, '2026-02-03', '2026-02-03', 'pending', 'cron');
```

**Step 2: Process Queue (08:00:05)**
```
08:00:05 → Process Clinic 1 (status: pending → processing → completed)
08:02:00 → Process Clinic 2 (status: pending → processing → completed)
08:04:00 → Process Clinic 3 (status: pending → processing → completed)
08:06:00 → Process Clinic 4 (status: pending → processing → completed)
08:08:00 → Process Clinic 5 (status: pending → processing → completed)
08:10:00 → Process Clinic 6 (status: pending → processing → completed)
08:12:00 → Done (semua 6 clinics selesai)
```

**Total waktu:** ~12 menit untuk 6 clinics (sequential)

---

## 🚀 Opsi untuk Paralel Processing

Jika ingin proses paralel, bisa modify `scrap-github-queue.ts`:

```typescript
async function processQueueParallel() {
  // Get semua pending items (max PROCESS_LIMIT)
  const queueItems = await getQueueItems(PROCESS_LIMIT)
  
  // Process semua secara paralel
  await Promise.all(
    queueItems.map(item => 
      performScraping(item.id, clinic, item.tgl_awal, item.tgl_akhir)
    )
  )
}
```

**Trade-offs:**

✅ **Pros:**
- Lebih cepat (semua clinic jalan bersamaan)
- Total waktu: ~2-3 menit untuk 6 clinics

❌ **Cons:**
- Memory usage tinggi (6 browser instances)
- Bisa exceed Railway free tier limits
- Rate limiting risk lebih tinggi
- Error handling lebih kompleks

---

## 📝 Summary

### Endpoint yang Menscrap

**POST** `https://csf-panel-dashboard-production.up.railway.app/trigger`

**Dengan body:**
```json
{"isCron":true}
```

### Apakah Harus Masuk ke scrap_queue?

**✅ YA**, karena:
- Reliability (retry jika gagal)
- Idempotency (prevent duplicate)
- Monitoring (track progress)
- Flexibility (support manual enqueue)

### Apakah Paralel?

**❌ TIDAK**, saat ini **sequential** karena:
- Resource management (memory)
- Rate limiting safety
- Error handling lebih mudah

**Jika ingin paralel**, bisa modify code, tapi perlu consider:
- Memory usage
- Railway limits
- Rate limiting

---

## 🔍 Monitoring

### Cek Queue Status

```sql
-- Cek pending items
SELECT COUNT(*) FROM scrap_queue WHERE status = 'pending';

-- Cek processing items
SELECT COUNT(*) FROM scrap_queue WHERE status = 'processing';

-- Cek completed items hari ini
SELECT COUNT(*) FROM scrap_queue 
WHERE status = 'completed' 
  AND DATE(completed_at) = CURRENT_DATE
  AND requested_by = 'cron';
```

### Cek Execution Time

```sql
-- Average execution time per clinic
SELECT 
  clinic_id,
  AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_seconds,
  COUNT(*) as total_runs
FROM scrap_queue
WHERE status = 'completed'
  AND requested_by = 'cron'
GROUP BY clinic_id;
```

---

## 📚 Related Documentation

- **Railway Setup**: `docs/RAILWAY_SETUP.md`
- **Cron Setup**: `docs/CRON_JOB_ORG_FINAL_GUIDE.md`
- **Queue System**: `docs/SCRAP_QUEUE_SYSTEM.md`
