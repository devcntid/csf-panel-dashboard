# Browserless.io Setup

## Overview

Browserless.io digunakan untuk bypass Cloudflare detection dengan menjalankan browser di environment yang lebih "natural" dan tidak terdeteksi sebagai datacenter IP.

## Setup

### 1. Dapatkan API Key

API Key sudah tersedia:
```
2TuRSBEFBqFVWUv457ef08e5084da6e2507d1f52ecdfeadb7
```

### 2. Set Environment Variable di Railway

Di Railway Dashboard → Service `scrap-queue-worker` → **Variables** tab, tambahkan:

```
BROWSERLESS_TOKEN=2TuRSBEFBqFVWUv457ef08e5084da6e2507d1f52ecdfeadb7
```

### 3. Cara Kerja

Script akan otomatis:
- **Jika `BROWSERLESS_TOKEN` ada**: Connect ke Browserless.io WebSocket endpoint
- **Jika `BROWSERLESS_TOKEN` tidak ada**: Fallback ke local browser (seperti sebelumnya)

### 4. Logs

Saat menggunakan Browserless, Anda akan melihat log:
```
[v0] 🌐 Connecting to Browserless.io...
[v0] ✅ Connected to Browserless.io
```

Saat menggunakan local browser:
```
[v0] 🖥️  Launching local browser...
[v0] ✅ Local browser launched
```

## Keuntungan Browserless.io

1. ✅ **IP Address**: Browserless menggunakan IP yang lebih "natural" (tidak terdeteksi sebagai datacenter)
2. ✅ **Cloudflare Bypass**: Lebih mudah bypass Cloudflare Turnstile challenge
3. ✅ **Tetap Pakai Playwright**: Tidak perlu rewrite scraping logic
4. ✅ **Reliability**: Browser dijalankan di environment yang lebih stabil

## Troubleshooting

### Connection Error
Jika ada error connection ke Browserless:
- Cek API key sudah benar
- Cek koneksi internet Railway ke Browserless
- Cek quota Browserless (jika ada limit)

### Fallback ke Local Browser
Jika Browserless tidak tersedia, script akan otomatis fallback ke local browser. Pastikan Playwright sudah terinstall di Railway.

## Monitoring

Monitor usage di Browserless dashboard:
- https://www.browserless.io/dashboard

Cek:
- Total sessions
- Total minutes used
- Quota remaining

## Cost

Browserless.io pricing:
- Free tier: Limited
- Paid plans: Mulai dari $50/bulan

Pastikan monitor usage untuk avoid unexpected costs.
