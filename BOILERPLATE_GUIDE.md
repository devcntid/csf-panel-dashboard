## Panduan Membuat Boilerplate dari Repo Ini

File ini menjelaskan hal-hal apa saja yang perlu disiapkan jika kamu ingin menjadikan repo ini sebagai **boilerplate** untuk project lain (selain TRD), dengan tetap memanfaatkan struktur, tooling, dan setup yang sudah ada.

### 1. Tujuan Boilerplate

- **Tujuan**: menyediakan starting point untuk aplikasi dashboard berbasis:
  - **Next.js 16 + React 19 + TypeScript**
  - **Tailwind CSS 4 + Radix UI** untuk UI
  - **Prisma + (opsional) Drizzle untuk migrasi/seed**
  - Integrasi **queue, analytics, file storage**, dll (bisa diaktifkan/di-nonaktifkan sesuai kebutuhan).

### 2. Hal yang Perlu Dipersiapkan & Diadaptasi

#### 2.1. Bersihkan Identitas Spesifik Project (Branding & Domain)

- **Ganti nama project**:
  - Ubah `name` dan `version` di `package.json` sesuai nama project baru.
  - Perbarui judul, meta, dan branding (logo, warna, text) di:
    - Layout/root (`app/layout.tsx` atau sejenisnya).
    - Komponen header/sidebar, logo, dan halaman login.
- **Hilangkan/ubah teks spesifik CSF, eClinic, Zains**:
  - Cari kata kunci seperti `Cita Sehat`, `CSF`, `eClinic`, `Zains` dan sesuaikan dengan domain project baru.

#### 2.2. Environment Variables

- **Siapkan file `.env.local` baru** (jangan commit `.env` lama):
  - Sesuaikan daftar env dari `README.md` dan tambahkan penjelasan untuk project baru.
  - Minimal:
    - Konfigurasi **database** (`DATABASE_URL`, dll).
    - URL aplikasi (`NEXT_PUBLIC_APP_URL` atau gunakan otomatis dari deployment).
    - Jika tidak memakai Zains/QStash/Blob, kamu bisa:
      - Mengosongkan variabel terkait, atau
      - Menghapus/mematikan fitur yang membutuhkan variabel tersebut.

#### 2.3. Database & ORM

- **Pilih database utama**:
  - Contoh: tetap pakai **Neon Postgres**, atau ganti ke provider lain sesuai kebutuhan.
- **Prisma**:
  - Sesuaikan `schema.prisma` (tabel, relasi, enum) dengan domain project baru.
  - Jalankan:
    - `pnpm migrate` (atau `pnpm prisma migrate dev` jika kamu menambahkan script).
- **Drizzle (opsional, hanya untuk migrasi/seed)**:
  - Pertahankan pola di repo ini: Drizzle hanya untuk **migrasi + seed**.
  - Sesuaikan:
    - Struktur schema Drizzle (jika ada) di folder `drizzle` / `scripts/schema`.
    - Script di `scripts/migrate*.ts` dan `scripts/seed*.ts`.

#### 2.4. Pembersihan Dependency

- **Tinjau `TECH_STACK.md` dan `package.json`**:
  - Banyak dependency disiapkan untuk fitur-fitur spesifik (Zains, QStash, WebAuthn, multi database provider, dsb).
  - Untuk boilerplate ringan, kamu bisa:
    - Mempertahankan hanya core:
      - `next`, `react`, `react-dom`, `typescript`, `tailwindcss`, `@radix-ui/react-*`, `lucide-react`, `zod`, `react-hook-form`, `sonner`, dll.
    - Menghapus yang tidak dipakai (misal tidak butuh `@simplewebauthn/*`, `@upstash/*`, beberapa client database serverless sekaligus, dsb).
  - Ini membuat boilerplate:
    - Lebih ringan.
    - Lebih fokus ke kebutuhan generik dashboard.

#### 2.5. Struktur Folder & Modul

- **Identifikasi modul yang reusable** (cocok untuk semua dashboard):
  - Layout dasar (sidebar, navbar, tema, mode gelap).
  - Komponen tabel, filter, pagination.
  - Komponen form (input, select, date picker, dialog).
  - Sistem notifikasi/toast.
- **Pisahkan modul domain-spesifik**:
  - Modul seperti transaksi eClinic, sinkronisasi Zains, konfigurasi klinik, dll:
    - Bisa dipindah ke folder `examples/` atau `features/csf/` jika mau tetap disimpan.
    - Atau dihapus dari boilerplate minimal.

#### 2.6. Auth & Role Management

- **Gunakan NextAuth/`@auth/core` sebagai dasar**:
  - Pertahankan konfigurasi auth (provider, session) tapi ganti:
    - Nama sistem.
    - URL callback.
    - Skema user/role di database.
- Dokumentasikan secara singkat di file ini:
  - Alur login.
  - Struktur tabel user/role.

### 3. File `.md` yang Direkomendasikan untuk Boilerplate

Agar boilerplate enak dipakai, siapkan beberapa dokumentasi `.md` berikut:

- **`README.md` (versi boilerplate)**:
  - Deskripsi singkat boilerplate (bukan lagi CSF/Zains).
  - Cara setup (prasyarat, env, migrasi DB, menjalankan dev/prod).
  - Link ke file dokumentasi lain (`TECH_STACK.md`, `BOILERPLATE_GUIDE.md`, dsb).

- **`TECH_STACK.md`** (sudah ada):
  - Sesuaikan penjelasan tech stack untuk konteks boilerplate generic (hapus bagian terlalu khusus CSF jika perlu).

- **`BOILERPLATE_GUIDE.md`** (file ini):
  - Jelaskan:
    - Apa saja yang harus diganti (branding, env, DB schema).
    - Mana modul yang bisa langsung dipakai, mana yang contoh saja.

- **`AUTH_FLOW.md`** (opsional tapi disarankan):
  - Dokumentasi alur login, session, role, dan proteksi halaman.

- **`DATABASE_SCHEMA.md`** (opsional):
  - Ringkasan tabel utama, relasi penting, dan convention penamaan.

### 4. Langkah Praktis Membuat Boilerplate dari Repo Ini

1. **Clone repo ini** dan buat repo baru (mis. `new-dashboard-boilerplate`).
2. **Bersihkan identitas**:
   - Ganti nama project di `package.json`, `README.md`, meta tags.
   - Ubah/bersihkan teks dan halaman yang menyebut CSF/eClinic/Zains.
3. **Tinjau dan sederhanakan dependency**:
   - Pakai `TECH_STACK.md` sebagai referensi.
   - Hapus dependency yang tidak dipakai di use case generikmu.
4. **Siapkan `.env.local` baru**:
   - Isi hanya env yang memang dipakai boilerplate.
   - Tambah contoh `.env.example` untuk mempermudah orang lain setup.
5. **Sesuaikan database & migrasi**:
   - Ubah schema Prisma dan (jika dipakai) schema Drizzle.
   - Jalankan `pnpm migrate`/`pnpm seed` untuk memastikan DB up-to-date.
6. **Rapikan struktur fitur**:
   - Pindahkan fitur yang hanya relevan untuk CSF ke folder `examples/` atau hapus.
   - Pastikan halaman default boilerplate menunjukkan contoh dashboard generik (bukan CSF).
7. **Update dokumentasi**:
   - Revisi `README.md`, `TECH_STACK.md`, dan `BOILERPLATE_GUIDE.md` supaya konsisten dengan boilerplate final.

### 5. Catatan Tentang Drizzle di Boilerplate

- Pertahankan pola dari repo ini:
  - **Drizzle hanya dipakai untuk migrasi & seed** via script di `scripts/*.ts`.
  - ORM utama runtime tetap bisa Prisma (atau yang kamu pilih).
- Kelebihan pola ini untuk boilerplate:
  - Orang yang memakai boilerplate bebas memilih cara akses data di runtime.
  - Migrasi/seed tetap type-safe dan rapi.

