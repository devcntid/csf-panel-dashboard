'use server'

import { sql } from '@/lib/db'
import { cache } from 'react'

export const getTransactions = cache(async (
  search?: string,
  clinicId?: number,
  dateFrom?: string,
  dateTo?: string,
  page: number = 1,
  limit: number = 10,
  polyId?: number,
  insuranceTypeId?: number
) => {
  try {
    const offset = (page - 1) * limit
    
    // Build date filter - handle multiple conditions
    // Normalize dates - hanya gunakan jika bukan empty string
    const validDateFrom = dateFrom && dateFrom.trim() !== '' ? dateFrom : undefined
    const validDateTo = dateTo && dateTo.trim() !== '' ? dateTo : undefined
    
    // Store date values for direct use in queries (avoid sql`` empty template)
    let dateFromValue: string | undefined = undefined
    let dateToValue: string | undefined = undefined
    let hasDateFilter = false
    
    if (validDateFrom && validDateTo) {
      dateFromValue = validDateFrom
      dateToValue = validDateTo
      hasDateFilter = true
    } else if (validDateFrom) {
      dateFromValue = validDateFrom
      hasDateFilter = true
    } else if (validDateTo) {
      dateToValue = validDateTo
      hasDateFilter = true
    }
    
    // Build date condition SQL directly - avoid nested sql template issues
    // Only create if hasDateFilter is true - will be used only in blocks where hasDateFilter is true
    // Note: dateCondition will only be used in blocks where hasDateFilter is true
    let dateCondition: any = undefined
    if (hasDateFilter) {
      if (dateFromValue && dateToValue) {
        dateCondition = sql`AND DATE(t.trx_date) >= DATE(${dateFromValue}) AND DATE(t.trx_date) <= DATE(${dateToValue})`
      } else if (dateFromValue) {
        dateCondition = sql`AND DATE(t.trx_date) >= DATE(${dateFromValue})`
      } else if (dateToValue) {
        dateCondition = sql`AND DATE(t.trx_date) <= DATE(${dateToValue})`
      }
    }
    
    // Build poly filter
    let polyFilter = sql``
    let hasPolyFilter = false
    if (polyId) {
      polyFilter = sql`AND t.poly_id = ${polyId}`
      hasPolyFilter = true
    }
    
    // Build insurance filter
    let insuranceFilter = sql``
    let hasInsuranceFilter = false
    if (insuranceTypeId) {
      insuranceFilter = sql`AND t.insurance_type_id = ${insuranceTypeId}`
      hasInsuranceFilter = true
    }
    
    // Build query dengan kondisi dinamis - menggunakan parallel fetching
    if (search && clinicId) {
      const searchPattern = `%${search}%`
      // Build query berdasarkan kombinasi filter
      if (hasDateFilter && hasPolyFilter && hasInsuranceFilter) {
        const [transactions, countResultRaw] = await Promise.all([
          sql`
            SELECT 
              t.*,
              c.name as clinic_name,
              mp.name as master_poly_name,
              mit.name as master_insurance_name
            FROM transactions t
            JOIN clinics c ON c.id = t.clinic_id
            LEFT JOIN master_polies mp ON mp.id = t.poly_id
            LEFT JOIN master_insurance_types mit ON mit.id = t.insurance_type_id
            WHERE (
              t.trx_no ILIKE ${searchPattern} OR
              t.patient_name ILIKE ${searchPattern} OR
              t.erm_no ILIKE ${searchPattern}
            ) AND t.clinic_id = ${clinicId}
            ${dateCondition}
            ${polyFilter}
            ${insuranceFilter}
            ORDER BY t.trx_date DESC, t.trx_time DESC
            LIMIT ${limit} OFFSET ${offset}
          `,
          sql`
            SELECT COUNT(*) as total
            FROM transactions t
            WHERE (
              t.trx_no ILIKE ${searchPattern} OR
              t.patient_name ILIKE ${searchPattern} OR
              t.erm_no ILIKE ${searchPattern}
            ) AND t.clinic_id = ${clinicId}
            ${dateCondition}
            ${polyFilter}
            ${insuranceFilter}
          `
        ])
        const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
        return {
          transactions: Array.isArray(transactions) ? transactions : [],
          total: Number((countResult as any)?.total || 0),
          page,
          limit,
        }
      } else if (hasDateFilter && hasPolyFilter) {
        const [transactions, countResultRaw] = await Promise.all([
          sql`
            SELECT 
              t.*,
              c.name as clinic_name,
              mp.name as master_poly_name,
              mit.name as master_insurance_name
            FROM transactions t
            JOIN clinics c ON c.id = t.clinic_id
            LEFT JOIN master_polies mp ON mp.id = t.poly_id
            LEFT JOIN master_insurance_types mit ON mit.id = t.insurance_type_id
            WHERE (
              t.trx_no ILIKE ${searchPattern} OR
              t.patient_name ILIKE ${searchPattern} OR
              t.erm_no ILIKE ${searchPattern}
            ) AND t.clinic_id = ${clinicId}
            ${dateCondition}
            ${polyFilter}
            ORDER BY t.trx_date DESC, t.trx_time DESC
            LIMIT ${limit} OFFSET ${offset}
          `,
          sql`
            SELECT COUNT(*) as total
            FROM transactions t
            WHERE (
              t.trx_no ILIKE ${searchPattern} OR
              t.patient_name ILIKE ${searchPattern} OR
              t.erm_no ILIKE ${searchPattern}
            ) AND t.clinic_id = ${clinicId}
            ${dateCondition}
            ${polyFilter}
          `
        ])
        const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
        return {
          transactions: Array.isArray(transactions) ? transactions : [],
          total: Number((countResult as any)?.total || 0),
          page,
          limit,
        }
      } else if (hasDateFilter && hasInsuranceFilter) {
        const [transactions, countResultRaw] = await Promise.all([
          sql`
            SELECT 
              t.*,
              c.name as clinic_name,
              mp.name as master_poly_name,
              mit.name as master_insurance_name
            FROM transactions t
            JOIN clinics c ON c.id = t.clinic_id
            LEFT JOIN master_polies mp ON mp.id = t.poly_id
            LEFT JOIN master_insurance_types mit ON mit.id = t.insurance_type_id
            WHERE (
              t.trx_no ILIKE ${searchPattern} OR
              t.patient_name ILIKE ${searchPattern} OR
              t.erm_no ILIKE ${searchPattern}
            ) AND t.clinic_id = ${clinicId}
            ${dateCondition}
            ${insuranceFilter}
            ORDER BY t.trx_date DESC, t.trx_time DESC
            LIMIT ${limit} OFFSET ${offset}
          `,
          sql`
            SELECT COUNT(*) as total
            FROM transactions t
            WHERE (
              t.trx_no ILIKE ${searchPattern} OR
              t.patient_name ILIKE ${searchPattern} OR
              t.erm_no ILIKE ${searchPattern}
            ) AND t.clinic_id = ${clinicId}
            ${dateCondition}
            ${insuranceFilter}
          `
        ])
        const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
        return {
          transactions: Array.isArray(transactions) ? transactions : [],
          total: Number((countResult as any)?.total || 0),
          page,
          limit,
        }
      } else if (hasPolyFilter && hasInsuranceFilter) {
        const [transactions, countResultRaw] = await Promise.all([
          sql`
            SELECT 
              t.*,
              c.name as clinic_name,
              mp.name as master_poly_name,
              mit.name as master_insurance_name
            FROM transactions t
            JOIN clinics c ON c.id = t.clinic_id
            LEFT JOIN master_polies mp ON mp.id = t.poly_id
            LEFT JOIN master_insurance_types mit ON mit.id = t.insurance_type_id
            WHERE (
              t.trx_no ILIKE ${searchPattern} OR
              t.patient_name ILIKE ${searchPattern} OR
              t.erm_no ILIKE ${searchPattern}
            ) AND t.clinic_id = ${clinicId}
            ${polyFilter}
            ${insuranceFilter}
            ORDER BY t.trx_date DESC, t.trx_time DESC
            LIMIT ${limit} OFFSET ${offset}
          `,
          sql`
            SELECT COUNT(*) as total
            FROM transactions t
            WHERE (
              t.trx_no ILIKE ${searchPattern} OR
              t.patient_name ILIKE ${searchPattern} OR
              t.erm_no ILIKE ${searchPattern}
            ) AND t.clinic_id = ${clinicId}
            ${polyFilter}
            ${insuranceFilter}
          `
        ])
        const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
        return {
          transactions: Array.isArray(transactions) ? transactions : [],
          total: Number((countResult as any)?.total || 0),
          page,
          limit,
        }
      } else if (hasDateFilter) {
        const [transactions, countResultRaw] = await Promise.all([
          sql`
            SELECT 
              t.*,
              c.name as clinic_name,
              mp.name as master_poly_name,
              mit.name as master_insurance_name
            FROM transactions t
            JOIN clinics c ON c.id = t.clinic_id
            LEFT JOIN master_polies mp ON mp.id = t.poly_id
            LEFT JOIN master_insurance_types mit ON mit.id = t.insurance_type_id
            WHERE (
              t.trx_no ILIKE ${searchPattern} OR
              t.patient_name ILIKE ${searchPattern} OR
              t.erm_no ILIKE ${searchPattern}
            ) AND t.clinic_id = ${clinicId}
            ${dateCondition}
            ORDER BY t.trx_date DESC, t.trx_time DESC
            LIMIT ${limit} OFFSET ${offset}
          `,
          sql`
            SELECT COUNT(*) as total
            FROM transactions t
            WHERE (
              t.trx_no ILIKE ${searchPattern} OR
              t.patient_name ILIKE ${searchPattern} OR
              t.erm_no ILIKE ${searchPattern}
            ) AND t.clinic_id = ${clinicId}
            ${dateCondition}
          `
        ])
        const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
        return {
          transactions: Array.isArray(transactions) ? transactions : [],
          total: Number((countResult as any)?.total || 0),
          page,
          limit,
        }
      } else if (hasPolyFilter) {
        const [transactions, countResultRaw] = await Promise.all([
          sql`
            SELECT 
              t.*,
              c.name as clinic_name,
              mp.name as master_poly_name,
              mit.name as master_insurance_name
            FROM transactions t
            JOIN clinics c ON c.id = t.clinic_id
            LEFT JOIN master_polies mp ON mp.id = t.poly_id
            LEFT JOIN master_insurance_types mit ON mit.id = t.insurance_type_id
            WHERE (
              t.trx_no ILIKE ${searchPattern} OR
              t.patient_name ILIKE ${searchPattern} OR
              t.erm_no ILIKE ${searchPattern}
            ) AND t.clinic_id = ${clinicId}
            ${polyFilter}
            ORDER BY t.trx_date DESC, t.trx_time DESC
            LIMIT ${limit} OFFSET ${offset}
          `,
          sql`
            SELECT COUNT(*) as total
            FROM transactions t
            WHERE (
              t.trx_no ILIKE ${searchPattern} OR
              t.patient_name ILIKE ${searchPattern} OR
              t.erm_no ILIKE ${searchPattern}
            ) AND t.clinic_id = ${clinicId}
            ${polyFilter}
          `
        ])
        const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
        return {
          transactions: Array.isArray(transactions) ? transactions : [],
          total: Number((countResult as any)?.total || 0),
          page,
          limit,
        }
      } else if (hasInsuranceFilter) {
        const [transactions, countResultRaw] = await Promise.all([
          sql`
            SELECT 
              t.*,
              c.name as clinic_name,
              mp.name as master_poly_name,
              mit.name as master_insurance_name
            FROM transactions t
            JOIN clinics c ON c.id = t.clinic_id
            LEFT JOIN master_polies mp ON mp.id = t.poly_id
            LEFT JOIN master_insurance_types mit ON mit.id = t.insurance_type_id
            WHERE (
              t.trx_no ILIKE ${searchPattern} OR
              t.patient_name ILIKE ${searchPattern} OR
              t.erm_no ILIKE ${searchPattern}
            ) AND t.clinic_id = ${clinicId}
            ${insuranceFilter}
            ORDER BY t.trx_date DESC, t.trx_time DESC
            LIMIT ${limit} OFFSET ${offset}
          `,
          sql`
            SELECT COUNT(*) as total
            FROM transactions t
            WHERE (
              t.trx_no ILIKE ${searchPattern} OR
              t.patient_name ILIKE ${searchPattern} OR
              t.erm_no ILIKE ${searchPattern}
            ) AND t.clinic_id = ${clinicId}
            ${insuranceFilter}
          `
        ])
        const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
        return {
          transactions: Array.isArray(transactions) ? transactions : [],
          total: Number((countResult as any)?.total || 0),
          page,
          limit,
        }
      } else {
        // Hanya search dan clinicId, tanpa filter lain
        const [transactions, countResultRaw] = await Promise.all([
          sql`
            SELECT 
              t.*,
              c.name as clinic_name,
              mp.name as master_poly_name,
              mit.name as master_insurance_name
            FROM transactions t
            JOIN clinics c ON c.id = t.clinic_id
            LEFT JOIN master_polies mp ON mp.id = t.poly_id
            LEFT JOIN master_insurance_types mit ON mit.id = t.insurance_type_id
            WHERE (
              t.trx_no ILIKE ${searchPattern} OR
              t.patient_name ILIKE ${searchPattern} OR
              t.erm_no ILIKE ${searchPattern}
            ) AND t.clinic_id = ${clinicId}
            ORDER BY t.trx_date DESC, t.trx_time DESC
            LIMIT ${limit} OFFSET ${offset}
          `,
          sql`
            SELECT COUNT(*) as total
            FROM transactions t
            WHERE (
              t.trx_no ILIKE ${searchPattern} OR
              t.patient_name ILIKE ${searchPattern} OR
              t.erm_no ILIKE ${searchPattern}
            ) AND t.clinic_id = ${clinicId}
          `
        ])
        const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
        return {
          transactions: Array.isArray(transactions) ? transactions : [],
          total: Number((countResult as any)?.total || 0),
          page,
          limit,
        }
      }
      const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
      
      return {
        transactions: Array.isArray(transactions) ? transactions : [],
        total: Number((countResult as any)?.total || 0),
        page,
        limit,
      }
    } else if (search) {
      // Build WHERE clause dengan search, dateFilter, dan polyFilter
      // Gunakan pendekatan yang lebih aman dengan membangun query berdasarkan kondisi
      const searchPattern = `%${search}%`
      
      // Build query berdasarkan kombinasi filter yang ada
      if (hasDateFilter && hasPolyFilter && hasInsuranceFilter) {
        const [transactions, countResultRaw] = await Promise.all([
          sql`
            SELECT 
              t.*,
              c.name as clinic_name,
              mp.name as master_poly_name,
              mit.name as master_insurance_name
            FROM transactions t
            JOIN clinics c ON c.id = t.clinic_id
            LEFT JOIN master_polies mp ON mp.id = t.poly_id
            LEFT JOIN master_insurance_types mit ON mit.id = t.insurance_type_id
            WHERE (
              t.trx_no ILIKE ${searchPattern} OR
              t.patient_name ILIKE ${searchPattern} OR
              t.erm_no ILIKE ${searchPattern}
            )
            ${dateCondition}
            ${polyFilter}
            ${insuranceFilter}
            ORDER BY t.trx_date DESC, t.trx_time DESC
            LIMIT ${limit} OFFSET ${offset}
          `,
          sql`
            SELECT COUNT(*) as total
            FROM transactions t
            WHERE (
              t.trx_no ILIKE ${searchPattern} OR
              t.patient_name ILIKE ${searchPattern} OR
              t.erm_no ILIKE ${searchPattern}
            )
            ${dateCondition}
            ${polyFilter}
            ${insuranceFilter}
          `
        ])
        const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
        return {
          transactions: Array.isArray(transactions) ? transactions : [],
          total: Number((countResult as any)?.total || 0),
          page,
          limit,
        }
      } else if (hasDateFilter && hasPolyFilter) {
        const [transactions, countResultRaw] = await Promise.all([
          sql`
            SELECT 
              t.*,
              c.name as clinic_name,
              mp.name as master_poly_name,
              mit.name as master_insurance_name
            FROM transactions t
            JOIN clinics c ON c.id = t.clinic_id
            LEFT JOIN master_polies mp ON mp.id = t.poly_id
            LEFT JOIN master_insurance_types mit ON mit.id = t.insurance_type_id
            WHERE (
              t.trx_no ILIKE ${searchPattern} OR
              t.patient_name ILIKE ${searchPattern} OR
              t.erm_no ILIKE ${searchPattern}
            )
            ${dateCondition}
            ${polyFilter}
            ORDER BY t.trx_date DESC, t.trx_time DESC
            LIMIT ${limit} OFFSET ${offset}
          `,
          sql`
            SELECT COUNT(*) as total
            FROM transactions t
            WHERE (
              t.trx_no ILIKE ${searchPattern} OR
              t.patient_name ILIKE ${searchPattern} OR
              t.erm_no ILIKE ${searchPattern}
            )
            ${dateCondition}
            ${polyFilter}
          `
        ])
        const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
        return {
          transactions: Array.isArray(transactions) ? transactions : [],
          total: Number((countResult as any)?.total || 0),
          page,
          limit,
        }
      } else if (hasDateFilter && hasInsuranceFilter) {
        const [transactions, countResultRaw] = await Promise.all([
          sql`
            SELECT 
              t.*,
              c.name as clinic_name,
              mp.name as master_poly_name,
              mit.name as master_insurance_name
            FROM transactions t
            JOIN clinics c ON c.id = t.clinic_id
            LEFT JOIN master_polies mp ON mp.id = t.poly_id
            LEFT JOIN master_insurance_types mit ON mit.id = t.insurance_type_id
            WHERE (
              t.trx_no ILIKE ${searchPattern} OR
              t.patient_name ILIKE ${searchPattern} OR
              t.erm_no ILIKE ${searchPattern}
            )
            ${dateCondition}
            ${insuranceFilter}
            ORDER BY t.trx_date DESC, t.trx_time DESC
            LIMIT ${limit} OFFSET ${offset}
          `,
          sql`
            SELECT COUNT(*) as total
            FROM transactions t
            WHERE (
              t.trx_no ILIKE ${searchPattern} OR
              t.patient_name ILIKE ${searchPattern} OR
              t.erm_no ILIKE ${searchPattern}
            )
            ${dateCondition}
            ${insuranceFilter}
          `
        ])
        const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
        return {
          transactions: Array.isArray(transactions) ? transactions : [],
          total: Number((countResult as any)?.total || 0),
          page,
          limit,
        }
      } else if (hasPolyFilter && hasInsuranceFilter) {
        const [transactions, countResultRaw] = await Promise.all([
          sql`
            SELECT 
              t.*,
              c.name as clinic_name,
              mp.name as master_poly_name,
              mit.name as master_insurance_name
            FROM transactions t
            JOIN clinics c ON c.id = t.clinic_id
            LEFT JOIN master_polies mp ON mp.id = t.poly_id
            LEFT JOIN master_insurance_types mit ON mit.id = t.insurance_type_id
            WHERE (
              t.trx_no ILIKE ${searchPattern} OR
              t.patient_name ILIKE ${searchPattern} OR
              t.erm_no ILIKE ${searchPattern}
            )
            ${polyFilter}
            ${insuranceFilter}
            ORDER BY t.trx_date DESC, t.trx_time DESC
            LIMIT ${limit} OFFSET ${offset}
          `,
          sql`
            SELECT COUNT(*) as total
            FROM transactions t
            WHERE (
              t.trx_no ILIKE ${searchPattern} OR
              t.patient_name ILIKE ${searchPattern} OR
              t.erm_no ILIKE ${searchPattern}
            )
            ${polyFilter}
            ${insuranceFilter}
          `
        ])
        const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
        return {
          transactions: Array.isArray(transactions) ? transactions : [],
          total: Number((countResult as any)?.total || 0),
          page,
          limit,
        }
      } else if (hasDateFilter) {
        const [transactions, countResultRaw] = await Promise.all([
          sql`
            SELECT 
              t.*,
              c.name as clinic_name,
              mp.name as master_poly_name,
              mit.name as master_insurance_name
            FROM transactions t
            JOIN clinics c ON c.id = t.clinic_id
            LEFT JOIN master_polies mp ON mp.id = t.poly_id
            LEFT JOIN master_insurance_types mit ON mit.id = t.insurance_type_id
            WHERE (
              t.trx_no ILIKE ${searchPattern} OR
              t.patient_name ILIKE ${searchPattern} OR
              t.erm_no ILIKE ${searchPattern}
            )
            ${dateCondition}
            ORDER BY t.trx_date DESC, t.trx_time DESC
            LIMIT ${limit} OFFSET ${offset}
          `,
          sql`
            SELECT COUNT(*) as total
            FROM transactions t
            WHERE (
              t.trx_no ILIKE ${searchPattern} OR
              t.patient_name ILIKE ${searchPattern} OR
              t.erm_no ILIKE ${searchPattern}
            )
            ${dateCondition}
          `
        ])
        const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
        return {
          transactions: Array.isArray(transactions) ? transactions : [],
          total: Number((countResult as any)?.total || 0),
          page,
          limit,
        }
      } else if (hasPolyFilter) {
        const [transactions, countResultRaw] = await Promise.all([
          sql`
            SELECT 
              t.*,
              c.name as clinic_name,
              mp.name as master_poly_name,
              mit.name as master_insurance_name
            FROM transactions t
            JOIN clinics c ON c.id = t.clinic_id
            LEFT JOIN master_polies mp ON mp.id = t.poly_id
            LEFT JOIN master_insurance_types mit ON mit.id = t.insurance_type_id
            WHERE (
              t.trx_no ILIKE ${searchPattern} OR
              t.patient_name ILIKE ${searchPattern} OR
              t.erm_no ILIKE ${searchPattern}
            )
            ${polyFilter}
            ORDER BY t.trx_date DESC, t.trx_time DESC
            LIMIT ${limit} OFFSET ${offset}
          `,
          sql`
            SELECT COUNT(*) as total
            FROM transactions t
            WHERE (
              t.trx_no ILIKE ${searchPattern} OR
              t.patient_name ILIKE ${searchPattern} OR
              t.erm_no ILIKE ${searchPattern}
            )
            ${polyFilter}
          `
        ])
        const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
        return {
          transactions: Array.isArray(transactions) ? transactions : [],
          total: Number((countResult as any)?.total || 0),
          page,
          limit,
        }
      } else if (hasInsuranceFilter) {
        const [transactions, countResultRaw] = await Promise.all([
          sql`
            SELECT 
              t.*,
              c.name as clinic_name,
              mp.name as master_poly_name,
              mit.name as master_insurance_name
            FROM transactions t
            JOIN clinics c ON c.id = t.clinic_id
            LEFT JOIN master_polies mp ON mp.id = t.poly_id
            LEFT JOIN master_insurance_types mit ON mit.id = t.insurance_type_id
            WHERE (
              t.trx_no ILIKE ${searchPattern} OR
              t.patient_name ILIKE ${searchPattern} OR
              t.erm_no ILIKE ${searchPattern}
            )
            ${insuranceFilter}
            ORDER BY t.trx_date DESC, t.trx_time DESC
            LIMIT ${limit} OFFSET ${offset}
          `,
          sql`
            SELECT COUNT(*) as total
            FROM transactions t
            WHERE (
              t.trx_no ILIKE ${searchPattern} OR
              t.patient_name ILIKE ${searchPattern} OR
              t.erm_no ILIKE ${searchPattern}
            )
            ${insuranceFilter}
          `
        ])
        const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
        return {
          transactions: Array.isArray(transactions) ? transactions : [],
          total: Number((countResult as any)?.total || 0),
          page,
          limit,
        }
      } else {
        // Hanya search, tanpa filter lain
        const [transactions, countResultRaw] = await Promise.all([
          sql`
            SELECT 
              t.*,
              c.name as clinic_name,
              mp.name as master_poly_name,
              mit.name as master_insurance_name
            FROM transactions t
            JOIN clinics c ON c.id = t.clinic_id
            LEFT JOIN master_polies mp ON mp.id = t.poly_id
            LEFT JOIN master_insurance_types mit ON mit.id = t.insurance_type_id
            WHERE (
              t.trx_no ILIKE ${searchPattern} OR
              t.patient_name ILIKE ${searchPattern} OR
              t.erm_no ILIKE ${searchPattern}
            )
            ORDER BY t.trx_date DESC, t.trx_time DESC
            LIMIT ${limit} OFFSET ${offset}
          `,
          sql`
            SELECT COUNT(*) as total
            FROM transactions t
            WHERE (
              t.trx_no ILIKE ${searchPattern} OR
              t.patient_name ILIKE ${searchPattern} OR
              t.erm_no ILIKE ${searchPattern}
            )
          `
        ])
        const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
        return {
          transactions: Array.isArray(transactions) ? transactions : [],
          total: Number((countResult as any)?.total || 0),
          page,
          limit,
        }
      }
    } else if (clinicId) {
      // Build query berdasarkan kombinasi filter yang ada
      if (hasDateFilter && hasPolyFilter && hasInsuranceFilter) {
        const [transactions, countResultRaw] = await Promise.all([
          sql`
            SELECT 
              t.*,
              c.name as clinic_name,
              mp.name as master_poly_name,
              mit.name as master_insurance_name
            FROM transactions t
            JOIN clinics c ON c.id = t.clinic_id
            LEFT JOIN master_polies mp ON mp.id = t.poly_id
            LEFT JOIN master_insurance_types mit ON mit.id = t.insurance_type_id
            WHERE t.clinic_id = ${clinicId}
            ${dateCondition}
            ${polyFilter}
            ${insuranceFilter}
            ORDER BY t.trx_date DESC, t.trx_time DESC
            LIMIT ${limit} OFFSET ${offset}
          `,
          sql`
            SELECT COUNT(*) as total
            FROM transactions t
            WHERE t.clinic_id = ${clinicId}
            ${dateCondition}
            ${polyFilter}
            ${insuranceFilter}
          `
        ])
        const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
        return {
          transactions: Array.isArray(transactions) ? transactions : [],
          total: Number((countResult as any)?.total || 0),
          page,
          limit,
        }
      } else if (hasDateFilter && hasPolyFilter) {
        const [transactions, countResultRaw] = await Promise.all([
          sql`
            SELECT 
              t.*,
              c.name as clinic_name,
              mp.name as master_poly_name,
              mit.name as master_insurance_name
            FROM transactions t
            JOIN clinics c ON c.id = t.clinic_id
            LEFT JOIN master_polies mp ON mp.id = t.poly_id
            LEFT JOIN master_insurance_types mit ON mit.id = t.insurance_type_id
            WHERE t.clinic_id = ${clinicId}
            ${dateCondition}
            ${polyFilter}
            ORDER BY t.trx_date DESC, t.trx_time DESC
            LIMIT ${limit} OFFSET ${offset}
          `,
          sql`
            SELECT COUNT(*) as total
            FROM transactions t
            WHERE t.clinic_id = ${clinicId}
            ${dateCondition}
            ${polyFilter}
          `
        ])
        const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
        return {
          transactions: Array.isArray(transactions) ? transactions : [],
          total: Number((countResult as any)?.total || 0),
          page,
          limit,
        }
      } else if (hasDateFilter && hasInsuranceFilter) {
        const [transactions, countResultRaw] = await Promise.all([
          sql`
            SELECT 
              t.*,
              c.name as clinic_name,
              mp.name as master_poly_name,
              mit.name as master_insurance_name
            FROM transactions t
            JOIN clinics c ON c.id = t.clinic_id
            LEFT JOIN master_polies mp ON mp.id = t.poly_id
            LEFT JOIN master_insurance_types mit ON mit.id = t.insurance_type_id
            WHERE t.clinic_id = ${clinicId}
            ${dateCondition}
            ${insuranceFilter}
            ORDER BY t.trx_date DESC, t.trx_time DESC
            LIMIT ${limit} OFFSET ${offset}
          `,
          sql`
            SELECT COUNT(*) as total
            FROM transactions t
            WHERE t.clinic_id = ${clinicId}
            ${dateCondition}
            ${insuranceFilter}
          `
        ])
        const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
        return {
          transactions: Array.isArray(transactions) ? transactions : [],
          total: Number((countResult as any)?.total || 0),
          page,
          limit,
        }
      } else if (hasPolyFilter && hasInsuranceFilter) {
        const [transactions, countResultRaw] = await Promise.all([
          sql`
            SELECT 
              t.*,
              c.name as clinic_name,
              mp.name as master_poly_name,
              mit.name as master_insurance_name
            FROM transactions t
            JOIN clinics c ON c.id = t.clinic_id
            LEFT JOIN master_polies mp ON mp.id = t.poly_id
            LEFT JOIN master_insurance_types mit ON mit.id = t.insurance_type_id
            WHERE t.clinic_id = ${clinicId}
            ${polyFilter}
            ${insuranceFilter}
            ORDER BY t.trx_date DESC, t.trx_time DESC
            LIMIT ${limit} OFFSET ${offset}
          `,
          sql`
            SELECT COUNT(*) as total
            FROM transactions t
            WHERE t.clinic_id = ${clinicId}
            ${polyFilter}
            ${insuranceFilter}
          `
        ])
        const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
        return {
          transactions: Array.isArray(transactions) ? transactions : [],
          total: Number((countResult as any)?.total || 0),
          page,
          limit,
        }
      } else if (hasDateFilter) {
        const [transactions, countResultRaw] = await Promise.all([
          sql`
            SELECT 
              t.*,
              c.name as clinic_name,
              mp.name as master_poly_name,
              mit.name as master_insurance_name
            FROM transactions t
            JOIN clinics c ON c.id = t.clinic_id
            LEFT JOIN master_polies mp ON mp.id = t.poly_id
            LEFT JOIN master_insurance_types mit ON mit.id = t.insurance_type_id
            WHERE t.clinic_id = ${clinicId}
            ${dateCondition}
            ORDER BY t.trx_date DESC, t.trx_time DESC
            LIMIT ${limit} OFFSET ${offset}
          `,
          sql`
            SELECT COUNT(*) as total
            FROM transactions t
            WHERE t.clinic_id = ${clinicId}
            ${dateCondition}
          `
        ])
        const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
        return {
          transactions: Array.isArray(transactions) ? transactions : [],
          total: Number((countResult as any)?.total || 0),
          page,
          limit,
        }
      } else if (hasPolyFilter) {
        const [transactions, countResultRaw] = await Promise.all([
          sql`
            SELECT 
              t.*,
              c.name as clinic_name,
              mp.name as master_poly_name,
              mit.name as master_insurance_name
            FROM transactions t
            JOIN clinics c ON c.id = t.clinic_id
            LEFT JOIN master_polies mp ON mp.id = t.poly_id
            LEFT JOIN master_insurance_types mit ON mit.id = t.insurance_type_id
            WHERE t.clinic_id = ${clinicId}
            ${polyFilter}
            ORDER BY t.trx_date DESC, t.trx_time DESC
            LIMIT ${limit} OFFSET ${offset}
          `,
          sql`
            SELECT COUNT(*) as total
            FROM transactions t
            WHERE t.clinic_id = ${clinicId}
            ${polyFilter}
          `
        ])
        const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
        return {
          transactions: Array.isArray(transactions) ? transactions : [],
          total: Number((countResult as any)?.total || 0),
          page,
          limit,
        }
      } else if (hasInsuranceFilter) {
        const [transactions, countResultRaw] = await Promise.all([
          sql`
            SELECT 
              t.*,
              c.name as clinic_name,
              mp.name as master_poly_name,
              mit.name as master_insurance_name
            FROM transactions t
            JOIN clinics c ON c.id = t.clinic_id
            LEFT JOIN master_polies mp ON mp.id = t.poly_id
            LEFT JOIN master_insurance_types mit ON mit.id = t.insurance_type_id
            WHERE t.clinic_id = ${clinicId}
            ${insuranceFilter}
            ORDER BY t.trx_date DESC, t.trx_time DESC
            LIMIT ${limit} OFFSET ${offset}
          `,
          sql`
            SELECT COUNT(*) as total
            FROM transactions t
            WHERE t.clinic_id = ${clinicId}
            ${insuranceFilter}
          `
        ])
        const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
        return {
          transactions: Array.isArray(transactions) ? transactions : [],
          total: Number((countResult as any)?.total || 0),
          page,
          limit,
        }
      } else {
        // Hanya clinicId, tanpa filter lain
        const [transactions, countResultRaw] = await Promise.all([
          sql`
            SELECT 
              t.*,
              c.name as clinic_name,
              mp.name as master_poly_name,
              mit.name as master_insurance_name
            FROM transactions t
            JOIN clinics c ON c.id = t.clinic_id
            LEFT JOIN master_polies mp ON mp.id = t.poly_id
            LEFT JOIN master_insurance_types mit ON mit.id = t.insurance_type_id
            WHERE t.clinic_id = ${clinicId}
            ORDER BY t.trx_date DESC, t.trx_time DESC
            LIMIT ${limit} OFFSET ${offset}
          `,
          sql`
            SELECT COUNT(*) as total
            FROM transactions t
            WHERE t.clinic_id = ${clinicId}
          `
        ])
        const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
        return {
          transactions: Array.isArray(transactions) ? transactions : [],
          total: Number((countResult as any)?.total || 0),
          page,
          limit,
        }
      }
    } else {
      // Handle case with no search and no clinicId
      // Build query berdasarkan kombinasi filter yang ada
      if (hasDateFilter && hasPolyFilter && hasInsuranceFilter) {
        const [transactions, countResultRaw] = await Promise.all([
          sql`
            SELECT 
              t.*,
              c.name as clinic_name,
              mp.name as master_poly_name,
              mit.name as master_insurance_name
            FROM transactions t
            JOIN clinics c ON c.id = t.clinic_id
            LEFT JOIN master_polies mp ON mp.id = t.poly_id
            LEFT JOIN master_insurance_types mit ON mit.id = t.insurance_type_id
            WHERE 1=1
            ${dateCondition}
            ${polyFilter}
            ${insuranceFilter}
            ORDER BY t.trx_date DESC, t.trx_time DESC
            LIMIT ${limit} OFFSET ${offset}
          `,
          sql`
            SELECT COUNT(*) as total FROM transactions t
            WHERE 1=1
            ${dateCondition}
            ${polyFilter}
            ${insuranceFilter}
          `
        ])
        const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
        return {
          transactions: Array.isArray(transactions) ? transactions : [],
          total: Number((countResult as any)?.total || 0),
          page,
          limit,
        }
      } else if (hasDateFilter && hasPolyFilter) {
        const [transactions, countResultRaw] = await Promise.all([
          sql`
            SELECT 
              t.*,
              c.name as clinic_name,
              mp.name as master_poly_name,
              mit.name as master_insurance_name
            FROM transactions t
            JOIN clinics c ON c.id = t.clinic_id
            LEFT JOIN master_polies mp ON mp.id = t.poly_id
            LEFT JOIN master_insurance_types mit ON mit.id = t.insurance_type_id
            WHERE 1=1
            ${dateCondition}
            ${polyFilter}
            ORDER BY t.trx_date DESC, t.trx_time DESC
            LIMIT ${limit} OFFSET ${offset}
          `,
          sql`
            SELECT COUNT(*) as total FROM transactions t
            WHERE 1=1
            ${dateCondition}
            ${polyFilter}
          `
        ])
        const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
        return {
          transactions: Array.isArray(transactions) ? transactions : [],
          total: Number((countResult as any)?.total || 0),
          page,
          limit,
        }
      } else if (hasDateFilter && hasInsuranceFilter) {
        const [transactions, countResultRaw] = await Promise.all([
          sql`
            SELECT 
              t.*,
              c.name as clinic_name,
              mp.name as master_poly_name,
              mit.name as master_insurance_name
            FROM transactions t
            JOIN clinics c ON c.id = t.clinic_id
            LEFT JOIN master_polies mp ON mp.id = t.poly_id
            LEFT JOIN master_insurance_types mit ON mit.id = t.insurance_type_id
            WHERE 1=1
            ${dateCondition}
            ${insuranceFilter}
            ORDER BY t.trx_date DESC, t.trx_time DESC
            LIMIT ${limit} OFFSET ${offset}
          `,
          sql`
            SELECT COUNT(*) as total FROM transactions t
            WHERE 1=1
            ${dateCondition}
            ${insuranceFilter}
          `
        ])
        const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
        return {
          transactions: Array.isArray(transactions) ? transactions : [],
          total: Number((countResult as any)?.total || 0),
          page,
          limit,
        }
      } else if (hasPolyFilter && hasInsuranceFilter) {
        const [transactions, countResultRaw] = await Promise.all([
          sql`
            SELECT 
              t.*,
              c.name as clinic_name,
              mp.name as master_poly_name,
              mit.name as master_insurance_name
            FROM transactions t
            JOIN clinics c ON c.id = t.clinic_id
            LEFT JOIN master_polies mp ON mp.id = t.poly_id
            LEFT JOIN master_insurance_types mit ON mit.id = t.insurance_type_id
            WHERE 1=1
            ${polyFilter}
            ${insuranceFilter}
            ORDER BY t.trx_date DESC, t.trx_time DESC
            LIMIT ${limit} OFFSET ${offset}
          `,
          sql`
            SELECT COUNT(*) as total FROM transactions t
            WHERE 1=1
            ${polyFilter}
            ${insuranceFilter}
          `
        ])
        const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
        return {
          transactions: Array.isArray(transactions) ? transactions : [],
          total: Number((countResult as any)?.total || 0),
          page,
          limit,
        }
      } else if (hasDateFilter) {
        // Build date condition directly in query to avoid nested sql template issues
        if (dateFromValue && dateToValue) {
          const [transactions, countResultRaw] = await Promise.all([
            sql`
              SELECT 
                t.*,
                c.name as clinic_name,
                mp.name as master_poly_name,
                mit.name as master_insurance_name
              FROM transactions t
              JOIN clinics c ON c.id = t.clinic_id
              LEFT JOIN master_polies mp ON mp.id = t.poly_id
              LEFT JOIN master_insurance_types mit ON mit.id = t.insurance_type_id
              WHERE DATE(t.trx_date) >= DATE(${dateFromValue}) AND DATE(t.trx_date) <= DATE(${dateToValue})
              ORDER BY t.trx_date DESC, t.trx_time DESC
              LIMIT ${limit} OFFSET ${offset}
            `,
            sql`
              SELECT COUNT(*) as total FROM transactions t
              WHERE DATE(t.trx_date) >= DATE(${dateFromValue}) AND DATE(t.trx_date) <= DATE(${dateToValue})
            `
          ])
          const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
          return {
            transactions: Array.isArray(transactions) ? transactions : [],
            total: Number((countResult as any)?.total || 0),
            page,
            limit,
          }
        } else if (dateFromValue) {
          const [transactions, countResultRaw] = await Promise.all([
            sql`
              SELECT 
                t.*,
                c.name as clinic_name,
                mp.name as master_poly_name,
                mit.name as master_insurance_name
              FROM transactions t
              JOIN clinics c ON c.id = t.clinic_id
              LEFT JOIN master_polies mp ON mp.id = t.poly_id
              LEFT JOIN master_insurance_types mit ON mit.id = t.insurance_type_id
              WHERE DATE(t.trx_date) >= DATE(${dateFromValue})
              ORDER BY t.trx_date DESC, t.trx_time DESC
              LIMIT ${limit} OFFSET ${offset}
            `,
            sql`
              SELECT COUNT(*) as total FROM transactions t
              WHERE DATE(t.trx_date) >= DATE(${dateFromValue})
            `
          ])
          const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
          return {
            transactions: Array.isArray(transactions) ? transactions : [],
            total: Number((countResult as any)?.total || 0),
            page,
            limit,
          }
        } else if (dateToValue) {
          const [transactions, countResultRaw] = await Promise.all([
            sql`
              SELECT 
                t.*,
                c.name as clinic_name,
                mp.name as master_poly_name,
                mit.name as master_insurance_name
              FROM transactions t
              JOIN clinics c ON c.id = t.clinic_id
              LEFT JOIN master_polies mp ON mp.id = t.poly_id
              LEFT JOIN master_insurance_types mit ON mit.id = t.insurance_type_id
              WHERE DATE(t.trx_date) <= DATE(${dateToValue})
              ORDER BY t.trx_date DESC, t.trx_time DESC
              LIMIT ${limit} OFFSET ${offset}
            `,
            sql`
              SELECT COUNT(*) as total FROM transactions t
              WHERE DATE(t.trx_date) <= DATE(${dateToValue})
            `
          ])
          const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
          return {
            transactions: Array.isArray(transactions) ? transactions : [],
            total: Number((countResult as any)?.total || 0),
            page,
            limit,
          }
        }
        const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
        return {
          transactions: Array.isArray(transactions) ? transactions : [],
          total: Number((countResult as any)?.total || 0),
          page,
          limit,
        }
      } else if (hasPolyFilter) {
        const [transactions, countResultRaw] = await Promise.all([
          sql`
            SELECT 
              t.*,
              c.name as clinic_name,
              mp.name as master_poly_name,
              mit.name as master_insurance_name
            FROM transactions t
            JOIN clinics c ON c.id = t.clinic_id
            LEFT JOIN master_polies mp ON mp.id = t.poly_id
            LEFT JOIN master_insurance_types mit ON mit.id = t.insurance_type_id
            WHERE 1=1
            ${polyFilter}
            ORDER BY t.trx_date DESC, t.trx_time DESC
            LIMIT ${limit} OFFSET ${offset}
          `,
          sql`
            SELECT COUNT(*) as total FROM transactions t
            WHERE 1=1
            ${polyFilter}
          `
        ])
        const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
        return {
          transactions: Array.isArray(transactions) ? transactions : [],
          total: Number((countResult as any)?.total || 0),
          page,
          limit,
        }
      } else if (hasInsuranceFilter) {
        const [transactions, countResultRaw] = await Promise.all([
          sql`
            SELECT 
              t.*,
              c.name as clinic_name,
              mp.name as master_poly_name,
              mit.name as master_insurance_name
            FROM transactions t
            JOIN clinics c ON c.id = t.clinic_id
            LEFT JOIN master_polies mp ON mp.id = t.poly_id
            LEFT JOIN master_insurance_types mit ON mit.id = t.insurance_type_id
            WHERE 1=1
            ${insuranceFilter}
            ORDER BY t.trx_date DESC, t.trx_time DESC
            LIMIT ${limit} OFFSET ${offset}
          `,
          sql`
            SELECT COUNT(*) as total FROM transactions t
            WHERE 1=1
            ${insuranceFilter}
          `
        ])
        const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
        return {
          transactions: Array.isArray(transactions) ? transactions : [],
          total: Number((countResult as any)?.total || 0),
          page,
          limit,
        }
      } else {
        // Tidak ada filter sama sekali
        const [transactions, countResultRaw] = await Promise.all([
          sql`
            SELECT 
              t.*,
              c.name as clinic_name,
              mp.name as master_poly_name,
              mit.name as master_insurance_name
            FROM transactions t
            JOIN clinics c ON c.id = t.clinic_id
            LEFT JOIN master_polies mp ON mp.id = t.poly_id
            LEFT JOIN master_insurance_types mit ON mit.id = t.insurance_type_id
            ORDER BY t.trx_date DESC, t.trx_time DESC
            LIMIT ${limit} OFFSET ${offset}
          `,
          sql`
            SELECT COUNT(*) as total FROM transactions t
          `
        ])
        const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
        return {
          transactions: Array.isArray(transactions) ? transactions : [],
          total: Number((countResult as any)?.total || 0),
          page,
          limit,
        }
      }
      const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
      
      return {
        transactions: Array.isArray(transactions) ? transactions : [],
        total: Number((countResult as any)?.total || 0),
        page,
        limit,
      }
    }
  } catch (error) {
    console.error('Error fetching transactions:', error)
    return {
      transactions: [],
      total: 0,
      page,
      limit,
    }
  }
})

export const getTransactionsByPatient = cache(async (
  patientId?: number,
  ermNo?: string,
  page: number = 1,
  limit: number = 10
) => {
  try {
    const offset = (page - 1) * limit
    
    if (patientId) {
      // Parallel fetching untuk performa maksimal
      const [transactions, countResultRaw] = await Promise.all([
        sql`
          SELECT 
            t.*,
            c.name as clinic_name
          FROM transactions t
          JOIN clinics c ON c.id = t.clinic_id
          WHERE t.patient_id = ${patientId}
          ORDER BY t.trx_date DESC, t.trx_time DESC
          LIMIT ${limit} OFFSET ${offset}
        `,
        sql`
          SELECT COUNT(*) as total
          FROM transactions t
          WHERE t.patient_id = ${patientId}
        `
      ])
      const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
      
      return {
        transactions: Array.isArray(transactions) ? transactions : [],
        total: Number((countResult as any)?.total || 0),
        page,
        limit,
      }
    } else if (ermNo) {
      // Parallel fetching untuk performa maksimal
      const [transactions, countResultRaw] = await Promise.all([
        sql`
          SELECT 
            t.*,
            c.name as clinic_name
          FROM transactions t
          JOIN clinics c ON c.id = t.clinic_id
          WHERE t.erm_no = ${ermNo}
          ORDER BY t.trx_date DESC, t.trx_time DESC
          LIMIT ${limit} OFFSET ${offset}
        `,
        sql`
          SELECT COUNT(*) as total
          FROM transactions t
          WHERE t.erm_no = ${ermNo}
        `
      ])
      const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
      
      return {
        transactions: Array.isArray(transactions) ? transactions : [],
        total: Number((countResult as any)?.total || 0),
        page,
        limit,
      }
    }
    
    return {
      transactions: [],
      total: 0,
      page,
      limit,
    }
  } catch (error) {
    console.error('Error fetching transactions by patient:', error)
    return {
      transactions: [],
      total: 0,
      page,
      limit,
    }
  }
})

export const getTransactionById = cache(async (id: string | number) => {
  try {
    const transactionId = typeof id === 'string' ? parseInt(id) : id
    const transactionRaw = await sql`
      SELECT 
        t.*,
        c.name as clinic_name,
        c.location as clinic_location,
        p.full_name as patient_full_name,
        p.first_visit_at,
        p.visit_count
      FROM transactions t
      JOIN clinics c ON c.id = t.clinic_id
      LEFT JOIN patients p ON p.id = t.patient_id
      WHERE t.id = ${transactionId}
    `
    const transaction = Array.isArray(transactionRaw) ? transactionRaw[0] : transactionRaw
    return transaction || null
  } catch (error) {
    console.error('Error fetching transaction:', error)
    return null
  }
})

export const getTransactionStats = cache(async () => {
  try {
    const statsRaw = await sql`
      SELECT 
        COUNT(*) as total_transactions,
        COUNT(CASE WHEN zains_synced = true THEN 1 END) as synced_count,
        COUNT(CASE WHEN zains_synced = false THEN 1 END) as pending_count,
        COALESCE(SUM(bill_total), 0) as total_revenue
      FROM transactions
    `
    const stats = Array.isArray(statsRaw) ? statsRaw[0] : statsRaw
    
    return {
      totalTransactions: Number((stats as any)?.total_transactions || 0),
      syncedCount: Number((stats as any)?.synced_count || 0),
      pendingCount: Number((stats as any)?.pending_count || 0),
      totalRevenue: Number((stats as any)?.total_revenue || 0),
    }
  } catch (error) {
    console.error('Error fetching transaction stats:', error)
    return {
      totalTransactions: 0,
      syncedCount: 0,
      pendingCount: 0,
      totalRevenue: 0,
    }
  }
})

export const getTransactionsToZains = cache(async (
  transactionId: number,
  dateFrom?: string,
  dateTo?: string
) => {
  try {
    let query = sql`
      SELECT 
        tz.*,
        t.trx_no,
        t.trx_date,
        c.name as clinic_name
      FROM transactions_to_zains tz
      JOIN transactions t ON t.id = tz.transaction_id
      JOIN clinics c ON c.id = t.clinic_id
      WHERE tz.transaction_id = ${transactionId}
    `
    
    if (dateFrom) {
      query = sql`
        SELECT 
          tz.*,
          t.trx_no,
          t.trx_date,
          c.name as clinic_name
        FROM transactions_to_zains tz
        JOIN transactions t ON t.id = tz.transaction_id
        JOIN clinics c ON c.id = t.clinic_id
        WHERE tz.transaction_id = ${transactionId}
          AND tz.tgl_transaksi >= ${dateFrom}
      `
    }
    
    if (dateTo) {
      query = sql`
        SELECT 
          tz.*,
          t.trx_no,
          t.trx_date,
          c.name as clinic_name
        FROM transactions_to_zains tz
        JOIN transactions t ON t.id = tz.transaction_id
        JOIN clinics c ON c.id = t.clinic_id
        WHERE tz.transaction_id = ${transactionId}
          ${dateFrom ? sql`AND tz.tgl_transaksi >= ${dateFrom}` : sql``}
          AND tz.tgl_transaksi <= ${dateTo}
      `
    }
    
    const result = await query
    return Array.isArray(result) ? result : []
  } catch (error) {
    console.error('Error fetching transactions to zains:', error)
    return []
  }
})
