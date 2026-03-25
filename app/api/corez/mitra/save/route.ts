import { NextRequest, NextResponse } from 'next/server'
import {
  generateIdDonatur,
  getZainsCsfPool,
} from '@/lib/mysql-zains-csf'

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0
}

function isEmailLike(v: unknown): boolean {
  if (typeof v !== 'string') return false
  const s = v.trim()
  // Validasi minimal; dokumentasi ref memakai Laravel required|email
  // (kami sengaja pakai regex sederhana)
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}

function build422(errors: Record<string, string[]>) {
  return NextResponse.json(
    {
      status: false,
      message: 'Data belum lengkap',
      errors,
    },
    { status: 422 },
  )
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    if (!body || typeof body !== 'object') {
      return build422({
        _error: ['Body harus berupa object JSON'],
      })
    }

    const errors: Record<string, string[]> = {}

    const pushReqError = (field: string) => {
      errors[field] = errors[field] || []
      errors[field].push(`The ${field} field is required.`)
    }

    const requiredString = (field: string, v: any) => {
      if (!isNonEmptyString(v)) pushReqError(field)
    }

    const nama = body.nama
    const id_jenis = body.id_jenis
    const hp = body.hp
    const telpon = body.telpon
    const email = body.email
    const alamat = body.alamat
    const id_crm = body.id_crm

    // required
    requiredString('nama', nama)
    requiredString('hp', hp)
    requiredString('telpon', telpon)
    requiredString('email', email)
    requiredString('alamat', alamat)
    requiredString('id_crm', id_crm)

    if (id_jenis === null || id_jenis === undefined || id_jenis === '') {
      pushReqError('id_jenis')
    } else {
      const n = Number(id_jenis)
      if (!Number.isFinite(n) || !Number.isInteger(n)) {
        errors['id_jenis'] = errors['id_jenis'] || []
        errors['id_jenis'].push('The id_jenis must be an integer.')
      }
    }

    // email format (Laravel rule: email)
    if (isNonEmptyString(email) && !isEmailLike(email)) {
      errors['email'] = errors['email'] || []
      errors['email'].push('The email must be a valid email address.')
    }

    if (Object.keys(errors).length > 0) {
      return build422(errors)
    }

    const pool = getZainsCsfPool()
    const connection = await pool.getConnection()

    try {
      // 1) duplikat: hp/email
      const [rows] = await connection.execute<any[]>(
        `
        SELECT id_donatur, hp, email
        FROM corez_donatur
        WHERE hp = ? OR email = ?
        LIMIT 1
        `,
        [hp, email],
      )

      const existMitra = rows?.[0]
      if (existMitra) {
        if (String(existMitra.hp) === String(hp) && String(existMitra.email) === String(email)) {
          return NextResponse.json(
            {
              status: false,
              message: 'Mitra dengan nomor HP dan email ini sudah terdaftar',
              id_donatur: existMitra.id_donatur,
            },
            { status: 400 },
          )
        }
        if (String(existMitra.hp) === String(hp)) {
          return NextResponse.json(
            {
              status: false,
              message: 'Mitra dengan nomor HP ini sudah terdaftar',
              id_donatur: existMitra.id_donatur,
            },
            { status: 400 },
          )
        }
        if (String(existMitra.email) === String(email)) {
          return NextResponse.json(
            {
              status: false,
              message: 'Mitra dengan email ini sudah terdaftar',
              id_donatur: existMitra.id_donatur,
            },
            { status: 400 },
          )
        }
      }

      // 2) generate id_donatur
      const id_donatur = await generateIdDonatur(connection)

      const id_kantor = 1
      const jk = 'x'
      const komitment = 0
      const tgl_lahir = new Date().toISOString().slice(0, 10)
      const tgl_reg = new Date().toISOString().slice(0, 10)

      const id_pekerjaan = 0
      const id_cara_bayar = 0
      const id_rutinitas_transaksi = 0
      const tgl_transaksi = 0
      const id_penghasilan = 0
      const id_pendidikan = 0
      const id_pelayanan = 0
      const id_profiling = 0
      const agama = 'Islam'
      const last_transaction = '0000-00-00'

      // Default string fields (array_fill_keys pada ref PHP)
      const fillEmpty = {
        tempat_lahir: '',
        des: '',
        id_donatur_parent: '',
        nikah: '',
        ll: '',
        sumber: '',
        lain: '',
        npwp: '',
        id_program: '',
        user_insert: '',
        user_name: '',
        password: '',
        verified: '',
        foto: '',
        id_koordinator: '',
        session: '',
        note: '',
        id_hubung: '',
        send_email: '',
      }

      const id_jenis_n = Number(id_jenis)
      const nowIso = new Date().toISOString()

      await connection.execute(
        `
        INSERT INTO corez_donatur (
          id_donatur, donatur, panggilan, tgl_lahir, jk, komitment, hp, telpon, id_crm, email, alamat,
          tgl_reg, id_kantor, id_jenis, aktif, status, id_pekerjaan, id_cara_bayar, id_rutinitas_transaksi, tgl_transaksi,
          id_penghasilan, id_pendidikan, id_pelayanan, id_profiling, agama, updated, dtu, last_transaction,
          tempat_lahir, des, id_donatur_parent, nikah, ll, sumber, lain, npwp, id_program, user_insert, user_name, password,
          verified, foto, id_koordinator, session, note, id_hubung, send_email
        ) VALUES (
          ?, ?, ?, CURDATE(), ?, ?, ?, ?, ?, ?, ?,
          CURDATE(), ?, ?, 'y', 'Donatur', ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
        `,
        [
          id_donatur,
          nama,
          nama, // panggilan
          jk,
          komitment,
          hp,
          telpon,
          id_crm,
          email,
          alamat,
          id_kantor,
          id_jenis_n,
          id_pekerjaan,
          id_cara_bayar,
          id_rutinitas_transaksi,
          tgl_transaksi,
          id_penghasilan,
          id_pendidikan,
          id_pelayanan,
          id_profiling,
          agama,
          nowIso, // updated (datetime)
          nowIso, // dtu (datetime)
          last_transaction,
          fillEmpty.tempat_lahir,
          fillEmpty.des,
          fillEmpty.id_donatur_parent,
          fillEmpty.nikah,
          fillEmpty.ll,
          fillEmpty.sumber,
          fillEmpty.lain,
          fillEmpty.npwp,
          fillEmpty.id_program,
          fillEmpty.user_insert,
          fillEmpty.user_name,
          fillEmpty.password,
          fillEmpty.verified,
          fillEmpty.foto,
          fillEmpty.id_koordinator,
          fillEmpty.session,
          fillEmpty.note,
          fillEmpty.id_hubung,
          fillEmpty.send_email,
        ],
      )

      const payloadData = {
        id_donatur,
        donatur: nama,
        panggilan: nama,
        tgl_lahir,
        jk,
        komitment,
        hp,
        telpon,
        id_crm,
        email,
        alamat,
        tgl_reg,
        id_kantor,
        id_jenis: id_jenis_n,
        aktif: 'y',
        status: 'Donatur',
        id_pekerjaan,
        id_cara_bayar,
        id_rutinitas_transaksi,
        tgl_transaksi,
        id_penghasilan,
        id_pendidikan,
        id_pelayanan,
        id_profiling,
        agama,
        updated: nowIso,
        dtu: nowIso,
        last_transaction,
        ...fillEmpty,
      }

      return NextResponse.json(
        {
          status: true,
          message: 'Data mitra berhasil disimpan',
          data: payloadData,
        },
        { status: 200 },
      )
    } finally {
      connection.release()
    }
  } catch (error: any) {
    console.error('Error POST /api/corez/mitra/save:', error)
    return NextResponse.json(
      {
        status: false,
        message: 'Data mitra gagal disimpan',
        error: error?.message || String(error),
      },
      { status: 500 },
    )
  }
}

