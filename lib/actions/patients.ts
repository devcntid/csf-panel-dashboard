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
              p.erm_no ILIKE ${`%${search}%`})
              AND p.clinic_id = ${clinicId}
            ORDER BY p.last_visit_at DESC
            LIMIT ${limit} OFFSET ${offset}
          `,
          sql`
            SELECT COUNT(*) as total
            FROM patients p
            WHERE 
              (p.full_name ILIKE ${`%${search}%`} OR
              p.erm_no ILIKE ${`%${search}%`})
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
              p.erm_no ILIKE ${`%${search}%`}
            ORDER BY p.last_visit_at DESC
            LIMIT ${limit} OFFSET ${offset}
          `,
          sql`
            SELECT COUNT(*) as total
            FROM patients p
            WHERE 
              p.full_name ILIKE ${`%${search}%`} OR
              p.erm_no ILIKE ${`%${search}%`}
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

export const getPatientStats = cache(async () => {
  try {
    const statsRaw = await sql`
      SELECT 
        COUNT(DISTINCT p.id) as total_patients,
        COUNT(DISTINCT CASE WHEN p.visit_count >= 10 THEN p.id END) as loyal_count,
        COUNT(DISTINCT CASE WHEN p.visit_count >= 3 AND p.visit_count < 10 THEN p.id END) as active_count,
        COUNT(DISTINCT CASE WHEN p.visit_count < 3 AND p.visit_count > 1 THEN p.id END) as at_risk_count,
        COUNT(DISTINCT CASE WHEN p.visit_count = 1 THEN p.id END) as new_count,
        COALESCE(AVG(p.visit_count), 0) as avg_visit_count,
        COUNT(DISTINCT CASE WHEN p.last_visit_at < CURRENT_DATE - INTERVAL '30 days' THEN p.id END) as churn_risk
      FROM patients p
    `
    const stats = Array.isArray(statsRaw) ? statsRaw[0] : statsRaw
    
    const total = Number((stats as any)?.total_patients || 0)
    const retentionRate = total > 0 
      ? ((Number((stats as any)?.loyal_count || 0) + Number((stats as any)?.active_count || 0)) / total * 100).toFixed(1)
      : '0'
    
    return {
      totalPatients: total,
      loyalCount: Number((stats as any)?.loyal_count || 0),
      activeCount: Number((stats as any)?.active_count || 0),
      atRiskCount: Number((stats as any)?.at_risk_count || 0),
      newCount: Number((stats as any)?.new_count || 0),
      avgVisitCount: Number((stats as any)?.avg_visit_count || 0).toFixed(1),
      retentionRate,
      churnRisk: Number((stats as any)?.churn_risk || 0),
      churnRiskPercentage: total > 0 ? ((Number((stats as any)?.churn_risk || 0) / total) * 100).toFixed(1) : '0',
    }
  } catch (error) {
    console.error('Error fetching patient stats:', error)
    return {
      totalPatients: 0,
      loyalCount: 0,
      activeCount: 0,
      atRiskCount: 0,
      newCount: 0,
      avgVisitCount: '0',
      retentionRate: '0',
      churnRisk: 0,
      churnRiskPercentage: '0',
    }
  }
})
