# Dashboard finansial (perencanaan + implementasi)

## Ringkasan keputusan

| Aspek | Keputusan |
|-------|-----------|
| Aktual | API Zains (`GET /api/summary/se-yearly`) — sama dengan tabel pivot Summary Dashboard. |
| Target | Neon Postgres `clinic_daily_targets.target_revenue`, agregasi per `source_id` (dan rollup SE / FUNDRAISING / Penerimaan lainnya / semua `sources`). |
| Non-klinik | `clinic_id` NULL, `source_id` terisi — ikut dalam `SUM(target_revenue)`. |
| Halaman visual | **`/dashboard/financial-visual`** — KPI, garis (SE vs Fundraising), donut komposisi. |
| Halaman tabel | **`/dashboard/summary-dashboard`** — pivot bulanan; tautan silang ke visual. |

## File yang diimplementasikan

| File | Peran |
|------|--------|
| [`app/api/summary/se-yearly/route.ts`](../app/api/summary/se-yearly/route.ts) | Respons + `targets.bySourceId` + `targets.rollup` (aktual vs target + %). |
| [`app/api/financial/revenue-growth/route.ts`](../app/api/financial/revenue-growth/route.ts) | Growth revenue tahunan (YoY) dari Zains `fins/total` group_by=yearly. |
| [`lib/summary-se-yearly-types.ts`](../lib/summary-se-yearly-types.ts) | Tipe + `formatRupiah` / `formatAchievementPct`. |
| [`lib/fetch-se-yearly-summary.ts`](../lib/fetch-se-yearly-summary.ts) | Fetch dengan retry + `onAttempt`. |
| [`lib/summary-pivot-helpers.ts`](../lib/summary-pivot-helpers.ts) | `findRowMonthly` untuk seri grafik. |
| [`lib/fins-totals.ts`](../lib/fins-totals.ts) | Pembungkus resmi `fins/total` termasuk group_by daily/weekly/monthly/quarterly/yearly. |
| [`lib/zains-series.ts`](../lib/zains-series.ts) | Helper range & grouped (`fetchZainsRangeSum`, `fetchZainsRangeNetSum`, `fetchZainsGroupedTotals`) untuk berbagai kategori sumber. |
| [`app/dashboard/financial-visual/page.tsx`](../app/dashboard/financial-visual/page.tsx) | Dashboard visual (Chart.js). |
| [`app/dashboard/summary-dashboard/page.tsx`](../app/dashboard/summary-dashboard/page.tsx) | Tabel pivot + link ke visual. |
| [`app/dashboard/layout.tsx`](../app/dashboard/layout.tsx) | Item menu Dashboard Finansial. |
| [`app/api/financial/time-tracker/route.ts`](../app/api/financial/time-tracker/route.ts) | Time Performance Tracker: daily/weekly/quarterly langsung dari group_by Zains, monthly via `buildBuckets`. |
| [`app/api/financial/clinic-ranking/route.ts`](../app/api/financial/clinic-ranking/route.ts) | Ranking capaian revenue SE Klinik per klinik (top list). Response menyertakan `grand_total_curr` / `grand_total_prev` (jumlah semua klinik, bukan hanya top 10) untuk baris footer **Grand total** di tabel ranking. |
| [`app/api/financial/clinic-heatmap/route.ts`](../app/api/financial/clinic-heatmap/route.ts) | Heatmap bulanan SE Klinik per klinik (top beberapa klinik utama). |

## Catatan

- **Dashboard Lembaga** ([`app/dashboard/yayasan/page.tsx`](../app/dashboard/yayasan/page.tsx)): agregasi operasional dari Neon (`transactions`) via [`app/api/dashboard/yayasan-stats/route.ts`](../app/api/dashboard/yayasan-stats/route.ts). Bagian donasi/kampanye tetap contoh bila belum ada sumber data.
- Tanpa cache/job; waktu muat mengikuti `se-yearly` (banyak call Zains).
- **Sumber halaman visual (inline dengan repo):** salinan TypeScript ada di [`docs/financial-visual-page.tsx.md`](financial-visual-page.tsx.md) (blok `tsx`); diekstrak ke [`app/dashboard/financial-visual/page.tsx`](../app/dashboard/financial-visual/page.tsx) saat build/setup (atau sudah tersinkron di git). Halaman ini sekarang memuat:
  - KPI rollup + kartu tambahan **Growth Revenue (YoY)**.
  - **Time Performance Tracker** dengan tab Daily / Weekly / Monthly / Quarterly yang langsung mengikuti `labels` dan agregasi dari API `time-tracker`.
  - **Stacked chart weekly/monthly** (bar per kategori + line GRAND TOTAL).
  - **Clinic Performance Ranking** (top klinik berdasarkan revenue SE Klinik + footer grand total semua klinik).
  - **Growth Heatmap per Klinik** berbasis total SE Klinik bulanan untuk beberapa klinik utama.

---

## Lampiran: isi halaman visual

Detail kode: [`docs/financial-visual-page.tsx.md`](financial-visual-page.tsx.md).

Ringkas perilaku:

- `fetchSeYearlySummary` + `findRowMonthly` untuk garis bulanan TOTAL SE vs TOTAL FUNDRAISING (sama dengan pivot).
- Donut: proporsi aktual SE / Fundraising / Penerimaan lainnya dari `targets.rollup`.
- Kartu KPI: empat rollup + progress bar untuk GRAND TOTAL.
