# Opsi Bypass Cloudflare untuk Railway

## 🔍 Masalah
Cloudflare Turnstile challenge tidak bisa diselesaikan di Railway karena:
- IP address Railway mungkin sudah di-blacklist oleh Cloudflare
- Cloudflare mendeteksi headless browser di cloud environment
- Turnstile memerlukan JavaScript execution yang kompleks

## ✅ Solusi yang Bisa Dicoba

### 1. **Gunakan Proxy Service (Residential Proxy)**
**Rekomendasi: Bright Data, Smartproxy, atau Oxylabs**

**Cara implementasi:**
- Daftar ke salah satu proxy service
- Dapatkan proxy endpoint (HTTP/HTTPS)
- Konfigurasi di Railway environment variables:
  ```
  PROXY_URL=http://username:password@proxy-endpoint:port
  ```
- Modifikasi `scrap-github-queue.ts` untuk menggunakan proxy:
  ```typescript
  const context = await browser.newContext({
    proxy: {
      server: process.env.PROXY_URL,
    },
    // ... other config
  })
  ```

**Kelebihan:**
- ✅ IP address residential (tidak terdeteksi sebagai datacenter)
- ✅ Bisa rotate IP jika perlu
- ✅ Relatif mudah diimplementasikan

**Kekurangan:**
- ❌ Berbayar (biasanya $50-200/bulan)
- ❌ Perlu setup proxy credentials

---

### 2. **Gunakan Scraping Service (ScraperAPI, ScrapingBee)**
**Rekomendasi: ScraperAPI atau ScrapingBee**

**Cara implementasi:**
- Daftar ke ScraperAPI (ada free tier 1,000 requests/bulan)
- Dapatkan API key
- Modifikasi scraping untuk menggunakan API mereka:
  ```typescript
  // Instead of direct Playwright, use ScraperAPI
  const response = await fetch(
    `http://api.scraperapi.com?api_key=${API_KEY}&url=${URL_CLINIC}`
  )
  const html = await response.text()
  // Parse HTML dengan Cheerio atau Puppeteer
  ```

**Kelebihan:**
- ✅ Handle Cloudflare secara otomatis
- ✅ Ada free tier untuk testing
- ✅ Tidak perlu maintain browser

**Kekurangan:**
- ❌ Perlu rewrite scraping logic (tidak bisa pakai Playwright langsung)
- ❌ Mungkin lebih lambat
- ❌ Berbayar untuk production scale

---

### 3. **Gunakan Browser Automation Service (Browserless, ScrapingBee)**
**Rekomendasi: Browserless.io**

**Cara implementasi:**
- Daftar ke Browserless.io
- Dapatkan WebSocket endpoint
- Modifikasi Playwright untuk connect ke remote browser:
  ```typescript
  const browser = await chromium.connectOverCDP(
    `wss://chrome.browserless.io?token=${BROWSERLESS_TOKEN}`
  )
  ```

**Kelebihan:**
- ✅ Tetap bisa pakai Playwright
- ✅ Browser dijalankan di environment yang lebih "natural"
- ✅ Handle Cloudflare lebih baik

**Kekurangan:**
- ❌ Berbayar ($50-200/bulan)
- ❌ Perlu koneksi WebSocket yang stabil

---

### 4. **Gunakan VPN/Proxy di Railway (Wireguard, Shadowsocks)**
**Cara implementasi:**
- Setup VPN server (VPS dengan Wireguard)
- Install Wireguard client di Railway Dockerfile
- Connect ke VPN sebelum menjalankan scraping

**Kelebihan:**
- ✅ Kontrol penuh atas IP address
- ✅ Bisa pakai residential IP jika punya VPS

**Kekurangan:**
- ❌ Perlu setup dan maintain VPS sendiri
- ❌ Kompleks untuk diimplementasikan
- ❌ Biaya VPS + Railway

---

### 5. **Contact Cloudflare untuk Whitelist IP**
**Cara:**
- Contact support Cloudflare atau pemilik website (csf.eclinic.id)
- Minta whitelist IP address Railway
- Atau minta API access jika memungkinkan

**Kelebihan:**
- ✅ Solusi permanen jika disetujui
- ✅ Tidak perlu proxy/service tambahan

**Kekurangan:**
- ❌ Perlu approval dari pemilik website
- ❌ Tidak selalu memungkinkan
- ❌ Perlu maintain whitelist jika IP Railway berubah

---

### 6. **Gunakan Undetected ChromeDriver atau Playwright Extra**
**Library: `playwright-extra` dengan `puppeteer-extra-plugin-stealth`**

**Cara implementasi:**
```bash
pnpm add playwright-extra puppeteer-extra-plugin-stealth
```

```typescript
import playwright from 'playwright-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'

playwright.use(StealthPlugin())

const browser = await playwright.chromium.launch({
  // ... config
})
```

**Kelebihan:**
- ✅ Gratis
- ✅ Mudah diimplementasikan
- ✅ Tetap pakai Playwright

**Kekurangan:**
- ❌ Mungkin masih terdeteksi di Railway (karena IP)
- ❌ Tidak guarantee 100% bypass

---

## 🎯 Rekomendasi Berdasarkan Prioritas

### **Opsi 1: ScraperAPI (Paling Mudah)**
- ✅ Free tier untuk testing
- ✅ Handle Cloudflare otomatis
- ✅ Tidak perlu maintain browser
- ⚠️ Perlu rewrite scraping logic sedikit

### **Opsi 2: Residential Proxy (Paling Reliable)**
- ✅ IP residential tidak terdeteksi
- ✅ Tetap pakai Playwright
- ✅ Bisa rotate IP
- ⚠️ Berbayar ($50-200/bulan)

### **Opsi 3: Browserless.io (Balance)**
- ✅ Tetap pakai Playwright
- ✅ Handle Cloudflare lebih baik
- ✅ Tidak perlu maintain browser
- ⚠️ Berbayar ($50-200/bulan)

---

## 📝 Implementasi Cepat: ScraperAPI

### Step 1: Daftar ScraperAPI
1. Kunjungi https://www.scraperapi.com/
2. Daftar (free tier: 1,000 requests/bulan)
3. Dapatkan API key

### Step 2: Setup Environment Variable
```bash
# Railway
SCRAPERAPI_KEY=your_api_key_here
```

### Step 3: Modifikasi Scraping
Gunakan ScraperAPI untuk fetch HTML, lalu parse dengan Playwright atau Cheerio.

**Alternatif:** Tetap pakai Playwright tapi dengan proxy dari ScraperAPI:
```typescript
const context = await browser.newContext({
  proxy: {
    server: `http://scraperapi:${SCRAPERAPI_KEY}@proxy.scraperapi.com:8001`,
  },
})
```

---

## 💡 Tips Tambahan

1. **Test dulu dengan free tier** sebelum commit ke paid plan
2. **Monitor usage** untuk avoid unexpected costs
3. **Consider rate limiting** untuk avoid detection
4. **Cache hasil** jika memungkinkan untuk reduce requests
5. **Use retry mechanism** dengan exponential backoff

---

## 🔗 Links

- **ScraperAPI**: https://www.scraperapi.com/
- **Bright Data**: https://brightdata.com/
- **Browserless**: https://www.browserless.io/
- **Playwright Extra**: https://github.com/berstend/puppeteer-extra
