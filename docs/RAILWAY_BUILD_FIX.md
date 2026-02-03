# Fix Railway Build Error: Python Not Found

## Problem

Railway build gagal dengan error:
```
gyp ERR! find Python Python is not set from command line or npm configuration
gyp ERR! find Python You need to install the latest version of Python.
```

Error ini terjadi karena beberapa native dependencies (`better-sqlite3`, `libpq`) memerlukan Python untuk compile, tapi Railway build environment tidak include Python secara default.

## Solution

Kita menggunakan **Dockerfile** sebagai gantinya karena lebih reliable dan mudah di-debug dibanding Nixpacks.

### File yang Ditambahkan/Dimodifikasi

1. **`Dockerfile`** (NEW)
   - Base image: `node:18-alpine` (ringan dan cepat)
   - Install Python 3, gcc, g++, make, libc-dev untuk compile native dependencies
   - Install pnpm globally
   - Install dependencies dengan `pnpm install --frozen-lockfile`
   - Start server dengan `node server.js`

2. **`railway.json`** (UPDATED)
   - Builder diubah dari `NIXPACKS` ke `DOCKERFILE`
   - Dockerfile path: `Dockerfile`

3. **`nixpacks.toml`** (DELETED)
   - Dihapus karena menggunakan Dockerfile sebagai gantinya

## Verifikasi

Setelah commit dan push, Railway akan:
1. Detect `Dockerfile`
2. Build Docker image dengan Python 3 dan build tools
3. Install Node.js dependencies (termasuk native modules yang perlu compile)
4. Deploy service

## Testing

1. Commit perubahan:
   ```bash
   git add Dockerfile railway.json
   git rm nixpacks.toml
   git commit -m "fix: use Dockerfile instead of Nixpacks for Railway build"
   git push
   ```

2. Cek Railway Dashboard → Service → Deployments
3. Pastikan build sukses (tidak ada error Python atau npm)

## Keuntungan Dockerfile vs Nixpacks

✅ **Dockerfile:**
- Lebih mudah di-debug
- Format standar dan familiar
- Full control atas build process
- Tidak ada masalah dengan package names
- Lebih cepat build (Alpine Linux ringan)

❌ **Nixpacks:**
- Format kurang familiar
- Package names harus exact match dengan Nix
- Lebih sulit di-debug jika error
- Terkadang auto-detect tidak bekerja dengan baik

## Related Files

- `Dockerfile` - Docker build configuration
- `railway.json` - Railway service configuration
- `server.js` - Worker server entry point
