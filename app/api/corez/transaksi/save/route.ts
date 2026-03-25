import { NextRequest, NextResponse } from 'next/server'
import {
  generateTransactionId,
  getZainsCsfPool,
  normalizeDateOnly,
  normalizeDateTime,
  stripDots,
} from '@/lib/mysql-zains-csf'

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0
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

function buildDuplicateResponse(payload: {
  message: string
  statusCode: 409
  id_transaksi?: string | null
  id_donatur?: string | null
  no_bukti?: string | null
}) {
  const { message, statusCode, id_transaksi, id_donatur, no_bukti } = payload
  return NextResponse.json(
    {
      status: false,
      message,
      ...(id_transaksi ? { id_transaksi } : {}),
      ...(no_bukti ? { no_bukti } : {}),
      ...(id_donatur ? { id_donatur } : {}),
      data: {
        id_transaksi: id_transaksi ?? undefined,
        id_donatur: id_donatur ?? undefined,
      },
    },
    { status: statusCode },
  )
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return build422({ _error: ['Body harus berupa object JSON'] })
  }

  const errors: Record<string, string[]> = {}
  const addError = (field: string, msg: string) => {
    errors[field] = errors[field] || []
    errors[field].push(msg)
  }

  const required = (field: string, value: unknown) => {
    if (!isNonEmptyString(value) && (value === null || value === undefined || value === '')) {
      addError(field, `The ${field} field is required.`)
    }
  }

  // Required per dokumentasi zains: minimal untuk insert + duplikat
  required('id_program', body.id_program)
  required('id_kantor', body.id_kantor)
  required('id_karyawan', body.id_karyawan)
  required('id_donatur', body.id_donatur)
  required('tgl_transaksi', body.tgl_transaksi)
  required('id_penghimpunan', body.id_penghimpunan)
  required('id_via_himpun', body.id_via_himpun)
  required('user_insert', body.user_insert)
  required('ViaInput', body.ViaInput)
  required('transaksi', body.transaksi)
  required('id_via_bayar', body.id_via_bayar)
  required('quantity', body.quantity)
  required('keterangan', body.keterangan)
  required('no_bukti', body.no_bukti)
  required('id_crm', body.id_crm)

  // Conditional: id_rekening dibutuhkan jika bank (id_via_bayar=2)
  const id_via_bayar_n = Number(body.id_via_bayar)
  if (id_via_bayar_n === 2) {
    if (!isNonEmptyString(body.id_rekening)) {
      addError('id_rekening', 'The id_rekening field is required.')
    }
  }

  if (Object.keys(errors).length > 0) {
    return build422(errors)
  }

  const pool = getZainsCsfPool()
  const connection = await pool.getConnection()

  try {
    await connection.beginTransaction()

    const id_program = String(body.id_program)
    const id_kantor = Number(body.id_kantor)
    const id_karyawan = String(body.id_karyawan)
    const id_donatur = String(body.id_donatur)

    const tgl_transaksi_dt = normalizeDateTime(body.tgl_transaksi)
    if (!tgl_transaksi_dt) {
      addError('tgl_transaksi', 'The tgl_transaksi field must be a valid date.')
      await connection.rollback()
      return build422(errors)
    }

    const tgl_transaksi_only = normalizeDateOnly(body.tgl_transaksi)
    const tgl_donasi_only = normalizeDateOnly(body.tgl_donasi) ?? tgl_transaksi_only
    if (!tgl_donasi_only || !tgl_transaksi_only) {
      addError('tgl_donasi', 'The tgl_donasi field must be a valid date.')
      await connection.rollback()
      return build422(errors)
    }

    const id_penghimpunan = Number(body.id_penghimpunan)
    const id_via_himpun = String(body.id_via_himpun)
    const user_insert = String(body.user_insert)
    const ViaInput = String(body.ViaInput)

    const transaksi = Number(body.transaksi)
    const quantity = Number(body.quantity)
    const id_via_bayar = Number(body.id_via_bayar)
    const keterangan = String(body.keterangan)
    const no_bukti = String(body.no_bukti)
    const id_crm = String(body.id_crm)

    const id_program_claim = body.id_program_claim ? String(body.id_program_claim) : id_program
    const id_cara_bayar =
      body.id_cara_bayar !== undefined && body.id_cara_bayar !== null && String(body.id_cara_bayar).trim() !== ''
        ? String(body.id_cara_bayar)
        : String(id_via_bayar)

    const id_rekening = body.id_rekening ? String(body.id_rekening) : null
    const id_affiliate = body.id_affiliate !== undefined && body.id_affiliate !== null ? String(body.id_affiliate) : ''

    // --- Validasi referensial minimal (program/donatur/kantor/karyawan) ---
    const [progRows] = await connection.execute<any[]>(
      `SELECT id_program, dp, coa_entitas, coa_individu, coa1, coa2
       FROM setting_program
       WHERE id_program = ?
       LIMIT 1`,
      [id_program],
    )
    const progRow = progRows?.[0]

    if (!progRow) {
      await connection.rollback()
      return build422({ id_program: ['The id_program is invalid.'] })
    }

    const [donaturRows] = await connection.execute<any[]>(
      `SELECT id_kantor FROM corez_donatur WHERE id_donatur = ? LIMIT 1`,
      [id_donatur],
    )
    const id_kantor_donatur_raw = donaturRows?.[0]?.id_kantor
    const id_kantor_donatur = id_kantor_donatur_raw !== undefined ? Number(id_kantor_donatur_raw) : NaN
    if (!Number.isFinite(id_kantor_donatur)) {
      await connection.rollback()
      return build422({ id_donatur: ['The id_donatur is invalid.'] })
    }

    const [karyawanRows] = await connection.execute<any[]>(
      `SELECT id_karyawan FROM hcm_karyawan WHERE id_karyawan = ? LIMIT 1`,
      [id_karyawan],
    )
    if (!karyawanRows?.[0]) {
      await connection.rollback()
      return build422({ id_karyawan: ['The id_karyawan is invalid.'] })
    }

    const [kantorRows] = await connection.execute<any[]>(
      `SELECT id_kantor, coa, coa_noncash FROM hcm_kantor WHERE id_kantor = ? LIMIT 1`,
      [id_kantor],
    )
    const kantorRow = kantorRows?.[0]
    if (!kantorRow) {
      await connection.rollback()
      return build422({ id_kantor: ['The id_kantor is invalid.'] })
    }

    // --- Duplikat: no_bukti ---
    const [dupNoBuktiRows] = await connection.execute<any[]>(
      `SELECT id_transaksi, id_donatur, no_bukti
       FROM corez_transaksi
       WHERE no_bukti = ?
       LIMIT 1`,
      [no_bukti],
    )
    const dupNoBukti = dupNoBuktiRows?.[0]
    if (dupNoBukti) {
      await connection.rollback()
      return buildDuplicateResponse({
        message: 'Transaksi sudah ada. Data dengan nomor bukti atau transaksi yang sama telah tercatat.',
        statusCode: 409,
        id_transaksi: dupNoBukti.id_transaksi,
        id_donatur: dupNoBukti.id_donatur,
        no_bukti,
      })
    }

    // --- Duplikat: trigger rule ---
    const dupKeyKeterangan = keterangan === null ? '' : String(keterangan)
    const [dupTriggerRows] = await connection.execute<any[]>(
      `SELECT id_transaksi, id_donatur, no_bukti
       FROM corez_transaksi
       WHERE id_donatur = ?
         AND id_program = ?
         AND id_kantor_transaksi = ?
         AND transaksi = ?
         AND tgl_transaksi = ?
         AND tgl_donasi = ?
         AND keterangan = ?
       LIMIT 1`,
      [id_donatur, id_program, id_kantor, transaksi, tgl_transaksi_dt, tgl_donasi_only, dupKeyKeterangan],
    )
    const dupTrigger = dupTriggerRows?.[0]
    if (dupTrigger) {
      await connection.rollback()
      return buildDuplicateResponse({
        message: 'Transaksi sudah ada. Data dengan nomor bukti atau transaksi yang sama telah tercatat.',
        statusCode: 409,
        id_transaksi: dupTrigger.id_transaksi,
        id_donatur: dupTrigger.id_donatur,
        no_bukti,
      })
    }

    // --- Lookup COA debet ---
    let coaDebetRaw = ''
    if (id_via_bayar === 1) {
      // cash
      coaDebetRaw = String(kantorRow.coa)
    } else if (id_via_bayar === 2) {
      // bank
      const [bankRows] = await connection.execute<any[]>(
        `SELECT coa FROM fins_bank_rek WHERE id_rekening = ? LIMIT 1`,
        [id_rekening],
      )
      if (!bankRows?.[0]?.coa) {
        await connection.rollback()
        return build422({ id_rekening: ['Rekening tidak ditemukan.'] })
      }
      coaDebetRaw = String(bankRows[0].coa)
    } else if (id_via_bayar === 3) {
      // noncash (ambil coa_noncash)
      coaDebetRaw = String(kantorRow.coa_noncash || kantorRow.coa)
    } else {
      await connection.rollback()
      return build422({ id_via_bayar: ['id_via_bayar tidak valid.'] })
    }

    const coa_debet = stripDots(coaDebetRaw)

    // --- Lookup COA kredit (dari setting_program) ---
    const coaKreditCandidate = [
      progRow.coa_entitas,
      progRow.coa_individu,
      progRow.coa2,
      progRow.coa1,
    ]
      .map((v: any) => (v == null ? '' : String(v).trim()))
      .filter(Boolean)

    if (coaKreditCandidate.length === 0) {
      await connection.rollback()
      return build422({ id_program: ['COA kredit untuk program tidak ditemukan.'] })
    }
    const coa_kredit = coaKreditCandidate[0]

    // --- DP ---
    const dpFromReq =
      body.dp !== undefined && body.dp !== null && String(body.dp).trim() !== ''
        ? Number(body.dp)
        : null

    const transaksiValue = Number(transaksi)
    const dpPercent = Number(progRow.dp ?? 0)
    const dpComputed = Number(((transaksiValue * dpPercent) / 100).toFixed(2))
    const dpAmount = dpFromReq !== null ? Number(dpFromReq.toFixed?.(2) ?? dpFromReq) : dpComputed

    // --- Generate transaction id ---
    const id_transaksi = generateTransactionId()
    const detailid = 1
    const approved_transaksi = 'y'
    const cur = 'IDR'

    // Insert ke corez_transaksi
    await connection.execute(
      `
      INSERT INTO corez_transaksi (
        id_transaksi, id_via_bayar, id_donatur, detailid,
        id_program, id_program_claim,
        coa_debet, coa_kredit,
        quantity, transaksi, tgl_transaksi,
        id_kantor_transaksi, id_kantor_donatur,
        id_penghimpunan, id_via_himpun,
        id_cara_bayar,
        cdt, approved_transaksi, tgl_donasi,
        keterangan, user_insert, no_bukti,
        cur, ViaInput, note,
        dp,
        id_affiliate,
        grouptrx,
        id_crm,
        dtu
      ) VALUES (
        ?, ?, ?,
        ?,
        ?, ?,
        ?, ?,
        ?, ?, ?,
        ?, ?,
        ?, ?,
        ?,
        NOW(), ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?,
        ?,
        ?,
        ?,
        NOW()
      )
      `,
      [
        id_transaksi,
        id_via_bayar,
        id_donatur,
        detailid,
        id_program,
        id_program_claim,
        coa_debet,
        coa_kredit,
        quantity,
        transaksiValue,
        tgl_transaksi_dt,
        id_kantor,
        id_kantor_donatur,
        id_penghimpunan,
        id_via_himpun,
        id_cara_bayar,
        approved_transaksi,
        tgl_donasi_only,
        keterangan,
        user_insert,
        no_bukti,
        cur,
        ViaInput,
        String(body.note ?? ''),
        dpAmount,
        id_affiliate,
        id_transaksi, // grouptrx
        id_crm,
      ],
    )

    await connection.commit()

    return NextResponse.json(
      {
        status: true,
        message: 'Berhasil menyimpan transaksi',
        id_transaksi,
        id_donatur,
        no_bukti,
        data: {
          id_transaksi,
          id_donatur,
          no_bukti,
          id_program,
          id_kantor,
          tgl_transaksi: tgl_transaksi_only,
          keterangan,
          transaksi: transaksiValue,
          quantity,
          coa_debet,
          coa_kredit,
          id_via_bayar,
          id_penghimpunan,
          id_via_himpun,
          user_insert,
          ViaInput,
          dp: dpAmount,
        },
      },
      { status: 200 },
    )
  } catch (error: any) {
    try {
      await connection.rollback()
    } catch {}

    // Duplikat karena unik constraint/error SQL (mis. 1644 pada ref)
    const msg = error?.message ? String(error.message) : String(error)
    const isDuplicateError = msg.includes('transaksi sudah ada') || msg.includes('1644')
    if (isDuplicateError) {
      return buildDuplicateResponse({
        message: 'Transaksi sudah ada. Data dengan nomor bukti atau transaksi yang sama telah tercatat.',
        statusCode: 409,
      })
    }

    console.error('Error POST /api/corez/transaksi/save:', error)
    return NextResponse.json(
      {
        status: false,
        message: 'Terjadi kesalahan saat menyimpan transaksi',
        error: error?.message || String(error),
      },
      { status: 500 },
    )
  } finally {
    connection.release()
  }
}

