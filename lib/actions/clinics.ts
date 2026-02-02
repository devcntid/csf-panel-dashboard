'use server'

import { sql } from '@/lib/db'
import { cache } from 'react'

// Cache untuk performa maksimal
export const getClinics = cache(async () => {
  try {
    const clinics = await sql`
      SELECT 
        c.*,
        COUNT(DISTINCT p.id) as total_patients,
        COUNT(DISTINCT t.id) as total_transactions,
        COALESCE(SUM(CASE WHEN t.trx_date = CURRENT_DATE THEN t.bill_total ELSE 0 END), 0) as revenue_today,
        COALESCE(SUM(CASE WHEN t.trx_date = CURRENT_DATE THEN t.bill_total ELSE 0 END), 0) as revenue_target,
        MAX(t.trx_date) as last_transaction_date
      FROM clinics c
      LEFT JOIN patients p ON p.clinic_id = c.id
      LEFT JOIN transactions t ON t.clinic_id = c.id
      WHERE c.is_active = true
      GROUP BY c.id
      ORDER BY c.name
    `
    return clinics
  } catch (error) {
    console.error('Error fetching clinics:', error)
    return []
  }
})

export const getClinicById = cache(async (id: string | number) => {
  try {
    const clinicId = typeof id === 'string' ? parseInt(id) : id
    const [clinic] = await sql`
      SELECT 
        c.*,
        COUNT(DISTINCT p.id) as total_patients,
        COUNT(DISTINCT t.id) as total_transactions,
        COALESCE(SUM(CASE WHEN t.trx_date = CURRENT_DATE THEN t.bill_total ELSE 0 END), 0) as revenue_today,
        COALESCE(AVG(t.bill_total), 0) as avg_transaction
      FROM clinics c
      LEFT JOIN patients p ON p.clinic_id = c.id
      LEFT JOIN transactions t ON t.clinic_id = c.id
      WHERE c.id = ${clinicId}
      GROUP BY c.id
    `
    return clinic || null
  } catch (error) {
    console.error('Error fetching clinic:', error)
    return null
  }
})

export const getClinicStats = cache(async (clinicId: number) => {
  try {
    const today = new Date().toISOString().split('T')[0]
    
    const [stats] = await sql`
      SELECT 
        COUNT(DISTINCT t.id) as transactions_today,
        COALESCE(SUM(t.bill_total), 0) as revenue_today,
        COUNT(DISTINCT t.erm_no) as unique_patients_today,
        COALESCE(AVG(t.bill_total), 0) as avg_transaction
      FROM transactions t
      WHERE t.clinic_id = ${clinicId} AND t.trx_date = ${today}
    `
    
    return stats || {
      transactions_today: 0,
      revenue_today: 0,
      unique_patients_today: 0,
      avg_transaction: 0,
    }
  } catch (error) {
    console.error('Error fetching clinic stats:', error)
    return {
      transactions_today: 0,
      revenue_today: 0,
      unique_patients_today: 0,
      avg_transaction: 0,
    }
  }
})
