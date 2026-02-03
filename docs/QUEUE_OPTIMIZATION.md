# Optimasi Queue System untuk Scraping Setiap 30 Menit

## 🔍 Analisis Masalah Saat Ini

### Current Flow

```
08:00 → Cron trigger
  ↓
Enqueue: Insert 6 jobs (1 per clinic) untuk hari ini
  ↓
Process: Process 6 items (sequential, ~12 menit)
  ↓
08:12 → Selesai, queue kosong
  ↓
08:30 → Cron trigger lagi
  ↓
❌ Tidak ada enqueue (karena isCron: true hanya enqueue sekali)
  ↓
❌ Queue kosong, tidak ada yang di-process
```

**Masalah:**
1. Enqueue hanya terjadi sekali di awal (saat cron pertama)
2. Setelah queue habis, scraping berhenti
3. Cron berikutnya (08:30, 09:00, dll) tidak ada yang di-process
4. Scraping hanya jalan sekali per hari, bukan setiap 30 menit

---

## 💡 Solusi yang Direkomendasikan

### Opsi 1: Enqueue Setiap 30 Menit (Recommended)

**Konsep:**
- Enqueue setiap kali cron trigger (setiap 30 menit)
- Tapi dengan **idempotency check** untuk prevent duplicate
- Jika sudah ada pending/processing untuk tanggal yang sama, skip insert

**Flow:**
```
08:00 → Enqueue 6 jobs → Process 6 items
08:30 → Enqueue 6 jobs (check duplicate) → Process 6 items
09:00 → Enqueue 6 jobs (check duplicate) → Process 6 items
...
21:00 → Enqueue 6 jobs (check duplicate) → Process 6 items
```

**Pros:**
- ✅ Scraping jalan setiap 30 menit
- ✅ Idempotency: tidak ada duplicate jika masih pending/processing
- ✅ Reliable: jika gagal di batch sebelumnya, akan di-retry di batch berikutnya

**Cons:**
- ⚠️ Banyak insert ke database (tapi dengan check, jadi aman)
- ⚠️ Queue items akan banyak (tapi akan di-cleanup setelah completed)

**Implementation:**
- Code sudah ada idempotency check di `enqueue-today-scrap-queue.ts`
- Hanya perlu pastikan enqueue jalan setiap cron trigger

---

### Opsi 2: Enqueue Sekali, Process Berulang (Tidak Recommended)

**Konsep:**
- Enqueue hanya sekali di awal hari (08:00)
- Process queue setiap 30 menit
- Re-process items yang failed

**Flow:**
```
08:00 → Enqueue 6 jobs (sekali)
08:00 → Process 6 items
08:30 → Process failed items (jika ada)
09:00 → Process failed items (jika ada)
...
```

**Pros:**
- ✅ Sedikit insert ke database
- ✅ Queue items sedikit

**Cons:**
- ❌ Tidak bisa re-scrape data yang sudah completed
- ❌ Jika semua completed, tidak ada yang di-process
- ❌ Tidak sesuai requirement "scraping setiap 30 menit"

---

### Opsi 3: Tidak Pakai Queue untuk Cron (Tidak Recommended)

**Konsep:**
- Cron langsung scrape tanpa queue
- Queue hanya untuk insidental

**Flow:**
```
08:00 → Langsung scrape 6 clinics (paralel/sequential)
08:30 → Langsung scrape 6 clinics
...
```

**Pros:**
- ✅ Simple, tidak perlu queue
- ✅ Langsung scrape

**Cons:**
- ❌ Tidak ada retry mechanism
- ❌ Tidak ada tracking per clinic
- ❌ Tidak ada idempotency
- ❌ Jika gagal, tidak bisa di-retry

---

## ✅ Rekomendasi: Opsi 1 (Enqueue Setiap 30 Menit)

### Alasan

1. **Sesuai Requirement:**
   - Scraping setiap 30 menit sepanjang hari
   - Data selalu up-to-date

2. **Idempotency:**
   - Code sudah ada check untuk prevent duplicate
   - Jika masih pending/processing, tidak akan insert lagi

3. **Reliability:**
   - Jika gagal di batch sebelumnya, akan di-retry
   - Setiap batch independent

4. **Flexibility:**
   - Bisa adjust PROCESS_LIMIT per batch
   - Bisa monitor progress per batch

---

## 🔧 Implementation

### Current Code (Sudah Benar)

**`enqueue-today-scrap-queue.ts`** sudah ada idempotency check:

```typescript
// Insert hanya jika belum ada pending/processing untuk tanggal yang sama
INSERT INTO scrap_queue (clinic_id, tgl_awal, tgl_akhir, status, requested_by)
SELECT ...
WHERE NOT EXISTS (
  SELECT 1 FROM scrap_queue q
  WHERE q.clinic_id = c.id
    AND q.tgl_awal = ${today}::date
    AND q.tgl_akhir = ${today}::date
    AND q.status IN ('pending', 'processing')
)
```

**`server.js`** sudah enqueue setiap kali `isCron: true`:

```javascript
if (isCron) {
  // Enqueue setiap kali cron trigger
  await runEnqueueToday()
}
```

### Yang Perlu Diperbaiki

**TIDAK ADA!** Code sudah benar. Masalahnya mungkin di:

1. **Cron tidak trigger dengan benar**
   - Cek cron-job.org execution history
   - Pastikan cron job active

2. **Queue items sudah completed semua**
   - Jika semua completed, enqueue akan skip (karena idempotency)
   - Ini **NORMAL** - berarti data sudah up-to-date

3. **PROCESS_LIMIT terlalu kecil**
   - Default: 6 (sesuai jumlah clinics)
   - Jika ada lebih dari 6 pending items, akan di-process di batch berikutnya

---

## 📊 Estimasi Data Queue

### Scenario: Enqueue Setiap 30 Menit

**Per hari:**
- Cron runs: 27 kali (08:00 - 21:00)
- Enqueue attempts: 27 kali
- Actual inserts: ~6-12 kali (karena idempotency, tidak semua insert)

**Per bulan:**
- Cron runs: ~810 kali (27 × 30 hari)
- Queue items: ~3,600 items (6 clinics × 30 hari × 2 batch/day average)

**Storage:**
- Per item: ~200 bytes
- Total: ~720 KB per bulan
- **Sangat kecil, tidak masalah!**

---

## 🎯 Optimasi Tambahan

### 1. Cleanup Old Queue Items

**Auto-cleanup items yang sudah completed > 7 hari:**

```sql
-- Run setiap hari (via cron)
DELETE FROM scrap_queue
WHERE status = 'completed'
  AND completed_at < NOW() - INTERVAL '7 days';
```

### 2. Limit Queue Items per Clinic per Day

**Prevent terlalu banyak pending items:**

```typescript
// Di enqueue-today-scrap-queue.ts
// Limit max 2 pending items per clinic per day
WHERE NOT EXISTS (
  SELECT 1 FROM scrap_queue q
  WHERE q.clinic_id = c.id
    AND q.tgl_awal = ${today}::date
    AND q.status IN ('pending', 'processing')
  HAVING COUNT(*) >= 2  -- Max 2 pending items
)
```

### 3. Process Only Recent Items

**Process hanya items yang created < 1 jam:**

```typescript
// Di scrap-github-queue.ts
const queueItem = await sql`
  SELECT * FROM scrap_queue
  WHERE status = 'pending'
    AND created_at > NOW() - INTERVAL '1 hour'
  ORDER BY created_at ASC
  LIMIT 1
`
```

---

## 📋 Rekomendasi Final

### ✅ Keep Current Implementation

**Alasan:**
1. Code sudah benar dengan idempotency
2. Enqueue setiap 30 menit sudah jalan (jika cron benar)
3. Queue items manageable (dengan cleanup)

### 🔧 Yang Perlu Diperbaiki

1. **Pastikan Cron Trigger dengan Benar:**
   - Cek cron-job.org execution history
   - Pastikan cron job active dan trigger setiap 30 menit

2. **Monitor Queue Status:**
   ```sql
   -- Cek queue status real-time
   SELECT 
     status,
     COUNT(*) as count,
     MIN(created_at) as oldest,
     MAX(created_at) as newest
   FROM scrap_queue
   WHERE DATE(created_at) = CURRENT_DATE
   GROUP BY status;
   ```

3. **Add Cleanup Job (Optional):**
   - Auto-delete completed items > 7 hari
   - Prevent database bloat

---

## 🎯 Kesimpulan

### Apakah Perlu Enqueue Setiap 30 Menit?

**✅ YA**, karena:
- Requirement: scraping setiap 30 menit
- Idempotency sudah ada, tidak akan duplicate
- Data queue manageable dengan cleanup

### Apakah Banyak Data?

**❌ TIDAK**, karena:
- Per item: ~200 bytes
- Per bulan: ~720 KB
- Dengan cleanup: bahkan lebih kecil

### Apakah Efisien?

**✅ YA**, karena:
- Idempotency prevent duplicate
- Queue system reliable dan trackable
- Bisa monitor dan debug dengan mudah

---

## 📚 Related Documentation

- **Scrap Flow**: `docs/SCRAP_FLOW_EXPLANATION.md`
- **Cron Setup**: `docs/CRON_JOB_ORG_FINAL_GUIDE.md`
- **Railway Setup**: `docs/RAILWAY_SETUP.md`
