import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { getZainsApiConfig } from '@/lib/zains-api-config'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const EXPORT_PER_PAGE = 5000
const MAX_ROWS = 50000

const PASSTHROUGH_PARAMS = [
  'type',
  'tgl_awal',
  'tgl_akhir',
  'terms',
  'approve',
  'mutasi',
  'id_via_bayar',
  'id_program',
  'id_kantor',
  'exclude_coa_debet',
  'only_coa_debet',
  'exclude_coa_kredit',
  'only_coa_kredit',
  'exclude_id_contact',
  'only_id_contact',
] as const

type TransactionRow = {
  id_trans: string
  id_transaksi: string
  id_exre: string
  tgl_exre: string
  keterangan: string
  nominal: number
  coa_debet: string
  coa_kredit: string
  id_kantor: number
  id_program: number
  id_via_bayar: number
  approve: string
  jenis: string
  mutasi: string
  id_contact: string
  coa_ca: string
}

function formatDate(raw: string): string {
  if (!raw) return ''
  try {
    const d = new Date(raw)
    if (isNaN(d.getTime())) return raw
    return d.toISOString().slice(0, 10)
  } catch {
    return raw
  }
}

async function fetchAllTransactions(
  baseUrl: string,
  apiKey: string,
  params: URLSearchParams,
): Promise<TransactionRow[]> {
  const all: TransactionRow[] = []
  let page = 1
  let totalPages = 1

  while (page <= totalPages && all.length < MAX_ROWS) {
    params.set('page', String(page))
    params.set('per_page', String(EXPORT_PER_PAGE))

    const targetUrl = `${baseUrl.replace(/\/+$/, '')}/fins/transactions?${params.toString()}`
    const res = await fetch(targetUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', Authorization: apiKey },
      cache: 'no-store',
    })

    if (!res.ok) break

    const json = await res.json()
    if (!json.status || !Array.isArray(json.data)) break

    all.push(...json.data)
    totalPages = json.paging?.total_page ?? 1
    page++
  }

  return all
}

export async function GET(req: NextRequest) {
  try {
    const { url: baseUrl } = getZainsApiConfig()
    const apiKey = process.env.API_KEY_ZAINS

    if (!baseUrl || !apiKey) {
      return NextResponse.json(
        { status: false, message: 'Konfigurasi API Zains belum lengkap' },
        { status: 500 },
      )
    }

    const incomingUrl = new URL(req.url)
    const proxiedParams = new URLSearchParams()

    for (const key of PASSTHROUGH_PARAMS) {
      const val = incomingUrl.searchParams.get(key)
      if (val != null && val.trim() !== '') {
        proxiedParams.set(key, val.trim())
      }
    }

    if (!proxiedParams.has('approve')) {
      proxiedParams.set('approve', 'a')
    }

    const label = incomingUrl.searchParams.get('label') || 'transaksi'

    const rows = await fetchAllTransactions(baseUrl, apiKey, proxiedParams)

    const excelData = [
      [
        'No',
        'ID Transaksi',
        'ID Exre',
        'Tanggal',
        'Keterangan',
        'Nominal',
        'COA Debet',
        'COA Kredit',
        'ID Kantor',
        'ID Program',
        'Via Bayar',
        'Approve',
        'Jenis',
        'Mutasi',
        'ID Contact',
      ],
      ...rows.map((row, idx) => [
        idx + 1,
        row.id_transaksi || '',
        row.id_exre || '',
        formatDate(row.tgl_exre),
        row.keterangan || '',
        row.nominal ?? 0,
        row.coa_debet || '',
        row.coa_kredit || '',
        row.id_kantor ?? '',
        row.id_program ?? '',
        row.id_via_bayar ?? '',
        row.approve || '',
        row.jenis || '',
        row.mutasi || '',
        row.id_contact || '',
      ]),
    ]

    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.aoa_to_sheet(excelData)
    worksheet['!cols'] = [
      { wch: 6 },
      { wch: 22 },
      { wch: 22 },
      { wch: 12 },
      { wch: 50 },
      { wch: 16 },
      { wch: 18 },
      { wch: 18 },
      { wch: 10 },
      { wch: 10 },
      { wch: 10 },
      { wch: 8 },
      { wch: 6 },
      { wch: 6 },
      { wch: 20 },
    ]
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Transactions')

    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
    const tglAwal = proxiedParams.get('tgl_awal') || ''
    const tglAkhir = proxiedParams.get('tgl_akhir') || ''
    const safeLabel = label.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()
    const filename = `fins-${safeLabel}-${tglAwal}-${tglAkhir}.xlsx`

    return new NextResponse(excelBuffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Gagal export Excel'
    console.error('Error /api/fins/transactions/export:', error)
    return NextResponse.json({ status: false, message: msg }, { status: 500 })
  }
}
