/**
 * Membangun baris nominal untuk insert ke transactions_to_zains.
 * - paid_tax tidak punya program Zains terpisah: digabung ke kategori pembayaran terbesar (bukan Pembulatan);
 *   jika semua kategori layanan 0, pajak ditambahkan ke Pembulatan.
 * - Setelah pembulatan per baris (Math.round), selisih ke paid_total dialokasikan ke baris dengan nominal terbesar
 *   agar jumlah nominal Zains = paid_total (integer).
 */

export type ZainsPaidFieldRow = {
  key: string
  category: string
  value: number
  nominal: number
}

export function buildZainsPaidFieldRows(params: {
  paidRegist: number
  paidAction: number
  paidLab: number
  paidDrug: number
  paidAlkes: number
  paidMcu: number
  paidRadio: number
  paidRounding: number
  paidTax: number
  paidDiscount: number
  paidTotal: number
  usePaidDiscountForTindakanOnly: boolean
}): ZainsPaidFieldRow[] {
  const {
    paidRegist,
    paidAction,
    paidLab,
    paidDrug,
    paidAlkes,
    paidMcu,
    paidRadio,
    paidRounding,
    paidTax,
    paidDiscount,
    paidTotal,
    usePaidDiscountForTindakanOnly,
  } = params

  const tindakanValue = usePaidDiscountForTindakanOnly
    ? Math.max(0, paidAction - paidDiscount)
    : paidAction

  const fields: { key: string; category: string; value: number }[] = [
    { key: 'Jumlah Pembayaran ( Rp. ) - Karcis', category: 'Karcis', value: paidRegist },
    { key: 'Jumlah Pembayaran ( Rp. ) - Tindakan', category: 'Tindakan', value: tindakanValue },
    { key: 'Jumlah Pembayaran ( Rp. ) - Laboratorium', category: 'Laboratorium', value: paidLab },
    { key: 'Jumlah Pembayaran ( Rp. ) - Obat', category: 'Obat-obatan', value: paidDrug },
    { key: 'Jumlah Pembayaran ( Rp. ) - Alkes', category: 'Alat Kesehatan', value: paidAlkes },
    { key: 'Jumlah Pembayaran ( Rp. ) - MCU', category: 'MCU', value: paidMcu },
    { key: 'Jumlah Pembayaran ( Rp. ) - Radiologi', category: 'Radiologi', value: paidRadio },
    { key: 'Jumlah Pembayaran ( Rp. ) - Pembulatan', category: 'Pembulatan', value: paidRounding },
  ]

  const tax = Math.max(0, paidTax)
  if (tax > 0) {
    const serviceEntries = fields
      .map((f, i) => ({ i, f }))
      .filter(({ f }) => f.category !== 'Pembulatan')
    const positive = serviceEntries.filter(({ f }) => f.value > 0)
    if (positive.length > 0) {
      let best = positive[0]
      for (const x of positive) {
        if (x.f.value > best.f.value) best = x
      }
      fields[best.i].value += tax
    } else {
      const pemIdx = fields.findIndex((f) => f.category === 'Pembulatan')
      if (pemIdx >= 0) fields[pemIdx].value += tax
    }
  }

  const active = fields.filter((f) => f.value > 0)
  const rows: ZainsPaidFieldRow[] = active.map((f) => ({
    ...f,
    nominal: Math.round(f.value),
  }))

  const target = Math.round(paidTotal)
  const sumNom = rows.reduce((s, r) => s + r.nominal, 0)
  const delta = target - sumNom
  if (delta !== 0 && rows.length > 0) {
    let bestI = 0
    for (let i = 1; i < rows.length; i++) {
      if (rows[i].nominal > rows[bestI].nominal) bestI = i
    }
    rows[bestI].nominal += delta
  }

  return rows
}
