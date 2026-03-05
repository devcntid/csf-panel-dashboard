'use server'

import { NextRequest, NextResponse } from 'next/server'
import { getZainsApiConfig } from '@/lib/zains-api-config'

function getTodayRange(): { tanggal_awal: string; tanggal_akhir: string } {
  const today = new Date()
  const y = today.getFullYear()
  const m = String(today.getMonth() + 1).padStart(2, '0')
  const d = String(today.getDate()).padStart(2, '0')
  const dateStr = `${y}-${m}-${d}`

  return {
    tanggal_awal: dateStr,
    tanggal_akhir: dateStr,
  }
}

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

    const coa = searchParams.get('coa')
    let tanggalAwal = searchParams.get('tanggal_awal')
    let tanggalAkhir = searchParams.get('tanggal_akhir')

    if (!coa) {
      return NextResponse.json(
        { status: false, message: 'Parameter coa wajib diisi' },
        { status: 400 },
      )
    }

    if (!tanggalAwal || !tanggalAkhir) {
      const defaults = getTodayRange()
      if (!tanggalAwal) tanggalAwal = defaults.tanggal_awal
      if (!tanggalAkhir) tanggalAkhir = defaults.tanggal_akhir
    }

    const page = searchParams.get('page') || '1'
    const perPage = searchParams.get('per_page') || '10'
    const keyword = searchParams.get('keyword') || ''
    const idKantor = searchParams.get('id_kantor') || ''

    const proxiedParams = new URLSearchParams()
    proxiedParams.set('coa', coa)
    proxiedParams.set('tanggal_awal', tanggalAwal)
    proxiedParams.set('tanggal_akhir', tanggalAkhir)
    proxiedParams.set('page', page)
    proxiedParams.set('per_page', perPage)
    if (keyword.trim()) proxiedParams.set('keyword', keyword.trim())
    if (idKantor) proxiedParams.set('id_kantor', idKantor)

    const targetUrl = `${baseUrl.replace(/\/+$/, '')}/fins/cashbook?${proxiedParams.toString()}`

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
    console.error('Error /api/fins/cashbook:', error)
    return NextResponse.json(
      {
        status: false,
        message: error?.message || 'Terjadi kesalahan saat mengambil data cashbook',
      },
      { status: 500 },
    )
  }
}

