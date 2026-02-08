import { NextRequest, NextResponse } from 'next/server'
import { syncPatientToZains } from '@/lib/services/zains-sync'
import { sql } from '@/lib/db'

/**
 * Endpoint untuk handle Upstash workflow execution
 * Endpoint ini akan dipanggil oleh Upstash workflow untuk sync patient ke Zains
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { patientId } = body

    // Terima patientId sebagai number atau string (payload sering dikirim sebagai string dari QStash/HTTP)
    const patientIdNum = patientId != null
      ? (typeof patientId === 'number' ? patientId : parseInt(String(patientId), 10))
      : NaN

    if (!patientId || isNaN(patientIdNum) || patientIdNum <= 0) {
      return NextResponse.json(
        { error: 'patientId harus diisi dan berupa number' },
        { status: 400 }
      )
    }

    // Get patient data dengan erm_no_for_zains
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
      // Patient sudah di-sync atau tidak ada erm_no_for_zains, skip
      return NextResponse.json({
        success: true,
        message: `Patient ID ${patientIdNum} sudah di-sync atau tidak memiliki erm_no_for_zains`,
        skipped: true
      })
    }

    const patientData = Array.isArray(patient) ? patient[0] : patient

    // Sync patient ke Zains
    const result = await syncPatientToZains(patientData)

    if (result.success) {
      console.log(`✅ [Upstash Workflow] Patient ID ${patientIdNum} berhasil di-sync ke Zains, id_donatur: ${result.id_donatur}`)
      return NextResponse.json({
        success: true,
        message: `Patient ID ${patientIdNum} berhasil di-sync ke Zains`,
        id_donatur: result.id_donatur,
        patientId: patientIdNum
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
