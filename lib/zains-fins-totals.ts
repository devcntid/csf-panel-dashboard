/**
 * Konvensi query untuk GET /fins/totals ke Zains.
 * Dipakai oleh semua route yang memanggil endpoint ini agar filter tidak terlewat.
 */
export const ZAINS_FINS_TOTALS_APPROVE_VALUE = 'a'

/**
 * Mutates searchParams: menambahkan filter approve yang dipakai Zains.
 */
export function applyZainsFinsTotalsQueryDefaults(searchParams: URLSearchParams): void {
  searchParams.set('approve', ZAINS_FINS_TOTALS_APPROVE_VALUE)
}

/**
 * Base URL dari env (tanpa trailing slash) + path /fins/totals + query (termasuk approve).
 */
export function resolveZainsFinsTotalsUrl(baseUrl: string, searchParams: URLSearchParams): string {
  const base = baseUrl.trim().replace(/\/+$/, '')
  applyZainsFinsTotalsQueryDefaults(searchParams)
  return `${base}/fins/totals?${searchParams.toString()}`
}

/** Daftar ID (atau token) dipisah koma, sama seperti COA di config source. */
export function parseCommaSeparatedIds(raw: string | null | undefined): string[] {
  if (raw == null || typeof raw !== 'string' || !raw.trim()) return []
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

/**
 * Query Zains /fins/totals: only_id_contact & exclude_id_contact (comma-separated).
 */
export function applyZainsFinsTotalsContactFilters(
  searchParams: URLSearchParams,
  onlyIds: string[],
  excludeIds: string[],
): void {
  if (onlyIds.length > 0) {
    searchParams.set('only_id_contact', onlyIds.join(','))
  }
  if (excludeIds.length > 0) {
    searchParams.set('exclude_id_contact', excludeIds.join(','))
  }
}
