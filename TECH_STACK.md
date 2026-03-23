## Tech Stack `cita-sehat-dashboard`

File ini menjelaskan secara ringkas teknologi dan dependencies yang digunakan pada project ini, termasuk bagaimana Drizzle dipakai.

### Arsitektur Utama

- **Framework utama**: `Next.js 16` (React 19) untuk web app fullstack (SSR/SSG/ISR, API routes, routing).
- **Bahasa**: `TypeScript` untuk type-safety di seluruh codebase.
- **Styling**: `Tailwind CSS 4` + `tailwind-merge`, `tailwindcss-animate`, `tw-animate-css` untuk utility-first styling dan animasi.
- **UI library**: `Radix UI` (`@radix-ui/react-*`), `lucide-react`, `cmdk`, `vaul` untuk komponen UI aksesibel dan konsisten.

### Database & Data Layer

- **ORM utama**: `Prisma` (`prisma`, `@prisma/client`) untuk akses database utama aplikasi.
- **Drizzle**:
  - Paket: `drizzle-orm`, `drizzle-kit`.
  - **Scope penggunaan**: hanya digunakan untuk **proses migrasi dan seeding data** di script `scripts/*.ts` (mis. `migrate`, `seed`).
  - Aplikasi (runtime Next.js) **tidak mengandalkan Drizzle sebagai ORM utama**, tapi hanya memanfaatkan kemudahan tooling Drizzle untuk:
    - Mendefinisikan schema untuk migrasi.
    - Menjalankan migrasi struktur tabel.
    - Menyiapkan data awal (seed) ke database.
- **SQL/Driver pendukung**:
  - `pg`, `postgres`, `mysql2`, `better-sqlite3`, `sqlite3`, `sql.js`: driver dan engine untuk koneksi ke berbagai jenis database (Postgres, MySQL, SQLite, in-browser SQL).
  - `knex`, `kysely`: query builder/abstraksi SQL tambahan (digunakan di beberapa script/tools).
  - `@types/better-sqlite3`, `@types/pg`, `@types/sql.js`: type definitions untuk TypeScript.
- **Database cloud/serverless**:
  - `@vercel/postgres`, `@planetscale/database`, `@neondatabase/serverless`, `@tidbcloud/serverless`, `@xata.io/client`, `@libsql/client`, `@libsql/client-wasm`, `@electric-sql/pglite`: client untuk berbagai solusi database serverless/hosted yang bisa digunakan oleh instance berbeda dari aplikasi.

### Auth, Security & Session

- **Auth**:
  - `next-auth`, `@auth/core`: otentikasi user, session, dan provider login (email/credential/third party).
- **WebAuthn**:
  - `@simplewebauthn/browser`, `@simplewebauthn/server`: dukungan login berbasis WebAuthn/passkey.

### Queue, Background Job & Workflow

- **Upstash**:
  - `@upstash/redis`: Redis serverless untuk caching, queue, atau session store.
  - `@upstash/qstash`: message queue / job scheduling serverless.
  - `@upstash/workflow`: orkestrasi workflow background yang kompleks.

### Observability & Analytics

- **Telemetry**:
  - `@opentelemetry/api`: standar API untuk tracing dan metrics.
- **Analytics**:
  - `@vercel/analytics`: analitik bawaan Vercel untuk page views & event tracking.

### Email & Komunikasi

- **Email**:
  - `nodemailer`: pengiriman email (notifikasi, verifikasi, dsb).

### File, Blob & Export

- **File storage**:
  - `@vercel/blob`: penyimpanan file/blob di Vercel (mis. upload dokumen, gambar).
- **Export & laporan**:
  - `xlsx`: generate dan baca file Excel.
  - `jspdf`, `html2canvas`: generate PDF berbasis HTML (export laporan, invoice, dsb).

### State Management Form & Validasi

- **Form**:
  - `react-hook-form`: manajemen form yang efisien dan terkontrol.
  - `@hookform/resolvers`: integrasi schema validation (mis. dengan Zod) ke `react-hook-form`.
- **Validasi**:
  - `zod`: schema validation di sisi client dan server (request body, form value, config).

### UI Components & Editor

- **Tiptap (rich text editor)**:
  - `@tiptap/core`, `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/pm`,
    `@tiptap/extension-code-block`, `@tiptap/extension-code-block-lowlight`,
    `@tiptap/extension-image`, `@tiptap/extension-link`:
    rich text editor modular dengan dukungan image, link, code block, dsb.
- **Drag & drop**:
  - `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`: drag-and-drop dan sorting di UI.
- **Carousel & layout**:
  - `embla-carousel-react`: carousel/slider.
  - `react-resizable-panels`: layout panel yang bisa di-resize.
- **Tanggal & kalender**:
  - `react-day-picker`: komponen kalender untuk memilih tanggal.
  - `date-fns`: helper manipulasi tanggal.
- **Charts & visualisasi data**:
  - `chart.js`, `react-chartjs-2`, `recharts`: grafik interaktif (line, bar, pie, dsb).
- **Toast & notifikasi**:
  - `sonner`: toast notification system.
- **OTP & input khusus**:
  - `input-otp`: input OTP dengan UX yang baik.

### Styling & Utilitas React

- **Styling helper**:
  - `class-variance-authority`: helper untuk membuat variant-based styling.
  - `clsx`: helper untuk menggabungkan className secara kondisional.
- **Theming**:
  - `next-themes`: dukungan tema (mis. dark/light mode) berbasis Next.js.

### Infrastruktur & Runtime

- **Next.js & React**:
  - `next`: framework utama aplikasi.
  - `react`, `react-dom`: core library React.
- **Cloud & platform types**:
  - `@cloudflare/workers-types`: type definitions untuk Cloudflare Workers (jika ada deployment/edge worker).
- **Environment**:
  - `dotenv`: load environment variable dari file `.env*`.

### DevDependencies

- **Build & tooling**:
  - `typescript`: bahasa TypeScript.
  - `tsx`: menjalankan file TypeScript tanpa proses build terpisah (dipakai untuk script seperti `migrate` dan `seed`).
- **Styling build**:
  - `tailwindcss`, `@tailwindcss/postcss`, `postcss`: toolchain untuk Tailwind CSS 4.
- **Types**:
  - `@types/node`, `@types/react`, `@types/react-dom`: type definitions untuk Node dan React.

### Scripts Terkait Drizzle, Migrasi & Seed

- **Script utama** (dari `package.json`):
  - `migrate`: menjalankan `tsx scripts/migrate.ts` dan `tsx scripts/add-summary-fields.ts`.
  - `migrate:*`: script migrasi tambahan spesifik (penambahan kolom, perbaikan FK, dsb).
  - `seed`: menjalankan `tsx scripts/seed.ts` dan `tsx scripts/add-summary-fields.ts`.
- **Peran Drizzle di sini**:
  - Script migrasi/seeding menggunakan schema dan tooling Drizzle (`drizzle-orm`, `drizzle-kit`) untuk:
    - Men-generate dan mengeksekusi migrasi database.
    - Menulis data awal (seed) menggunakan query type-safe.
  - Setelah migrasi/seed selesai, aplikasi daily-use tetap memakai stack ORM/data-access utama (mis. Prisma) untuk operasi runtime.

### Ringkasan

- **Drizzle** di project ini **dibatasi untuk keperluan migrasi & seed** melalui script TypeScript, bukan sebagai ORM utama pada runtime.
- Project mengadopsi stack modern: **Next.js 16 + React 19 + TypeScript + Tailwind 4 + Radix UI**, dengan dukungan kaya untuk **database multi-provider, auth, analytics, queue, file handling, dan charts**.

