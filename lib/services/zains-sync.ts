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
  id_donatur?: string
  success?: boolean
  message?: string
  error?: string
}

/**
 * Extract phone number from erm_no
 * Menggunakan no_erm langsung sebagai hp dan telpon
 */
function extractPhoneFromErm(ermNo: string): { hp: string; telpon: string } {
  // Langsung gunakan erm_no sebagai hp dan telpon
  return {
    hp: ermNo || '',
    telpon: ermNo || ''
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

  const { hp, telpon } = extractPhoneFromErm(patient.erm_no || '')
  
  const payload: ZainsSyncPayload = {
    nama: patient.full_name || '',
    id_jenis: 1,
    hp: hp,
    telpon: telpon,
    email: '',
    alamat: '',
    id_crm: ''
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
    
    if (data.id_donatur) {
      // Update patient dengan id_donatur_zains
      await sql`
        UPDATE patients
        SET id_donatur_zains = ${data.id_donatur},
            updated_at = NOW()
        WHERE id = ${patient.id}
      `
      
      return {
        success: true,
        id_donatur: data.id_donatur,
        patientId: patient.id
      }
    } else {
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
export async function getUnsyncedPatients(limit: number = 20): Promise<any[]> {
  try {
    const patients = await sql`
      SELECT id, clinic_id, erm_no, full_name
      FROM patients
      WHERE (id_donatur_zains IS NULL OR id_donatur_zains = '')
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
 * This function processes 20 patients at a time in parallel
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
  const patients = await getUnsyncedPatients(20)
  
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
