import mysql from 'mysql2/promise'
import type { Pool, PoolConnection } from 'mysql2/promise'

const DB_NAME_ZAINS_CSF = 'zains_csf'

function getEnvRequired(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Env ${name} tidak dikonfigurasi`)
  return String(v)
}

function getEnvOptional(name: string, fallback: string): string {
  const v = process.env[name]
  return v ? String(v) : fallback
}

let pool: Pool | null = null

export function getZainsCsfPool(): Pool {
  if (pool) return pool

  const host = getEnvRequired('HOST_DB')
  const port = Number(process.env.PORT_DB || 3306)
  const user = getEnvRequired('USER_DB')
  const password = getEnvRequired('PASS_DB')

  const charset = getEnvOptional('DB_CHARSET', 'utf8mb4')
  // mysql2/promise types tidak memiliki opsi `collation`, jadi hanya pakai charset.
  // Jika collation perlu diatur, biasanya dilakukan di level database.

  pool = mysql.createPool({
    host,
    port,
    user,
    password,
    database: DB_NAME_ZAINS_CSF,
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
    multipleStatements: false,
    charset,
    // Supaya Date/time baliknya lebih mudah di-handle sebagai string
    dateStrings: true,
  })

  return pool
}

export function stripDots(value: string | null | undefined): string {
  if (!value) return ''
  return String(value).replace(/\./g, '')
}

export function normalizeDateOnly(input: unknown): string | null {
  if (input === null || input === undefined) return null
  const s = String(input).trim()
  if (!s || s === 'null') return null

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s

  // Bisa jadi string datetime (YYYY-MM-DD HH:mm:ss atau ISO)
  const maybeDate = new Date(s)
  if (Number.isNaN(maybeDate.getTime())) return null
  // Note: toISOString bisa bergeser timezone; tapi untuk input yang konsisten
  // umumnya tetap mengarah ke tanggal yang benar.
  return maybeDate.toISOString().slice(0, 10)
}

export function normalizeDateTime(input: unknown): string | null {
  const dateOnly = normalizeDateOnly(input)
  if (!dateOnly) return null
  // Database yang kita isi butuh DATETIME; jika inputnya date-only, pakai midnight.
  return `${dateOnly} 00:00:00`
}

function getYymmdd(date: Date): string {
  const yy = String(date.getFullYear() % 100).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yy}${mm}${dd}`
}

export async function generateIdDonatur(connection: PoolConnection): Promise<string> {
  // Sama seperti refs/MitraController.php: id_kantor = str_pad(1, 3, '0')
  const idKantor = '001'
  const today = new Date()
  const newDate = getYymmdd(today) // format ymd (2-digit year)

  // prefix yang dibandingkan pada LEFT(id_donatur, 9) = (ymd + id_kantor)
  const prefix = `${newDate}${idKantor}` // panjang 9

  const [rows] = await connection.execute<mysql.RowDataPacket[]>(
    `
    SELECT RIGHT(id_donatur, 5) AS id
    FROM corez_donatur
    WHERE LEFT(id_donatur, 9) = ?
      AND LENGTH(id_donatur) = 14
    ORDER BY RIGHT(id_donatur, 5) DESC
    LIMIT 1
  `,
    [prefix],
  )

  const last = rows && rows[0] && (rows[0] as any).id ? Number((rows[0] as any).id) : 0
  const nextNumber = last ? last + 1 : 1
  const nextNumberPadded = String(nextNumber).padStart(5, '0')

  return `${newDate}${idKantor}${nextNumberPadded}`
}

export function generateTransactionId(): string {
  const now = new Date()
  const ymd = getYymmdd(now)
  const rand = Math.floor(Math.random() * 9999999) + 1 // 1..9999999
  const randPadded = String(rand).padStart(7, '0')
  // refs/TransaksiRepository.php: '201' + date('ymd') + sprintf('%07d', rand)
  return `201${ymd}${randPadded}`
}

