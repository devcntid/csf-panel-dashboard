import type { PivotResponse } from '@/lib/summary-se-yearly-types'

export const SE_YEARLY_MAX_ATTEMPTS = 3
export const SE_YEARLY_RETRY_DELAY_MS = 5000
export const SE_YEARLY_FETCH_TIMEOUT_MS = 280_000

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms))
}

export type FetchSeYearlyResult =
  | { ok: true; data: PivotResponse }
  | { ok: false; error: string; status?: number }

/**
 * Ambil summary tahunan (Zains + target Neon) dengan retry sama seperti halaman Summary Dashboard.
 */
export async function fetchSeYearlySummary(
  year: number,
  options?: { signal?: AbortSignal; isCancelled?: () => boolean; onAttempt?: (attempt: number) => void },
): Promise<FetchSeYearlyResult> {
  const params = new URLSearchParams({ year: String(year) })

  for (let attempt = 1; attempt <= SE_YEARLY_MAX_ATTEMPTS; attempt++) {
    options?.onAttempt?.(attempt)
    if (options?.isCancelled?.()) return { ok: false, error: 'Dibatalkan' }

    const controller = new AbortController()
    const clientTimer = setTimeout(() => controller.abort(), SE_YEARLY_FETCH_TIMEOUT_MS)

    try {
      const res = await fetch(`/api/summary/se-yearly?${params.toString()}`, {
        cache: 'no-store',
        signal: controller.signal,
      })
      clearTimeout(clientTimer)

      let json: PivotResponse & { message?: string }
      try {
        json = (await res.json()) as PivotResponse & { message?: string }
      } catch {
        json = { success: false, message: 'Respons tidak valid' } as PivotResponse & { message?: string }
      }

      if (options?.isCancelled?.()) return { ok: false, error: 'Dibatalkan' }

      if (res.ok && json.success) {
        return { ok: true, data: json }
      }

      const serverMsg =
        typeof json?.message === 'string' && json.message.trim()
          ? json.message.trim()
          : `Permintaan gagal (${res.status})`

      const retryable =
        res.status === 502 ||
        res.status === 503 ||
        res.status === 504 ||
        res.status === 408 ||
        res.status === 429

      if (retryable && attempt < SE_YEARLY_MAX_ATTEMPTS) {
        await sleep(SE_YEARLY_RETRY_DELAY_MS)
        continue
      }

      return {
        ok: false,
        error:
          retryable || res.status >= 500
            ? `${serverMsg} — Layanan Zains/Koyeb sedang lambat atau sibuk.`
            : serverMsg,
        status: res.status,
      }
    } catch (err: unknown) {
      clearTimeout(clientTimer)
      if (options?.isCancelled?.()) return { ok: false, error: 'Dibatalkan' }

      const isAbort = err instanceof Error && err.name === 'AbortError'
      const msg = isAbort
        ? 'Waktu tunggu habis — server masih memproses banyak data dari Zains.'
        : err instanceof Error
          ? err.message
          : 'Gagal terhubung ke server.'

      if (attempt < SE_YEARLY_MAX_ATTEMPTS) {
        await sleep(SE_YEARLY_RETRY_DELAY_MS)
        continue
      }

      return {
        ok: false,
        error: `${msg} Silakan tunggu sebentar lalu ketuk Muat ulang — kami sudah mencoba ${SE_YEARLY_MAX_ATTEMPTS} kali.`,
      }
    }
  }

  return { ok: false, error: 'Gagal setelah beberapa percobaan.' }
}
