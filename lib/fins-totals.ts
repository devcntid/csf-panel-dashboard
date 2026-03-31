import type { PoolConnection } from 'mysql2/promise'
import { getZainsCsfPool } from '@/lib/mysql-zains-csf'
import { getZainsApiConfig } from '@/lib/zains-api-config'
import { resolveZainsFinsTotalsUrl } from '@/lib/zains-fins-totals'

export type FinsTotalsType = 'expend' | 'receipt'
// Selaras dengan kemampuan API Zains fins/total (daily, weekly, monthly, quarterly, yearly)
export type FinsTotalsGroupBy = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly' | null

export type FinsTotalsFilters = {
  type: FinsTotalsType
  group_by?: FinsTotalsGroupBy

  // range mode
  tgl_awal?: string
  tgl_akhir?: string

  // monthly mode
  year?: number

  // optional filters
  approve?: string
  id_program?: string // comma-separated
  id_kantor?: string // comma-separated
  only_coa_debet?: string // comma-separated
  exclude_coa_debet?: string // comma-separated
  only_coa_kredit?: string // comma-separated
  exclude_coa_kredit?: string // comma-separated
  only_id_contact?: string // comma-separated
  exclude_id_contact?: string // comma-separated
}

type MonthlyRow = { month: number; month_name: string; sum: number; count: number }
type YearlyRow = { year: number; sum: number; count: number }

export type FinsTotalsRangeResponse = {
  status: true
  message: string
  data: { sum: number; count: number }
  filters: Record<string, any>
}

export type FinsTotalsMonthlyResponse = {
  status: true
  message: string
  data: MonthlyRow[]
  grand_total: { sum: number; count: number }
  filters: Record<string, any>
}

export type FinsTotalsYearlyResponse = {
  status: true
  message: string
  data: YearlyRow[]
  grand_total: { sum: number; count: number }
  filters: Record<string, any>
}

export type FinsTotalsResponse = FinsTotalsRangeResponse | FinsTotalsMonthlyResponse | FinsTotalsYearlyResponse

function splitCsv(raw: string | undefined): string[] {
  if (!raw) return []
  return String(raw)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function monthNameShort(month: number): string {
  const map: Record<number, string> = {
    1: 'Jan',
    2: 'Feb',
    3: 'Mar',
    4: 'Apr',
    5: 'Mei',
    6: 'Jun',
    7: 'Jul',
    8: 'Agu',
    9: 'Sep',
    10: 'Okt',
    11: 'Nov',
    12: 'Des',
  }
  return map[month] || String(month)
}

function buildInClause(column: string, values: string[], negate: boolean): { sql: string; params: any[] } {
  if (values.length === 0) return { sql: '', params: [] }
  const placeholders = values.map(() => '?').join(', ')
  return { sql: ` AND ${column}${negate ? ' NOT' : ''} IN (${placeholders})`, params: values }
}

function buildFinsTotalsSearchParams(filters: FinsTotalsFilters): URLSearchParams {
  const sp = new URLSearchParams()
  sp.set('type', filters.type)
  // Untuk HTTP API Zains, semua nilai group_by yang didukung boleh diteruskan apa adanya
  if (filters.group_by) {
    sp.set('group_by', filters.group_by)
  }
  if (filters.year != null && Number.isFinite(Number(filters.year))) {
    sp.set('year', String(filters.year))
  }
  if (filters.tgl_awal) sp.set('tgl_awal', filters.tgl_awal)
  if (filters.tgl_akhir) sp.set('tgl_akhir', filters.tgl_akhir)
  if (filters.approve) sp.set('approve', filters.approve)
  if (filters.id_program) sp.set('id_program', filters.id_program)
  if (filters.id_kantor) sp.set('id_kantor', filters.id_kantor)
  if (filters.only_coa_debet) sp.set('only_coa_debet', filters.only_coa_debet)
  if (filters.exclude_coa_debet) sp.set('exclude_coa_debet', filters.exclude_coa_debet)
  if (filters.only_coa_kredit) sp.set('only_coa_kredit', filters.only_coa_kredit)
  if (filters.exclude_coa_kredit) sp.set('exclude_coa_kredit', filters.exclude_coa_kredit)
  if (filters.only_id_contact) sp.set('only_id_contact', filters.only_id_contact)
  if (filters.exclude_id_contact) sp.set('exclude_id_contact', filters.exclude_id_contact)
  return sp
}

async function queryFinsTotalsViaZainsHttp(filters: FinsTotalsFilters): Promise<FinsTotalsResponse> {
  const { url: baseUrl } = getZainsApiConfig()
  const apiKey = process.env.API_KEY_ZAINS
  if (!baseUrl || !apiKey) {
    throw new Error('queryFinsTotalsViaZainsHttp: baseUrl atau API_KEY_ZAINS kosong')
  }
  const sp = buildFinsTotalsSearchParams(filters)
  const targetUrl = resolveZainsFinsTotalsUrl(baseUrl, sp)
  const res = await fetch(targetUrl, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: apiKey,
    },
    cache: 'no-store',
  })
  const text = await res.text()
  if (!res.ok) {
    throw new Error(`Fins totals HTTP ${res.status}: ${text.slice(0, 800)}`)
  }
  return JSON.parse(text) as FinsTotalsResponse
}

/**
 * Agregat FINS: jika `URL_API_ZAINS` / `URL_API_ZAINS_*` + `API_KEY_ZAINS` terisi, pakai GET ke API Zains Golang;
 * selain itu query langsung ke MySQL `zains_csf` (HOST_DB).
 */
export async function queryFinsTotals(filters: FinsTotalsFilters): Promise<FinsTotalsResponse> {
  const { url: baseUrl } = getZainsApiConfig()
  const apiKey = process.env.API_KEY_ZAINS
  if (baseUrl && apiKey) {
    return queryFinsTotalsViaZainsHttp(filters)
  }

  const pool = getZainsCsfPool()
  const connection = await pool.getConnection()
  try {
    return await queryFinsTotalsWithConn(connection, filters)
  } finally {
    connection.release()
  }
}

export async function queryFinsTotalsWithConn(
  connection: PoolConnection,
  filters: FinsTotalsFilters,
): Promise<FinsTotalsResponse> {
  const now = new Date()
  const transType = filters.type
  const jenis = transType === 'receipt' ? 'r' : 'e'

  const groupBy = filters.group_by ?? null
  const msg = `Total ${transType} berhasil diambil`

  // Default range: 1 Jan - 31 Des tahun berjalan (sesuai docs)
  const currentYear = now.getFullYear()
  const defaultTglAwal = `${currentYear}-01-01`
  const defaultTglAkhir = `${currentYear}-12-31`

  const approve = filters.approve

  const kantorIDs = splitCsv(filters.id_kantor)
  const programIDs = splitCsv(filters.id_program)

  const onlyCoaDebet = splitCsv(filters.only_coa_debet)
  const excludeCoaDebet = splitCsv(filters.exclude_coa_debet)
  const onlyCoaKredit = splitCsv(filters.only_coa_kredit)
  const excludeCoaKredit = splitCsv(filters.exclude_coa_kredit)
  const onlyIdContact = splitCsv(filters.only_id_contact)
  const excludeIdContact = splitCsv(filters.exclude_id_contact)

  // Build base where + params
  let where = `WHERE jenis = ?`
  const params: any[] = [jenis]

  // group_by specific date filter
  if (groupBy === 'monthly') {
    const year = Number(filters.year ?? currentYear)
    where += ` AND YEAR(tgl_exre) = ?`
    params.push(year)
  } else if (groupBy === 'yearly') {
    const endYear = currentYear
    const startYear = endYear - 4
    where += ` AND YEAR(tgl_exre) BETWEEN ? AND ?`
    params.push(startYear, endYear)
  } else {
    const tglAwal = filters.tgl_awal || defaultTglAwal
    const tglAkhir = filters.tgl_akhir || defaultTglAkhir
    where += ` AND DATE(tgl_exre) BETWEEN ? AND ?`
    params.push(tglAwal, tglAkhir)
  }

  // approve
  if (approve && String(approve).trim()) {
    where += ` AND approve = ?`
    params.push(String(approve).trim())
  }

  // id_kantor / id_program
  const kantorIn = buildInClause('id_kantor', kantorIDs, false)
  where += kantorIn.sql
  params.push(...kantorIn.params)

  const programIn = buildInClause('id_program', programIDs, false)
  where += programIn.sql
  params.push(...programIn.params)

  // coa filters
  const exDeb = buildInClause('coa_debet', excludeCoaDebet, true)
  where += exDeb.sql
  params.push(...exDeb.params)
  const exKre = buildInClause('coa_kredit', excludeCoaKredit, true)
  where += exKre.sql
  params.push(...exKre.params)
  const onlyDeb = buildInClause('coa_debet', onlyCoaDebet, false)
  where += onlyDeb.sql
  params.push(...onlyDeb.params)
  const onlyKre = buildInClause('coa_kredit', onlyCoaKredit, false)
  where += onlyKre.sql
  params.push(...onlyKre.params)

  // id_contact filters
  const exContact = buildInClause('id_contact', excludeIdContact, true)
  where += exContact.sql
  params.push(...exContact.params)
  const onlyContact = buildInClause('id_contact', onlyIdContact, false)
  where += onlyContact.sql
  params.push(...onlyContact.params)

  if (groupBy === 'monthly') {
    const [rows] = await connection.execute<any[]>(
      `
      SELECT MONTH(tgl_exre) AS month, COALESCE(SUM(nominal), 0) AS sum, COUNT(id_trans) AS count
      FROM fins_trans
      ${where}
      GROUP BY month
      ORDER BY month
      `,
      params,
    )

    const data: MonthlyRow[] = (rows || []).map((r: any) => {
      const month = Number(r.month || r.bulan || 0)
      const sum = Number(r.sum || 0)
      const count = Number(r.count || 0)
      return { month, month_name: monthNameShort(month), sum, count }
    })

    const grand_total = data.reduce(
      (acc, r) => ({ sum: acc.sum + r.sum, count: acc.count + r.count }),
      { sum: 0, count: 0 },
    )

    return {
      status: true,
      message: msg,
      data,
      grand_total,
      filters: {
        ...filters,
        type: transType,
        group_by: 'monthly',
      },
    }
  }

  if (groupBy === 'yearly') {
    const [rows] = await connection.execute<any[]>(
      `
      SELECT YEAR(tgl_exre) AS year, COALESCE(SUM(nominal), 0) AS sum, COUNT(id_trans) AS count
      FROM fins_trans
      ${where}
      GROUP BY year
      ORDER BY year
      `,
      params,
    )

    const data: YearlyRow[] = (rows || []).map((r: any) => ({
      year: Number(r.year || r.tahun || 0),
      sum: Number(r.sum || 0),
      count: Number(r.count || 0),
    }))

    const grand_total = data.reduce(
      (acc, r) => ({ sum: acc.sum + r.sum, count: acc.count + r.count }),
      { sum: 0, count: 0 },
    )

    const endYear = currentYear
    const startYear = endYear - 4

    return {
      status: true,
      message: msg,
      data,
      grand_total,
      filters: {
        ...filters,
        type: transType,
        group_by: 'yearly',
        start_year: startYear,
        end_year: endYear,
      },
    }
  }

  // range mode
  const [rows] = await connection.execute<any[]>(
    `
    SELECT COALESCE(SUM(nominal), 0) AS sum, COUNT(id_trans) AS count
    FROM fins_trans
    ${where}
    `,
    params,
  )

  const row = rows?.[0] || {}
  const sum = Number(row.sum || 0)
  const count = Number(row.count || 0)

  return {
    status: true,
    message: msg,
    data: { sum, count },
    filters: {
      ...filters,
      type: transType,
      group_by: null,
      tgl_awal: filters.tgl_awal || defaultTglAwal,
      tgl_akhir: filters.tgl_akhir || defaultTglAkhir,
    },
  }
}

