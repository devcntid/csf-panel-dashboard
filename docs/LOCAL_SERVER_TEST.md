# Test Server Lokal: /wake dan /trigger Endpoints

## ✅ Bisa Dijalankan di Local MacBook!

Ya, endpoint `/wake` dan `/trigger` bisa dijalankan di local MacBook untuk testing. Server `server.js` adalah Node.js HTTP server biasa yang bisa jalan di mana saja.

---

## 🚀 Quick Start

### Step 1: Pastikan Environment Variables Sudah Di-Set

Buka file `.env.local` di root project, pastikan ada:

```bash
# Database (wajib)
DATABASE_URL=postgresql://...
POSTGRES_URL=postgresql://...
NEXT_PUBLIC_DATABASE_URL=postgresql://...

# Server config (optional)
PORT=3001                    # Default: 3001 (untuk menghindari konflik dengan Next.js dev server di port 3000)
PROCESS_LIMIT=6
IDLE_TIMEOUT=300000

**Cara ambil DATABASE_URL:**
1. Vercel Dashboard → Project → Settings → Environment Variables
2. Cari `DATABASE_URL` → klik icon 👁️ untuk reveal
3. Copy value → paste ke `.env.local`

### Step 2: Install Dependencies (Jika Belum)

```bash
pnpm install
```

### Step 3: Install Playwright (Jika Belum)

```bash
pnpm playwright:install
```

### Step 4: Jalankan Server

```bash
pnpm railway:worker
```

**Atau langsung:**

```bash
node server.js
```

**Expected output:**
```
[Railway Worker] Server running on port 3001
[Railway Worker] Health check: http://localhost:3001/health
[Railway Worker] Trigger endpoint: POST http://localhost:3001/trigger
[Railway Worker] Auto-sleep enabled (idle timeout: 300s)
[Railway Worker] Idle check started (timeout: 300s)
```

**Note:** Port 3001 digunakan untuk menghindari konflik dengan Next.js dev server yang berjalan di port 3000.

Server sekarang berjalan di **http://localhost:3001**

**Penting:** Server ini berbeda dengan Next.js dev server (`pnpm dev` yang jalan di port 3000). Jalankan keduanya di terminal terpisah jika perlu.

---

## 🧪 Test Endpoints

### 1. Test Health Check

```bash
curl http://localhost:3001/health
```

**Expected response:**
```json
{
  "status": "ok",
  "processing": false,
  "idleTime": 0,
  "idleTimeout": 300
}
```

### 2. Test Wake Endpoint

```bash
curl http://localhost:3001/wake
```

**Expected response:**
```json
{
  "success": true,
  "message": "Service woken up",
  "timestamp": "2026-02-03T..."
}
```

### 3. Test Trigger Endpoint (Manual)

```bash
curl -X POST http://localhost:3001/trigger \
  -H "Content-Type: application/json" \
  -d '{"isCron":false}'
```

**Expected response:**
```json
{
  "success": true,
  "message": "Scrap queue worker triggered",
  "isCron": false
}
```

**Note:** Response ini langsung return, tapi proses scraping akan berjalan di background. Cek terminal untuk melihat log proses.

### 4. Test Trigger Endpoint (Cron)

```bash
curl -X POST http://localhost:3001/trigger \
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

**Note:** Dengan `isCron: true`, server akan menjalankan `enqueue-today` dulu sebelum scraping.

---

## 📝 Test dengan Browser

Buka browser dan akses:

1. **Health Check:**
   ```
   http://localhost:3001/health
   ```

2. **Wake:**
   ```
   http://localhost:3001/wake
   ```

**Note:** `/trigger` harus pakai POST request, jadi tidak bisa langsung di browser. Pakai `curl` atau Postman.

---

## 🔍 Monitor Logs

Saat menjalankan server, kamu akan melihat log real-time di terminal:

```
[Railway Worker] Service woken up via /wake endpoint
[Railway Worker] Starting scrap queue worker (cron: false)
[Railway Worker] Running scrap:github:queue...
[Railway Worker] Processing queue item 1/6...
[Railway Worker] Scrap queue worker completed
```

---

## ⚙️ Environment Variables untuk Local

### Required (Wajib)

```bash
DATABASE_URL=postgresql://...
POSTGRES_URL=postgresql://...
NEXT_PUBLIC_DATABASE_URL=postgresql://...
```

### Optional (Opsional)

```bash
PORT=3001                    # Default: 3001 (untuk local, berbeda dengan Next.js dev server)
PROCESS_LIMIT=6              # Default: 6
IDLE_TIMEOUT=300000          # Default: 300000 (5 menit)
NODE_ENV=development         # Default: development
```

**Note:** 
- Port 3001 digunakan untuk menghindari konflik dengan Next.js dev server (`pnpm dev`) yang berjalan di port 3000
- Untuk Railway, tetap pakai `PORT=3001` di Railway env vars (Railway akan auto-assign port)

---

## 🐛 Troubleshooting

### Problem: Port 3001 sudah digunakan

**Solusi:**
```bash
# Cek process yang pakai port 3001
lsof -i :3001

# Kill process (ganti PID dengan process ID)
kill -9 <PID>

# Atau ubah PORT di .env.local
PORT=3002
```

**Note:** Port 3000 biasanya digunakan oleh Next.js dev server (`pnpm dev`), jadi `server.js` menggunakan port 3001 secara default.

### Problem: Database connection error

**Solusi:**
1. Cek `DATABASE_URL` di `.env.local` sudah benar
2. Test connection:
   ```bash
   # Test dengan node
   node -e "require('dotenv').config(); const {sql} = require('./lib/db'); sql\`SELECT 1\`.then(r => console.log('OK')).catch(e => console.error(e))"
   ```

### Problem: Playwright tidak terinstall

**Solusi:**
```bash
pnpm playwright:install
```

### Problem: Script tidak ditemukan

**Solusi:**
```bash
# Pastikan dependencies terinstall
pnpm install

# Pastikan tsx terinstall
pnpm add -D tsx
```

---

## 📋 Checklist Test

- [ ] Environment variables sudah di-set di `.env.local`
- [ ] Dependencies terinstall (`pnpm install`)
- [ ] Playwright terinstall (`pnpm playwright:install`)
- [ ] Server berjalan (`pnpm railway:worker`)
- [ ] Test `/health` → sukses
- [ ] Test `/wake` → sukses
- [ ] Test `/trigger` → sukses
- [ ] Cek logs di terminal → proses scraping jalan
- [ ] Cek database → queue items ter-proses

---

## 🎯 Use Cases

### 1. Development & Testing

Jalankan server lokal untuk:
- Test endpoint sebelum deploy ke Railway
- Debug masalah scraping
- Test dengan data lokal

### 2. Manual Trigger

Gunakan untuk trigger scraping manual dari terminal:

```bash
# Trigger manual
curl -X POST http://localhost:3001/trigger \
  -H "Content-Type: application/json" \
  -d '{"isCron":false}'
```

### 3. Integration Testing

Test integrasi dengan database dan scraping flow tanpa perlu deploy ke Railway.

---

## 🔗 Related Documentation

- **Local Env Setup**: `docs/LOCAL_ENV_SETUP.md`
- **Railway Setup**: `docs/RAILWAY_SETUP.md`
- **Server Code**: `server.js`

---

## 💡 Tips

1. **Gunakan Terminal Multiplexer:**
   - Split terminal: satu untuk server, satu untuk test curl
   - Atau pakai `tmux` atau `screen`

2. **Monitor Logs:**
   - Server akan print log real-time
   - Cek juga database untuk melihat hasil scraping

3. **Test dengan Data Kecil:**
   - Set `PROCESS_LIMIT=1` untuk test dengan 1 queue item saja
   - Atau enqueue manual dengan data test

4. **Stop Server:**
   - Tekan `Ctrl+C` di terminal untuk stop server
   - Server akan graceful shutdown
