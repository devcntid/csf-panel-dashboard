/**
 * Nilai trx_no untuk UNIQUE (clinic_id, trx_no, trx_date).
 * Upload Excel: jika nomor transaksi kosong, gunakan kunci sintetis agar idempoten
 * setara constraint lama (erm_no + tanggal + poli + total tagihan).
 */
export function resolveTrxNoForUploadUpsert(options: {
  trxNoRaw: string
  clinicId: number
  ermNo: string
  trxDate: string
  polyclinic: string
  billTotal: number
  rowIndex: number
}): string {
  const t = String(options.trxNoRaw ?? '').trim()
  if (t) return t
  const poly = String(options.polyclinic ?? '').trim()
  const erm = String(options.ermNo ?? '').trim()
  const totalKey = Number.isFinite(options.billTotal)
    ? options.billTotal.toFixed(2)
    : '0.00'
  if (erm) {
    return `legacy:${options.clinicId}:${erm}:${options.trxDate}:${poly}:${totalKey}`
  }
  return `legacy:${options.clinicId}:${options.trxDate}:row:${options.rowIndex}`
}
