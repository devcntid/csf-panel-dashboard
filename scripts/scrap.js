const { chromium } = require('playwright');
const fs = require('fs');

async function scrapEclinic() {
  // --- KONFIGURASI ---
  const NAMA_KLINIK = 'PRATAMA CITA SEHAT JAKARTA';
  const USERNAME = 'harini';
  const PASSWORD = 'H4rini0k!_';

  console.log('🚀 Memulai scraping eClinic...');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 500,
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await page.goto('https://csf.eclinic.id/login');
    console.log('✅ Halaman login dimuat');

    // 1. Pilih Klinik
    console.log('📝 Memilih klinik...');
    await page.getByPlaceholder('Pilih Klinik').click();
    await page.getByPlaceholder('Pilih Klinik').fill(NAMA_KLINIK);
    await page.getByText(NAMA_KLINIK).click();

    // 2. Login
    console.log('🔐 Melakukan login...');
    await page.getByPlaceholder('ID Pengguna').fill(USERNAME);
    await page.getByPlaceholder('Kata Sandi').fill(PASSWORD);
    await page.getByRole('button', { name: 'Login' }).click();

    await page.waitForURL('**/dashboard**', { timeout: 15000 }).catch(() => {
      console.log('⚠️  Mungkin sudah di dashboard atau perlu menunggu lebih lama');
    });
    console.log('✅ Login berhasil');

    // 3. Masuk Laporan Pendapatan Harian
    console.log('📊 Membuka halaman laporan pendapatan harian...');
    await page.getByRole('button', { name: 'Laporan' }).click();
    await page.getByRole('link', { name: 'Laporan Pendapatan Harian' }).click();

    // 4. Pilih filter (semua puskesmas/asuransi/ruangan)
    console.log('✅ Mengaktifkan semua filter...');
    await page.locator('#selectAllPuskesmas').check();
    await page.locator('#selectAllAsuransi').check();
    await page.locator('#selectAllRuangan').check();

    // 5. Tampilkan data
    console.log('🔍 Menampilkan data...');
    await page.getByRole('button', { name: 'Tampilkan' }).click();

    // --- BAGIAN SCRAPING ---
    console.log('⏳ Menunggu tabel muncul...');
    await page.waitForSelector('table tbody tr', { timeout: 30000 });

    const dataScraped = await page.$eval('table', (table) => {
      // Bangun header multi-level (meng-handle colspan/rowspan)
      var headerRows = Array.from(table.querySelectorAll('thead tr'));
      var headerMatrix = [];

      headerRows.forEach(function (row, rowIndex) {
        if (!headerMatrix[rowIndex]) headerMatrix[rowIndex] = [];
        var cells = Array.from(row.children);
        var colIndex = 0;

        cells.forEach(function (cell) {
          // Lompat ke kolom kosong berikutnya
          while (headerMatrix[rowIndex][colIndex]) {
            colIndex++;
          }

          var rowSpan = parseInt(cell.getAttribute('rowspan') || '1', 10);
          var colSpan = parseInt(cell.getAttribute('colspan') || '1', 10);
          var text = (cell.innerText || '').trim();

          for (var r = 0; r < rowSpan; r++) {
            var targetRow = rowIndex + r;
            if (!headerMatrix[targetRow]) headerMatrix[targetRow] = [];
            for (var c = 0; c < colSpan; c++) {
              headerMatrix[targetRow][colIndex + c] = text;
            }
          }

          colIndex += colSpan;
        });
      });

      // Gabungkan header per kolom (parent - child - dst)
      var maxHeaderRow = headerMatrix.length;
      var totalCols = headerMatrix[maxHeaderRow - 1].length;
      var finalHeaders = [];

      for (var col = 0; col < totalCols; col++) {
        var labels = [];
        for (var rowIdx = 0; rowIdx < maxHeaderRow; rowIdx++) {
          var label = headerMatrix[rowIdx][col];
          if (label && labels.indexOf(label) === -1) {
            labels.push(label);
          }
        }
        finalHeaders[col] = labels.join(' - ') || ('Col ' + (col + 1));
      }

      // Scrap semua baris body
      var bodyRows = Array.from(table.querySelectorAll('tbody tr'));

      return bodyRows.map(function (tr) {
        var cells = Array.from(tr.querySelectorAll('td'));
        if (cells.length === 0) return null;

        var rowData = {};
        finalHeaders.forEach(function (header, idx) {
          var cell = cells[idx];
          rowData[header] = cell && cell.innerText ? cell.innerText.trim() : '';
        });

        return rowData;
      }).filter(function (row) { return row !== null; });
    });

    console.log(`\n✅ Berhasil mengambil ${dataScraped.length} baris data:`);
    console.table(dataScraped);

    const outputPath = 'cek_data.json';
    fs.writeFileSync(outputPath, JSON.stringify(dataScraped, null, 2));
    console.log(`\n💾 File ${outputPath} telah dibuat.`);
  } catch (error) {
    console.error('❌ Error saat scraping:', error && error.message ? error.message : error);
    throw error;
  } finally {
    await browser.close();
    console.log('🔒 Browser ditutup');
  }
}

scrapEclinic()
  .then(() => {
    console.log('\n✨ Scraping selesai!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Scraping gagal:', error);
    process.exit(1);
  });
