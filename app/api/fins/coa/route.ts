'use server'

import { NextRequest, NextResponse } from 'next/server'
import { getZainsApiConfig } from '@/lib/zains-api-config'

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
    const searchParams = incomingUrl.searchParams

    const idKantor = searchParams.get('id_kantor') || '87'
    const search = searchParams.get('search') || searchParams.get('keyword') || ''
    const page = searchParams.get('page') || '1'
    const perPage = searchParams.get('per_page') || '100'
    const active = searchParams.get('active') || 'y'

    const proxiedParams = new URLSearchParams()
    proxiedParams.set('page', page)
    proxiedParams.set('per_page', perPage)
    proxiedParams.set('active', active)
    if (idKantor) proxiedParams.set('id_kantor', idKantor)
    if (search.trim()) proxiedParams.set('search', search.trim())

    const targetUrl = `${baseUrl.replace(/\/+$/, '')}/setting/coa?${proxiedParams.toString()}`

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
        {
          status: false,
          message: `Gagal memanggil API Zains (HTTP ${res.status})`,
          error: text,
        },
        { status: res.status },
      )
    }

    let json: any
    try {
      json = JSON.parse(text)
    } catch {
      return NextResponse.json(
        {
          status: false,
          message: 'Respons API Zains tidak valid (bukan JSON)',
          raw: text,
        },
        { status: 500 },
      )
    }

    const rawData: any[] = Array.isArray(json.data) ? json.data : []

    const normalized = rawData.map((row) => ({
      coa: String(row.coa ?? ''),
      nama_coa: String(row.nama_coa ?? ''),
      id_kantor: idKantor,
      group: String(row.group ?? row['group'] ?? ''),
    }))

    return NextResponse.json({
      status: true,
      message: json.message ?? 'OK',
      data: normalized,
    })
  } catch (error: any) {
    console.error('Error /api/fins/coa:', error)
    return NextResponse.json(
      {
        status: false,
        message: error?.message || 'Terjadi kesalahan saat mengambil data COA dari Zains',
      },
      { status: 500 },
    )
  }
}

