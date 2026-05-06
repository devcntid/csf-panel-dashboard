# Panduan Sync Chrome Extension → CSF Panel API

## Endpoint

```
POST /api/transactions/insert
```

## Payload

```json
{
  "clinic_id": 1,
  "transaction_data": [
    {
      "trx_no": "NT-0000053454",
      "trx_date": "2026-05-06",
      "erm_no": "1000000000284897",
      "patient_name": "NURUL HARIYANTI",
      "insurance_type": "Umum",
      "polyclinic": "POLI UMUM",
      "payment_method": "TUNAI",
      "voucher_code": "-",
      "bill_action": 250000,
      "bill_total": 250000,
      "bill_action_discount": 75000,
      "paid_action": 175000,
      "paid_discount": 75000,
      "paid_total": 175000
    }
  ]
}
```

## Aturan Penting

### 1. `payment_method` WAJIB diisi

Field `payment_method` sekarang menjadi bagian dari kunci unik (UNIQUE constraint) di database:

```
UNIQUE (clinic_id, trx_no, trx_date, erm_no, payment_method)
```

Jika `payment_method` kosong/tidak ada, backend akan menyimpan sebagai string kosong `""` dan semua transaksi tanpa payment_method akan dianggap satu baris yang sama.

### 2. Multi-Payment (TUNAI + QRIS)

Untuk transaksi dengan 2 metode pembayaran, kirim **2 kali hit terpisah** — masing-masing dengan `payment_method` yang berbeda:

**Hit 1:**
```json
{
  "clinic_id": 1,
  "transaction_data": [{
    "trx_no": "NT-0000053454",
    "erm_no": "1000000000284897",
    "trx_date": "2026-05-06",
    "payment_method": "TUNAI",
    "paid_total": 100000
  }]
}
```

**Hit 2:**
```json
{
  "clinic_id": 1,
  "transaction_data": [{
    "trx_no": "NT-0000053454",
    "erm_no": "1000000000284897",
    "trx_date": "2026-05-06",
    "payment_method": "QRIS",
    "paid_total": 75000
  }]
}
```

Ini akan menghasilkan **2 baris** di database (benar).

### 3. Re-sync / Double Hit → Idempoten

Jika Chrome Extension mengirim payload yang sama 2x (karena retry, double-click, dll), backend akan **UPDATE** baris yang sudah ada, bukan membuat duplikat.

Kunci idempoten: `clinic_id + trx_no + trx_date + erm_no + payment_method`

### 4. `trx_line_no` — Tidak Perlu Dikirim

Field `trx_line_no` masih ada di database tapi **bukan** bagian dari UNIQUE constraint lagi. Backend akan mengisinya otomatis (default = 1). Tidak perlu disertakan di payload.

## Best Practice di Sisi Extension

### Hindari Double-Hit

```javascript
let isSyncing = false;

async function syncTransaction(payload) {
  if (isSyncing) return; // cegah double-hit
  isSyncing = true;
  try {
    const res = await fetch('/api/transactions/insert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return await res.json();
  } finally {
    isSyncing = false;
  }
}
```

### Atau gunakan debounce

```javascript
function debounce(fn, ms = 2000) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

const debouncedSync = debounce(syncTransaction, 2000);
```

### Pastikan `payment_method` selalu terisi

```javascript
const payload = {
  clinic_id: clinicId,
  transaction_data: items.map(item => ({
    ...item,
    payment_method: item.payment_method || 'TUNAI', // fallback
  })),
};
```

## Response

```json
{
  "success": true,
  "message": "1 transaksi berhasil diproses (0 baru, 1 duplikat diperbarui)",
  "inserted_count": 1,
  "new_transactions": 0,
  "duplicate_updates": 1
}
```
