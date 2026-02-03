# Fix Railway 502 Bad Gateway Error

## Problem

Railway service mengembalikan **502 Bad Gateway** untuk endpoint `/wake`, `/health`, dan `/trigger`, padahal di local berjalan dengan baik.

## Root Causes

1. **Server tidak start dengan benar** - Service crash saat startup
2. **Port configuration salah** - Server tidak listen ke port yang benar
3. **Playwright tidak terinstall** - Dependencies tidak lengkap
4. **URL parsing error** - Query string tidak di-handle dengan benar

## Solutions

### 1. Perbaikan yang Sudah Dilakukan

#### A. URL Parsing Fix

**Problem:** `req.url` bisa include query string, jadi routing tidak match.

**Fix:** Parse URL dengan benar:
```javascript
const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
const pathname = url.pathname
```

#### B. Server Listen Fix

**Problem:** Server mungkin listen ke `localhost` saja, tidak accessible dari luar.

**Fix:** Listen ke `0.0.0.0`:
```javascript
server.listen(PORT, '0.0.0.0', () => {
  // ...
})
```

#### C. Playwright Installation

**Problem:** Playwright tidak terinstall di Docker image.

**Fix:** Tambahkan di Dockerfile:
```dockerfile
# Install Playwright and Chromium
RUN pnpm playwright install --with-deps chromium
```

#### D. Error Handling

**Problem:** Error tidak di-handle dengan baik, service crash tanpa log yang jelas.

**Fix:** Tambahkan error handling:
```javascript
server.on('error', (error) => {
  console.error('[Railway Worker] Server error:', error)
  if (error.code === 'EADDRINUSE') {
    console.error(`[Railway Worker] Port ${PORT} sudah digunakan.`)
  }
  process.exit(1)
})
```

### 2. Verifikasi Railway Configuration

#### A. Cek Environment Variables

Pastikan di Railway Dashboard → Service → Variables:

```
NODE_ENV=production
PORT=3001
PROCESS_LIMIT=6
DATABASE_URL=postgresql://...
POSTGRES_URL=postgresql://...
NEXT_PUBLIC_DATABASE_URL=postgresql://...
```

**Penting:** Railway akan auto-assign PORT, tapi kita tetap set `PORT=3001` untuk konsistensi.

#### B. Cek Start Command

Di Railway Dashboard → Service → Settings → Start Command:

**Harus kosong** (Railway akan menggunakan CMD dari Dockerfile: `node server.js`)

Atau jika perlu set manual:
```
node server.js
```

**Jangan pakai:**
- `pnpm dev` (ini untuk Next.js dev server)
- `pnpm start` (ini untuk Next.js production server)
- `next start` (ini untuk Next.js)

#### C. Cek Health Check Path

Di Railway Dashboard → Service → Settings → Health Check:

```
/health
```

**Method:** GET

**Expected Response:**
```json
{
  "status": "ok",
  "processing": false,
  "idleTime": 0,
  "idleTimeout": 300
}
```

### 3. Debugging Steps

#### Step 1: Cek Railway Logs

1. Buka **Railway Dashboard** → Service → **Deployments** → **View Logs**
2. Cari error messages:
   - `[Railway Worker] Server running on port...`
   - `[Railway Worker] Server error:...`
   - `Error: Cannot find module...`
   - `EADDRINUSE`

#### Step 2: Test Health Check

```bash
curl https://csf-panel-dashboard-production.up.railway.app/health
```

**Expected:**
```json
{"status":"ok","processing":false,"idleTime":0,"idleTimeout":300}
```

**Jika 502:**
- Service tidak running
- Cek logs untuk error

#### Step 3: Test Wake Endpoint

```bash
curl https://csf-panel-dashboard-production.up.railway.app/wake
```

**Expected:**
```json
{"success":true,"message":"Service woken up","timestamp":"..."}
```

#### Step 4: Cek Service Status

1. Railway Dashboard → Service
2. Status harus **"Active"** (green)
3. Jika **"Inactive"** atau **"Failed"**, cek logs

### 4. Common Issues & Fixes

#### Issue 1: Service Crash on Startup

**Symptoms:**
- Status: "Failed"
- Logs: Error saat start

**Fix:**
1. Cek `DATABASE_URL` sudah benar
2. Cek Playwright terinstall (lihat logs)
3. Cek PORT tidak conflict

#### Issue 2: Port Already in Use

**Symptoms:**
- Logs: `EADDRINUSE: address already in use`

**Fix:**
- Railway akan auto-assign PORT, tidak perlu khawatir
- Pastikan tidak set PORT manual yang conflict

#### Issue 3: Module Not Found

**Symptoms:**
- Logs: `Cannot find module '@/lib/db'`

**Fix:**
- Pastikan `pnpm install --frozen-lockfile` berhasil
- Cek `package.json` dependencies lengkap

#### Issue 4: Playwright Not Found

**Symptoms:**
- Logs: `playwright: command not found`

**Fix:**
- Pastikan Dockerfile include: `RUN pnpm playwright install --with-deps chromium`

### 5. Redeploy Steps

Setelah fix, redeploy:

1. **Commit changes:**
   ```bash
   git add server.js Dockerfile
   git commit -m "fix: Railway 502 error - URL parsing, listen 0.0.0.0, Playwright install"
   git push
   ```

2. **Railway akan auto-deploy:**
   - Railway Dashboard → Service → Deployments
   - Tunggu build selesai
   - Cek logs untuk konfirmasi

3. **Test endpoints:**
   ```bash
   curl https://csf-panel-dashboard-production.up.railway.app/health
   curl https://csf-panel-dashboard-production.up.railway.app/wake
   ```

### 6. Verification Checklist

Setelah redeploy:

- [ ] Build sukses (tidak ada error)
- [ ] Service status: **"Active"** (green)
- [ ] Logs menunjukkan: `[Railway Worker] Server running on port...`
- [ ] Health check: `curl /health` → 200 OK
- [ ] Wake endpoint: `curl /wake` → 200 OK
- [ ] Trigger endpoint: `curl -X POST /trigger` → 200 OK
- [ ] Tidak ada 502 error di HTTP logs

---

## Related Documentation

- **Railway Setup**: `docs/RAILWAY_SETUP.md`
- **Railway Build Fix**: `docs/RAILWAY_BUILD_FIX.md`
- **Local Server Test**: `docs/LOCAL_SERVER_TEST.md`
