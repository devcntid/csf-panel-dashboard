# Optimasi untuk Railway Free Tier

## Overview

Railway Free tier memiliki limit **500 hours/month**, sedangkan service always-on membutuhkan ~730 hours/month. Optimasi ini mengurangi usage hours dengan implementasi auto-sleep dan wake mechanism.

## Strategi Optimasi

### 1. Auto-Sleep Setelah Idle

Service akan log idle status setelah 5 menit tidak ada aktivitas:
- Check idle setiap 1 menit
- Log warning jika idle > 5 menit
- Railway akan auto-sleep service yang idle (jika supported)

### 2. Wake via HTTP Request

Service akan wake otomatis saat ada HTTP request:
- External cron akan wake service sebelum scraping
- Vercel trigger akan wake service untuk insidental scraping
- Health check endpoint juga wake service

### 3. Endpoint untuk Wake

**GET `/wake`**
- Wake service sebelum scraping
- Bisa dipanggil oleh external cron
- Update `lastRequestTime` untuk reset idle timer

**GET `/health`**
- Health check + wake service
- Return idle time dan status

## Setup External Cron untuk Wake

### Opsi A: cron-job.org (Recommended)

1. Daftar di https://cron-job.org (free)
2. Create new cron job:
   - **Name**: `Wake Railway Service`
   - **URL**: `https://<railway-service-url>/wake`
   - **Schedule**: Setiap 30 menit, 5 menit sebelum scraping
     - Contoh: Scraping jam 08:00, wake jam 07:55
     - Pattern: `55 7-20 * * 1-6` (07:55-20:55, Senin-Sabtu)
   - **Method**: GET
   - **Headers**: (kosong)

3. Create cron job kedua untuk trigger scraping:
   - **Name**: `Trigger Scrap Queue`
   - **URL**: `https://<railway-service-url>/trigger`
   - **Schedule**: `*/30 1-14 * * 1-6` (setiap 30 menit, 01:00-14:00 UTC)
   - **Method**: POST
   - **Body** (JSON):
     ```json
     {"isCron":true}
     ```
   - **Headers**: `Content-Type: application/json`

### Opsi B: Railway Cron (Jika Tersedia)

1. Railway Dashboard → Project → **"New"** → **"Cron Job"**
2. **Name**: `wake-service`
3. **Schedule**: `55 7-20 * * 1-6` (5 menit sebelum scraping)
4. **Command**:
   ```bash
   curl https://<railway-service-url>/wake
   ```

## Environment Variables

Tambahkan di Railway Dashboard → Service → Variables:

```
IDLE_TIMEOUT=300000
```

- Default: `300000` (5 menit dalam milliseconds)
- Bisa disesuaikan: `600000` (10 menit) untuk lebih hemat

## Estimasi Usage Hours

### Sebelum Optimasi
- Always-on: ~730 hours/month
- Status: ⚠️ Melebihi limit (500 hours)

### Setelah Optimasi
- Wake sebelum scraping: ~2-3 hours/month (wake calls)
- Scraping execution: ~50-100 hours/month (6 klinik × 30 menit × 13 jam × 6 hari)
- Idle time: ~100-150 hours/month (service idle antara scraping)
- **Total: ~150-250 hours/month**
- Status: ✅ Masih dalam limit (500 hours)

## Monitoring

### Cek Idle Time

```bash
curl https://<railway-service-url>/health
```

Response:
```json
{
  "status": "ok",
  "processing": false,
  "idleTime": 120,
  "idleTimeout": 300
}
```

### Cek Railway Usage

1. Railway Dashboard → Project → **Usage**
2. Cek **Compute Hours** per bulan
3. Pastikan masih di bawah 500 hours

## Troubleshooting

### Problem: Service tidak wake saat ada request

**Solusi:**
1. Cek Railway Dashboard → Service → Status
2. Pastikan service status "Running" (bukan "Sleeping")
3. Railway Free tier mungkin tidak support auto-sleep/wake
4. Solusi: Upgrade ke Railway Hobby ($5/month) untuk reliable sleep/wake

### Problem: Usage hours masih tinggi

**Solusi:**
1. Cek apakah external cron wake bekerja
2. Pastikan service sleep setelah idle (cek logs)
3. Pertimbangkan upgrade ke Railway Hobby untuk better control

### Problem: Scraping gagal karena service sleep

**Solusi:**
1. Pastikan external cron wake service **5 menit sebelum** scraping
2. Test wake endpoint: `curl https://<railway-url>/wake`
3. Cek logs untuk confirm service wake

## Best Practices

1. **Wake sebelum scraping**: External cron wake service 5 menit sebelum scraping
2. **Monitor usage**: Cek Railway usage setiap minggu
3. **Adjust idle timeout**: Jika usage masih tinggi, kurangi `IDLE_TIMEOUT`
4. **Upgrade jika perlu**: Jika usage konsisten > 400 hours, pertimbangkan Railway Hobby

## Related Files

- `server.js` - Worker server dengan auto-sleep logic
- `docs/RAILWAY_SETUP.md` - Setup lengkap Railway
- `docs/RAILWAY_BUILD_FIX.md` - Build configuration
