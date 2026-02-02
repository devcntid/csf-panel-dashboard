# Panduan Lengkap: Setup Environment Variables di Railway

## 📋 Overview Arsitektur

```
┌─────────────────────────────────────────────────────────┐
│                    VERCEL (Frontend + API)              │
│  - Next.js App (UI Dashboard)                          │
│  - API Routes (/api/scrap/queue, /api/scrap/run-queue)│
│  - Tidak menjalankan Playwright (aman untuk serverless)│
└───────────────────────┬─────────────────────────────────┘
                        │
                        │ HTTP POST (trigger insidental)
                        ↓
┌─────────────────────────────────────────────────────────┐
│              RAILWAY (Worker + Cron)                    │
│  - server.js (HTTP server untuk trigger)                │
│  - Playwright scraping (jalan di Railway, bukan Vercel) │
│  - Cron job (scheduled setiap 30 menit)                │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ↓
              ┌──────────────────┐
              │  Neon Postgres   │
              │  (Database)      │
              └──────────────────┘
```

**Kesimpulan:**
- ✅ **Vercel**: Frontend + API routes (tetap seperti biasa)
- ✅ **Railway**: Hanya untuk scraper worker + cron (Playwright)
- ✅ **Database**: Tetap pakai Neon Postgres (sama dengan Vercel)

---

## 🚀 Step-by-Step: Setup Environment Variables di Railway

### Step 1: Buka Railway Dashboard

1. Login ke **https://railway.app**
2. Pilih **Project** kamu (atau buat project baru jika belum ada)
3. Klik service **`scrap-queue-worker`** (atau buat service baru jika belum ada)

### Step 2: Buka Tab Variables

1. Di halaman service `scrap-queue-worker`
2. Klik tab **"Variables"** (di menu atas, sebelah "Settings", "Metrics", dll)
3. Kamu akan lihat list environment variables (kosong jika baru dibuat)

### Step 3: Ambil DATABASE_URL dari Vercel

**Cara 1: Via Vercel Dashboard (Recommended)**

1. Buka **https://vercel.com**
2. Login → Pilih **Project** kamu
3. Klik **Settings** → **Environment Variables**
4. Cari variable **`DATABASE_URL`**
5. Klik icon **👁️ (eye)** untuk reveal value
6. **Copy** seluruh value (biasanya format: `postgresql://user:pass@host:port/db?sslmode=require`)

**Cara 2: Via Vercel CLI**

```bash
vercel env pull .env.local
cat .env.local | grep DATABASE_URL
```

### Step 4: Tambah Environment Variables di Railway

Di Railway Dashboard → Service `scrap-queue-worker` → Tab **"Variables"**:

#### A. Klik tombol **"+ New Variable"** atau **"Add Variable"**

#### B. Tambahkan satu per satu:

**Variable 1: NODE_ENV**
```
Name:  NODE_ENV
Value: production
```
Klik **"Add"** atau **"Save"**

**Variable 2: PORT**
```
Name:  PORT
Value: 3001
```
Klik **"Add"** atau **"Save"**

**Variable 3: PROCESS_LIMIT**
```
Name:  PROCESS_LIMIT
Value: 6
```
Klik **"Add"** atau **"Save"**

**Variable 4: DATABASE_URL**
```
Name:  DATABASE_URL
Value: <paste value dari Vercel>
```
**Penting:** Paste seluruh connection string dari Vercel (contoh: `postgresql://user:pass@host:port/db?sslmode=require`)

Klik **"Add"** atau **"Save"**

**Variable 5: POSTGRES_URL**
```
Name:  POSTGRES_URL
Value: <sama dengan DATABASE_URL>
```
Copy-paste value yang sama dengan `DATABASE_URL`

Klik **"Add"** atau **"Save"**

**Variable 6: NEXT_PUBLIC_DATABASE_URL** (Optional, jika diperlukan)
```
Name:  NEXT_PUBLIC_DATABASE_URL
Value: <sama dengan DATABASE_URL>
```
Copy-paste value yang sama dengan `DATABASE_URL`

Klik **"Add"** atau **"Save"**

### Step 5: Verifikasi Variables

Setelah semua variables ditambahkan, pastikan list-nya seperti ini:

```
✅ NODE_ENV = production
✅ PORT = 3001
✅ PROCESS_LIMIT = 6
✅ DATABASE_URL = postgresql://...
✅ POSTGRES_URL = postgresql://...
✅ NEXT_PUBLIC_DATABASE_URL = postgresql://... (optional)
```

### Step 6: Redeploy Service (Jika Sudah Deployed)

1. Klik tab **"Deployments"** (di menu atas)
2. Klik tombol **"Redeploy"** pada deployment terbaru
3. Atau Railway akan auto-redeploy setelah kamu save variables

---

## 📸 Visual Guide (Screenshot Reference)

### Railway Variables Tab

```
┌─────────────────────────────────────────────────┐
│  scrap-queue-worker                             │
│  ┌───────────────────────────────────────────┐  │
│  │ Overview  Variables  Settings  Metrics  │  │
│  └───────────────────────────────────────────┘  │
│                                                 │
│  Environment Variables                          │
│  ┌─────────────────────────────────────────┐   │
│  │ Name              Value                  │   │
│  ├─────────────────────────────────────────┤   │
│  │ NODE_ENV         production             │   │
│  │ PORT             3001                   │   │
│  │ PROCESS_LIMIT    6                      │   │
│  │ DATABASE_URL     postgresql://...       │   │
│  │ POSTGRES_URL     postgresql://...       │   │
│  └─────────────────────────────────────────┘   │
│                                                 │
│  [+ New Variable]                               │
└─────────────────────────────────────────────────┘
```

---

## 🔍 Troubleshooting

### Problem: Variable tidak muncul setelah di-add

**Solusi:**
1. Refresh halaman Railway
2. Cek tab **"Variables"** lagi
3. Pastikan klik **"Save"** atau **"Add"** setelah input

### Problem: DATABASE_URL format salah

**Solusi:**
1. Pastikan copy **seluruh** connection string (dari `postgresql://` sampai akhir)
2. Jangan ada spasi di awal/akhir
3. Format harus: `postgresql://user:password@host:port/database?sslmode=require`

### Problem: Service tidak bisa connect ke database

**Solusi:**
1. Cek `DATABASE_URL` di Railway sama persis dengan di Vercel
2. Test connection string:
   ```bash
   # Di terminal lokal, test dulu
   psql "<DATABASE_URL>"
   ```
3. Pastikan Neon database allow connection dari Railway IP (biasanya sudah allow semua)

### Problem: Service crash setelah set variables

**Solusi:**
1. Cek logs: Railway Dashboard → Service → **"Deployments"** → **"View Logs"**
2. Pastikan semua required variables sudah di-set
3. Pastikan format value benar (tidak ada typo)

---

## ✅ Checklist

- [ ] Railway service `scrap-queue-worker` sudah dibuat
- [ ] Tab **"Variables"** sudah dibuka
- [ ] `NODE_ENV=production` sudah di-set
- [ ] `PORT=3001` sudah di-set
- [ ] `PROCESS_LIMIT=6` sudah di-set
- [ ] `DATABASE_URL` sudah di-copy dari Vercel dan di-paste ke Railway
- [ ] `POSTGRES_URL` sudah di-set (sama dengan DATABASE_URL)
- [ ] `NEXT_PUBLIC_DATABASE_URL` sudah di-set (optional, sama dengan DATABASE_URL)
- [ ] Service sudah di-redeploy setelah set variables
- [ ] Test health check: `curl https://<railway-url>/health` → sukses

---

## 🎯 Quick Reference: Copy-Paste Values

Jika kamu sudah punya `.env.local` atau `.env` di lokal:

```bash
# Di terminal lokal, jalankan:
cat .env.local | grep -E "DATABASE_URL|POSTGRES_URL|NEXT_PUBLIC_DATABASE_URL"

# Copy output dan paste ke Railway Variables
```

Atau jika pakai Vercel CLI:

```bash
vercel env pull .env.local
cat .env.local
```

---

## 📝 Catatan Penting

1. **DATABASE_URL harus sama persis** dengan di Vercel (copy-paste, jangan ketik manual)
2. **Railway akan auto-redeploy** setelah kamu save variables (tidak perlu manual)
3. **Variables bersifat case-sensitive**: `DATABASE_URL` bukan `database_url`
4. **Jangan expose variables** di public (Railway sudah secure, tapi jangan screenshot dan share)

---

## 🚀 Next Steps

Setelah semua variables di-set:

1. **Test Health Check:**
   ```bash
   curl https://<railway-service-url>/health
   ```

2. **Test Manual Trigger:**
   ```bash
   curl -X POST https://<railway-service-url>/trigger \
     -H "Content-Type: application/json" \
     -d '{"isCron":false}'
   ```

3. **Setup Cron** (lihat `docs/RAILWAY_SETUP.md`)

4. **Set RAILWAY_SERVICE_URL di Vercel** (lihat `docs/RAILWAY_SETUP.md`)

---

## 📚 Related Documentation

- **Full Setup Guide**: `docs/RAILWAY_SETUP.md`
- **Architecture**: Lihat diagram di atas
- **Troubleshooting**: Lihat section di atas
