# Perbedaan Performance: Playwright Local vs Railway

## 🔍 Analisis Masalah

### Kenapa di Local Cepat, di Railway Lambat?

**Local Laptop:**
- ✅ CPU: Multi-core, high frequency
- ✅ Memory: 8-16GB+ RAM
- ✅ Network: Direct connection, low latency
- ✅ Storage: SSD cepat
- ✅ Browser: Native, tidak ada overhead containerization

**Railway (Free/Starter Tier):**
- ⚠️ CPU: Shared, limited cores
- ⚠️ Memory: 512MB-1GB RAM (sangat terbatas)
- ⚠️ Network: Cloud network, bisa lebih lambat
- ⚠️ Storage: Container filesystem (lebih lambat)
- ⚠️ Browser: Running di container, ada overhead

---

## 🎯 Perbedaan yang Mempengaruhi Performance

### 1. CPU & Memory Constraints

**Local:**
```
CPU: 4-8 cores, 2.5-3.5 GHz
Memory: 8-16GB RAM
→ Browser bisa jalan dengan full resources
```

**Railway Free Tier:**
```
CPU: Shared, ~0.5-1 core
Memory: 512MB-1GB RAM
→ Browser terbatas, bisa swap ke disk (sangat lambat)
```

**Impact:**
- Cloudflare challenge butuh JavaScript execution
- Limited CPU = JavaScript execution lambat
- Limited memory = Browser bisa crash atau sangat lambat

### 2. Network Latency

**Local:**
```
Direct connection ke website
Latency: ~10-50ms
→ Cloudflare challenge cepat selesai
```

**Railway:**
```
Cloud network → Internet → Website
Latency: ~100-300ms (bisa lebih)
→ Cloudflare challenge butuh waktu lebih lama
```

**Impact:**
- Network latency mempengaruhi Cloudflare challenge
- Multiple round-trips untuk challenge = lebih lama

### 3. Cloudflare Detection

**Local:**
- IP address: Residential/ISP (kurang suspicious)
- Browser fingerprint: Native browser (kurang suspicious)
- Network pattern: Normal user pattern

**Railway:**
- IP address: Datacenter/Cloud (lebih suspicious)
- Browser fingerprint: Headless browser di container (lebih suspicious)
- Network pattern: Automated pattern

**Impact:**
- Cloudflare lebih ketat untuk datacenter IP
- Challenge lebih kompleks dan butuh waktu lebih lama
- Bisa di-block jika terlalu banyak request

### 4. Container Overhead

**Local:**
- Browser jalan langsung di OS
- Tidak ada virtualization overhead

**Railway:**
- Browser jalan di Docker container
- Ada overhead dari containerization
- Resource isolation bisa impact performance

---

## 📊 Perbandingan Performance

### Local Laptop (Typical)

```
Page load: ~2-3 detik
Cloudflare challenge: ~3-5 detik
Total: ~5-8 detik
```

### Railway Free Tier

```
Page load: ~5-10 detik
Cloudflare challenge: ~15-60 detik (atau timeout)
Total: ~20-70 detik (atau gagal)
```

**Kenapa lebih lambat:**
1. Limited CPU → JavaScript execution lambat
2. Limited memory → Browser swap ke disk
3. Network latency → Multiple round-trips
4. Cloudflare detection → Challenge lebih kompleks

---

## 🔧 Solusi untuk Improve Performance di Railway

### 1. Optimize Browser Launch Args

**Current:**
```javascript
browser = await chromium.launch({
  headless: true,
  slowMo: 500,
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--single-process',
  ],
})
```

**Optimized:**
```javascript
browser = await chromium.launch({
  headless: true,
  slowMo: 100, // Kurangi dari 500 ke 100
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-software-rasterizer',
    '--disable-extensions',
    '--disable-background-networking',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
    '--disable-ipc-flooding-protection',
    '--memory-pressure-off', // Penting untuk Railway
    '--max_old_space_size=512', // Limit memory usage
  ],
})
```

### 2. Optimize Resource Blocking

**Current:**
```javascript
// Block semua images, fonts, dll
await page.route('**/*.{png,jpg,jpeg,gif,svg,woff,woff2,ttf}', ...)
```

**Optimized:**
```javascript
// Block lebih agresif, tapi jangan block JS/CSS yang penting
await page.route('**/*.{png,jpg,jpeg,gif,svg,woff,woff2,ttf,css}', (route) => {
  route.abort()
})
// Tapi allow JavaScript karena Cloudflare perlu JS
```

### 3. Increase Timeout untuk Cloudflare

**Current:**
```javascript
maxAttempts = 30 // 30 detik
```

**Optimized:**
```javascript
maxAttempts = 90 // 90 detik (sudah di-update)
```

### 4. Use Stealth Mode (Optional)

Install `playwright-extra` dengan `puppeteer-extra-plugin-stealth`:

```bash
pnpm add playwright-extra puppeteer-extra-plugin-stealth
```

**Tapi ini bisa consume lebih banyak memory!**

### 5. Upgrade Railway Plan (Jika Masih Lambat)

**Free Tier:**
- 512MB RAM
- Shared CPU
- Limited resources

**Starter Plan ($5/month):**
- 2GB RAM
- Dedicated CPU
- Better performance

---

## 🎯 Rekomendasi

### Short-term (Free)

1. ✅ **Optimize browser args** (reduce memory usage)
2. ✅ **Increase Cloudflare wait time** (90 detik)
3. ✅ **Better error handling** (sudah di-update)
4. ✅ **Optimize resource blocking**

### Long-term (Jika Masih Lambat)

1. **Upgrade Railway Plan:**
   - Starter: $5/month → 2GB RAM, dedicated CPU
   - Better performance untuk Playwright

2. **Alternative: Use Proxy Service:**
   - Residential proxy untuk bypass Cloudflare
   - Tapi ini cost tambahan

3. **Alternative: Use Stealth Mode:**
   - `playwright-extra` dengan stealth plugin
   - Tapi consume lebih banyak memory

---

## 📊 Expected Performance After Optimization

### Railway Free Tier (After Optimization)

```
Page load: ~5-8 detik (improved)
Cloudflare challenge: ~20-40 detik (improved)
Total: ~25-50 detik (masih lebih lambat dari local, tapi acceptable)
```

### Railway Starter Plan ($5/month)

```
Page load: ~3-5 detik
Cloudflare challenge: ~10-20 detik
Total: ~15-25 detik (mendekati local performance)
```

---

## 🔍 Monitoring

### Cek Resource Usage

```bash
# Di Railway logs, cek:
- Memory usage
- CPU usage
- Network latency
```

### Cek Performance Metrics

```sql
-- Cek average execution time
SELECT 
  clinic_id,
  AVG(EXTRACT(EPOCH FROM (completed_at - started_at))) as avg_seconds,
  MIN(EXTRACT(EPOCH FROM (completed_at - started_at))) as min_seconds,
  MAX(EXTRACT(EPOCH FROM (completed_at - started_at))) as max_seconds,
  COUNT(*) as total_runs
FROM scrap_queue
WHERE status = 'completed'
  AND requested_by = 'cron'
  AND completed_at > NOW() - INTERVAL '7 days'
GROUP BY clinic_id
ORDER BY avg_seconds DESC;
```

---

## 💡 Tips

1. **Monitor Railway Usage:**
   - Railway Dashboard → Metrics
   - Cek memory dan CPU usage
   - Jika sering > 80%, consider upgrade

2. **Optimize Concurrent Processing:**
   - Jangan process terlalu banyak parallel
   - Sequential lebih aman untuk free tier

3. **Cache Browser Instance (Advanced):**
   - Reuse browser context jika mungkin
   - Tapi ini complex dan bisa memory leak

4. **Use Headless: false (Testing Only):**
   - Untuk debugging, bisa set `headless: false`
   - Tapi ini consume lebih banyak resources

---

## 📚 Related Documentation

- **Railway Setup**: `docs/RAILWAY_SETUP.md`
- **Railway Troubleshooting**: `docs/RAILWAY_TROUBLESHOOTING.md`
- **Scrap Flow**: `docs/SCRAP_FLOW_EXPLANATION.md`
