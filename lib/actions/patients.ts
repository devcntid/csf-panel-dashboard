'use server'

import { sql } from '@/lib/db'
import { cache } from 'react'

export const getPatients = cache(async (search?: string, page: number = 1, limit: number = 10, clinicId?: number) => {
  try {
    const offset = (page - 1) * limit
    
    if (search) {
      // Build query berdasarkan kombinasi search dan clinicId
      if (clinicId) {
        // Search + Clinic filter
        const [patients, countResultRaw] = await Promise.all([
          sql`
            SELECT 
              p.*,
              c.name as clinic_name,
              CASE 
                WHEN p.visit_count >= 10 THEN 'Loyal'
                WHEN p.visit_count >= 3 THEN 'Active'
                WHEN p.visit_count = 1 THEN 'New'
                ELSE 'At Risk'
              END as status
            FROM patients p
            JOIN clinics c ON c.id = p.clinic_id
            WHERE 
              (p.full_name ILIKE ${`%${search}%`} OR
              p.erm_no ILIKE ${`%${search}%`} OR
              p.nik ILIKE ${`%${search}%`} OR
              p.id_donatur_zains ILIKE ${`%${search}%`})
              AND p.clinic_id = ${clinicId}
            ORDER BY p.last_visit_at DESC
            LIMIT ${limit} OFFSET ${offset}
          `,
          sql`
            SELECT COUNT(*) as total
            FROM patients p
            WHERE 
              (p.full_name ILIKE ${`%${search}%`} OR
              p.erm_no ILIKE ${`%${search}%`} OR
              p.nik ILIKE ${`%${search}%`} OR
              p.id_donatur_zains ILIKE ${`%${search}%`})
              AND p.clinic_id = ${clinicId}
          `
        ])
        const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
        
        return {
          patients: Array.isArray(patients) ? patients : [],
          total: Number((countResult as any)?.total || 0),
          page,
          limit,
        }
      } else {
        // Search saja, tanpa clinic filter
        const [patients, countResultRaw] = await Promise.all([
          sql`
            SELECT 
              p.*,
              c.name as clinic_name,
              CASE 
                WHEN p.visit_count >= 10 THEN 'Loyal'
                WHEN p.visit_count >= 3 THEN 'Active'
                WHEN p.visit_count = 1 THEN 'New'
                ELSE 'At Risk'
              END as status
            FROM patients p
            JOIN clinics c ON c.id = p.clinic_id
            WHERE 
              p.full_name ILIKE ${`%${search}%`} OR
              p.erm_no ILIKE ${`%${search}%`} OR
              p.nik ILIKE ${`%${search}%`} OR
              p.id_donatur_zains ILIKE ${`%${search}%`}
            ORDER BY p.last_visit_at DESC
            LIMIT ${limit} OFFSET ${offset}
          `,
          sql`
            SELECT COUNT(*) as total
            FROM patients p
            WHERE 
              p.full_name ILIKE ${`%${search}%`} OR
              p.erm_no ILIKE ${`%${search}%`} OR
              p.nik ILIKE ${`%${search}%`} OR
              p.id_donatur_zains ILIKE ${`%${search}%`}
          `
        ])
        const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
        
        return {
          patients: Array.isArray(patients) ? patients : [],
          total: Number((countResult as any)?.total || 0),
          page,
          limit,
        }
      }
    } else {
      // Parallel fetching untuk performa maksimal
      if (clinicId) {
        const [patients, countResultRaw] = await Promise.all([
          sql`
            SELECT 
              p.*,
              c.name as clinic_name,
              CASE 
                WHEN p.visit_count >= 10 THEN 'Loyal'
                WHEN p.visit_count >= 3 THEN 'Active'
                WHEN p.visit_count = 1 THEN 'New'
                ELSE 'At Risk'
              END as status
            FROM patients p
            JOIN clinics c ON c.id = p.clinic_id
            WHERE p.clinic_id = ${clinicId}
            ORDER BY p.last_visit_at DESC
            LIMIT ${limit} OFFSET ${offset}
          `,
          sql`
            SELECT COUNT(*) as total 
            FROM patients p
            WHERE p.clinic_id = ${clinicId}
          `
        ])
        const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
        
        return {
          patients: Array.isArray(patients) ? patients : [],
          total: Number((countResult as any)?.total || 0),
          page,
          limit,
        }
      } else {
        const [patients, countResultRaw] = await Promise.all([
          sql`
            SELECT 
              p.*,
              c.name as clinic_name,
              CASE 
                WHEN p.visit_count >= 10 THEN 'Loyal'
                WHEN p.visit_count >= 3 THEN 'Active'
                WHEN p.visit_count = 1 THEN 'New'
                ELSE 'At Risk'
              END as status
            FROM patients p
            JOIN clinics c ON c.id = p.clinic_id
            ORDER BY p.last_visit_at DESC
            LIMIT ${limit} OFFSET ${offset}
          `,
          sql`
            SELECT COUNT(*) as total FROM patients
          `
        ])
        const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
        
        return {
          patients: Array.isArray(patients) ? patients : [],
          total: Number((countResult as any)?.total || 0),
          page,
          limit,
        }
      }
    }
  } catch (error) {
    console.error('Error fetching patients:', error)
    return {
      patients: [],
      total: 0,
      page,
      limit,
    }
  }
})

export const getPatientById = cache(async (id: string | number) => {
  try {
    const patientId = typeof id === 'string' ? parseInt(id) : id
    const patientRaw = await sql`
      SELECT 
        p.*,
        c.name as clinic_name,
        c.location as clinic_location,
        CASE 
          WHEN p.visit_count >= 10 THEN 'Loyal'
          WHEN p.visit_count >= 3 THEN 'Active'
          WHEN p.visit_count = 1 THEN 'New'
          ELSE 'At Risk'
        END as status
      FROM patients p
      JOIN clinics c ON c.id = p.clinic_id
      WHERE p.id = ${patientId}
    `
    const patient = Array.isArray(patientRaw) ? patientRaw[0] : patientRaw
    return patient || null
  } catch (error) {
    console.error('Error fetching patient:', error)
    return null
  }
})

// Stats ringkas untuk halaman Data Pasien:
// - totalPatients: total pasien sesuai filter
// - withoutZains: pasien yang TIDAK punya satu pun transaksi yang dibreak ke transactions_to_zains
// - zainsQueue: pasien yang punya transaksi Zains tapi belum punya id_donatur_zains (antrian sync)
export const getPatientStats = cache(async (search?: string, clinicId?: number) => {
  try {
    const searchPattern = search && search.trim() ? `%${search.trim()}%` : null

    let statsRaw: any

    if (searchPattern && clinicId) {
      statsRaw = await sql`
        SELECT 
          COUNT(DISTINCT p.id) as total_patients,
          COUNT(DISTINCT CASE 
            WHEN NOT EXISTS (
              SELECT 1
              FROM transactions t
              JOIN transactions_to_zains tz ON tz.transaction_id = t.id
              WHERE t.patient_id = p.id
            ) 
            THEN p.id END
          ) as without_zains,
          COUNT(DISTINCT CASE 
            WHEN (p.id_donatur_zains IS NULL OR p.id_donatur_zains = '')
             AND EXISTS (
               SELECT 1
               FROM transactions t2
               JOIN transactions_to_zains tz2 ON tz2.transaction_id = t2.id
               WHERE t2.patient_id = p.id
             )
            THEN p.id END
          ) as zains_queue
        FROM patients p
        WHERE p.clinic_id = ${clinicId}
          AND (
            p.full_name ILIKE ${searchPattern} OR
            p.erm_no ILIKE ${searchPattern} OR
            p.id_donatur_zains ILIKE ${searchPattern}
          )
      `
    } else if (clinicId) {
      statsRaw = await sql`
        SELECT 
          COUNT(DISTINCT p.id) as total_patients,
          COUNT(DISTINCT CASE 
            WHEN NOT EXISTS (
              SELECT 1
              FROM transactions t
              JOIN transactions_to_zains tz ON tz.transaction_id = t.id
              WHERE t.patient_id = p.id
            ) 
            THEN p.id END
          ) as without_zains,
          COUNT(DISTINCT CASE 
            WHEN (p.id_donatur_zains IS NULL OR p.id_donatur_zains = '')
             AND EXISTS (
               SELECT 1
               FROM transactions t2
               JOIN transactions_to_zains tz2 ON tz2.transaction_id = t2.id
               WHERE t2.patient_id = p.id
             )
            THEN p.id END
          ) as zains_queue
        FROM patients p
        WHERE p.clinic_id = ${clinicId}
      `
    } else if (searchPattern) {
      statsRaw = await sql`
        SELECT 
          COUNT(DISTINCT p.id) as total_patients,
          COUNT(DISTINCT CASE 
            WHEN NOT EXISTS (
              SELECT 1
              FROM transactions t
              JOIN transactions_to_zains tz ON tz.transaction_id = t.id
              WHERE t.patient_id = p.id
            ) 
            THEN p.id END
          ) as without_zains,
          COUNT(DISTINCT CASE 
            WHEN (p.id_donatur_zains IS NULL OR p.id_donatur_zains = '')
             AND EXISTS (
               SELECT 1
               FROM transactions t2
               JOIN transactions_to_zains tz2 ON tz2.transaction_id = t2.id
               WHERE t2.patient_id = p.id
             )
            THEN p.id END
          ) as zains_queue
        FROM patients p
        WHERE 
          p.full_name ILIKE ${searchPattern} OR
          p.erm_no ILIKE ${searchPattern} OR
          p.id_donatur_zains ILIKE ${searchPattern}
      `
    } else {
      statsRaw = await sql`
        SELECT 
          COUNT(DISTINCT p.id) as total_patients,
          COUNT(DISTINCT CASE 
            WHEN NOT EXISTS (
              SELECT 1
              FROM transactions t
              JOIN transactions_to_zains tz ON tz.transaction_id = t.id
              WHERE t.patient_id = p.id
            ) 
            THEN p.id END
          ) as without_zains,
          COUNT(DISTINCT CASE 
            WHEN (p.id_donatur_zains IS NULL OR p.id_donatur_zains = '')
             AND EXISTS (
               SELECT 1
               FROM transactions t2
               JOIN transactions_to_zains tz2 ON tz2.transaction_id = t2.id
               WHERE t2.patient_id = p.id
             )
            THEN p.id END
          ) as zains_queue
        FROM patients p
      `
    }

    const stats = Array.isArray(statsRaw) ? statsRaw[0] : statsRaw

    return {
      totalPatients: Number((stats as any)?.total_patients || 0),
      withoutZains: Number((stats as any)?.without_zains || 0),
      zainsQueue: Number((stats as any)?.zains_queue || 0),
    }
  } catch (error) {
    console.error('Error fetching patient stats:', error)
    return {
      totalPatients: 0,
      withoutZains: 0,
      zainsQueue: 0,
    }
  }
})

/**
 * Hapus pasien beserta cascade: transactions_to_zains (transaksi pasien) lalu transactions, lalu patient.
 */
export async function deletePatient(patientId: number): Promise<{ success: boolean; error?: string }> {
  try {
    await sql`
      DELETE FROM transactions_to_zains
      WHERE transaction_id IN (SELECT id FROM transactions WHERE patient_id = ${patientId})
    `
    await sql`DELETE FROM transactions WHERE patient_id = ${patientId}`
    await sql`DELETE FROM patients WHERE id = ${patientId}`
    return { success: true }
  } catch (error) {
    console.error('Error deleting patient:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Gagal menghapus pasien',
    }
  }
}
