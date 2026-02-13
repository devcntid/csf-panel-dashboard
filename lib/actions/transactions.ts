'use server'

import { sql, getSqlClient } from '@/lib/db'
import { cache } from 'react'

// Legacy implementation (masih disimpan jika suatu saat perlu dirujuk kembali)
// Jangan digunakan langsung di code baru.
export const getTransactionsLegacy = cache(async (
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
    
    // Build date condition SQL secara dinamis (fragment)
    // Hanya digunakan di dalam template sql utama
    let dateCondition: any = sql``
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
            ${
              hasDateFilter && dateFromValue && dateToValue
                ? sql`AND DATE(t.trx_date) >= DATE(${dateFromValue}) AND DATE(t.trx_date) <= DATE(${dateToValue})`
                : hasDateFilter && dateFromValue
                ? sql`AND DATE(t.trx_date) >= DATE(${dateFromValue})`
                : hasDateFilter && dateToValue
                ? sql`AND DATE(t.trx_date) <= DATE(${dateToValue})`
                : sql``
            }
            ${hasPolyFilter ? sql`AND t.poly_id = ${polyId}` : sql``}
            ${hasInsuranceFilter ? sql`AND t.insurance_type_id = ${insuranceTypeId}` : sql``}
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
            ${
              hasDateFilter && dateFromValue && dateToValue
                ? sql`AND DATE(t.trx_date) >= DATE(${dateFromValue}) AND DATE(t.trx_date) <= DATE(${dateToValue})`
                : hasDateFilter && dateFromValue
                ? sql`AND DATE(t.trx_date) >= DATE(${dateFromValue})`
                : hasDateFilter && dateToValue
                ? sql`AND DATE(t.trx_date) <= DATE(${dateToValue})`
                : sql``
            }
            ${hasPolyFilter ? sql`AND t.poly_id = ${polyId}` : sql``}
            ${hasInsuranceFilter ? sql`AND t.insurance_type_id = ${insuranceTypeId}` : sql``}
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
            ${
              hasDateFilter && dateFromValue && dateToValue
                ? sql`AND DATE(t.trx_date) >= DATE(${dateFromValue}) AND DATE(t.trx_date) <= DATE(${dateToValue})`
                : hasDateFilter && dateFromValue
                ? sql`AND DATE(t.trx_date) >= DATE(${dateFromValue})`
                : hasDateFilter && dateToValue
                ? sql`AND DATE(t.trx_date) <= DATE(${dateToValue})`
                : sql``
            }
            ${hasPolyFilter ? sql`AND t.poly_id = ${polyId}` : sql``}
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
            ${
              hasDateFilter && dateFromValue && dateToValue
                ? sql`AND DATE(t.trx_date) >= DATE(${dateFromValue}) AND DATE(t.trx_date) <= DATE(${dateToValue})`
                : hasDateFilter && dateFromValue
                ? sql`AND DATE(t.trx_date) >= DATE(${dateFromValue})`
                : hasDateFilter && dateToValue
                ? sql`AND DATE(t.trx_date) <= DATE(${dateToValue})`
                : sql``
            }
            ${hasInsuranceFilter ? sql`AND t.insurance_type_id = ${insuranceTypeId}` : sql``}
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
            ${hasPolyFilter ? sql`AND t.poly_id = ${polyId}` : sql``}
            ${hasInsuranceFilter ? sql`AND t.insurance_type_id = ${insuranceTypeId}` : sql``}
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
            ${
              hasDateFilter && dateFromValue && dateToValue
                ? sql`AND DATE(t.trx_date) >= DATE(${dateFromValue}) AND DATE(t.trx_date) <= DATE(${dateToValue})`
                : hasDateFilter && dateFromValue
                ? sql`AND DATE(t.trx_date) >= DATE(${dateFromValue})`
                : hasDateFilter && dateToValue
                ? sql`AND DATE(t.trx_date) <= DATE(${dateToValue})`
                : sql``
            }
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
            ${
              hasDateFilter && dateFromValue && dateToValue
                ? sql`AND DATE(t.trx_date) >= DATE(${dateFromValue}) AND DATE(t.trx_date) <= DATE(${dateToValue})`
                : hasDateFilter && dateFromValue
                ? sql`AND DATE(t.trx_date) >= DATE(${dateFromValue})`
                : hasDateFilter && dateToValue
                ? sql`AND DATE(t.trx_date) <= DATE(${dateToValue})`
                : sql``
            }
            ${hasPolyFilter ? sql`AND t.poly_id = ${polyId}` : sql``}
            ${hasInsuranceFilter ? sql`AND t.insurance_type_id = ${insuranceTypeId}` : sql``}
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
            ${
              hasDateFilter && dateFromValue && dateToValue
                ? sql`AND DATE(t.trx_date) >= DATE(${dateFromValue}) AND DATE(t.trx_date) <= DATE(${dateToValue})`
                : hasDateFilter && dateFromValue
                ? sql`AND DATE(t.trx_date) >= DATE(${dateFromValue})`
                : hasDateFilter && dateToValue
                ? sql`AND DATE(t.trx_date) <= DATE(${dateToValue})`
                : sql``
            }
            ${hasPolyFilter ? sql`AND t.poly_id = ${polyId}` : sql``}
            ${hasInsuranceFilter ? sql`AND t.insurance_type_id = ${insuranceTypeId}` : sql``}
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
            ${
              hasDateFilter && dateFromValue && dateToValue
                ? sql`AND DATE(t.trx_date) >= DATE(${dateFromValue}) AND DATE(t.trx_date) <= DATE(${dateToValue})`
                : hasDateFilter && dateFromValue
                ? sql`AND DATE(t.trx_date) >= DATE(${dateFromValue})`
                : hasDateFilter && dateToValue
                ? sql`AND DATE(t.trx_date) <= DATE(${dateToValue})`
                : sql``
            }
            ${hasPolyFilter ? sql`AND t.poly_id = ${polyId}` : sql``}
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
            ${
              hasDateFilter && dateFromValue && dateToValue
                ? sql`AND DATE(t.trx_date) >= DATE(${dateFromValue}) AND DATE(t.trx_date) <= DATE(${dateToValue})`
                : hasDateFilter && dateFromValue
                ? sql`AND DATE(t.trx_date) >= DATE(${dateFromValue})`
                : hasDateFilter && dateToValue
                ? sql`AND DATE(t.trx_date) <= DATE(${dateToValue})`
                : sql``
            }
            ${hasInsuranceFilter ? sql`AND t.insurance_type_id = ${insuranceTypeId}` : sql``}
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
            ${hasPolyFilter ? sql`AND t.poly_id = ${polyId}` : sql``}
            ${hasInsuranceFilter ? sql`AND t.insurance_type_id = ${insuranceTypeId}` : sql``}
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
            ${
              hasDateFilter && dateFromValue && dateToValue
                ? sql`AND DATE(t.trx_date) >= DATE(${dateFromValue}) AND DATE(t.trx_date) <= DATE(${dateToValue})`
                : hasDateFilter && dateFromValue
                ? sql`AND DATE(t.trx_date) >= DATE(${dateFromValue})`
                : hasDateFilter && dateToValue
                ? sql`AND DATE(t.trx_date) <= DATE(${dateToValue})`
                : sql``
            }
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

// Implementasi baru getTransactions dengan builder query yang jauh lebih sederhana
// Menggunakan getSqlClient() dan text query + parameter array agar tidak ada nested template sql
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
    const client = getSqlClient()

    // Normalisasi input
    const trimmedSearch = search && search.trim() !== '' ? search.trim() : undefined
    const validDateFrom = dateFrom && dateFrom.trim() !== '' ? dateFrom : undefined
    const validDateTo = dateTo && dateTo.trim() !== '' ? dateTo : undefined

    const whereClauses: string[] = []
    const params: any[] = []
    let paramIndex = 0

    // Filter klinik
    if (clinicId) {
      paramIndex++
      params.push(clinicId)
      whereClauses.push(`t.clinic_id = $${paramIndex}`)
    }

    // Filter search (trx_no, patient_name, erm_no)
    if (trimmedSearch) {
      paramIndex++
      params.push(`%${trimmedSearch}%`)
      const idx = paramIndex
      whereClauses.push(
        `(t.trx_no ILIKE $${idx} OR t.patient_name ILIKE $${idx} OR t.erm_no ILIKE $${idx})`,
      )
    }

    // Filter tanggal
    if (validDateFrom && validDateTo) {
      paramIndex++
      const fromIdx = paramIndex
      params.push(validDateFrom)

      paramIndex++
      const toIdx = paramIndex
      params.push(validDateTo)

      whereClauses.push(
        `DATE(t.trx_date) >= DATE($${fromIdx}) AND DATE(t.trx_date) <= DATE($${toIdx})`,
      )
    } else if (validDateFrom) {
      paramIndex++
      params.push(validDateFrom)
      whereClauses.push(`DATE(t.trx_date) >= DATE($${paramIndex})`)
    } else if (validDateTo) {
      paramIndex++
      params.push(validDateTo)
      whereClauses.push(`DATE(t.trx_date) <= DATE($${paramIndex})`)
    }

    // Filter poli
    if (polyId) {
      paramIndex++
      params.push(polyId)
      whereClauses.push(`t.poly_id = $${paramIndex}`)
    }

    // Filter jenis asuransi
    if (insuranceTypeId) {
      paramIndex++
      params.push(insuranceTypeId)
      whereClauses.push(`t.insurance_type_id = $${paramIndex}`)
    }

    const whereSql = whereClauses.length > 0 ? whereClauses.join(' AND ') : 'TRUE'

    // Tambahkan parameter limit & offset
    paramIndex++
    const limitIdx = paramIndex
    params.push(limit)

    paramIndex++
    const offsetIdx = paramIndex
    params.push(offset)

    const baseFromWhere = `
      FROM transactions t
      JOIN clinics c ON c.id = t.clinic_id
      LEFT JOIN master_polies mp ON mp.id = t.poly_id
      LEFT JOIN master_insurance_types mit ON mit.id = t.insurance_type_id
      WHERE ${whereSql}
    `

    const filterParams = params.slice(0, limitIdx - 1)

    const [transactions, countResultRaw] = await Promise.all([
      client(
        `
        SELECT 
          t.*,
          c.name AS clinic_name,
          mp.name AS master_poly_name,
          mit.name AS master_insurance_name
        ${baseFromWhere}
        ORDER BY t.trx_date DESC, t.trx_time DESC
        LIMIT $${limitIdx} OFFSET $${offsetIdx}
        `,
        params,
      ),
      client(
        `
        SELECT COUNT(*) AS total
        ${baseFromWhere}
        `,
        filterParams,
      ),
    ])

    const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw

    return {
      transactions: Array.isArray(transactions) ? transactions : [],
      total: Number((countResult as any)?.total || 0),
      page,
      limit,
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

export const getTransactionStats = cache(async (
  search?: string,
  clinicId?: number,
  dateFrom?: string,
  dateTo?: string,
  polyId?: number,
  insuranceTypeId?: number
) => {
  try {
    const client = getSqlClient()

    const trimmedSearch = search && search.trim() !== '' ? search.trim() : undefined
    const validDateFrom = dateFrom && dateFrom.trim() !== '' ? dateFrom : undefined
    const validDateTo = dateTo && dateTo.trim() !== '' ? dateTo : undefined

    const whereClauses: string[] = []
    const params: any[] = []
    let paramIndex = 0

    // Filter klinik
    if (clinicId) {
      paramIndex++
      params.push(clinicId)
      whereClauses.push(`t.clinic_id = $${paramIndex}`)
    }

    // Filter search
    if (trimmedSearch) {
      paramIndex++
      params.push(`%${trimmedSearch}%`)
      const idx = paramIndex
      whereClauses.push(
        `(t.trx_no ILIKE $${idx} OR t.patient_name ILIKE $${idx} OR t.erm_no ILIKE $${idx})`,
      )
    }

    // Filter tanggal
    if (validDateFrom && validDateTo) {
      paramIndex++
      const fromIdx = paramIndex
      params.push(validDateFrom)

      paramIndex++
      const toIdx = paramIndex
      params.push(validDateTo)

      whereClauses.push(
        `DATE(t.trx_date) >= DATE($${fromIdx}) AND DATE(t.trx_date) <= DATE($${toIdx})`,
      )
    } else if (validDateFrom) {
      paramIndex++
      params.push(validDateFrom)
      whereClauses.push(`DATE(t.trx_date) >= DATE($${paramIndex})`)
    } else if (validDateTo) {
      paramIndex++
      params.push(validDateTo)
      whereClauses.push(`DATE(t.trx_date) <= DATE($${paramIndex})`)
    }

    // Filter poli
    if (polyId) {
      paramIndex++
      params.push(polyId)
      whereClauses.push(`t.poly_id = $${paramIndex}`)
    }

    // Filter jenis asuransi
    if (insuranceTypeId) {
      paramIndex++
      params.push(insuranceTypeId)
      whereClauses.push(`t.insurance_type_id = $${paramIndex}`)
    }

    const whereSql = whereClauses.length > 0 ? whereClauses.join(' AND ') : 'TRUE'

    const statsRaw = await client(
      `
      SELECT 
        COUNT(*) as total_transactions,
        COUNT(CASE WHEN zains_synced = true THEN 1 END) as synced_count,
        COUNT(CASE WHEN zains_synced = false THEN 1 END) as pending_count,
        COALESCE(SUM(paid_total), 0) as total_revenue,
        COALESCE(SUM(covered_total), 0) as total_jaminan,
        COALESCE(SUM(bill_total), 0) as total_tagihan
      FROM transactions t
      WHERE ${whereSql}
      `,
      params,
    )

    const stats = Array.isArray(statsRaw) ? statsRaw[0] : statsRaw
    
    return {
      totalTransactions: Number((stats as any)?.total_transactions || 0),
      syncedCount: Number((stats as any)?.synced_count || 0),
      pendingCount: Number((stats as any)?.pending_count || 0),
      totalRevenue: Number((stats as any)?.total_revenue || 0),
      totalJaminan: Number((stats as any)?.total_jaminan || 0),
      totalTagihan: Number((stats as any)?.total_tagihan || 0),
    }
  } catch (error) {
    console.error('Error fetching transaction stats:', error)
    return {
      totalTransactions: 0,
      syncedCount: 0,
      pendingCount: 0,
      totalRevenue: 0,
      totalJaminan: 0,
      totalTagihan: 0,
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
        c.name as clinic_name,
        mtc.name as program_name
      FROM transactions_to_zains tz
      JOIN transactions t ON t.id = tz.transaction_id
      JOIN clinics c ON c.id = t.clinic_id
      LEFT JOIN master_target_categories mtc ON mtc.id_program_zains = tz.id_program
      WHERE tz.transaction_id = ${transactionId}
    `
    
    if (dateFrom) {
      query = sql`
        SELECT 
          tz.*,
          t.trx_no,
          t.trx_date,
          c.name as clinic_name,
          mtc.name as program_name
        FROM transactions_to_zains tz
        JOIN transactions t ON t.id = tz.transaction_id
        JOIN clinics c ON c.id = t.clinic_id
        LEFT JOIN master_target_categories mtc ON mtc.id_program_zains = tz.id_program
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
          c.name as clinic_name,
          mtc.name as program_name
        FROM transactions_to_zains tz
        JOIN transactions t ON t.id = tz.transaction_id
        JOIN clinics c ON c.id = t.clinic_id
        LEFT JOIN master_target_categories mtc ON mtc.id_program_zains = tz.id_program
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

/**
 * Hapus transaksi beserta cascade ke transactions_to_zains.
 * Urutan: hapus dulu transactions_to_zains, lalu transactions.
 */
export async function deleteTransaction(transactionId: number): Promise<{ success: boolean; error?: string }> {
  try {
    await sql`DELETE FROM transactions_to_zains WHERE transaction_id = ${transactionId}`
    await sql`DELETE FROM transactions WHERE id = ${transactionId}`
    return { success: true }
  } catch (error) {
    console.error('Error deleting transaction:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Gagal menghapus transaksi',
    }
  }
}
