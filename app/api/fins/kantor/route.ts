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

    const page = searchParams.get('page') || '1'
    const perPage = searchParams.get('per_page') || '10'
    const aktif = searchParams.get('aktif') || 'y'

    const proxiedParams = new URLSearchParams()
    proxiedParams.set('page', page)
    proxiedParams.set('per_page', perPage)
    proxiedParams.set('aktif', aktif)

    const targetUrl = `${baseUrl.replace(/\/+$/, '')}/hcm/kantor?${proxiedParams.toString()}`

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

    return NextResponse.json(json, { status: 200 })
  } catch (error: any) {
    console.error('Error /api/fins/kantor:', error)
    return NextResponse.json(
      {
        status: false,
        message: error?.message || 'Terjadi kesalahan saat mengambil data kantor dari Zains',
      },
      { status: 500 },
    )
  }
}

