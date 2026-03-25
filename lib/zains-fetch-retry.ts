/**
 * Fetch ke API Zains dengan timeout per percobaan + retry untuk timeout / 5xx / 429.
 * Env opsional: ZAINS_FETCH_TIMEOUT_MS (default 120000), ZAINS_FETCH_RETRIES (default 2).
 */

export type ZainsFetchRetryOptions = {
  timeoutMs?: number
  retries?: number
  baseDelayMs?: number
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms))
}

function parseEnvInt(name: string, fallback: number): number {
  const v = process.env[name]
  if (v == null || v === '') return fallback
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

const DEFAULT_TIMEOUT_MS = parseEnvInt('ZAINS_FETCH_TIMEOUT_MS', 120_000)
const DEFAULT_RETRIES = parseEnvInt('ZAINS_FETCH_RETRIES', 2)
const DEFAULT_BASE_DELAY_MS = 2000

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status === 502 || status === 503 || status === 504
}

function isAbortOrTimeout(e: unknown): boolean {
  if (!(e instanceof Error)) return false
  if (e.name === 'AbortError') return true
  const m = e.message.toLowerCase()
  return m.includes('abort') || m.includes('timeout') || m.includes('timed out')
}

function isLikelyNetworkError(e: unknown): boolean {
  if (!(e instanceof Error)) return true
  const m = e.message.toLowerCase()
  return (
    m.includes('fetch') ||
    m.includes('network') ||
    m.includes('econnreset') ||
    m.includes('socket') ||
    m.includes('enotfound') ||
    m.includes('etimedout')
  )
}

/**
 * Response OK dikembalikan langsung. Response non-OK retryable → retry; selain itu return as-is (jangan baca body di sini).
 */
export async function fetchZainsWithRetry(
  url: string,
  init: RequestInit,
  options?: ZainsFetchRetryOptions,
): Promise<Response> {
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const maxRetries = options?.retries ?? DEFAULT_RETRIES
  const baseDelayMs = options?.baseDelayMs ?? DEFAULT_BASE_DELAY_MS

  let lastError: unknown

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const res = await fetch(url, { ...init, signal: controller.signal })
      clearTimeout(timer)

      if (res.ok) return res

      if (isRetryableStatus(res.status) && attempt < maxRetries) {
        await sleep(baseDelayMs * (attempt + 1))
        continue
      }

      return res
    } catch (e) {
      clearTimeout(timer)
      lastError = e

      const canRetry =
        attempt < maxRetries && (isAbortOrTimeout(e) || isLikelyNetworkError(e))

      if (canRetry) {
        await sleep(baseDelayMs * (attempt + 1))
        continue
      }

      throw e
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

export function getZainsSummaryConcurrency(): number {
  const n = parseEnvInt('ZAINS_SUMMARY_CONCURRENCY', 5)
  return Math.max(1, Math.min(32, n))
}

/** Jalankan banyak tugas async dengan batas paralelisme (kurangi timeout upstream saat burst ke Koyeb). */
export async function runPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return []
  const results: R[] = new Array(items.length)
  let next = 0

  async function runWorker() {
    for (;;) {
      const i = next++
      if (i >= items.length) break
      results[i] = await worker(items[i], i)
    }
  }

  const n = Math.min(Math.max(1, concurrency), items.length)
  await Promise.all(Array.from({ length: n }, () => runWorker()))
  return results
}
