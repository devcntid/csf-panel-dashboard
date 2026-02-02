# Fix Railway Build Error: Python Not Found

## Problem

Railway build gagal dengan error:
```
gyp ERR! find Python Python is not set from command line or npm configuration
gyp ERR! find Python You need to install the latest version of Python.
```

Error ini terjadi karena beberapa native dependencies (`better-sqlite3`, `libpq`) memerlukan Python untuk compile, tapi Railway build environment tidak include Python secara default.

## Solution

Kita sudah menambahkan file `nixpacks.toml` yang menginstruksikan Railway untuk install Python dan build tools sebelum install dependencies.

### File yang Ditambahkan/Dimodifikasi

1. **`nixpacks.toml`** (NEW)
   - Konfigurasi untuk install Python 3, pip, gcc, dan make
   - Setup Node.js 18
   - Install dependencies dengan `pnpm install --frozen-lockfile`

2. **`railway.json`** (UPDATED)
   - Disederhanakan, karena build command sekarang di-handle oleh `nixpacks.toml`

## Verifikasi

Setelah commit dan push, Railway akan:
1. Detect `nixpacks.toml`
2. Install Python 3 dan build tools
3. Install Node.js dependencies (termasuk native modules yang perlu compile)
4. Deploy service

## Testing

1. Commit perubahan:
   ```bash
   git add nixpacks.toml railway.json
   git commit -m "fix: add Python and build tools for Railway native dependencies"
   git push
   ```

2. Cek Railway Dashboard → Service → Deployments
3. Pastikan build sukses (tidak ada error Python)

## Alternative Solution (Jika Masih Error)

Jika masih error, bisa set environment variable di Railway:

1. Railway Dashboard → Service → Variables
2. Tambahkan:
   ```
   NIXPACKS_PYTHON_VERSION=3.11
   ```

Atau gunakan Dockerfile custom (lebih kompleks tapi lebih kontrol).

## Related Files

- `nixpacks.toml` - Nixpacks configuration
- `railway.json` - Railway service configuration
- `server.js` - Worker server entry point
