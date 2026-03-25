# Dokumentasi API – API KI Zains v2

Dokumentasi lengkap untuk semua endpoint API, aturan authentikasi, konfigurasi multi-database, tabel yang terlibat, dan contoh query raw.

---

## 1. Arsitektur Multi-Database

API ini **multi-database**: satu aplikasi melayani banyak entitas (mis. CSF, IJF, FIL), masing-masing dengan database MySQL terpisah. Connection default per request ditentukan oleh **API key** yang dikirim di header.

### 1.1 Koneksi Database

Daftar koneksi didefinisikan di `config/database.php`:

| Connection   | Env (nama DB)   | Keterangan        |
|-------------|-----------------|-------------------|
| `zains`     | `DB_ZAINS`      | DB pusat; dipakai untuk **authentikasi** (tabel `admin_entitas`) |
| `zains_fil` | `DB_FIL`        | Database entitas FIL |
| `zains_csf` | `DB_CSF`        | Database entitas CSF |
| `zains_ijf` | `DB_IJF`        | Database entitas IJF |
| `zains_pac` | `DB_ACF`        | Database entitas PAC |
| `zains_kspps` | `DB_KSPPS`    | Database entitas KSPPS |
| `zains_rw`  | `DB_RW`         | Database entitas RW |
| `zains_sh`  | `DB_SH`         | Database entitas SH (env: `HOST_CS2`, `PORT_CS2`, `USERNAME_SH`, `PASSWORD_SH`) |
| `zains_harfa`, `zains_dsmbali`, `zains_itqan`, `zains_lauzfi` | `DB_HARFA`, dll. | DB eksternal (env: `HOST_EKSTERNAL`, `USERNAME_EKSTERNAL`, `PASSWORD_EKSTERNAL`) |
| `rumahwakaf.org` | `DB_WAQAF`   | PostgreSQL (env: `HOST_WAQAF`, `USERNAME_WAKAF`, `PASSWORD_WAKAF`) |

Semua koneksi MySQL (kecuali yang eksternal) memakai env umum: `HOST_DB`, `PORT_DB`, `USER_DB`, `PASS_DB`, `DB_CHARSET`, `DB_COLLATION`.

### 1.2 Authentikasi API Key dan Penanda Entitas

- **Sumber API key**: Database **`zains`** (bukan database entitas), tabel **`admin_entitas`**, kolom **`apikey`**.
- Model `App\Models\Setting\AdminEntitas` memakai `protected $connection = 'zains'` sehingga lookup API key selalu ke DB `zains`.
- Setiap baris di `admin_entitas` punya:
  - `id_entitas` (mis. `CSF`, `IJF`)
  - `apikey` (nilai yang dikirim di header)
- Alur request yang memakai API key:
  1. Header **`Authorization`** dibaca.
  2. Nilainya dicocokkan dengan kolom `apikey` di tabel `admin_entitas` (connection `zains`).
  3. Jika cocok, **connection default** diset ke **`zains_` + `id_entitas`** (lowercase), mis. `zains_csf`.
  4. Semua query berikutnya (transaksi, donatur, COA, dll.) memakai database entitas tersebut.

**Kesimpulan**: **API key sekaligus penanda entitas**. Satu API key = satu entitas (satu database). Setiap entitas (client) memakai API key-nya sendiri; request otomatis mengarah ke DB yang benar.

### 1.3 Variabel Environment (referensi)

Variabel yang dipakai untuk konfigurasi database (lihat juga `.env.example` dan `config/database.php`):

```env
# Umum (koneksi utama & entitas)
HOST_DB=
PORT_DB=
USER_DB=
PASS_DB=
DB_ZAINS=
DB_FIL=
DB_CSF=
DB_IJF=
DB_ACF=
DB_KSPPS=
DB_RW=
DB_CHARSET=utf8mb4
DB_COLLATION=utf8mb4_unicode_ci

# Entitas SH (server lain)
HOST_CS2=
PORT_CS2=
DB_SH=
USERNAME_SH=
PASSWORD_SH=

# DB eksternal (harfa, dsmbali, itqan, lauzfi)
HOST_EKSTERNAL=
PORT_EKSTERNAL=
USERNAME_EKSTERNAL=
PASSWORD_EKSTERNAL=
DB_HARFA=
DB_DSMBALI=
DB_ITQAN=
DB_LAUZFI=

# Waqaf (PostgreSQL)
HOST_WAQAF=
PORT_WAQAF=
DB_WAQAF=
USERNAME_WAKAF=
PASSWORD_WAKAF=
```

---

## 2. Aturan Authentikasi

### 2.1 Endpoint Tanpa API Key

Tidak perlu header `Authorization`:

- **GET** `/api/` — info welcome.
- **POST** `/api/setting/apikey` — body: `id_entitas`; mengembalikan API key dari `zains.admin_entitas`.
- **GET** `/api/setting/program` — daftar program (tanpa middleware API key).
- **GET** `/api/setting/setting-object` — daftar setting object (tanpa middleware API key).
- **GET** `/api/corez/{entitas}/transaksi/print/{id_donatur}/{tgl_transaksi}/{donatur}` — print kwitansi; **entitas dari path** (`{entitas}`), DB = `zains_` + entitas (middleware `MultitenantMiddleware`).

### 2.2 Endpoint Dengan API Key

Semua route di bawah `Route::group(['middleware' => ApiKeyAuthMiddleware::class])` membutuhkan header:

```http
Authorization: <nilai apikey dari admin_entitas>
```

Setelah valid, connection default = `zains_` + `id_entitas` (lowercase). Response error:

- **401 Unauthorized** — header `Authorization` tidak ada.
- **401 Invalid token** — nilai header tidak ditemukan di `admin_entitas.apikey`.

---

## 3. Daftar Endpoint (ringkas)

| Method | Path | Auth | Kegunaan |
|--------|------|------|----------|
| GET | `/api/` | - | Welcome message |
| POST | `/api/setting/apikey` | - | Ambil API key by `id_entitas` (DB zains) |
| GET | `/api/setting/program` | - | Daftar program (tanpa API key) |
| GET | `/api/setting/setting-object` | - | Daftar setting object |
| GET | `/api/corez/{entitas}/transaksi/print/{id_donatur}/{tgl_transaksi}/{donatur}` | Path entitas | Download PDF kwitansi transaksi |
| GET | `/api/hcm/karyawan` | API key | Daftar karyawan aktif |
| POST | `/api/hcm/karyawan/save` | API key | Tambah karyawan |
| PUT | `/api/hcm/karyawan/{id}` | API key | Update karyawan |
| GET | `/api/hcm/karyawan/validasi` | API key | Cek email karyawan |
| GET | `/api/hcm/kantor` | API key | Daftar kantor (paging, filter terms/aktif) |
| GET | `/api/setting/contact` | API key | Daftar contact |
| POST | `/api/setting/contact/save` | API key | Tambah contact |
| GET | `/api/setting/bank` | API key | Daftar bank/rekening |
| GET | `/api/setting/program` | API key | Daftar program |
| GET | `/api/setting/campaign` | API key | Daftar campaign aktif |
| POST | `/api/setting/campaign/save` | API key | Tambah campaign |
| GET | `/api/setting/coa` | API key | Daftar COA |
| GET | `/api/setting/coa/saldo` | API key | Saldo COA (opname + transaksi) |
| GET | `/api/corez/penerima-manfaat` | API key | Daftar penerima manfaat |
| POST | `/api/corez/penerima-manfaat/save` | API key | Tambah penerima manfaat |
| PUT | `/api/corez/penerima-manfaat/{id}` | API key | Update penerima manfaat |
| GET | `/api/corez/mitra` | API key | Daftar mitra (donatur aktif) |
| POST | `/api/corez/mitra/save` | API key | Tambah mitra |
| PUT | `/api/corez/mitra/{id}` | API key | Update mitra |
| GET | `/api/corez/transaksi` | API key | Daftar transaksi disetujui (filter tgl, paging) |
| POST | `/api/corez/transaksi/save` | API key | Simpan transaksi baru |
| PUT | `/api/corez/transaksi/{id}` | API key | Update transaksi |
| POST | `/api/corez/transaksi-wakaf` | API key | Simpan transaksi wakaf (2 baris: utama + DP) |
| POST | `/api/corez/transaksi-sh` | API key | Simpan transaksi SH (donatur auto) |
| PUT | `/api/corez/transaksi-ajis/{id}` | API key | Update transaksi AJIS |
| GET | `/api/fins/transactions` | API key | Daftar transaksi FINS (penerimaan/pengeluaran) |
| GET/POST | `/api/fins/totals` | API key | Total penerimaan/pengeluaran (range atau monthly/yearly) |
| POST | `/api/fins/expend` | API key | Tambah pengeluaran (fins_trans, jenis 'e') |
| POST | `/api/fins/receipt` | API key | Tambah penerimaan (fins_trans, jenis 'r') |
| GET | `/api/fins/jurnal` | API key | Daftar jurnal (fins_jurnal, filter tgl/COA/program/kantor) |
| GET | `/api/fins/cashbook` | API key | Buku kas per COA (grid + saldo berjalan, dari fins_trans) |
| GET | `/api/fins/book-ledger/tabs` | API key | Daftar tab Buku Besar (JURNAL + fins_report BB) |
| GET | `/api/fins/book-ledger` | API key | Grid Buku Besar (fins_jurnal, saldo awal, running saldo, footer) |
| GET | `/api/fins/book-ledger/export` | API key | Export Buku Besar (CSV, filter sama dengan grid) |
| GET | `/api/logs/transactions` | API key | Log transaksi per tanggal (file) |
| GET | `/api/logs/transactions/{id}` | API key | Log transaksi by ID (file) |

---

## 4. Spesifikasi Per Endpoint

Base URL: `https://<host>/api` (atau sesuai environment). Untuk endpoint yang butuh API key, selalu sertakan header: `Authorization: <apikey>`.

### Tabel ringkas filter GET (query parameter)

| Endpoint | Wajib | Opsional |
|----------|--------|----------|
| 4.1 GET `/api/` | — | — |
| 4.3 GET `/api/setting/program` | — | `id_entitas`, `id_program`, `nama`, `active`, `page`, `per_page` |
| 4.4 GET `/api/setting/setting-object` | — | `object`, `key`, `value`, `page`, `per_page` |
| 4.5 GET `/api/corez/{entitas}/transaksi/print/...` | path: `entitas`, `id_donatur`, `tgl_transaksi`, `donatur` | — |
| 4.6 GET `/api/hcm/karyawan` | — | `page`, `per_page`, `nama`, `nik`, `email`, `active`, `id_kantor`, `terms`, `sort`, `order` |
| 4.9 GET `/api/hcm/karyawan/validasi` | `email` | — |
| 4.10 GET `/api/hcm/kantor` | — | `page`, `per_page`, `nama`, `active`, `terms`, `sort`, `order` |
| 4.11 GET `/api/setting/contact` | — | `page`, `per_page`, `nama`/`nama_lengkap`, `id_contact`, `terms`, `sort`, `order` |
| 4.13 GET `/api/setting/bank` | — | `page`, `per_page`, `nama`, `active`, `terms`, `sort`, `order` |
| 4.14 GET `/api/setting/program` (API key) | — | `page`, `per_page`, `id_program`, `nama`, `active`, `terms`, `sort`, `order` |
| 4.15 GET `/api/setting/campaign` | — | `page`, `per_page`, `id_campaign`, `nama`, `active`, `terms`, `sort`, `order` |
| 4.17 GET `/api/corez/penerima-manfaat` | — | `page`, `per_page`, `id_penerima`, `nama`, `terms`, `sort`, `order` |
| 4.20 GET `/api/corez/mitra` | — | `page`, `per_page`, `id_mitra`, `nama`, `hp`, `email`, `terms`, `sort`, `order` |
| 4.22 GET `/api/corez/transaksi` | — | `page`, `per_page`, `id_donatur`, `tgl_awal`, `tgl_akhir`, `id_program`, `id_input_donasi`, `terms`, `sort`, `order` |
| 4.28 GET `/api/fins/transactions` | — | `type`, `tgl_awal`, `tgl_akhir`, `page`, `per_page`, `terms`, `approve`, `mutasi`, `id_via_bayar`, `nominal_*`, `id_program`, `id_kantor`, `exclude_coa_debet`, `exclude_coa_kredit`, `only_coa_debet`, `only_coa_kredit`, `exclude_id_contact`, `only_id_contact` |
| 4.29 GET `/api/fins/totals` | `type` | `group_by` (monthly\|yearly), `year` (untuk monthly; default tahun ini), `tgl_awal`, `tgl_akhir` (untuk range; default 01-01..12-31 tahun ini), `approve`, `id_program`, `id_kantor`, `exclude_coa_debet`, `exclude_coa_kredit`, `only_coa_debet`, `only_coa_kredit`, `exclude_id_contact`, `only_id_contact` |
| 4.32 GET `/api/fins/jurnal` | — | `type`, `tgl_awal`, `tgl_akhir`, `page`, `per_page`, COA/program/kantor, `id_via_bayar`, `via_jurnal`, `terms`, `nominal_*` |
| 4.33 GET `/api/fins/cashbook` | `coa` | `tanggal_awal`, `tanggal_akhir`, `status`, `mutasi`, `view_with`, `id_kantor`, `noresi`, `keysearch`, `keycoa`, `id_program`, `id_contact`, `nik_*`, `page`, `per_page`/`rows`, `sort`, `order` |
| 4.33a GET `/api/fins/book-ledger/tabs` | — | `mode` (legacy\|per_coa\|hybrid), `include_default`, `active_only` |
| 4.33b GET `/api/fins/book-ledger` | `tab_key`, `period_type` | `start_date`, `end_date`, `coa`, `office_id`, `keyword`, `group_by`, `opening_balance_mode`, `page`, `limit`, `sort_by`, `sort_order` |
| 4.33c GET `/api/fins/book-ledger/export` | (sama dengan book-ledger) | `format` (csv\|xls\|xlsx), `export_scope` |
| 4.34 GET `/api/setting/coa` | `parent_coa` (jika `for_selection=1` atau `all_child=1`) | `page`, `per_page`, `nama_coa`, `coa`, `group`, `level`, `parent`, `default`, `saldo`, `active`, `id_kantor`, `parent_coa`, `terms`, `for_selection`, `all_child` |
| 4.35 GET `/api/setting/coa/saldo` | `coa` | — |
| 4.36 GET `/api/logs/transactions` | — | `date` |
| 4.37 GET `/api/logs/transactions/{id}` | path: `id` | `date` |

---

### 4.1 GET `/api/`

- **Auth**: Tidak ada.
- **Kegunaan**: Cek ketersediaan API.
- **Response**: `{"message": "Welcome to API"}`.

---

### 4.2 POST `/api/setting/apikey`

- **Auth**: Tidak ada.
- **Kegunaan**: Mendapatkan API key untuk entitas tertentu dari database `zains`, tabel `admin_entitas`.
- **Tabel**: **SELECT** dari `admin_entitas` (connection **zains**).
- **Request body**:
```json
{
  "id_entitas": "CSF"
}
```
- **Response sukses (200)**:
```json
{
  "status": true,
  "message": "API key ditemukan",
  "apikey": "6dc7a19ca38ac6f919d143634a584fba0964eb544a8a13dd4a846de45e519d1c"
}
```
- **Response 404**: `{"status": false, "message": "Entitas tidak ditemukan"}`.
- **Response 200 (belum ada apikey)**: `{"status": false, "message": "API key belum tersedia"}`.

**Contoh query raw (lookup API key)**:
```sql
-- Di database zains
SELECT id_entitas, apikey
FROM admin_entitas
WHERE id_entitas = 'CSF'
LIMIT 1;
```

---

### 4.3 GET `/api/setting/program` (tanpa API key)

- **Auth**: Tidak ada.
- **Kegunaan**: Ambil daftar program dari tabel `setting_program` (tanpa switch connection; memakai default).
- **Filter (query parameter)**  
  - **Wajib:** tidak ada.  
  - **Opsional:** `program` (string, LIKE nama program), `id_program` (exact), `jenis` (`r` = reguler, `e` = eksekutif; jika nilai lain → 404). Default hanya COA aktif; limit 10.
- **Tabel**: **SELECT** dari `setting_program`.
- **Contoh query raw**:
```sql
SELECT id_program, program, coa_individu, coa_entitas, coa1, coa2, dp, level, parent, jenis, aktif, sort
FROM setting_program
WHERE aktif = 'y'
  AND (program LIKE '%...%' OR :program IS NULL)
  AND (id_program = :id_program OR :id_program IS NULL)
  AND (jenis = :jenis OR :jenis IS NULL)
ORDER BY sort
LIMIT 10;
```

---

### 4.4 GET `/api/setting/setting-object`

- **Auth**: Tidak ada.
- **Kegunaan**: Ambil data setting object.
- **Filter (query parameter)**  
  - **Wajib:** tidak ada.  
  - **Opsional:** `i` (string, LIKE), `o` (string, LIKE). Limit 10.
- **Tabel**: **SELECT** dari `setting_object`.
- **Contoh query raw**:
```sql
SELECT i, o FROM setting_object
WHERE (i = :i OR :i IS NULL)
LIMIT 10;
```

---

### 4.5 GET `/api/corez/{entitas}/transaksi/print/{id_donatur}/{tgl_transaksi}/{donatur}`

- **Auth**: Entitas dari **path** (`{entitas}`). Middleware `MultitenantMiddleware` set DB = `zains_` + entitas.
- **Kegunaan**: Generate dan download PDF kwitansi transaksi donatur untuk tanggal tertentu.
- **Filter (query parameter)**  
  - **Wajib:** tidak ada (filter hanya via path).  
  - **Path params (wajib):** `entitas`, `id_donatur`, `tgl_transaksi`, `donatur`.
- **Tabel**: **SELECT** dari `corez_transaksi` **JOIN** `corez_donatur`, **LEFT JOIN** `hcm_kantor`, `hcm_karyawan` (2x: sebagai karyawan dan teller).
- **Response**: PDF file (download).

**Contoh query raw (data kwitansi)**:
```sql
SELECT
  corez_transaksi.grouptrx,
  corez_transaksi.quantity,
  corez_transaksi.tgl_transaksi,
  corez_transaksi.user_insert,
  corez_transaksi.id_via_bayar,
  SUM(corez_transaksi.transaksi) AS total_transaksi,
  corez_donatur.donatur,
  corez_donatur.id_donatur,
  corez_donatur.alamat AS alamat_donatur,
  corez_donatur.npwp,
  corez_donatur.hp,
  hcm_kantor.kantor,
  hcm_karyawan.karyawan,
  hcm_karyawan.hp AS hp_karyawan,
  hcm_kantor.alamat,
  h1.karyawan AS teller
FROM corez_transaksi
JOIN corez_donatur ON corez_donatur.id_donatur = corez_transaksi.id_donatur
LEFT JOIN hcm_kantor ON hcm_kantor.id_kantor = corez_transaksi.id_kantor_transaksi
LEFT JOIN hcm_karyawan ON hcm_karyawan.id_karyawan = corez_transaksi.id_crm
LEFT JOIN hcm_karyawan AS h1 ON h1.id_karyawan = corez_transaksi.user_insert
WHERE corez_transaksi.id_donatur = :id_donatur
  AND corez_transaksi.tgl_transaksi = :tgl_transaksi
  AND corez_transaksi.approved_transaksi = 'y'
GROUP BY corez_transaksi.grouptrx, corez_transaksi.quantity, corez_transaksi.tgl_transaksi, ...
```

---

### 4.6 GET `/api/hcm/karyawan`

- **Auth**: API key.
- **Kegunaan**: Daftar karyawan aktif dengan filter opsional.
- **Filter (query parameter)**  
  - **Wajib:** tidak ada.  
  - **Opsional:** `id_karyawan` (exact), `karyawan` (string, LIKE), `email` (string, LIKE). Max 10 baris.
- **Tabel**: **SELECT** dari `hcm_karyawan`.
- **Response**: `{ "status": true, "message": "Data karyawan berhasil diambil", "data": [...] }`.

**Contoh query raw**:
```sql
SELECT id_karyawan, karyawan, email, jk, tempat_lahir, tgl_lahir, alamat, status_karyawan
FROM hcm_karyawan
WHERE aktif = 'y'
  AND (id_karyawan = :id_karyawan OR :id_karyawan IS NULL)
  AND (karyawan LIKE CONCAT('%', :karyawan, '%') OR :karyawan IS NULL)
  AND (email LIKE CONCAT('%', :email, '%') OR :email IS NULL)
LIMIT 10;
```

---

### 4.7 POST `/api/hcm/karyawan/save`

- **Auth**: API key.
- **Kegunaan**: Tambah karyawan baru.
- **Tabel**: **INSERT** ke `hcm_karyawan`.
- **Request body (contoh)**:
```json
{
  "karyawan": "Budi Santoso",
  "panggilan": "Budi",
  "jk": "l",
  "tempat_lahir": "Jakarta",
  "tgl_lahir": "1990-01-15",
  "email": "budi@example.com",
  "hp": "08123456789",
  "alamat": "Jl. Contoh No. 1",
  "kota": "Jakarta",
  "id_kantor": 1,
  "id_jabatan": "1",
  "status_karyawan": "Tetap",
  "tgl_masuk": "2024-01-01",
  "identitasid": 1,
  "no_identitas": "3271012345670001"
}
```
- **Contoh query raw**:
```sql
INSERT INTO hcm_karyawan (
  id_karyawan, karyawan, panggilan, jk, tempat_lahir, tgl_lahir, email, hp, alamat, kota,
  id_kantor, id_jabatan, status_karyawan, tgl_masuk, identitasid, no_identitas, ...
) VALUES (
  :id_karyawan, :karyawan, :panggilan, :jk, :tempat_lahir, :tgl_lahir, :email, :hp, :alamat, :kota,
  :id_kantor, :id_jabatan, :status_karyawan, :tgl_masuk, :identitasid, :no_identitas, ...
);
```

---

### 4.8 PUT `/api/hcm/karyawan/{id}`

- **Auth**: API key.
- **Kegunaan**: Update data karyawan by `id_karyawan` (path `{id}` = id_karyawan).
- **Tabel**: **UPDATE** `hcm_karyawan` WHERE `id_karyawan` = `{id}`.

---

### 4.9 GET `/api/hcm/karyawan/validasi`

- **Auth**: API key.
- **Kegunaan**: Validasi keberadaan email karyawan (aktif).
- **Filter (query parameter)**  
  - **Wajib:** `email` (format email, validasi Laravel `required|email`).  
  - **Opsional:** tidak ada.
- **Tabel**: **SELECT** dari `hcm_karyawan` (by email).

---

### 4.10 GET `/api/hcm/kantor`

- **Auth**: API key.
- **Kegunaan**: Daftar kantor untuk datagrid (paging) atau dropdown filter, mis. untuk filter di fins/transactions atau fins/jurnal. Mendukung pencarian (terms) dan filter aktif/parent.
- **Filter (query parameter)**  
  - **Wajib:** tidak ada.  
  - **Opsional:** `page` (integer, default 1), `per_page` (integer, default 15, max 100), `terms` (string, LIKE pada `kantor`, `alamat`, `kota`), `aktif` (`y`|`n`), `id_kantor_parent` (string, exact).
- **Tabel**: **SELECT** dari `hcm_kantor`.
- **Response**: `status`, `message`, `data` (array items), `paging` (per_page, current_page, total_data, total_page, next_page, previous_page).

**Contoh query raw**:
```sql
SELECT *
FROM hcm_kantor
WHERE (kantor LIKE CONCAT('%', :terms, '%') OR alamat LIKE CONCAT('%', :terms, '%') OR kota LIKE CONCAT('%', :terms, '%') OR :terms IS NULL)
  AND (aktif = :aktif OR :aktif IS NULL)
  AND (id_kantor_parent = :id_kantor_parent OR :id_kantor_parent IS NULL)
ORDER BY kantor
LIMIT :per_page OFFSET :offset;
```

---

### 4.11 GET `/api/setting/contact`

- **Auth**: API key.
- **Kegunaan**: Daftar contact aktif dengan filter.
- **Filter (query parameter)**  
  - **Wajib:** tidak ada.  
  - **Opsional:** `id_contact` (exact), `nama` (di code dipakai untuk kondisi; nilai LIKE ke `nama_lengkap`), `hp` (exact), `email` (exact). Max 10 baris.
- **Tabel**: **SELECT** dari `setting_contact`.
- **Contoh query raw**:
```sql
SELECT * FROM setting_contact
WHERE (id_contact = :id_contact OR :id_contact IS NULL)
  AND (nama_lengkap LIKE CONCAT('%', :nama, '%') OR :nama IS NULL)
LIMIT 10;
```

---

### 4.12 POST `/api/setting/contact/save`

- **Auth**: API key.
- **Kegunaan**: Tambah contact.
- **Tabel**: **INSERT** ke `setting_contact`.

---

### 4.13 GET `/api/setting/bank`

- **Auth**: API key.
- **Kegunaan**: Daftar rekening bank (untuk pilihan COA debet transaksi).
- **Filter (query parameter)**  
  - **Wajib:** tidak ada.  
  - **Opsional:** `nama_rekening` (string, LIKE kolom `keterangan`), `nomor_rekening` (string, exact `id_rekening`). Limit 10.
- **Tabel**: **SELECT** dari `fins_bank_rek`.
- **Contoh query raw**:
```sql
SELECT id_rekening, id_bank, keterangan, coa, active, scrap, note
FROM fins_bank_rek
WHERE active = 'y'
  AND (keterangan LIKE CONCAT('%', :nama_rekening, '%') OR :nama_rekening IS NULL)
  AND (id_rekening = :nomor_rekening OR :nomor_rekening IS NULL)
LIMIT 10;
```

---

### 4.14 GET `/api/setting/program` (dengan API key)

- **Auth**: API key.
- **Kegunaan**: Daftar program dengan connection entitas (database mengikuti API key). Tanpa API key, route yang sama ada di grup public dan memakai default connection.
- **Filter (query parameter):** sama seperti **4.3** — tidak ada yang wajib; opsional: `program`, `id_program`, `jenis` (`r`|`e`). Limit 10.
- **Tabel**: **SELECT** dari `setting_program`.

---

### 4.15 GET `/api/setting/campaign`

- **Auth**: API key.
- **Kegunaan**: Daftar campaign aktif (tanpa filter query di code).
- **Filter (query parameter)**  
  - **Wajib:** tidak ada.  
  - **Opsional:** tidak ada (semua campaign dengan `active = 'y'` dikembalikan).
- **Tabel**: **SELECT** dari `setting_campaign` WHERE `active = 'y'`.
- **Contoh query raw**:
```sql
SELECT * FROM setting_campaign WHERE active = 'y';
```

---

### 4.16 POST `/api/setting/campaign/save`

- **Auth**: API key.
- **Kegunaan**: Tambah campaign.
- **Tabel**: **INSERT** ke `setting_campaign`.

---

### 4.17 GET `/api/corez/penerima-manfaat`

- **Auth**: API key.
- **Kegunaan**: Daftar penerima manfaat (PM) aktif.
- **Filter (query parameter)**  
  - **Wajib:** tidak ada.  
  - **Opsional:** `id_pm` (exact), `nama` (string, LIKE kolom `pm`). Limit dari config `DEFAULT_RANGE_DATA` (10).
- **Tabel**: **SELECT** dari `corez_pm`.
- **Contoh query raw**:
```sql
SELECT * FROM corez_pm
WHERE aktif = 'y'
  AND (id_pm = :id_pm OR :id_pm IS NULL)
  AND (pm LIKE CONCAT('%', :nama, '%') OR :nama IS NULL)
LIMIT 10;
```

---

### 4.18 POST `/api/corez/penerima-manfaat/save`

- **Auth**: API key.
- **Kegunaan**: Tambah penerima manfaat.
- **Tabel**: **INSERT** ke `corez_pm`.
- **Request body (contoh)**:
```json
{
  "nama": "Budi",
  "jenis": "Zakat",
  "hp": "08123456789",
  "email": "budi@example.com",
  "alamat": "Jl. Contoh No. 123",
  "id_pj": "PJ001"
}
```

---

### 4.19 PUT `/api/corez/penerima-manfaat/{id}`

- **Auth**: API key.
- **Kegunaan**: Update penerima manfaat by id.
- **Tabel**: **UPDATE** `corez_pm`.

---

### 4.20 GET `/api/corez/mitra`

- **Auth**: API key.
- **Kegunaan**: Daftar mitra (donatur aktif, model pakai tabel `corez_donatur`).
- **Filter (query parameter)**  
  - **Wajib:** tidak ada.  
  - **Opsional:** `id_donatur` (exact), `donatur` (string, LIKE), `email` (exact). Limit 10.
- **Tabel**: **SELECT** dari `corez_donatur` WHERE `aktif = 'y'`.
- **Contoh query raw**:
```sql
SELECT * FROM corez_donatur
WHERE aktif = 'y'
  AND (id_donatur = :id_donatur OR :id_donatur IS NULL)
  AND (donatur LIKE CONCAT('%', :donatur, '%') OR :donatur IS NULL)
  AND (email = :email OR :email IS NULL)
LIMIT 10;
```

---

### 4.21 POST `/api/corez/mitra/save`

- **Auth**: API key.
- **Kegunaan**: Menambah mitra (donatur) baru. Mitra disimpan ke tabel **`corez_donatur`** dengan status donatur. Sebelum insert, sistem mengecek duplikat berdasarkan **HP** dan **email**: jika HP atau email sudah terdaftar, request ditolak dengan pesan yang sesuai. **ID donatur** di-generate otomatis dengan pola `YYMMDD` + `id_kantor` (3 digit) + urutan 5 digit per hari (method `GenerateIDDonatur`). Kolom lain yang tidak dikirim diisi dari config (mis. id_kantor, id_jenis, status, agama, last_transaction, dll.).
- **Tabel**: **INSERT** ke `corez_donatur`. **SELECT** untuk cek duplikat: `corez_donatur` (where hp atau email).
- **Request body (wajib)**:
```json
{
  "nama": "Budi Setiawan",
  "id_jenis": 1,
  "hp": "08123456789",
  "telpon": "0211234567",
  "email": "budi@email.com",
  "alamat": "Jl. Merdeka No. 123",
  "id_crm": "CRM-001"
}
```
- **Response sukses (200)**: `{ "status": true, "message": "Data mitra berhasil disimpan", "data": { ... } }`.
- **Response 400**: Duplikat — "Mitra dengan nomor HP ini sudah terdaftar" / "Mitra dengan email ini sudah terdaftar" / "Mitra dengan nomor HP dan email ini sudah terdaftar" (bisa disertai `id_donatur`).
- **Response 422**: Validasi gagal — "Data belum lengkap", `errors` berisi field yang salah.

**Contoh query raw (cek duplikat)**:
```sql
SELECT id_donatur FROM corez_donatur
WHERE hp = :hp OR email = :email
LIMIT 1;
```

**Contoh query raw (insert)**:
```sql
INSERT INTO corez_donatur (
  id_donatur, donatur, panggilan, tgl_lahir, jk, komitment, hp, telpon, id_crm, email, alamat,
  tgl_reg, id_kantor, id_jenis, aktif, status, id_pekerjaan, id_cara_bayar, id_rutinitas_transaksi,
  tgl_transaksi, id_penghasilan, id_pendidikan, id_pelayanan, id_profiling, agama, updated, dtu, last_transaction,
  tempat_lahir, des, id_donatur_parent, nikah, ll, sumber, lain, npwp, id_program, user_insert, user_name, password,
  verified, foto, id_koordinator, session, note, id_hubung, send_email
) VALUES (
  :id_donatur, :nama, :nama, CURDATE(), 'x', 0, :hp, :telpon, :id_crm, :email, :alamat,
  CURDATE(), 1, :id_jenis, 'y', 'Donatur', 0, 0, 0, 0, 0, 0, 0, 0, 'Islam', NOW(), NOW(), '1998-01-01',
  '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''
);
```

#### PUT `/api/corez/mitra/{id}`

- **Auth**: API key.
- **Kegunaan**: Update data mitra (donatur) berdasarkan `id_donatur` (path `{id}`).
- **Tabel**: **UPDATE** `corez_donatur` WHERE `id_donatur` = `{id}`.

---

### 4.22 GET `/api/corez/transaksi`

- **Auth**: API key.
- **Kegunaan**: Daftar transaksi yang sudah disetujui (`approved_transaksi = 'y'`) dengan filter tanggal dan paging.
- **Filter (query parameter)**  
  - **Wajib:** tidak ada.  
  - **Opsional:** `tgl_awal`, `tgl_akhir` (dapat dari query atau body JSON; default: awal bulan ini–hari ini), `page` (default 1), `per_page` (default 10, max 100).
- **Tabel**: **SELECT** dari `corez_transaksi` **LEFT JOIN** `corez_donatur`, `setting_program`, `setting_program AS program_parent`, `fins_coa`, `hcm_kantor`, `fins_bank_rek` (COA debet dipetakan ke rekening/kantor).
- **Response**: `status`, `message`, `data`, `count`, `sum`, `paging` (per_page, current_page, total_data, total_page, next_page, previous_page).

**Contoh query raw (inti)**:
```sql
SELECT
  corez_transaksi.id_transaksi,
  corez_transaksi.id_donatur,
  corez_transaksi.transaksi,
  fins_coa.nama_coa,
  corez_donatur.donatur AS nama_donatur,
  corez_transaksi.tgl_transaksi,
  setting_program.program AS nama_program,
  program_parent.program AS program_parent,
  hcm_kantor.kantor AS nama_kantor,
  corez_transaksi.id_penghimpunan,
  corez_transaksi.id_via_himpun,
  corez_transaksi.id_via_bayar AS metode_bayar,
  CASE WHEN corez_transaksi.id_via_bayar = 1 THEN 'cash' WHEN corez_transaksi.id_via_bayar = 2 THEN 'bank' WHEN corez_transaksi.id_via_bayar = 3 THEN 'noncash' ELSE NULL END AS jenis_transaksi,
  CASE WHEN corez_transaksi.id_via_bayar = 2 THEN fins_bank_rek.keterangan WHEN corez_transaksi.id_via_bayar = 1 THEN hcm_kantor.kantor ELSE NULL END AS id_rekening,
  CASE WHEN corez_donatur.id_jenis = 1 THEN 'retail' WHEN corez_donatur.id_jenis = 2 THEN 'corporate' WHEN corez_donatur.id_jenis = 3 THEN 'community' ELSE NULL END AS jenis_donatur
FROM corez_transaksi
LEFT JOIN corez_donatur ON corez_donatur.id_donatur = corez_transaksi.id_donatur
LEFT JOIN setting_program ON setting_program.id_program = corez_transaksi.id_program
LEFT JOIN setting_program AS program_parent ON program_parent.id_program = setting_program.id_program_parent
LEFT JOIN fins_coa ON fins_coa.coa = corez_transaksi.coa_debet
LEFT JOIN hcm_kantor ON hcm_kantor.id_kantor = corez_transaksi.id_kantor_transaksi
LEFT JOIN fins_bank_rek ON REPLACE(fins_bank_rek.coa, '.', '') = corez_transaksi.coa_debet
WHERE corez_transaksi.approved_transaksi = 'y'
  AND corez_transaksi.tgl_transaksi BETWEEN :tgl_awal AND :tgl_akhir
ORDER BY corez_transaksi.tgl_transaksi DESC, corez_transaksi.id_transaksi DESC
LIMIT :per_page OFFSET :offset;
```

---

### 4.23 POST `/api/corez/transaksi/save`

- **Auth**: API key.
- **Kegunaan**: Simpan transaksi donasi baru. Validasi: program, rekening (jika non-cash), kantor, karyawan, donatur, tanggal, penghimpunan, via himpun, user_insert, ViaInput, nominal, id_via_bayar. COA debet diambil dari `fins_bank_rek` (bank) atau `hcm_kantor` (cash).
- **Tabel**: **INSERT** ke `corez_transaksi`. **SELECT** untuk validasi/lookup: `setting_program`, `fins_bank_rek` (Bank), `hcm_kantor` (Kantor).
- **Request body (contoh)**:
```json
{
  "id_program": "22",
  "id_rekening": "10109003000",
  "id_kantor": 1,
  "id_karyawan": "1012025161001",
  "id_donatur": "26030700100007",
  "tgl_transaksi": "2026-03-07",
  "id_penghimpunan": 6,
  "id_via_himpun": "Donasi Online",
  "user_insert": "System Cron",
  "ViaInput": "Crowdfunding",
  "transaksi": 100000,
  "id_via_bayar": 2,
  "quantity": 1,
  "keterangan": "a.n Emma | Ramadhan | Pangan Sehat",
  "no_bukti": "070326200019",
  "id_crm": "ads",
  "id_affiliate": "ads"
}
```
- Duplikasi: dicek by `no_bukti` dan by rule trigger (id_donatur, id_program, id_kantor_transaksi, tgl_transaksi, tgl_donasi, transaksi, keterangan). Jika duplikat: 409 atau 400 dengan message.

**Contoh query raw (insert)**:
```sql
INSERT INTO corez_transaksi (
  id_transaksi, id_via_bayar, id_donatur, detailid, id_program, id_program_claim,
  coa_debet, coa_kredit, quantity, transaksi, tgl_transaksi, id_kantor_transaksi, id_kantor_donatur,
  id_penghimpunan, id_via_himpun, id_cara_bayar, cdt, approved_transaksi, tgl_donasi, keterangan,
  user_insert, no_bukti, cur, ViaInput, note, dp, grouptrx, id_affiliate, dtu, ...
) VALUES (
  :id_transaksi, :id_via_bayar, :id_donatur, 1, :id_program, :id_program_claim,
  :coa_debet, :coa_kredit, :quantity, :transaksi, :tgl_transaksi, :id_kantor_transaksi, :id_kantor_donatur,
  :id_penghimpunan, :id_via_himpun, :id_cara_bayar, NOW(), 'y', :tgl_donasi, :keterangan,
  :user_insert, :no_bukti, 'IDR', :ViaInput, :note, :dp, :grouptrx, :id_affiliate, NOW(), ...
);
```

---

### 4.24 PUT `/api/corez/transaksi/{id}`

- **Auth**: API key.
- **Kegunaan**: Update transaksi by `id_transaksi` (path `{id}` = id_transaksi; model memakai primary key `id_transaksi`).
- **Tabel**: **UPDATE** `corez_transaksi` WHERE `id_transaksi` = `{id}`.

---

### 4.25 POST `/api/corez/transaksi-wakaf`

- **Auth**: API key.
- **Kegunaan**: Simpan transaksi wakaf: dua baris transaksi (utama + Dana Pengelola/DP). Donatur dicari atau dibuat; COA dari program dan bank.
- **Tabel**: **INSERT** 2 baris ke `corez_transaksi`. **SELECT** untuk validasi: `fins_bank_rek`, `hcm_kantor`, `setting_program` (program wakaf + program DP).
- **Request body (contoh)**:
```json
{
  "nama_donatur": "Ahmad",
  "hp_donatur": "08123456789",
  "id_program": 101,
  "id_rekening": "10109003000",
  "id_kantor": 1,
  "id_penghimpunan": 6,
  "id_via_himpun": "Donasi Online",
  "ViaInput": "Waqfid",
  "transaksi": 1000000,
  "dp_persen": 30,
  "coa_kredit": "401.04.008.011",
  "tgl_transaksi": "2026-03-07",
  "tgl_donasi": "2026-03-07",
  "no_bukti": "TRX-WQF-001"
}
```
- **Contoh query raw (2x insert)**:
```sql
INSERT INTO corez_transaksi (id_transaksi, id_donatur, coa_debet, coa_kredit, transaksi, id_program, id_program_claim, tgl_transaksi, tgl_donasi, keterangan, no_bukti, ...)
VALUES
  (:id_transaksi, :id_donatur, :coa_debet, :coa_kredit, :nominal_transaksi, :id_program, :id_program, :tgl_transaksi, :tgl_donasi, :keterangan, :no_bukti, ...),
  (:id_transaksi_dp, :id_donatur, :coa_debet, :coa_kredit_dp, :nominal_dp, :id_program_dp, :id_program_dp, :tgl_transaksi, :tgl_donasi, :keterangan_dp, :no_bukti, ...);
```

---

### 4.26 POST `/api/corez/transaksi-sh`

- **Auth**: API key.
- **Kegunaan**: Simpan transaksi SH; donatur dicari atau dibuat (findOrCreateDonatur) by email/hp; keterangan dibentuk dari nama donatur + program + campaign.
- **Tabel**: **INSERT** ke `corez_transaksi`; mungkin **INSERT** ke `corez_donatur` jika donatur baru. **SELECT**: `corez_donatur`, `hcm_karyawan`, `setting_program`.
- **Request body**: berisi antara lain `email_karyawan`, `id_program`, `coa_debet`, `coa_kredit`, `transaksi`, `tgl_transaksi`, `tgl_donasi`, `id_via_himpun`, `user_insert`, `ViaInput`, `no_bukti`, `campaign`, data donatur (nama, hp, email).

---

### 4.27 PUT `/api/corez/transaksi-ajis/{id}`

- **Auth**: API key.
- **Kegunaan**: Update transaksi untuk **integrasi AJIS**: menyimpan atau memperbarui **ID donasi dari sistem eksternal (AJIS)** ke kolom `note` di `corez_transaksi`. Kolom `note` berisi tag XML `<id_input_donasi>...</id_input_donasi>`. Jika di `note` sudah ada tag tersebut, nilainya diganti; jika belum, tag ditambahkan di akhir. Hanya kolom `note` yang di-update; field lain tidak berubah. Path `{id}` = `id_transaksi`.
- **Tabel**: **SELECT** lalu **UPDATE** `corez_transaksi` WHERE `id_transaksi` = `{id}`.
- **Request body (wajib)**:
```json
{
  "id_input_donasi": "AJIS-12345"
}
```
- **Response sukses (200)**: `{ "status": true, "message": "Success", "data": { "note": "..." } }`.
- **Response 404**: "Tolong sertakan ID Transaksi" (path kosong), "Tolong sertakan ID Donasi" (body tanpa id_input_donasi), atau "Data Transaksi tidak ditemukan".

**Contoh query raw (ambil note lama)**:
```sql
SELECT note FROM corez_transaksi WHERE id_transaksi = :id LIMIT 1;
```

**Contoh query raw (update)**:
```sql
UPDATE corez_transaksi
SET note = :note_baru
WHERE id_transaksi = :id;
-- note_baru = note lama + <id_input_donasi>AJIS-12345</id_input_donasi> (atau replace jika sudah ada tag)
```

---

### 4.28 GET `/api/fins/transactions`

- **Auth**: API key.
- **Kegunaan**: Daftar transaksi FINS (penerimaan `r` dan/atau pengeluaran `e`) dengan filter tanggal, COA, program, kantor, approve, jenis, mutasi, id_via_bayar, terms (LIKE), nominal.
- **Filter (query parameter)**  
  - **Wajib:** tidak ada.  
  - **Opsional:**  
    - `type` (`expend`|`receipt`) → memfilter `jenis` (`e` / `r`)  
    - `tgl_awal`, `tgl_akhir` (default: 30 hari terakhir–hari ini)  
    - `page` (default 1), `per_page` (default 10)  
    - `terms` (LIKE ke `keterangan`, `note`, `id_transaksi`)  
    - `approve` (exact)  
    - `mutasi` (exact)  
    - `id_via_bayar` (exact)  
    - `nominal_eq`, `nominal_gte`, `nominal_lte` (numeric; ke `nominal`)  
    - `id_program`, `id_kantor` (string pisah koma; IN)  
    - `exclude_coa_debet`, `only_coa_debet` (string pisah koma; ke `coa_debet`)  
    - `exclude_coa_kredit`, `only_coa_kredit` (string pisah koma; ke `coa_kredit`)  
    - `exclude_id_contact`, `only_id_contact` (string pisah koma; ke `id_contact`)  
- **Tabel yang terlibat**:
  - **Utama**: `fins_trans`
  - **Catatan**: Endpoint ini **tidak melakukan JOIN** (nama program/kantor/COA tidak di-lookup; hanya filter berdasarkan kolom di `fins_trans`).
- **Response**: `status`, `message`, `data` (array), `paging`.

**Contoh query raw (inti)**:
```sql
SELECT
  id_trans, id_transaksi, id_exre, coa_ca, coa_debet, coa_kredit, nominal, keterangan,
  tgl_exre, id_kantor, id_via_bayar, approve, jenis, mutasi, id_program, id_contact
FROM fins_trans
WHERE tgl_exre BETWEEN :tgl_awal AND :tgl_akhir
  -- opsional:
  -- AND jenis = :jenis                    -- type=expend|receipt
  -- AND (keterangan LIKE :terms_like
  --   OR note LIKE :terms_like
  --   OR id_transaksi LIKE :terms_like)   -- terms
  -- AND approve = :approve
  -- AND mutasi = :mutasi
  -- AND id_via_bayar = :id_via_bayar
  -- AND nominal = :nominal_eq
  -- AND nominal >= :nominal_gte
  -- AND nominal <= :nominal_lte
  -- AND id_program IN (:id_program_list)
  -- AND id_kantor IN (:id_kantor_list)
  -- AND coa_debet [NOT] IN (:coa_debet_list)     -- exclude_coa_debet / only_coa_debet
  -- AND coa_kredit [NOT] IN (:coa_kredit_list)   -- exclude_coa_kredit / only_coa_kredit
  -- AND id_contact [NOT] IN (:id_contact_list)   -- exclude_id_contact / only_id_contact
ORDER BY tgl_exre DESC
LIMIT :per_page OFFSET :offset;
```

---

### 4.29 GET/POST `/api/fins/totals`

- **Auth**: API key.
- **Kegunaan**: Mengambil **agregat total** (sum nominal dan count) untuk transaksi FINS tipe **penerimaan** (`receipt`, jenis `r`) atau **pengeluaran** (`expend`, jenis `e`). Mendukung tiga mode:
  1. **Range tanggal** (default): total dalam rentang `tgl_awal`–`tgl_akhir`. Jika tidak kirim `group_by`, **tgl_awal** dan **tgl_akhir** wajib divalidasi (required); controller memberi default **1 Jan** dan **31 Des tahun berjalan** bila tidak dikirim.
  2. **Per bulan** (`group_by=monthly`): total per bulan (1–12) dalam **satu tahun**. Parameter `year` menentukan tahun (default: tahun berjalan). `tgl_awal`/`tgl_akhir` diabaikan. Response: array per bulan + `grand_total`.
  3. **Per tahun** (`group_by=yearly`): total per tahun untuk **5 tahun terakhir** (tahun berjalan dan 4 tahun sebelumnya). `tgl_awal`/`tgl_akhir` diabaikan. Response: array per tahun + `grand_total`.
- **Tabel yang terlibat**:
  - **Utama**: `fins_trans` (SUM/COUNT berdasarkan `nominal` dan `id_trans`, dikelompokkan berdasarkan bulan/tahun jika diminta).
  - **Catatan**: Endpoint ini **tidak melakukan JOIN** ke tabel lain (program/kantor/COA hanya dipakai sebagai filter lewat kolom di `fins_trans`).
- **Parameter (query string; GET/POST sama saja)**:
  - **Wajib**:
    - `type`: `expend` atau `receipt`
  - **Opsional (umum)**:
    - `approve`: string (exact match ke kolom `approve`)
    - `id_program`: string pisah koma (IN)
    - `id_kantor`: string pisah koma (IN)
    - `exclude_coa_debet`, `only_coa_debet`: string pisah koma (filter ke `coa_debet`)
    - `exclude_coa_kredit`, `only_coa_kredit`: string pisah koma (filter ke `coa_kredit`)
    - `exclude_id_contact`, `only_id_contact`: string pisah koma (filter ke `id_contact`)
  - **Opsional (mode range / default)**:
    - `tgl_awal` (default: `YYYY-01-01` tahun berjalan)
    - `tgl_akhir` (default: `YYYY-12-31` tahun berjalan)
  - **Opsional (mode monthly)**:
    - `group_by=monthly`
    - `year` (default: tahun berjalan)
  - **Opsional (mode yearly)**:
    - `group_by=yearly`
- **Response (200)**:
  - **Mode range**: `{ "status": true, "message": "Total receipt|expend berhasil diambil", "data": { "sum": number, "count": number }, "filters": { "type", "group_by": null, "tgl_awal", "tgl_akhir", ... } }`.
  - **Mode monthly**: `"data"` = array objek per bulan: `{ "month": 1..12, "month_name": "Jan"|"Feb"|...|"Des", "sum": number, "count": number }` (tidak ada field `year` di tiap item; tahun ada di `filters.year`). `"grand_total": { "sum": number, "count": number }`, `"filters": { "type", "group_by": "monthly", "year", ... }`.
  - **Mode yearly**: `"data"` = array objek per tahun: `{ "year": number, "sum": number, "count": number }`. `"grand_total": { "sum", "count" }`, `"filters": { "type", "group_by": "yearly", "start_year", "end_year", ... }`.

**Contoh query raw (mode range)**:
```sql
SELECT
  COALESCE(SUM(nominal), 0) AS sum,
  COUNT(id_trans) AS count
FROM fins_trans
WHERE jenis = :jenis
  AND DATE(tgl_exre) BETWEEN :tgl_awal AND :tgl_akhir
  -- filter opsional (hanya ditambahkan jika param dikirim):
  -- AND approve = :approve
  -- AND id_program IN (:id_program_list)
  -- AND id_kantor IN (:id_kantor_list)
  -- AND coa_debet [NOT] IN (:coa_debet_list)  -- exclude_coa_debet / only_coa_debet
  -- AND coa_kredit [NOT] IN (:coa_kredit_list) -- exclude_coa_kredit / only_coa_kredit
  -- AND id_contact [NOT] IN (:id_contact_list) -- exclude_id_contact / only_id_contact
;
-- :jenis = 'e' untuk type=expend, :jenis = 'r' untuk type=receipt
```

**Contoh query raw (mode monthly)**:
```sql
SELECT
  MONTH(tgl_exre) AS bulan,
  COALESCE(SUM(nominal), 0) AS sum,
  COUNT(id_trans) AS count
FROM fins_trans
WHERE jenis = :jenis
  AND YEAR(tgl_exre) = :year
  -- filter opsional sama seperti mode range (approve/id_program/id_kantor/COA/id_contact)
GROUP BY bulan
ORDER BY bulan;
```

**Contoh query raw (mode yearly)**:
```sql
SELECT
  YEAR(tgl_exre) AS tahun,
  COALESCE(SUM(nominal), 0) AS sum,
  COUNT(id_trans) AS count
FROM fins_trans
WHERE jenis = :jenis
  AND YEAR(tgl_exre) BETWEEN :start_year AND :end_year
  -- filter opsional sama seperti mode range (approve/id_program/id_kantor/COA/id_contact)
GROUP BY tahun
ORDER BY tahun;
-- start_year = end_year - 4 (5 tahun)
```

---

### 4.30 POST `/api/fins/expend`

- **Auth**: API key.
- **Kegunaan**: Tambah data pengeluaran (jenis `e` di `fins_trans`). id_exre dan noresi di-generate.
- **Tabel**: **INSERT** ke `fins_trans`. **SELECT** dari `hcm_karyawan` (by `nik_input`) untuk id_jabatan dan atasan.
- **Request body (wajib)**:
```json
{
  "coa_debet": "101.01.002.032",
  "coa_kredit": "501.04.002.035",
  "id_kantor": 1,
  "id_via_bayar": 1,
  "nominal": 50000,
  "quantity": 1,
  "nik_input": "admin"
}
```
- **Opsional**: `keterangan`, `id_program`, `total`, `approve`, `mutasi`, `coa_ca`, `id_contact`, `note`.

**Contoh query raw (insert)**:
```sql
INSERT INTO fins_trans (
  id_trans, id_transaksi, id_exre, coa_ca, coa_debet, coa_kredit, nominal, keterangan,
  nik_input, nik_input_atasan, tgl_exre, fdt, realisasi, coa, nik_approve, id_kantor, id_via_bayar,
  approve, jenis, mutasi, nik_cair, id_program, id_contact, noresi, total, quantity, id_jabatan, note, dtu
) VALUES (
  '', :id_exre, :id_exre, '', :coa_debet, :coa_kredit, :nominal, :keterangan,
  :nik_input, :nik_input_atasan, NOW(), NOW(), 0, :coa_debet, '', :id_kantor, :id_via_bayar,
  :approve, 'e', :mutasi, '', :id_program, :id_contact, :noresi, :total, :quantity, :id_jabatan, :note, NOW()
);
```

---

### 4.31 POST `/api/fins/receipt`

- **Auth**: API key.
- **Kegunaan**: Menyimpan **data penerimaan** (receipt) ke tabel `fins_trans` dengan **jenis tetap `r`**. Digunakan untuk mencatat pemasukan (mis. penerimaan dari klinik, donasi yang masuk ke kas). Field **`id_exre`** dan **`noresi`** di-generate otomatis: `id_exre` dari pola R + id_kantor (3 digit) + yymmdd + urutan; `noresi` dari mutasi + yymmdd + kantor + urutan. Sistem juga melakukan **lookup** ke `hcm_karyawan` berdasarkan `nik_input` untuk mengisi `id_jabatan` dan `nik_input_atasan`; jika karyawan tidak ditemukan, kedua field diisi 0/kosong. Nilai **approve** dinormalisasi ke enum yang valid (default `u`); **total** default = nominal jika tidak dikirim.
- **Tabel**: **INSERT** ke `fins_trans`. **SELECT** dari `hcm_karyawan` (by `id_karyawan` = nik_input) untuk id_jabatan, id_karyawan_parent; **SELECT** dari `fins_trans` untuk generate id_exre dan noresi (urutan terakhir).
- **Request body (wajib)**:
```json
{
  "coa_debet": "101.01.002.013",
  "coa_kredit": "401.04.002.020",
  "id_kantor": 1,
  "id_via_bayar": 1,
  "nominal": 3000000,
  "quantity": 1,
  "nik_input": "1012025161001"
}
```
- **Request body (opsional)**: `keterangan`, `id_program`, `total`, `approve` (enum: a, r, u, as, rs, us, aj, asj, ac, hc; default u), `mutasi` (2 karakter), `coa_ca`, `id_contact`, `note`, `nik_approve`, `nik_cair`.
- **Response sukses (200)**: `{ "status": true, "message": "Data Penerimaan berhasil disimpan", "data": { ... } }`.
- **Response 400**: Validasi gagal, `errors` berisi field yang salah.
- **Response 500**: Insert gagal atau exception.

**Contoh query raw (lookup karyawan)**:
```sql
SELECT id_jabatan, id_karyawan_parent FROM hcm_karyawan WHERE id_karyawan = :nik_input LIMIT 1;
```

**Contoh query raw (insert)**:
```sql
INSERT INTO fins_trans (
  id_trans, id_transaksi, id_exre, coa_ca, coa_debet, coa_kredit, nominal, keterangan,
  tgl_exre, fdt, coa, id_kantor, id_via_bayar, jenis, id_program, noresi, total, quantity,
  realisasi, dtu, approve, nik_input, id_jabatan, nik_input_atasan, mutasi, nik_approve, note, id_contact, nik_cair
) VALUES (
  '', :id_exre, :id_exre, '', :coa_debet, :coa_kredit, :nominal, :keterangan,
  NOW(), NOW(), :coa, :id_kantor, :id_via_bayar, 'r', :id_program, :noresi, :total, :quantity,
  0, NOW(), 'u', :nik_input, :id_jabatan, :nik_input_atasan, :mutasi, '', :note, :id_contact, ''
);
```

---

### 4.32 GET `/api/fins/jurnal`

- **Auth**: API key.
- **Kegunaan**: Daftar **jurnal** (buku besar) dari tabel `fins_jurnal`. Satu baris = satu record jurnal (debet/kredit per COA). Jenis transaksi (receipt/expend) ditentukan dari join ke `fins_trans` (kolom `jenis`). Berguna untuk tampilan daftar jurnal klasik: Tanggal, COA, Debet, Kredit, Keterangan, Via Jurnal, User Input, Kantor, Program, ID Buku (id_exre), dll.
- **Filter (query parameter)**  
  - **Wajib:** tidak ada.  
  - **Opsional:** `type` (`expend`|`receipt`), `tgl_awal`, `tgl_akhir` (default: awal bulan ini–hari ini), `page` (default 1), `per_page` (default 10, max 100), `exclude_coa_debet`, `exclude_coa_kredit`, `only_coa_debet`, `only_coa_kredit` (string pisah koma), `id_program`, `id_kantor` (string pisah koma), `id_via_bayar` (integer), `via_jurnal` (integer), `terms` (LIKE keterangan, id_exre, id_transaksi, note), `nominal_eq`, `nominal_gte`, `nominal_lte` (berdasarkan debet/kredit di jurnal).
- **Tabel**: **SELECT** dari `fins_jurnal` **LEFT JOIN** `fins_trans`, `hcm_karyawan`, `hcm_kantor`, `setting_program`, `fins_coa` (coa, coa_buku, parent), `fins_jurnal` (j_sumber) + `fins_coa` (coa_sumber) untuk baris sumber dana.
- **Response**: `status`, `message`, `data`, `count`, `sum` (sum_debet/sum_kredit), `paging`.

**Contoh query raw (inti)**:
```sql
SELECT j.id_jurnal, j.id_transaksi, j.id_exre, j.coa, j.debet, j.kredit, j.keterangan, j.tgl_exre, j.via_jurnal, j.nik_input, j.id_kantor, j.id_program, j.noresi,
  fins_coa.nama_coa, hcm_kantor.kantor, setting_program.program, hcm_karyawan.karyawan
FROM fins_jurnal AS j
LEFT JOIN fins_trans ON fins_trans.id_trans = j.id_trans
LEFT JOIN hcm_karyawan ON hcm_karyawan.id_karyawan = j.nik_input
LEFT JOIN hcm_kantor ON hcm_kantor.id_kantor = j.id_kantor
LEFT JOIN setting_program ON setting_program.id_program = j.id_program
LEFT JOIN fins_coa ON fins_coa.coa = j.coa
WHERE fins_trans.jenis IN ('r', 'e')
  AND DATE(j.tgl_exre) BETWEEN :tgl_awal AND :tgl_akhir
ORDER BY j.tgl_exre DESC, j.id_jurnal DESC
LIMIT :per_page OFFSET :offset;
```

---

### 4.33 GET `/api/fins/cashbook`

- **Auth**: API key.
- **Kegunaan**: **Buku kas** per COA: grid transaksi yang memengaruhi satu COA (coa_debet = coa atau coa_kredit = coa) dengan **saldo berjalan** per baris. Data utama dari `fins_trans`; baris pertama adalah virtual "Saldo Awal"; footer berisi total debet/kredit dan saldo akhir. Berguna untuk laporan kas/bank per rekening COA.
- **Filter (query parameter)**  
  - **Wajib:** `coa` (string, kode COA).  
  - **Opsional:** `tanggal_awal`, `tanggal_akhir` (date), `status` (approve; default `a`), `mutasi`, `view_with`, `id_kantor` (string), `noresi`, `keysearch` (LIKE keterangan, note, id_transaksi, id_trans, id_exre, noresi), `keycoa` (COA tambahan), `id_program`, `id_contact`, `nik_input`, `nik_approve`, `page` (default 1), `per_page` atau `rows` (default 50, max 500), `sort`, `order` (`asc`|`desc`).
- **Tabel**: **SELECT** dari `fins_trans` **LEFT JOIN** `fins_coa` (debet & kredit), `hcm_karyawan` (input & approve), `hcm_kantor`, `setting_program`, `setting_contact`. Perhitungan saldo awal bisa memakai agregasi `fins_trans` + penyesuaian dari `fins_jurnal` (via_jurnal = 4).
- **Response**: `status`, `message`, `total`, `rows` (array dengan kolom debet, kredit, saldo, id_trans, tgl_exre, coa_debet, coa_kredit, kantor, program, keterangan, user_input, dll.; baris pertama `is_saldo_awal: true`), `footer` (SaldoAwal, debet, kredit, saldo, cdebet, ckredit), `time`.

**Contoh query raw (grid)**:
```sql
SELECT fins_trans.id_trans, fins_trans.tgl_exre, fins_trans.coa_debet, fins_trans.coa_kredit,
  fins_trans.nominal, fins_trans.jenis, fins_trans.mutasi, fins_trans.approve, fins_trans.noresi, fins_trans.keterangan,
  fins_trans.id_kantor, fins_trans.id_program, fins_trans.id_exre, coa_debet_t.nama_coa AS nama_coa_debet, coa_kredit_t.nama_coa AS nama_coa_kredit,
  hcm_kantor.kantor, setting_program.program
FROM fins_trans
LEFT JOIN fins_coa AS coa_debet_t ON coa_debet_t.coa = fins_trans.coa_debet
LEFT JOIN fins_coa AS coa_kredit_t ON coa_kredit_t.coa = fins_trans.coa_kredit
LEFT JOIN hcm_kantor ON hcm_kantor.id_kantor = fins_trans.id_kantor
LEFT JOIN setting_program ON setting_program.id_program = fins_trans.id_program
WHERE (fins_trans.coa_debet = :coa OR fins_trans.coa_kredit = :coa)
  AND fins_trans.jenis IN ('r', 'e')
  AND DATE(fins_trans.tgl_exre) BETWEEN :tanggal_awal AND :tanggal_akhir
ORDER BY fins_trans.tgl_exre, fins_trans.id_trans
LIMIT :per_page OFFSET :offset;
```

---

### 4.34 GET `/api/setting/coa`

- **Auth**: API key.
- **Kegunaan**: Daftar COA dengan paging dan filter; default hanya `active = 'y'`. Mode khusus: `for_selection=1` mengembalikan hanya array kode COA (wajib `parent_coa`).
- **Filter (query parameter)**  
  - **Wajib:** tidak ada (kecuali kondisi berikut).  
  - **Wajib jika:** `for_selection=1` → `parent_coa` wajib; `all_child=1` → `parent_coa` wajib (400 jika tidak diisi).  
  - **Opsional:** `page` (default 1), `per_page` (default 10, max 100), `nama_coa` (exact), `coa` (exact), `group`, `level`, `parent`, `default`, `saldo`, `active` (override default 'y'), `id_kantor` (FIND_IN_SET di kolom id_kantor), `parent_coa` (filter anak langsung atau semua keturunan jika `all_child=1`), `terms` (LIKE nama_coa, coa, note, keterangan), `for_selection` (0|1), `all_child` (0|1).
- **Tabel**: **SELECT** dari `fins_coa` (default `active = 'y'`).
- **Contoh query raw**: sama seperti dokumentasi COA sebelumnya (SELECT dari fins_coa).

---

### 4.35 GET `/api/setting/coa/saldo`

- **Auth**: API key.
- **Kegunaan**: Hitung saldo COA: saldo opname (dari `fins_opname`) + saldo dari transaksi (`fins_trans`) sesuai rumus (debet/kredit by jenis dan mutasi). Path sekarang di **setting**.
- **Filter (query parameter)**  
  - **Wajib:** `coa` (string). Validasi Laravel `required`; jika gagal → 404 dengan message "Validasi gagal".  
  - **Opsional:** tidak ada.
- **Tabel**: **SELECT** dari `fins_coa`, `fins_opname`; subquery/raw dari `fins_trans` untuk saldo transaksi.
- **Response**: `status`, `message`, `data` (saldo). Jika COA tidak ditemukan → 404.

---

### 4.36 GET `/api/logs/transactions`

- **Auth**: API key.
- **Kegunaan**: Baca log transaksi per tanggal dari file (bukan database).
- **Filter (query parameter)**  
  - **Wajib:** tidak ada.  
  - **Opsional:** `date` (format Y-m-d; default: hari ini). Jika file tidak ada → 404.
- **Sumber**: File `storage/logs/transactions/transactions-{date}.log`.
- **Response**: `status`, `data` (array baris log yang di-parse JSON).

---

### 4.37 GET `/api/logs/transactions/{id}`

- **Auth**: API key.
- **Kegunaan**: Cari log transaksi yang memuat ID tertentu (`context.transaction_id` = path `id`) di file log per tanggal.
- **Filter (query parameter)**  
  - **Wajib (path):** `id` (ID transaksi).  
  - **Opsional:** `date` (Y-m-d; default: hari ini). Jika file tidak ada → 404.
- **Response**: `status`, `data` (array baris log yang match `transaction_id`).

---

## 5. Referensi Tabel dan Skema

Berikut ringkasan tabel yang dipakai API (detail kolom lengkap ada di `schema_api_golang.sql`).

| Tabel | Keterangan singkat |
|-------|--------------------|
| **admin_entitas** (DB **zains**) | id_entitas (PK), entitas, apikey, type, domain, active, expired, dll. Sumber API key dan mapping entitas. |
| **corez_donatur** | id_donatur (PK), donatur, hp, email, id_jenis, status, id_kantor, id_crm, tgl_reg, last_transaction, dll. |
| **corez_transaksi** | id_transaksi + detailid (PK), id_donatur, id_program, coa_debet, coa_kredit, transaksi, tgl_transaksi, id_kantor_transaksi, approved_transaksi, no_bukti, id_via_bayar, dll. |
| **corez_pm** | Penerima manfaat (id_pm, pm, jenis, hp, email, alamat, id_pj, aktif, dll.). |
| **fins_trans** | id_trans (PK), id_transaksi, id_exre, coa_debet, coa_kredit, nominal, keterangan, nik_input, tgl_exre, id_kantor, approve, jenis (r/e), mutasi, id_program, noresi, dll. |
| **fins_coa** | coa (PK), nama_coa, coa_parent, level, active, saldo (d/k), dll. |
| **fins_bank_rek** | id_rekening (PK), id_bank, keterangan, coa, active, dll. |
| **fins_jurnal** | id_jurnal (PK), id_transaksi, coa, debet, kredit, tgl_exre, dll. |
| **fins_opname** | tanggal, coa, id_kantor, per, via (PK komposit), saldo_awal, saldo_akhir, dll. |
| **hcm_kantor** | id_kantor (PK), kantor, alamat, kota, coa, coa_noncash, dll. |
| **hcm_karyawan** | id_karyawan (PK), karyawan, email, hp, id_kantor, id_jabatan, status_karyawan, id_donatur, dll. |
| **setting_program** | id_program (PK), program, id_program_parent, coa_individu, coa_entitas, coa1, coa2, dp, jenis, aktif, dll. |
| **setting_contact** | Contact (id_contact, nama_lengkap, hp, email, alamat, id_crm, id_kantor, dll.). |
| **setting_campaign** | Campaign (id, campaign, id_campaign_parent, id_program, program, nominal, active, dll.). |
| **setting_object** | Key-value (i, o json, dll.). |

Relasi utama:

- `corez_transaksi.id_donatur` → `corez_donatur.id_donatur`
- `corez_transaksi.id_program` → `setting_program.id_program`
- `corez_transaksi.coa_debet` → `fins_coa.coa` / `fins_bank_rek.coa` (format bisa tanpa titik)
- `corez_transaksi.id_kantor_transaksi` → `hcm_kantor.id_kantor`
- `corez_transaksi.id_crm` → `hcm_karyawan.id_karyawan` (atau referensi CRM)
- `fins_trans.nik_input` → `hcm_karyawan.id_karyawan`
- `fins_trans.id_kantor` → `hcm_kantor.id_kantor`
- `fins_trans.coa_debet` / `coa_kredit` → `fins_coa.coa`

---

## 6. Contoh Request dengan Header

Mendapatkan API key (tanpa auth):

```bash
curl -X POST "https://your-api-host/api/setting/apikey" \
  -H "Content-Type: application/json" \
  -d '{"id_entitas": "CSF"}'
```

Memanggil endpoint yang dilindungi API key (mis. simpan transaksi):

```bash
curl -X POST "https://your-api-host/api/corez/transaksi/save" \
  -H "Content-Type: application/json" \
  -H "Authorization: 6dc7a19ca38ac6f919d143634a584fba0964eb544a8a13dd4a846de45e519d1c" \
  -d '{
    "id_program": "22",
    "id_rekening": "10109003000",
    "id_kantor": 1,
    "id_karyawan": "1012025161001",
    "id_donatur": "26030700100007",
    "tgl_transaksi": "2026-03-07",
    "id_penghimpunan": 6,
    "id_via_himpun": "Donasi Online",
    "user_insert": "System Cron",
    "ViaInput": "Crowdfunding",
    "transaksi": 100000,
    "id_via_bayar": 2,
    "quantity": 1,
    "keterangan": "Donasi Palestina",
    "no_bukti": "070326200019"
  }'
```

Dengan header `Authorization` tersebut, backend akan mengidentifikasi entitas dari `admin_entitas` (mis. CSF) dan mengarahkan semua query ke database `zains_csf` (env `DB_CSF`).
