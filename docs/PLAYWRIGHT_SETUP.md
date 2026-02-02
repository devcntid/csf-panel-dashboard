# Playwright Setup Guide

## Overview
Aplikasi ini menggunakan Playwright untuk web scraping di route `/api/scrap`. Playwright memerlukan browser executables (Chromium) untuk berjalan.

## Installation

### Lokal Development
Browser Playwright akan diinstal otomatis setelah menjalankan:
```bash
npm install
# atau
yarn install
```

Script `postinstall` di `package.json` akan menjalankan:
```bash
npm run playwright:install
```

### Vercel Deployment
⚠️ **PENTING: Playwright tidak dapat berjalan di Vercel**

Vercel menggunakan Alpine Linux yang tidak memiliki `apt-get` untuk menginstal system dependencies yang dibutuhkan Chromium. Akibatnya:
- `/api/scrap` endpoint akan return error 503 di Vercel
- Scrap API hanya bisa dijalankan secara lokal

Jika Anda perlu scrap feature di production, gunakan alternative:
1. **Hosting lain**: Railway, Render, atau self-hosted yang support system dependencies
2. **Serverless Browser Service**: Browserless.io, ScraperAPI, Apify, atau Bright Data
3. **Local Runner**: Setup local machine/VPS untuk menjalankan scrap job secara scheduled

## Manual Installation
Jika perlu menginstal manual:
```bash
# Install Chromium browser dengan dependencies sistem
npx playwright install chromium --with-deps

# Atau install semua browsers
npx playwright install --with-deps
```

## Troubleshooting

### Error: "Executable doesn't exist"
**Penyebab:** Browser belum diinstal
**Solusi:**
```bash
npx playwright install chromium --with-deps
```

### Error saat di Vercel/Serverless: "apt-get: command not found"
**Penyebab:** Vercel environment tidak memiliki package manager untuk install system dependencies
**Solusi:** TIDAK ADA SOLUSI - Playwright tidak dapat berjalan di Vercel
- Endpoint `/api/scrap` akan return 503 error
- Gunakan alternative solutions (lihat bagian Vercel Deployment di atas)

### Memory Issues
Jika terjadi error OOM (Out of Memory):
```typescript
// Di app/api/scrap/route.ts
const browser = await chromium.launch({
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
  ],
  // Limit memory usage
  limitMemory: 512 * 1024 * 1024, // 512MB
})
```

## Performance Tips

1. **Reuse Browser Context**: Gunakan browser context yang sama untuk multiple pages
2. **Set Timeouts**: Selalu set timeout yang reasonable
```typescript
await page.goto(url, { timeout: 30000 })
await page.waitForSelector(selector, { timeout: 30000 })
```

3. **Close Resources**: Selalu tutup context dan browser
```typescript
await context.close()
await browser.close()
```

## Files Modified
- `package.json`: Ditambah `playwright:install` script dan `postinstall`
- `vercel.json`: Ditambah `buildCommand` untuk Vercel
- `app/api/scrap/route.ts`: Optimized `chromium.launch()` configuration

## Environment Variables
Tidak memerlukan env vars khusus untuk Playwright. Semua konfigurasi ada di kode.

## Resources
- [Playwright Documentation](https://playwright.dev)
- [Playwright System Requirements](https://playwright.dev/docs/library#system-requirements)
- [Vercel with Playwright](https://vercel.com/guides/vercel-with-playwright)
