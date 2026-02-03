# Railway Troubleshooting: 502 Bad Gateway

## Problem

Endpoint `/health`, `/wake`, dan `/trigger` mengembalikan **502 Bad Gateway**:
```json
{"status":"error","code":502,"message":"Application failed to respond"}
```

## Quick Diagnosis

### Step 1: Cek Railway Service Status

1. Buka **Railway Dashboard** → Service `csf-panel-dashboard`
2. Cek status:
   - ✅ **"Active"** (green) = Service running
   - ❌ **"Inactive"** atau **"Failed"** = Service tidak running

### Step 2: Cek Railway Logs

1. Railway Dashboard → Service → **Deployments** → **View Logs**
2. Cari error messages:
   - `[Railway Worker] Server running on port...` ✅ (berarti server start)
   - `[Railway Worker] Server error:...` ❌ (ada error)
   - `Error: Cannot find module...` ❌ (dependencies tidak lengkap)
   - `EADDRINUSE` ❌ (port conflict)

### Step 3: Cek Environment Variables

Railway Dashboard → Service → **Variables** tab, pastikan ada:

**Required:**
```
NODE_ENV=production
PORT=3001
PROCESS_LIMIT=6
DATABASE_URL=postgresql://...
POSTGRES_URL=postgresql://...
NEXT_PUBLIC_DATABASE_URL=postgresql://...
```

**Cara cek:**
1. Railway Dashboard → Service → **Variables**
2. Pastikan semua variables di atas ada
3. Klik icon 👁️ untuk reveal value (khusus DATABASE_URL)

### Step 4: Cek Build Logs

1. Railway Dashboard → Service → **Deployments** → **Build Logs**
2. Cari error:
   - `Error: Installation process exited with code: 127` ❌ (Playwright install gagal)
   - `gyp ERR! find Python` ❌ (Python tidak ditemukan)
   - `Cannot find module` ❌ (Dependencies tidak terinstall)

## Common Issues & Solutions

### Issue 1: Service Tidak Start

**Symptoms:**
- Status: "Inactive" atau "Failed"
- Logs: Tidak ada log `[Railway Worker] Server running...`

**Solutions:**

1. **Cek Start Command:**
   - Railway Dashboard → Service → **Settings** → **Start Command**
   - Harus kosong (Railway akan pakai CMD dari Dockerfile: `node server.js`)
   - Atau set manual: `node server.js`

2. **Cek Environment Variables:**
   - Pastikan `DATABASE_URL` sudah di-set
   - Pastikan `PORT` sudah di-set (default: 3001)

3. **Redeploy:**
   - Railway Dashboard → Service → **Deployments** → **Redeploy**

### Issue 2: Playwright Install Gagal

**Symptoms:**
- Build logs: `Error: Installation process exited with code: 127`
- Build logs: `apt-get: not found`

**Solution:**
- Pastikan Dockerfile menggunakan `node:18-slim` (Debian), bukan `node:18-alpine`
- Pastikan Dockerfile include: `RUN pnpm playwright install --with-deps chromium`

### Issue 3: Port Conflict

**Symptoms:**
- Logs: `EADDRINUSE: address already in use`

**Solution:**
- Railway akan auto-assign PORT, tidak perlu khawatir
- Pastikan tidak set PORT manual yang conflict
- Biarkan Railway handle PORT assignment

### Issue 4: Database Connection Error

**Symptoms:**
- Logs: `DATABASE_URL tidak ditemukan`
- Logs: `Connection refused` atau `timeout`

**Solution:**
1. Cek `DATABASE_URL` di Railway Variables
2. Pastikan format benar: `postgresql://user:pass@host:port/db?sslmode=require`
3. Test connection dari local:
   ```bash
   # Copy DATABASE_URL dari Railway
   export DATABASE_URL="postgresql://..."
   node -e "const {sql} = require('./lib/db'); sql\`SELECT 1\`.then(() => console.log('OK')).catch(e => console.error(e))"
   ```

### Issue 5: Server Crash on Startup

**Symptoms:**
- Logs: Error saat start
- Status: "Failed"

**Solution:**
1. Cek logs untuk error message spesifik
2. Pastikan semua dependencies terinstall
3. Pastikan Playwright terinstall
4. Cek `DATABASE_URL` valid

## Step-by-Step Fix

### Fix 1: Verifikasi Configuration

1. **Cek Railway Service:**
   ```
   Railway Dashboard → Service → Settings
   - Start Command: kosong atau `node server.js`
   - Health Check Path: `/health`
   ```

2. **Cek Environment Variables:**
   ```
   Railway Dashboard → Service → Variables
   - NODE_ENV=production
   - PORT=3001
   - DATABASE_URL=postgresql://...
   - POSTGRES_URL=postgresql://...
   - NEXT_PUBLIC_DATABASE_URL=postgresql://...
   ```

3. **Cek Dockerfile:**
   - Base image: `node:18-slim` (Debian)
   - Include: `RUN pnpm playwright install --with-deps chromium`
   - CMD: `["node", "server.js"]`

### Fix 2: Redeploy Service

1. **Trigger Redeploy:**
   - Railway Dashboard → Service → **Deployments**
   - Klik **"..."** → **"Redeploy"**
   - Atau push commit baru ke GitHub

2. **Monitor Build:**
   - Tunggu build selesai
   - Cek build logs untuk error
   - Pastikan build sukses

3. **Monitor Deploy:**
   - Tunggu deploy selesai
   - Cek deploy logs untuk error
   - Pastikan service status: "Active"

### Fix 3: Test Endpoints

Setelah redeploy, test:

```bash
# Health check
curl https://csf-panel-dashboard-production.up.railway.app/health

# Expected:
# {"status":"ok","processing":false,"idleTime":0,"idleTimeout":300}

# Wake
curl https://csf-panel-dashboard-production.up.railway.app/wake

# Expected:
# {"success":true,"message":"Service woken up","timestamp":"..."}
```

## Debug Commands

### Cek Service Logs (Real-time)

1. Railway Dashboard → Service → **Deployments** → **View Logs**
2. Filter: `[Railway Worker]`
3. Cari:
   - `Server running on port...` ✅
   - `Server error:...` ❌
   - `Error:...` ❌

### Test dari Local

```bash
# Test dengan DATABASE_URL dari Railway
export DATABASE_URL="postgresql://..."
export PORT=3001
node server.js

# Di terminal lain:
curl http://localhost:3001/health
```

### Cek Railway Service URL

1. Railway Dashboard → Service → **Settings** → **Networking**
2. Copy **Public Domain**
3. Format: `https://csf-panel-dashboard-production.up.railway.app`

## Checklist

Setelah fix, pastikan:

- [ ] Service status: **"Active"** (green)
- [ ] Build logs: Tidak ada error
- [ ] Deploy logs: `[Railway Worker] Server running on port...`
- [ ] Environment variables: Semua required vars ada
- [ ] Health check: `curl /health` → 200 OK
- [ ] Wake endpoint: `curl /wake` → 200 OK
- [ ] Trigger endpoint: `curl -X POST /trigger` → 200 OK

## Still Not Working?

Jika masih 502 setelah semua fix:

1. **Cek Railway Status Page:**
   - https://status.railway.app
   - Pastikan tidak ada incident

2. **Cek Service Limits:**
   - Railway Dashboard → Project → **Usage**
   - Pastikan tidak exceed free tier limits

3. **Contact Support:**
   - Railway Dashboard → **Help** → **Support**
   - Atau email: support@railway.app

---

## Related Documentation

- **Railway Setup**: `docs/RAILWAY_SETUP.md`
- **Railway 502 Fix**: `docs/RAILWAY_502_FIX.md`
- **Railway Build Fix**: `docs/RAILWAY_BUILD_FIX.md`
