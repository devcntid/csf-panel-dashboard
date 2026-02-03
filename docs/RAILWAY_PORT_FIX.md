# Fix Railway Port Mismatch (502 Error)

## Problem

Railway service mengembalikan **502 Bad Gateway** karena **port mismatch**:
- Railway Settings menunjukkan port **8080**
- Environment variable `PORT=3001`
- Server listen ke port 3001, tapi Railway routing ke port 8080

## Root Cause

Railway **auto-assigns** PORT via environment variable. Jika kita set `PORT=3001` manual di env vars, tapi Railway routing ke port lain (misalnya 8080), maka akan terjadi mismatch.

## Solution

### Step 1: Hapus PORT dari Environment Variables

1. Buka **Railway Dashboard** → Service → **Variables**
2. Cari variable `PORT`
3. **Hapus** variable `PORT` (biarkan Railway auto-assign)
4. Railway akan otomatis set `PORT` env var saat service start

### Step 2: Verifikasi Railway Auto-Assign PORT

Railway akan otomatis:
1. Assign port untuk service (bisa 8080, 3000, atau port lain)
2. Set `PORT` environment variable dengan port yang di-assign
3. Server.js akan membaca `process.env.PORT` dan listen ke port tersebut

### Step 3: Redeploy Service

1. Railway Dashboard → Service → **Deployments**
2. Klik **"..."** → **"Redeploy"**
3. Atau push commit baru ke GitHub

### Step 4: Verifikasi

Setelah redeploy, cek logs:

1. **Deploy Logs** harus menunjukkan:
   ```
   [Railway Worker] Starting server...
   [Railway Worker] PORT from env: 8080
   [Railway Worker] Using PORT: 8080
   [Railway Worker] Server running on port 8080
   ```

2. **Test endpoint:**
   ```bash
   curl https://csf-panel-dashboard-production.up.railway.app/health
   ```

   **Expected:**
   ```json
   {"status":"ok","processing":false,"idleTime":0,"idleTimeout":300}
   ```

## Important Notes

### ✅ DO (Yang Harus Dilakukan)

1. **Biarkan Railway auto-assign PORT**
   - Jangan set `PORT` manual di env vars
   - Railway akan otomatis set `PORT` saat service start

2. **Server.js sudah benar**
   - `const PORT = process.env.PORT || 3001`
   - Akan menggunakan PORT dari Railway jika ada
   - Default ke 3001 hanya untuk local development

3. **Listen ke 0.0.0.0**
   - `server.listen(PORT, '0.0.0.0', ...)`
   - Agar accessible dari luar container

### ❌ DON'T (Yang Jangan Dilakukan)

1. **Jangan set PORT manual di Railway env vars**
   - Railway akan auto-assign PORT
   - Setting manual bisa menyebabkan mismatch

2. **Jangan hardcode port di server.js**
   - Selalu gunakan `process.env.PORT`
   - Railway akan set PORT otomatis

## Verification Checklist

Setelah fix:

- [ ] Variable `PORT` **DIHAPUS** dari Railway env vars
- [ ] Service di-redeploy
- [ ] Deploy logs menunjukkan: `[Railway Worker] Server running on port...`
- [ ] Port di logs **SAMA** dengan port di Railway Settings
- [ ] Health check: `curl /health` → 200 OK
- [ ] Wake endpoint: `curl /wake` → 200 OK
- [ ] Trigger endpoint: `curl -X POST /trigger` → 200 OK

## Troubleshooting

### Jika masih 502 setelah hapus PORT:

1. **Cek Railway Settings → Networking:**
   - Port yang ditampilkan di Settings
   - Pastikan sama dengan PORT di deploy logs

2. **Cek Deploy Logs:**
   - Harus ada: `[Railway Worker] Server running on port...`
   - Jika tidak ada, server tidak start (cek error di logs)

3. **Cek Environment Variables:**
   - Pastikan `DATABASE_URL` ada dan valid
   - Pastikan tidak ada variable lain yang conflict

---

## Related Documentation

- **Railway Setup**: `docs/RAILWAY_SETUP.md`
- **Railway 502 Fix**: `docs/RAILWAY_502_FIX.md`
- **Railway Troubleshooting**: `docs/RAILWAY_TROUBLESHOOTING.md`
