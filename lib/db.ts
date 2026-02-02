import { neon } from '@neondatabase/serverless'

// Load .env.local jika belum ter-load (untuk development)
if (typeof window === 'undefined' && process.env.NODE_ENV !== 'production') {
  try {
    // Cek apakah DATABASE_URL sudah ada
    if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
      // Try to load dotenv
      const dotenv = require('dotenv')
      const path = require('path')
      dotenv.config({ path: path.join(process.cwd(), '.env.local') })
    }
  } catch (e) {
    // Ignore errors - Next.js should handle env loading
    console.warn('Could not load .env.local manually:', e)
  }
}

// Get DATABASE_URL dengan fallback
function getDatabaseUrl(): string {
  const databaseUrl = 
    process.env.DATABASE_URL || 
    process.env.POSTGRES_URL ||
    process.env.NEXT_PUBLIC_DATABASE_URL

  if (!databaseUrl) {
    const errorMsg = 
      'DATABASE_URL atau POSTGRES_URL tidak ditemukan.\n' +
      'Pastikan file .env.local ada di root project dengan:\n' +
      'DATABASE_URL=postgresql://...\n\n' +
      'Atau set environment variable:\n' +
      'export DATABASE_URL=postgresql://...'
    
    // Di development, beri warning lebih detail
    if (process.env.NODE_ENV !== 'production') {
      console.error(errorMsg)
      console.error('\nCurrent working directory:', process.cwd())
      console.error('NODE_ENV:', process.env.NODE_ENV)
    }
    
    throw new Error(errorMsg)
  }

  return databaseUrl
}

// Lazy connection - hanya dibuat saat digunakan
let sqlInstance: ReturnType<typeof neon> | null = null

function getSql() {
  if (!sqlInstance) {
    const databaseUrl = getDatabaseUrl()
    sqlInstance = neon(databaseUrl)
  }
  return sqlInstance
}

// Export sql - lazy load saat digunakan
// Neon's sql adalah template tag function yang return Promise
export const sql = ((strings: TemplateStringsArray, ...values: any[]) => {
  return getSql()(strings, ...values)
}) as any as ReturnType<typeof neon>

// Helper untuk format currency
export function formatCurrency(amount: number | string | null): string {
  if (amount === null || amount === undefined) return 'Rp 0'
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num)
}

// Helper untuk format date
export function formatDate(date: Date | string | null): string {
  if (!date) return '-'
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('id-ID', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d)
}

// Helper untuk format datetime
export function formatDateTime(date: Date | string | null): string {
  if (!date) return '-'
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('id-ID', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

// Helper untuk relative time
export function getRelativeTime(date: Date | string | null): string {
  if (!date) return '-'
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Baru saja'
  if (diffMins < 60) return `${diffMins} menit lalu`
  if (diffHours < 24) return `${diffHours} jam lalu`
  if (diffDays < 7) return `${diffDays} hari lalu`
  return formatDate(d)
}
