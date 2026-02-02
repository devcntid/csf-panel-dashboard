# Setup Environment Variables untuk Local Development (MacBook)

## 📋 Overview

Untuk development lokal di MacBook, kamu perlu set environment variables di file `.env.local`. File ini sudah di `.gitignore`, jadi aman untuk commit.

---

## 🚀 Quick Setup

### Step 1: Copy Template

```bash
# Di root project
cp .env.local.example .env.local
```

### Step 2: Isi Environment Variables

Buka file `.env.local` dan isi dengan value yang sesuai:

---

## ✅ Required Variables (Wajib)

### 1. DATABASE_URL

**Wajib diisi** untuk koneksi ke database.

**Cara ambil:**
1. Buka **Vercel Dashboard** → Project → **Settings** → **Environment Variables**
2. Cari `DATABASE_URL`
3. Klik icon **👁️ (eye)** untuk reveal value
4. Copy seluruh value

**Format:**
```
DATABASE_URL=postgresql://user:password@host:port/database?sslmode=require
```

**Contoh:**
```
DATABASE_URL=postgresql://user:pass123@ep-xxx-xxx.us-east-2.aws.neon.tech/dbname?sslmode=require
```

### 2. POSTGRES_URL

**Sama dengan DATABASE_URL** (copy-paste value yang sama)

```
POSTGRES_URL=postgresql://user:password@host:port/database?sslmode=require
```

### 3. NEXT_PUBLIC_DATABASE_URL (Optional)

**Sama dengan DATABASE_URL** (copy-paste value yang sama)

```
NEXT_PUBLIC_DATABASE_URL=postgresql://user:password@host:port/database?sslmode=require
```

---

## 🔧 Optional Variables (Opsional)

### 1. RAILWAY_SERVICE_URL

**Hanya perlu jika mau test trigger ke Railway dari local.**

**Cara ambil:**
1. Buka **Railway Dashboard** → Service `scrap-queue-worker`
2. Klik tab **"Settings"** → **"Networking"**
3. Copy **Public Domain** (contoh: `https://scrap-queue-worker-production.up.railway.app`)

**Format:**
```
RAILWAY_SERVICE_URL=https://your-railway-service-url.up.railway.app
```

**Penting:** Jangan tambahkan `/trigger` di akhir URL!

**Contoh:**
```
RAILWAY_SERVICE_URL=https://scrap-queue-worker-production.up.railway.app
```

### 2. PORT

**Optional** - Port untuk Next.js dev server (default: 3000)

```
PORT=3000
```

### 3. PROCESS_LIMIT

**Optional** - Limit proses scrap queue (default: 6)

```
PROCESS_LIMIT=6
```

### 4. NODE_ENV

**Optional** - Environment mode (default: development)

```
NODE_ENV=development
```

---

## 📝 Contoh File .env.local Lengkap

```bash
# Database (Required)
DATABASE_URL=postgresql://user:pass123@ep-xxx-xxx.us-east-2.aws.neon.tech/dbname?sslmode=require
POSTGRES_URL=postgresql://user:pass123@ep-xxx-xxx.us-east-2.aws.neon.tech/dbname?sslmode=require
NEXT_PUBLIC_DATABASE_URL=postgresql://user:pass123@ep-xxx-xxx.us-east-2.aws.neon.tech/dbname?sslmode=require

# Railway (Optional - hanya jika test trigger)
RAILWAY_SERVICE_URL=https://scrap-queue-worker-production.up.railway.app

# Local Development (Optional)
PORT=3000
PROCESS_LIMIT=6
NODE_ENV=development
```

---

## 🔍 Verifikasi Setup

### Test 1: Cek File .env.local

```bash
# Di root project
cat .env.local | grep DATABASE_URL
```

**Expected output:**
```
DATABASE_URL=postgresql://...
```

### Test 2: Test Database Connection

```bash
# Jalankan Next.js dev server
pnpm dev

# Buka browser: http://localhost:3000
# Jika tidak ada error, berarti DATABASE_URL sudah benar
```

### Test 3: Test Railway Trigger (Jika RAILWAY_SERVICE_URL di-set)

```bash
# Test health check
curl https://<railway-service-url>/health

# Test trigger (jika RAILWAY_SERVICE_URL sudah di-set)
# Buka UI → Dashboard → Konfigurasi → System Logs → Klik "Jalankan Scrap Queue"
```

---

## 🆕 Perubahan dari Setup Sebelumnya

### ✅ Tidak Ada Perubahan Wajib

**File `.env.local` kamu yang sudah ada tetap bisa dipakai!** Tidak ada perubahan wajib.

### ➕ Penambahan Optional

Jika mau test trigger ke Railway dari local, tambahkan:

```
RAILWAY_SERVICE_URL=https://your-railway-service-url.up.railway.app
```

**Tapi ini optional** - jika tidak di-set, trigger dari UI akan fallback ke pesan warning (job tetap ter-enqueue di database).

---

## 🚨 Troubleshooting

### Problem: "DATABASE_URL tidak ditemukan"

**Solusi:**
1. Pastikan file `.env.local` ada di **root project** (sama level dengan `package.json`)
2. Pastikan format benar: `DATABASE_URL=postgresql://...` (tanpa spasi di sekitar `=`)
3. Restart dev server: `pnpm dev`

### Problem: Database connection error

**Solusi:**
1. Cek `DATABASE_URL` format benar (harus dimulai dengan `postgresql://`)
2. Pastikan connection string dari Vercel/Neon sudah benar
3. Test connection string:
   ```bash
   psql "<DATABASE_URL>"
   ```

### Problem: RAILWAY_SERVICE_URL tidak bekerja

**Solusi:**
1. Pastikan format benar: `https://...` (tanpa `/trigger` di akhir)
2. Test health check dulu: `curl https://<railway-url>/health`
3. Pastikan Railway service sudah running

---

## 📚 Related Documentation

- **Railway Setup**: `docs/RAILWAY_SETUP.md`
- **Railway Env Setup**: `docs/RAILWAY_ENV_SETUP.md`
- **Local Development**: File ini

---

## ✅ Checklist

- [ ] File `.env.local` sudah dibuat (copy dari `.env.local.example`)
- [ ] `DATABASE_URL` sudah di-set (copy dari Vercel)
- [ ] `POSTGRES_URL` sudah di-set (sama dengan DATABASE_URL)
- [ ] `NEXT_PUBLIC_DATABASE_URL` sudah di-set (optional, sama dengan DATABASE_URL)
- [ ] `RAILWAY_SERVICE_URL` sudah di-set (optional, untuk test trigger)
- [ ] Test database connection → sukses
- [ ] Test Next.js dev server → sukses (`pnpm dev`)

---

## 💡 Tips

1. **Jangan commit `.env.local`** - File ini sudah di `.gitignore`
2. **Gunakan `.env.local.example`** sebagai template untuk tim
3. **Copy DATABASE_URL dari Vercel** - Jangan ketik manual (bisa typo)
4. **RAILWAY_SERVICE_URL optional** - Hanya perlu jika mau test trigger dari local

---

## 🎯 Summary

**Untuk development lokal di MacBook:**

✅ **Wajib:**
- `DATABASE_URL` (copy dari Vercel)
- `POSTGRES_URL` (sama dengan DATABASE_URL)

✅ **Optional:**
- `RAILWAY_SERVICE_URL` (hanya jika mau test trigger ke Railway)
- `PORT`, `PROCESS_LIMIT`, `NODE_ENV` (default sudah OK)

**Tidak ada perubahan wajib dari setup sebelumnya!** File `.env.local` yang sudah ada tetap bisa dipakai.
