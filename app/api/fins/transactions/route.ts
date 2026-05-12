import { NextRequest, NextResponse } from 'next/server'
import { getZainsApiConfig } from '@/lib/zains-api-config'

export const dynamic = 'force-dynamic'

const PASSTHROUGH_PARAMS = [
  'type',
  'tgl_awal',
  'tgl_akhir',
  'page',
  'per_page',
  'terms',
  'approve',
  'mutasi',
  'id_via_bayar',
  'nominal_eq',
  'nominal_gte',
  'nominal_lte',
  'id_program',
  'id_kantor',
  'exclude_coa_debet',
  'only_coa_debet',
  'exclude_coa_kredit',
  'only_coa_kredit',
  'exclude_id_contact',
  'only_id_contact',
] as const

export async function GET(req: NextRequest) {
  try {
    const { url: baseUrl } = getZainsApiConfig()
    const apiKey = process.env.API_KEY_ZAINS

    if (!baseUrl) {
      return NextResponse.json(
        { status: false, message: 'URL_API_ZAINS belum dikonfigurasi' },
        { status: 500 },
      )
    }
    if (!apiKey) {
      return NextResponse.json(
        { status: false, message: 'API_KEY_ZAINS belum dikonfigurasi' },
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

    const targetUrl = `${baseUrl.replace(/\/+$/, '')}/fins/transactions?${proxiedParams.toString()}`

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
      return NextResponse.json(
        { status: false, message: `Gagal memanggil API Zains (HTTP ${res.status})`, error: text },
        { status: res.status },
      )
    }

    let json: unknown
    try {
      json = JSON.parse(text)
    } catch {
      return NextResponse.json(
        { status: false, message: 'Respons API Zains tidak valid (bukan JSON)' },
        { status: 500 },
      )
    }

    return NextResponse.json(json, { status: 200 })
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Terjadi kesalahan'
    console.error('Error /api/fins/transactions:', error)
    return NextResponse.json({ status: false, message: msg }, { status: 500 })
  }
}
