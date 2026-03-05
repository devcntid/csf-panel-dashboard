'use server'

import { NextRequest, NextResponse } from 'next/server'
import { getZainsApiConfig } from '@/lib/zains-api-config'

function getDefaultDateRange(): { tgl_awal: string; tgl_akhir: string } {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()

  const pad = (n: number) => String(n).padStart(2, '0')

  const start = new Date(Date.UTC(year, month, 1))
  const end = today

  const format = (d: Date) => d.toISOString().slice(0, 10)

  return {
    tgl_awal: format(start),
    tgl_akhir: format(end),
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

    let tglAwal = searchParams.get('tgl_awal')
    let tglAkhir = searchParams.get('tgl_akhir')

    // Jika front-end tidak mengirim tanggal, gunakan default: 1 bulan berjalan
    if (!tglAwal || !tglAkhir) {
      const defaults = getDefaultDateRange()
      if (!tglAwal) tglAwal = defaults.tgl_awal
      if (!tglAkhir) tglAkhir = defaults.tgl_akhir
    }

    const type = searchParams.get('type') || ''
    const page = searchParams.get('page') || '1'
    const perPage = searchParams.get('per_page') || '10'

    const proxiedParams = new URLSearchParams()
    if (type) proxiedParams.set('type', type)
    proxiedParams.set('tgl_awal', tglAwal)
    proxiedParams.set('tgl_akhir', tglAkhir)
    proxiedParams.set('page', page)
    proxiedParams.set('per_page', perPage)

    const targetUrl = `${baseUrl.replace(/\/+$/, '')}/fins/jurnal?${proxiedParams.toString()}`

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

    // Transformasi respons agar FE menerima data "bentuk tabel":
    // - Satu baris jurnal = satu sisi (debet ATAU kredit)
    // - Kolom utama: id_jurnal, id_transaksi, id_exre, coa, debet, kredit, keterangan, dll.
    if (json && Array.isArray(json.data)) {
      const originalRows: any[] = json.data
      const tableRows: any[] = []

      for (const row of originalRows) {
        const debetVal = Number(row.debet || 0)
        const kreditVal = Number(row.kredit || 0)

        const hasDebet = !Number.isNaN(debetVal) && debetVal !== 0
        const hasKredit = !Number.isNaN(kreditVal) && kreditVal !== 0

        const common = {
          id_transaksi: row.id_transaksi,
          id_exre: row.id_exre,
          keterangan: row.keterangan,
          nik_input: row.nik_input,
          tgl_exre: row.tgl_exre,
          tgl: row.tgl,
          nominal: row.nominal,
          id_kantor: row.id_kantor,
          id_via_bayar: row.id_via_bayar,
          jenis_jurnal: row.jenis_jurnal,
          via_jurnal: row.via_jurnal,
          id_trans: row.id_trans,
          note: row.note,
          fdt: row.fdt,
          coa_buku: row.coa_buku,
          noresi: row.noresi,
          id_program: row.id_program,
          dtu: row.dtu,
          nama_kantor: row.nama_kantor,
          nama_program: row.nama_program,
          nama_karyawan: row.nama_karyawan,
          nama_coa_buku: row.nama_coa_buku,
          jenis: row.jenis,
          keterangan_sumber_dana: row.keterangan_sumber_dana,
        }

        // Support dua format dari Zains:
        // 1) Gabungan: coa_debet/coa_kredit, nama_coa_debet/nama_coa_kredit
        // 2) Sudah flat: coa, nama_coa (satu baris per sisi) — jangan timpa dengan coa_debet yang undefined
        const coaDebet = row.coa_debet ?? row.coa
        const namaCoaDebet = row.nama_coa_debet ?? row.nama_coa
        const parentDebet = row.nama_parent_coa_debet ?? row.nama_parent_coa
        const coaKredit = row.coa_kredit ?? row.coa
        const namaCoaKredit = row.nama_coa_kredit ?? row.nama_coa
        const parentKredit = row.nama_parent_coa_kredit ?? row.nama_parent_coa

        // Baris debet
        if (hasDebet) {
          tableRows.push({
            ...common,
            id_jurnal: row.id_jurnal,
            coa: coaDebet,
            nama_coa: namaCoaDebet,
            nama_parent_coa: parentDebet,
            debet: debetVal,
            kredit: 0,
          })
        }

        // Baris kredit
        if (hasKredit) {
          tableRows.push({
            ...common,
            id_jurnal: row.id_jurnal_kredit || row.id_jurnal,
            coa: coaKredit,
            nama_coa: namaCoaKredit,
            nama_parent_coa: parentKredit,
            debet: 0,
            kredit: kreditVal,
          })
        }

        // Fallback: jika keduanya 0, tetap tampilkan satu baris
        if (!hasDebet && !hasKredit) {
          tableRows.push({
            ...common,
            id_jurnal: row.id_jurnal,
            coa: coaDebet || coaKredit,
            nama_coa: namaCoaDebet || namaCoaKredit,
            nama_parent_coa: parentDebet || parentKredit,
            debet: 0,
            kredit: 0,
          })
        }
      }

      // Normalisasi keterangan_sumber_dana per transaksi:
      // Untuk setiap grup (id_exre/id_transaksi yang sama), ambil sumber dana utama
      // lalu propagate ke semua baris di grup. Contoh: Faspay di sisi debet juga
      // menjadi keterangan_sumber_dana di sisi kredit.
      const groups = new Map<string, any[]>()

      for (const row of tableRows) {
        const key = row.id_exre || row.id_transaksi
        if (!key) continue

        if (!groups.has(key)) {
          groups.set(key, [])
        }
        groups.get(key)!.push(row)
      }

      for (const [, rows] of groups) {
        // Prioritas: baris debet yang punya keterangan_sumber_dana tidak kosong
        let sumberRow =
          rows.find(
            (r) =>
              Number(r.debet || 0) > 0 &&
              typeof r.keterangan_sumber_dana === 'string' &&
              r.keterangan_sumber_dana.trim() !== '',
          ) ||
          // fallback: baris apa pun yang punya keterangan_sumber_dana
          rows.find(
            (r) =>
              typeof r.keterangan_sumber_dana === 'string' &&
              r.keterangan_sumber_dana.trim() !== '',
          )

        if (!sumberRow) {
          continue
        }

        const sumber = String(sumberRow.keterangan_sumber_dana).trim()

        for (const r of rows) {
          r.keterangan_sumber_dana = sumber
        }
      }

      json.data = tableRows

      // Jangan timpa total_data / count dengan tableRows.length, agar paging FE
      // tetap memakai total dari Zains (total baris jurnal). Kalau ditimpa,
      // total_data jadi hanya jumlah baris di halaman ini sehingga paging salah.
    }

    return NextResponse.json(json, { status: 200 })
  } catch (error: any) {
    console.error('Error /api/fins/jurnal:', error)
    return NextResponse.json(
      {
        status: false,
        message: error?.message || 'Terjadi kesalahan saat mengambil data jurnal',
      },
      { status: 500 },
    )
  }
}

