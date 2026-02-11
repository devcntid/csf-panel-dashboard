import { NextRequest, NextResponse } from 'next/server'
import {
  syncPatientToZains,
  syncTransactionsToZainsByTransactionId,
} from '@/lib/services/zains-sync'
import { sql } from '@/lib/db'

/**
 * Endpoint untuk handle Upstash workflow execution (spesifik per transaksi).
 * Dipanggil setelah insert/upload transaksi: sync patient ke Zains lalu sync hanya
 * transactions_to_zains untuk transaction_id yang diberikan (bukan general batch).
 *
 * Body: { patientId: number, transactionId?: number }
 * - patientId: wajib, untuk sync donatur ke Zains
 * - transactionId: opsional; jika ada, sync hanya transaksi ini ke Zains (spesifik).
 *   Jika tidak ada, hanya sync patient (tidak trigger sync transaksi general).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { patientId, transactionId } = body

    const patientIdNum =
      patientId != null
        ? typeof patientId === 'number'
          ? patientId
          : parseInt(String(patientId), 10)
        : NaN

    if (!patientId || isNaN(patientIdNum) || patientIdNum <= 0) {
      return NextResponse.json(
        { error: 'patientId harus diisi dan berupa number' },
        { status: 400 },
      )
    }

    const transactionIdNum =
      transactionId != null
        ? typeof transactionId === 'number'
          ? transactionId
          : parseInt(String(transactionId), 10)
        : NaN
    const hasTransactionId = !isNaN(transactionIdNum) && transactionIdNum > 0

    const [patient] = await sql`
      SELECT id, clinic_id, erm_no, full_name, erm_no_for_zains, id_donatur_zains
      FROM patients
      WHERE id = ${patientIdNum}
        AND (id_donatur_zains IS NULL OR id_donatur_zains = '')
        AND erm_no_for_zains IS NOT NULL
        AND erm_no_for_zains != ''
      LIMIT 1
    `

    if (!patient || (Array.isArray(patient) && patient.length === 0)) {
      return NextResponse.json({
        success: true,
        message: `Patient ID ${patientIdNum} sudah di-sync atau tidak memiliki erm_no_for_zains`,
        skipped: true,
      })
    }

    const patientData = Array.isArray(patient) ? patient[0] : patient

    const result = await syncPatientToZains(patientData)

    if (result.success) {
      console.log(
        `✅ [Upstash Workflow] Patient ID ${patientIdNum} berhasil di-sync ke Zains, id_donatur: ${result.id_donatur}`,
      )

      if (hasTransactionId) {
        const trxResult = await syncTransactionsToZainsByTransactionId(transactionIdNum)
        console.log(
          `✅ [Upstash Workflow] Sync transaksi spesifik (transaction_id=${transactionIdNum}): ${trxResult.success} berhasil, ${trxResult.failed} gagal dari ${trxResult.total} records`,
        )
        return NextResponse.json({
          success: true,
          message: `Patient ID ${patientIdNum} berhasil di-sync ke Zains; sync transaksi spesifik selesai`,
          id_donatur: result.id_donatur,
          patientId: patientIdNum,
          transactionId: transactionIdNum,
          transactionSync: {
            total: trxResult.total,
            success: trxResult.success,
            failed: trxResult.failed,
          },
        })
      }

      return NextResponse.json({
        success: true,
        message: `Patient ID ${patientIdNum} berhasil di-sync ke Zains`,
        id_donatur: result.id_donatur,
        patientId: patientIdNum,
      })
    } else {
      console.warn(`⚠️  [Upstash Workflow] Patient ID ${patientIdNum} gagal di-sync ke Zains: ${result.error}`)
      return NextResponse.json({
        success: false,
        error: result.error,
        patientId: patientIdNum
      }, { status: 500 })
    }
  } catch (error: any) {
    console.error('❌ [Upstash Workflow] Error saat sync patient ke Zains:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Error saat sync patient ke Zains'
      },
      { status: 500 }
    )
  }
}
