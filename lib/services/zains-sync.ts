'use server'

import { sql } from '@/lib/db'

interface ZainsSyncPayload {
  nama: string
  id_jenis: number
  hp: string
  telpon: string
  email: string
  alamat: string
  id_crm: string
}

interface ZainsSyncResponse {
  status?: boolean
  message?: string
  data?: {
    id_donatur?: string
    donatur?: string
    [key: string]: any
  }
  id_donatur?: string  // Bisa di level root response (untuk case sudah terdaftar)
  success?: boolean
  error?: string
}

/**
 * Extract phone and email from erm_no_for_zains
 * Menggunakan erm_no_for_zains untuk hp, telpon, dan email
 */
function extractContactFromErmNoForZains(ermNoForZains: string): { hp: string; telpon: string; email: string } {
  // Gunakan erm_no_for_zains untuk hp dan telpon
  // Email format: {erm_no_for_zains}@gmail.com
  return {
    hp: ermNoForZains || '',
    telpon: ermNoForZains || '',
    email: ermNoForZains ? `${ermNoForZains}@gmail.com` : ''
  }
}

/**
 * Get Zains API URL based on environment
 */
function getZainsApiUrl(): string {
  const isProduction = process.env.IS_PRODUCTION === 'true'
  
  if (isProduction) {
    return process.env.URL_API_ZAINS_PRODUCTION || ''
  } else {
    return process.env.URL_API_ZAINS_STAGING || ''
  }
}

/**
 * Sync single patient to Zains API
 */
export async function syncPatientToZains(patient: any): Promise<{
  success: boolean
  id_donatur?: string
  error?: string
  patientId: number
}> {
  const apiUrl = getZainsApiUrl()
  const apiKey = process.env.API_KEY_ZAINS
  
  if (!apiUrl) {
    return {
      success: false,
      error: 'URL_API_ZAINS tidak dikonfigurasi',
      patientId: patient.id
    }
  }

  if (!apiKey) {
    return {
      success: false,
      error: 'API_KEY_ZAINS tidak dikonfigurasi',
      patientId: patient.id
    }
  }

  // Gunakan erm_no_for_zains untuk hp, telpon, dan email
  const { hp, telpon, email } = extractContactFromErmNoForZains(patient.erm_no_for_zains || '')
  
  const payload: ZainsSyncPayload = {
    nama: patient.full_name || '',
    id_jenis: 1,
    hp: hp,
    telpon: telpon,
    email: email,
    alamat: '-',
    id_crm: '-'
  }

  try {
    const response = await fetch(`${apiUrl}/corez/mitra/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': apiKey,
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const errorText = await response.text()
      return {
        success: false,
        error: `HTTP ${response.status}: ${errorText}`,
        patientId: patient.id
      }
    }

    const data: ZainsSyncResponse = await response.json()
    
    // Ambil id_donatur dari response API Zains (prioritas: data.data.id_donatur, lalu data.id_donatur)
    const idDonatur = data.data?.id_donatur || data.id_donatur
    
    // Handle case: Mitra sudah terdaftar (tidak perlu retry)
    if (data.status === false && data.message && data.message.includes('sudah terdaftar')) {
      // Patient sudah terdaftar di Zains
      // Update patient dengan id_donatur dari response jika ada
      if (idDonatur) {
        await sql`
          UPDATE patients
          SET id_donatur_zains = ${idDonatur},
              updated_at = NOW()
          WHERE id = ${patient.id}
        `
        
        return {
          success: true,
          id_donatur: idDonatur,
          patientId: patient.id
        }
      } else {
        // Jika tidak ada id_donatur di response, tetap mark as success agar tidak retry
        return {
          success: true,
          id_donatur: 'already_registered',
          patientId: patient.id
        }
      }
    }
    
    // Handle response sukses: Update patient dengan id_donatur dari response
    if (idDonatur) {
      await sql`
        UPDATE patients
        SET id_donatur_zains = ${idDonatur},
            updated_at = NOW()
        WHERE id = ${patient.id}
      `
      
      return {
        success: true,
        id_donatur: idDonatur,
        patientId: patient.id
      }
    } else {
      // Jika tidak ada id_donatur di response, return error
      return {
        success: false,
        error: data.message || data.error || 'id_donatur tidak ditemukan di response',
        patientId: patient.id
      }
    }
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Error saat sync ke Zains',
      patientId: patient.id
    }
  }
}

/**
 * Get batch of patients yang belum di-sync (id_donatur_zains kosong)
 */
export async function getUnsyncedPatients(limit: number = 10): Promise<any[]> {
  try {
    const patients = await sql`
      SELECT id, clinic_id, erm_no, full_name, erm_no_for_zains
      FROM patients
      WHERE (id_donatur_zains IS NULL OR id_donatur_zains = '')
        AND erm_no_for_zains IS NOT NULL
        AND erm_no_for_zains != ''
      ORDER BY created_at ASC
      LIMIT ${limit}
    `
    
    return Array.isArray(patients) ? patients : []
  } catch (error) {
    console.error('Error fetching unsynced patients:', error)
    return []
  }
}

/**
 * Log sync result to system_logs
 */
export async function logSyncResult(
  clinicId: number | null,
  status: 'success' | 'error',
  message: string,
  payload: any
): Promise<void> {
  try {
    await sql`
      INSERT INTO system_logs (clinic_id, process_type, status, message, payload)
      VALUES (
        ${clinicId},
        'patient_zains_sync',
        ${status},
        ${message},
        ${JSON.stringify(payload)}::jsonb
      )
    `
  } catch (error) {
    console.error('Error logging sync result:', error)
  }
}

/**
 * Sync batch of patients to Zains (async, non-blocking)
 * This function processes 10 patients at a time in parallel
 */
export async function syncPatientsBatchToZains(): Promise<{
  total: number
  success: number
  failed: number
  results: Array<{
    patientId: number
    success: boolean
    id_donatur?: string
    error?: string
  }>
}> {
  const patients = await getUnsyncedPatients(10)
  
  if (patients.length === 0) {
    return {
      total: 0,
      success: 0,
      failed: 0,
      results: []
    }
  }

  // Process all patients in parallel for maximum speed
  const syncPromises = patients.map(patient => syncPatientToZains(patient))
  const results = await Promise.all(syncPromises)

  const successCount = results.filter(r => r.success).length
  const failedCount = results.filter(r => !r.success).length

  // Log summary
  await logSyncResult(
    null, // clinic_id bisa null untuk batch sync
    failedCount === 0 ? 'success' : (successCount > 0 ? 'success' : 'error'),
    `Sync batch: ${successCount} berhasil, ${failedCount} gagal dari ${patients.length} patients`,
    {
      total: patients.length,
      success: successCount,
      failed: failedCount,
      results: results.map(r => ({
        patientId: r.patientId,
        success: r.success,
        id_donatur: r.id_donatur,
        error: r.error
      }))
    }
  )

  // Log individual failures
  for (const result of results) {
    if (!result.success) {
      const patient = patients.find(p => p.id === result.patientId)
      await logSyncResult(
        patient?.clinic_id || null,
        'error',
        `Gagal sync patient ID ${result.patientId}: ${result.error}`,
        {
          patientId: result.patientId,
          ermNo: patient?.erm_no,
          fullName: patient?.full_name,
          error: result.error
        }
      )
    }
  }

  return {
    total: patients.length,
    success: successCount,
    failed: failedCount,
    results: results.map(r => ({
      patientId: r.patientId,
      success: r.success,
      id_donatur: r.id_donatur,
      error: r.error
    }))
  }
}

/**
 * Sync single patient to Zains (untuk workflow integration)
 * Digunakan setelah transaction to zains sukses dan patient sudah di-insert/update
 * Async, non-blocking - tidak throw error, hanya log
 */
export async function syncPatientToZainsWorkflow(patientId: number): Promise<void> {
  try {
    // Get patient data dengan erm_no_for_zains
    const [patient] = await sql`
      SELECT id, clinic_id, erm_no, full_name, erm_no_for_zains, id_donatur_zains
      FROM patients
      WHERE id = ${patientId}
        AND (id_donatur_zains IS NULL OR id_donatur_zains = '')
        AND erm_no_for_zains IS NOT NULL
        AND erm_no_for_zains != ''
      LIMIT 1
    `

    if (!patient || patient.length === 0) {
      // Patient sudah di-sync atau tidak ada erm_no_for_zains, skip
      return
    }

    const patientData = Array.isArray(patient) ? patient[0] : patient

    // Sync patient ke Zains (async, non-blocking)
    syncPatientToZains(patientData)
      .then(result => {
        if (result.success) {
          console.log(`✅ [Workflow] Patient ID ${patientId} berhasil di-sync ke Zains, id_donatur: ${result.id_donatur}`)
        } else {
          console.warn(`⚠️  [Workflow] Patient ID ${patientId} gagal di-sync ke Zains: ${result.error}`)
        }
      })
      .catch(error => {
        console.error(`❌ [Workflow] Error saat sync patient ID ${patientId} ke Zains:`, error)
      })
  } catch (error) {
    // Jangan throw error, hanya log
    console.error(`❌ [Workflow] Error saat fetch patient ID ${patientId} untuk sync:`, error)
  }
}
