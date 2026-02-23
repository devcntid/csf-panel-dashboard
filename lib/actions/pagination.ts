'use server'

import { sql } from '@/lib/db'
import { cache } from 'react'

export const getClinicsPaginated = cache(async (page: number = 1, limit: number = 10) => {
  try {
    const offset = (page - 1) * limit
    
    // Parallel fetching untuk performa maksimal
    const [clinics, countResultRaw] = await Promise.all([
      sql`
        SELECT * FROM clinics
        ORDER BY id ASC
        LIMIT ${limit} OFFSET ${offset}
      `,
      sql`
        SELECT COUNT(*) as total FROM clinics
      `
    ])
    const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
    
    return {
      clinics: Array.isArray(clinics) ? clinics : [],
      total: Number((countResult as any)?.total || 0),
      page,
      limit,
    }
  } catch (error) {
    console.error('Error fetching clinics:', error)
    return {
      clinics: [],
      total: 0,
      page,
      limit,
    }
  }
})

export const getMasterPoliesPaginated = cache(async (page: number = 1, limit: number = 10) => {
  try {
    const offset = (page - 1) * limit
    
    // Parallel fetching untuk performa maksimal
    const [polies, countResultRaw] = await Promise.all([
      sql`
        SELECT * FROM master_polies
        ORDER BY id ASC
        LIMIT ${limit} OFFSET ${offset}
      `,
      sql`
        SELECT COUNT(*) as total FROM master_polies
      `
    ])
    const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
    
    return {
      polies: Array.isArray(polies) ? polies : [],
      total: Number((countResult as any)?.total || 0),
      page,
      limit,
    }
  } catch (error) {
    console.error('Error fetching master polies:', error)
    return {
      polies: [],
      total: 0,
      page,
      limit,
    }
  }
})

export const getPolyMappingsPaginated = cache(async (
  clinicId?: number,
  masterPolyId?: number,
  search?: string,
  page: number = 1,
  limit: number = 10
) => {
  try {
    const offset = (page - 1) * limit
    
    // Normalize search - hanya gunakan jika bukan empty string
    const validSearch = search && search.trim() !== '' ? search.trim() : undefined
    
    // Handle special case: unmapped (masterPolyId = -1 means NULL)
    const isUnmapped = masterPolyId === -1
    
    // Build query dengan kondisi dinamis menggunakan parameterized query
    if (clinicId && isUnmapped && validSearch) {
      const [mappings, countResultRaw] = await Promise.all([
        sql`
          SELECT 
            cpm.*,
            c.name as clinic_name,
            mp.name as master_poly_name
          FROM clinic_poly_mappings cpm
          JOIN clinics c ON c.id = cpm.clinic_id
          LEFT JOIN master_polies mp ON mp.id = cpm.master_poly_id
          WHERE cpm.clinic_id = ${clinicId}
            AND cpm.master_poly_id IS NULL
            AND (
              cpm.raw_poly_name ILIKE ${`%${validSearch}%`}
              OR c.name ILIKE ${`%${validSearch}%`}
              OR mp.name ILIKE ${`%${validSearch}%`}
            )
          ORDER BY cpm.id ASC
          LIMIT ${limit} OFFSET ${offset}
        `,
        sql`
          SELECT COUNT(*) as total
          FROM clinic_poly_mappings cpm
          JOIN clinics c ON c.id = cpm.clinic_id
          LEFT JOIN master_polies mp ON mp.id = cpm.master_poly_id
          WHERE cpm.clinic_id = ${clinicId}
            AND cpm.master_poly_id IS NULL
            AND (
              cpm.raw_poly_name ILIKE ${`%${validSearch}%`}
              OR c.name ILIKE ${`%${validSearch}%`}
              OR mp.name ILIKE ${`%${validSearch}%`}
            )
        `
      ])
      const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
      return {
        mappings: Array.isArray(mappings) ? mappings : [],
        total: Number((countResult as any)?.total || 0),
        page,
        limit,
      }
    } else if (clinicId && isUnmapped) {
      const [mappings, countResultRaw] = await Promise.all([
        sql`
          SELECT 
            cpm.*,
            c.name as clinic_name,
            mp.name as master_poly_name
          FROM clinic_poly_mappings cpm
          JOIN clinics c ON c.id = cpm.clinic_id
          LEFT JOIN master_polies mp ON mp.id = cpm.master_poly_id
          WHERE cpm.clinic_id = ${clinicId}
            AND cpm.master_poly_id IS NULL
          ORDER BY cpm.id ASC
          LIMIT ${limit} OFFSET ${offset}
        `,
        sql`
          SELECT COUNT(*) as total
          FROM clinic_poly_mappings cpm
          WHERE cpm.clinic_id = ${clinicId}
            AND cpm.master_poly_id IS NULL
        `
      ])
      const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
      return {
        mappings: Array.isArray(mappings) ? mappings : [],
        total: Number((countResult as any)?.total || 0),
        page,
        limit,
      }
    } else if (clinicId && masterPolyId && validSearch) {
      const [mappings, countResultRaw] = await Promise.all([
        sql`
          SELECT 
            cpm.*,
            c.name as clinic_name,
            mp.name as master_poly_name
          FROM clinic_poly_mappings cpm
          JOIN clinics c ON c.id = cpm.clinic_id
          LEFT JOIN master_polies mp ON mp.id = cpm.master_poly_id
          WHERE cpm.clinic_id = ${clinicId}
            AND cpm.master_poly_id = ${masterPolyId}
            AND (
              cpm.raw_poly_name ILIKE ${`%${validSearch}%`}
              OR c.name ILIKE ${`%${validSearch}%`}
              OR mp.name ILIKE ${`%${validSearch}%`}
            )
          ORDER BY cpm.id ASC
          LIMIT ${limit} OFFSET ${offset}
        `,
        sql`
          SELECT COUNT(*) as total
          FROM clinic_poly_mappings cpm
          WHERE cpm.clinic_id = ${clinicId}
            AND cpm.master_poly_id = ${masterPolyId}
            AND (
              cpm.raw_poly_name ILIKE ${`%${validSearch}%`}
              OR c.name ILIKE ${`%${validSearch}%`}
            )
        `
      ])
      const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
      return {
        mappings: Array.isArray(mappings) ? mappings : [],
        total: Number((countResult as any)?.total || 0),
        page,
        limit,
      }
    } else if (clinicId && masterPolyId) {
      const [mappings, countResultRaw] = await Promise.all([
        sql`
          SELECT 
            cpm.*,
            c.name as clinic_name,
            mp.name as master_poly_name
          FROM clinic_poly_mappings cpm
          JOIN clinics c ON c.id = cpm.clinic_id
          LEFT JOIN master_polies mp ON mp.id = cpm.master_poly_id
          WHERE cpm.clinic_id = ${clinicId}
            AND cpm.master_poly_id = ${masterPolyId}
          ORDER BY cpm.id ASC
          LIMIT ${limit} OFFSET ${offset}
        `,
        sql`
          SELECT COUNT(*) as total
          FROM clinic_poly_mappings cpm
          WHERE cpm.clinic_id = ${clinicId}
            AND cpm.master_poly_id = ${masterPolyId}
        `
      ])
      const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
      return {
        mappings: Array.isArray(mappings) ? mappings : [],
        total: Number((countResult as any)?.total || 0),
        page,
        limit,
      }
    } else if (clinicId && validSearch) {
      const [mappings, countResultRaw] = await Promise.all([
        sql`
          SELECT 
            cpm.*,
            c.name as clinic_name,
            mp.name as master_poly_name
          FROM clinic_poly_mappings cpm
          JOIN clinics c ON c.id = cpm.clinic_id
          LEFT JOIN master_polies mp ON mp.id = cpm.master_poly_id
          WHERE cpm.clinic_id = ${clinicId}
            AND (
              cpm.raw_poly_name ILIKE ${`%${validSearch}%`}
              OR c.name ILIKE ${`%${validSearch}%`}
              OR mp.name ILIKE ${`%${validSearch}%`}
            )
          ORDER BY cpm.id ASC
          LIMIT ${limit} OFFSET ${offset}
        `,
        sql`
          SELECT COUNT(*) as total
          FROM clinic_poly_mappings cpm
          JOIN clinics c ON c.id = cpm.clinic_id
          LEFT JOIN master_polies mp ON mp.id = cpm.master_poly_id
          WHERE cpm.clinic_id = ${clinicId}
            AND (
              cpm.raw_poly_name ILIKE ${`%${validSearch}%`}
              OR c.name ILIKE ${`%${validSearch}%`}
              OR mp.name ILIKE ${`%${validSearch}%`}
            )
        `
      ])
      const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
      return {
        mappings: Array.isArray(mappings) ? mappings : [],
        total: Number((countResult as any)?.total || 0),
        page,
        limit,
      }
    } else if (clinicId) {
      const [mappings, countResultRaw] = await Promise.all([
        sql`
          SELECT 
            cpm.*,
            c.name as clinic_name,
            mp.name as master_poly_name
          FROM clinic_poly_mappings cpm
          JOIN clinics c ON c.id = cpm.clinic_id
          LEFT JOIN master_polies mp ON mp.id = cpm.master_poly_id
          WHERE cpm.clinic_id = ${clinicId}
          ORDER BY cpm.id ASC
          LIMIT ${limit} OFFSET ${offset}
        `,
        sql`
          SELECT COUNT(*) as total
          FROM clinic_poly_mappings cpm
          WHERE cpm.clinic_id = ${clinicId}
        `
      ])
      const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
      return {
        mappings: Array.isArray(mappings) ? mappings : [],
        total: Number((countResult as any)?.total || 0),
        page,
        limit,
      }
    } else if (isUnmapped && validSearch) {
      const [mappings, countResultRaw] = await Promise.all([
        sql`
          SELECT 
            cpm.*,
            c.name as clinic_name,
            mp.name as master_poly_name
          FROM clinic_poly_mappings cpm
          JOIN clinics c ON c.id = cpm.clinic_id
          LEFT JOIN master_polies mp ON mp.id = cpm.master_poly_id
          WHERE cpm.master_poly_id IS NULL
            AND (
              cpm.raw_poly_name ILIKE ${`%${validSearch}%`}
              OR c.name ILIKE ${`%${validSearch}%`}
            )
          ORDER BY cpm.id ASC
          LIMIT ${limit} OFFSET ${offset}
        `,
        sql`
          SELECT COUNT(*) as total
          FROM clinic_poly_mappings cpm
          WHERE cpm.master_poly_id IS NULL
            AND (
              cpm.raw_poly_name ILIKE ${`%${validSearch}%`}
            )
        `
      ])
      const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
      return {
        mappings: Array.isArray(mappings) ? mappings : [],
        total: Number((countResult as any)?.total || 0),
        page,
        limit,
      }
    } else if (isUnmapped) {
      const [mappings, countResultRaw] = await Promise.all([
        sql`
          SELECT 
            cpm.*,
            c.name as clinic_name,
            mp.name as master_poly_name
          FROM clinic_poly_mappings cpm
          JOIN clinics c ON c.id = cpm.clinic_id
          LEFT JOIN master_polies mp ON mp.id = cpm.master_poly_id
          WHERE cpm.master_poly_id IS NULL
          ORDER BY cpm.id ASC
          LIMIT ${limit} OFFSET ${offset}
        `,
        sql`
          SELECT COUNT(*) as total
          FROM clinic_poly_mappings cpm
          WHERE cpm.master_poly_id IS NULL
        `
      ])
      const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
      return {
        mappings: Array.isArray(mappings) ? mappings : [],
        total: Number((countResult as any)?.total || 0),
        page,
        limit,
      }
    } else if (masterPolyId && validSearch) {
      const [mappings, countResultRaw] = await Promise.all([
        sql`
          SELECT 
            cpm.*,
            c.name as clinic_name,
            mp.name as master_poly_name
          FROM clinic_poly_mappings cpm
          JOIN clinics c ON c.id = cpm.clinic_id
          LEFT JOIN master_polies mp ON mp.id = cpm.master_poly_id
          WHERE cpm.master_poly_id = ${masterPolyId}
            AND (
              cpm.raw_poly_name ILIKE ${`%${validSearch}%`}
              OR c.name ILIKE ${`%${validSearch}%`}
              OR mp.name ILIKE ${`%${validSearch}%`}
            )
          ORDER BY cpm.id ASC
          LIMIT ${limit} OFFSET ${offset}
        `,
        sql`
          SELECT COUNT(*) as total
          FROM clinic_poly_mappings cpm
          WHERE cpm.master_poly_id = ${masterPolyId}
            AND (
              cpm.raw_poly_name ILIKE ${`%${validSearch}%`}
              OR c.name ILIKE ${`%${validSearch}%`}
            )
        `
      ])
      const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
      return {
        mappings: Array.isArray(mappings) ? mappings : [],
        total: Number((countResult as any)?.total || 0),
        page,
        limit,
      }
    } else if (masterPolyId) {
      const [mappings, countResultRaw] = await Promise.all([
        sql`
          SELECT 
            cpm.*,
            c.name as clinic_name,
            mp.name as master_poly_name
          FROM clinic_poly_mappings cpm
          JOIN clinics c ON c.id = cpm.clinic_id
          LEFT JOIN master_polies mp ON mp.id = cpm.master_poly_id
          WHERE cpm.master_poly_id = ${masterPolyId}
          ORDER BY c.name, cpm.raw_poly_name
          LIMIT ${limit} OFFSET ${offset}
        `,
        sql`
          SELECT COUNT(*) as total
          FROM clinic_poly_mappings cpm
          WHERE cpm.master_poly_id = ${masterPolyId}
        `
      ])
      const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
      return {
        mappings: Array.isArray(mappings) ? mappings : [],
        total: Number((countResult as any)?.total || 0),
        page,
        limit,
      }
    } else if (validSearch) {
      const [mappings, countResultRaw] = await Promise.all([
        sql`
          SELECT 
            cpm.*,
            c.name as clinic_name,
            mp.name as master_poly_name
          FROM clinic_poly_mappings cpm
          JOIN clinics c ON c.id = cpm.clinic_id
          LEFT JOIN master_polies mp ON mp.id = cpm.master_poly_id
          WHERE
            cpm.raw_poly_name ILIKE ${`%${validSearch}%`}
            OR c.name ILIKE ${`%${validSearch}%`}
            OR mp.name ILIKE ${`%${validSearch}%`}
          ORDER BY c.name, cpm.raw_poly_name
          LIMIT ${limit} OFFSET ${offset}
        `,
        sql`
          SELECT COUNT(*) as total
          FROM clinic_poly_mappings cpm
          JOIN clinics c ON c.id = cpm.clinic_id
          LEFT JOIN master_polies mp ON mp.id = cpm.master_poly_id
          WHERE
            cpm.raw_poly_name ILIKE ${`%${validSearch}%`}
            OR c.name ILIKE ${`%${validSearch}%`}
            OR mp.name ILIKE ${`%${validSearch}%`}
        `
      ])
      const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
      return {
        mappings: Array.isArray(mappings) ? mappings : [],
        total: Number((countResult as any)?.total || 0),
        page,
        limit,
      }
    } else {
      const [mappings, countResultRaw] = await Promise.all([
        sql`
          SELECT 
            cpm.*,
            c.name as clinic_name,
            mp.name as master_poly_name
          FROM clinic_poly_mappings cpm
          JOIN clinics c ON c.id = cpm.clinic_id
          LEFT JOIN master_polies mp ON mp.id = cpm.master_poly_id
          ORDER BY c.name, cpm.raw_poly_name
          LIMIT ${limit} OFFSET ${offset}
        `,
        sql`
          SELECT COUNT(*) as total FROM clinic_poly_mappings
        `
      ])
      const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
      return {
        mappings: Array.isArray(mappings) ? mappings : [],
        total: Number((countResult as any)?.total || 0),
        page,
        limit,
      }
    }
  } catch (error) {
    console.error('Error fetching poly mappings:', error)
    return {
      mappings: [],
      total: 0,
      page,
      limit,
    }
  }
})

export const getInsuranceMappingsPaginated = cache(async (
  clinicId?: number,
  masterInsuranceId?: number,
  search?: string,
  page: number = 1,
  limit: number = 10
) => {
  try {
    const offset = (page - 1) * limit
    
    // Normalize search - hanya gunakan jika bukan empty string
    const validSearch = search && search.trim() !== '' ? search.trim() : undefined
    
    // Handle special case: unmapped (masterInsuranceId = -1 means NULL)
    const isUnmapped = masterInsuranceId === -1
    
    // Build query dengan kondisi dinamis menggunakan parameterized query
    if (clinicId && isUnmapped && validSearch) {
      const [mappings, countResultRaw] = await Promise.all([
        sql`
          SELECT 
            cim.*,
            c.name as clinic_name,
            mit.name as master_insurance_name
          FROM clinic_insurance_mappings cim
          JOIN clinics c ON c.id = cim.clinic_id
          LEFT JOIN master_insurance_types mit ON mit.id = cim.master_insurance_id
          WHERE cim.clinic_id = ${clinicId}
            AND cim.master_insurance_id IS NULL
            AND (
              cim.raw_insurance_name ILIKE ${`%${validSearch}%`}
              OR c.name ILIKE ${`%${validSearch}%`}
              OR mit.name ILIKE ${`%${validSearch}%`}
            )
          ORDER BY cim.id ASC
          LIMIT ${limit} OFFSET ${offset}
        `,
        sql`
          SELECT COUNT(*) as total
          FROM clinic_insurance_mappings cim
          JOIN clinics c ON c.id = cim.clinic_id
          LEFT JOIN master_insurance_types mit ON mit.id = cim.master_insurance_id
          WHERE cim.clinic_id = ${clinicId}
            AND cim.master_insurance_id IS NULL
            AND (
              cim.raw_insurance_name ILIKE ${`%${validSearch}%`}
              OR c.name ILIKE ${`%${validSearch}%`}
              OR mit.name ILIKE ${`%${validSearch}%`}
            )
        `
      ])
      const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
      return {
        mappings: Array.isArray(mappings) ? mappings : [],
        total: Number((countResult as any)?.total || 0),
        page,
        limit,
      }
    } else if (clinicId && isUnmapped) {
      const [mappings, countResultRaw] = await Promise.all([
        sql`
          SELECT 
            cim.*,
            c.name as clinic_name,
            mit.name as master_insurance_name
          FROM clinic_insurance_mappings cim
          JOIN clinics c ON c.id = cim.clinic_id
          LEFT JOIN master_insurance_types mit ON mit.id = cim.master_insurance_id
          WHERE cim.clinic_id = ${clinicId}
            AND cim.master_insurance_id IS NULL
          ORDER BY cim.id ASC
          LIMIT ${limit} OFFSET ${offset}
        `,
        sql`
          SELECT COUNT(*) as total
          FROM clinic_insurance_mappings cim
          WHERE cim.clinic_id = ${clinicId}
            AND cim.master_insurance_id IS NULL
        `
      ])
      const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
      return {
        mappings: Array.isArray(mappings) ? mappings : [],
        total: Number((countResult as any)?.total || 0),
        page,
        limit,
      }
    } else if (clinicId && masterInsuranceId && validSearch) {
      const [mappings, countResultRaw] = await Promise.all([
        sql`
          SELECT 
            cim.*,
            c.name as clinic_name,
            mit.name as master_insurance_name
          FROM clinic_insurance_mappings cim
          JOIN clinics c ON c.id = cim.clinic_id
          LEFT JOIN master_insurance_types mit ON mit.id = cim.master_insurance_id
          WHERE cim.clinic_id = ${clinicId}
            AND cim.master_insurance_id = ${masterInsuranceId}
            AND (
              cim.raw_insurance_name ILIKE ${`%${validSearch}%`}
              OR c.name ILIKE ${`%${validSearch}%`}
              OR mit.name ILIKE ${`%${validSearch}%`}
            )
          ORDER BY cim.id ASC
          LIMIT ${limit} OFFSET ${offset}
        `,
        sql`
          SELECT COUNT(*) as total
          FROM clinic_insurance_mappings cim
          JOIN clinics c ON c.id = cim.clinic_id
          LEFT JOIN master_insurance_types mit ON mit.id = cim.master_insurance_id
          WHERE cim.clinic_id = ${clinicId}
            AND cim.master_insurance_id = ${masterInsuranceId}
            AND (
              cim.raw_insurance_name ILIKE ${`%${validSearch}%`}
              OR c.name ILIKE ${`%${validSearch}%`}
              OR mit.name ILIKE ${`%${validSearch}%`}
            )
        `
      ])
      const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
      return {
        mappings: Array.isArray(mappings) ? mappings : [],
        total: Number((countResult as any)?.total || 0),
        page,
        limit,
      }
    } else if (clinicId && masterInsuranceId) {
      const [mappings, countResultRaw] = await Promise.all([
        sql`
          SELECT 
            cim.*,
            c.name as clinic_name,
            mit.name as master_insurance_name
          FROM clinic_insurance_mappings cim
          JOIN clinics c ON c.id = cim.clinic_id
          LEFT JOIN master_insurance_types mit ON mit.id = cim.master_insurance_id
          WHERE cim.clinic_id = ${clinicId}
            AND cim.master_insurance_id = ${masterInsuranceId}
          ORDER BY cim.id ASC
          LIMIT ${limit} OFFSET ${offset}
        `,
        sql`
          SELECT COUNT(*) as total
          FROM clinic_insurance_mappings cim
          WHERE cim.clinic_id = ${clinicId}
            AND cim.master_insurance_id = ${masterInsuranceId}
        `
      ])
      const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
      return {
        mappings: Array.isArray(mappings) ? mappings : [],
        total: Number((countResult as any)?.total || 0),
        page,
        limit,
      }
    } else if (clinicId && validSearch) {
      const [mappings, countResultRaw] = await Promise.all([
        sql`
          SELECT 
            cim.*,
            c.name as clinic_name,
            mit.name as master_insurance_name
          FROM clinic_insurance_mappings cim
          JOIN clinics c ON c.id = cim.clinic_id
          LEFT JOIN master_insurance_types mit ON mit.id = cim.master_insurance_id
          WHERE cim.clinic_id = ${clinicId}
            AND (
              cim.raw_insurance_name ILIKE ${`%${validSearch}%`}
              OR c.name ILIKE ${`%${validSearch}%`}
              OR mit.name ILIKE ${`%${validSearch}%`}
            )
          ORDER BY cim.id ASC
          LIMIT ${limit} OFFSET ${offset}
        `,
        sql`
          SELECT COUNT(*) as total
          FROM clinic_insurance_mappings cim
          JOIN clinics c ON c.id = cim.clinic_id
          LEFT JOIN master_insurance_types mit ON mit.id = cim.master_insurance_id
          WHERE cim.clinic_id = ${clinicId}
            AND (
              cim.raw_insurance_name ILIKE ${`%${validSearch}%`}
              OR c.name ILIKE ${`%${validSearch}%`}
              OR mit.name ILIKE ${`%${validSearch}%`}
            )
        `
      ])
      const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
      return {
        mappings: Array.isArray(mappings) ? mappings : [],
        total: Number((countResult as any)?.total || 0),
        page,
        limit,
      }
    } else if (clinicId) {
      const [mappings, countResultRaw] = await Promise.all([
        sql`
          SELECT 
            cim.*,
            c.name as clinic_name,
            mit.name as master_insurance_name
          FROM clinic_insurance_mappings cim
          JOIN clinics c ON c.id = cim.clinic_id
          LEFT JOIN master_insurance_types mit ON mit.id = cim.master_insurance_id
          WHERE cim.clinic_id = ${clinicId}
          ORDER BY cim.id ASC
          LIMIT ${limit} OFFSET ${offset}
        `,
        sql`
          SELECT COUNT(*) as total
          FROM clinic_insurance_mappings cim
          WHERE cim.clinic_id = ${clinicId}
        `
      ])
      const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
      return {
        mappings: Array.isArray(mappings) ? mappings : [],
        total: Number((countResult as any)?.total || 0),
        page,
        limit,
      }
    } else if (isUnmapped && validSearch) {
      const [mappings, countResultRaw] = await Promise.all([
        sql`
          SELECT 
            cim.*,
            c.name as clinic_name,
            mit.name as master_insurance_name
          FROM clinic_insurance_mappings cim
          JOIN clinics c ON c.id = cim.clinic_id
          LEFT JOIN master_insurance_types mit ON mit.id = cim.master_insurance_id
          WHERE cim.master_insurance_id IS NULL
            AND (
              cim.raw_insurance_name ILIKE ${`%${validSearch}%`}
              OR c.name ILIKE ${`%${validSearch}%`}
            )
          ORDER BY cim.id ASC
          LIMIT ${limit} OFFSET ${offset}
        `,
        sql`
          SELECT COUNT(*) as total
          FROM clinic_insurance_mappings cim
          WHERE cim.master_insurance_id IS NULL
            AND (
              cim.raw_insurance_name ILIKE ${`%${validSearch}%`}
            )
        `
      ])
      const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
      return {
        mappings: Array.isArray(mappings) ? mappings : [],
        total: Number((countResult as any)?.total || 0),
        page,
        limit,
      }
    } else if (isUnmapped) {
      const [mappings, countResultRaw] = await Promise.all([
        sql`
          SELECT 
            cim.*,
            c.name as clinic_name,
            mit.name as master_insurance_name
          FROM clinic_insurance_mappings cim
          JOIN clinics c ON c.id = cim.clinic_id
          LEFT JOIN master_insurance_types mit ON mit.id = cim.master_insurance_id
          WHERE cim.master_insurance_id IS NULL
          ORDER BY cim.id ASC
          LIMIT ${limit} OFFSET ${offset}
        `,
        sql`
          SELECT COUNT(*) as total
          FROM clinic_insurance_mappings cim
          WHERE cim.master_insurance_id IS NULL
        `
      ])
      const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
      return {
        mappings: Array.isArray(mappings) ? mappings : [],
        total: Number((countResult as any)?.total || 0),
        page,
        limit,
      }
    } else if (masterInsuranceId && validSearch) {
      const [mappings, countResultRaw] = await Promise.all([
        sql`
          SELECT 
            cim.*,
            c.name as clinic_name,
            mit.name as master_insurance_name
          FROM clinic_insurance_mappings cim
          JOIN clinics c ON c.id = cim.clinic_id
          LEFT JOIN master_insurance_types mit ON mit.id = cim.master_insurance_id
          WHERE cim.master_insurance_id = ${masterInsuranceId}
            AND (
              cim.raw_insurance_name ILIKE ${`%${validSearch}%`}
              OR c.name ILIKE ${`%${validSearch}%`}
              OR mit.name ILIKE ${`%${validSearch}%`}
            )
          ORDER BY cim.id ASC
          LIMIT ${limit} OFFSET ${offset}
        `,
        sql`
          SELECT COUNT(*) as total
          FROM clinic_insurance_mappings cim
          JOIN clinics c ON c.id = cim.clinic_id
          LEFT JOIN master_insurance_types mit ON mit.id = cim.master_insurance_id
          WHERE cim.master_insurance_id = ${masterInsuranceId}
            AND (
              cim.raw_insurance_name ILIKE ${`%${validSearch}%`}
              OR c.name ILIKE ${`%${validSearch}%`}
              OR mit.name ILIKE ${`%${validSearch}%`}
            )
        `
      ])
      const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
      return {
        mappings: Array.isArray(mappings) ? mappings : [],
        total: Number((countResult as any)?.total || 0),
        page,
        limit,
      }
    } else if (masterInsuranceId) {
      const [mappings, countResultRaw] = await Promise.all([
        sql`
          SELECT 
            cim.*,
            c.name as clinic_name,
            mit.name as master_insurance_name
          FROM clinic_insurance_mappings cim
          JOIN clinics c ON c.id = cim.clinic_id
          LEFT JOIN master_insurance_types mit ON mit.id = cim.master_insurance_id
          WHERE cim.master_insurance_id = ${masterInsuranceId}
          ORDER BY cim.id ASC
          LIMIT ${limit} OFFSET ${offset}
        `,
        sql`
          SELECT COUNT(*) as total
          FROM clinic_insurance_mappings cim
          WHERE cim.master_insurance_id = ${masterInsuranceId}
        `
      ])
      const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
      return {
        mappings: Array.isArray(mappings) ? mappings : [],
        total: Number((countResult as any)?.total || 0),
        page,
        limit,
      }
    } else if (validSearch) {
      const [mappings, countResultRaw] = await Promise.all([
        sql`
          SELECT 
            cim.*,
            c.name as clinic_name,
            mit.name as master_insurance_name
          FROM clinic_insurance_mappings cim
          JOIN clinics c ON c.id = cim.clinic_id
          LEFT JOIN master_insurance_types mit ON mit.id = cim.master_insurance_id
          WHERE (
            cim.raw_insurance_name ILIKE ${`%${validSearch}%`}
            OR c.name ILIKE ${`%${validSearch}%`}
            OR mit.name ILIKE ${`%${validSearch}%`}
          )
          ORDER BY cim.id ASC
          LIMIT ${limit} OFFSET ${offset}
        `,
        sql`
          SELECT COUNT(*) as total
          FROM clinic_insurance_mappings cim
          JOIN clinics c ON c.id = cim.clinic_id
          LEFT JOIN master_insurance_types mit ON mit.id = cim.master_insurance_id
          WHERE (
            cim.raw_insurance_name ILIKE ${`%${validSearch}%`}
            OR c.name ILIKE ${`%${validSearch}%`}
            OR mit.name ILIKE ${`%${validSearch}%`}
          )
        `
      ])
      const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
      return {
        mappings: Array.isArray(mappings) ? mappings : [],
        total: Number((countResult as any)?.total || 0),
        page,
        limit,
      }
    } else {
      const [mappings, countResultRaw] = await Promise.all([
        sql`
          SELECT 
            cim.*,
            c.name as clinic_name,
            mit.name as master_insurance_name
          FROM clinic_insurance_mappings cim
          JOIN clinics c ON c.id = cim.clinic_id
          LEFT JOIN master_insurance_types mit ON mit.id = cim.master_insurance_id
          ORDER BY c.name, cim.raw_insurance_name
          LIMIT ${limit} OFFSET ${offset}
        `,
        sql`
          SELECT COUNT(*) as total FROM clinic_insurance_mappings
        `
      ])
      const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
      return {
        mappings: Array.isArray(mappings) ? mappings : [],
        total: Number((countResult as any)?.total || 0),
        page,
        limit,
      }
    }
  } catch (error) {
    console.error('Error fetching insurance mappings:', error)
    return {
      mappings: [],
      total: 0,
      page,
      limit,
    }
  }
})

export const getInsuranceTypesPaginated = cache(async (page: number = 1, limit: number = 10) => {
  try {
    const offset = (page - 1) * limit
    
    // Parallel fetching untuk performa maksimal
    const [insuranceTypes, countResultRaw] = await Promise.all([
      sql`
        SELECT * FROM master_insurance_types
        ORDER BY id ASC
        LIMIT ${limit} OFFSET ${offset}
      `,
      sql`
        SELECT COUNT(*) as total FROM master_insurance_types
      `
    ])
    const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
    
    return {
      insuranceTypes: Array.isArray(insuranceTypes) ? insuranceTypes : [],
      total: Number((countResult as any)?.total || 0),
      page,
      limit,
    }
  } catch (error) {
    console.error('Error fetching insurance types:', error)
    return {
      insuranceTypes: [],
      total: 0,
      page,
      limit,
    }
  }
})

export const getBpjsRealizationsPaginated = cache(async (
  clinicId?: number,
  year?: number,
  month?: number,
  page: number = 1,
  limit: number = 10
) => {
  try {
    const offset = (page - 1) * limit
    const cid = clinicId ?? null
    const y = year ?? null
    const m = month ?? null
    const [rows, countResultRaw] = await Promise.all([
      sql`
        SELECT r.*, c.name as clinic_name
        FROM clinic_bpjs_realizations r
        JOIN clinics c ON c.id = r.clinic_id
        WHERE (${cid}::bigint IS NULL OR r.clinic_id = ${cid})
          AND (${y}::int IS NULL OR r.year = ${y})
          AND (${m}::int IS NULL OR r.month = ${m})
        ORDER BY r.year DESC, r.month DESC, r.clinic_id ASC
        LIMIT ${limit} OFFSET ${offset}
      `,
      sql`
        SELECT COUNT(*) as total
        FROM clinic_bpjs_realizations r
        WHERE (${cid}::bigint IS NULL OR r.clinic_id = ${cid})
          AND (${y}::int IS NULL OR r.year = ${y})
          AND (${m}::int IS NULL OR r.month = ${m})
      `
    ])
    const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
    return {
      realizations: Array.isArray(rows) ? rows : [],
      total: Number((countResult as any)?.total || 0),
      page,
      limit,
    }
  } catch (error) {
    console.error('Error fetching bpjs realizations:', error)
    return {
      realizations: [],
      total: 0,
      page,
      limit,
    }
  }
})

export const getTargetCategoriesPaginated = cache(async (page: number = 1, limit: number = 10) => {
  try {
    const offset = (page - 1) * limit
    
    // Parallel fetching untuk performa maksimal
    const [categories, countResultRaw] = await Promise.all([
      sql`
        SELECT * FROM master_target_categories
        ORDER BY id ASC
        LIMIT ${limit} OFFSET ${offset}
      `,
      sql`
        SELECT COUNT(*) as total FROM master_target_categories
      `
    ])
    const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
    
    return {
      categories: Array.isArray(categories) ? categories : [],
      total: Number((countResult as any)?.total || 0),
      page,
      limit,
    }
  } catch (error) {
    console.error('Error fetching target categories:', error)
    return {
      categories: [],
      total: 0,
      page,
      limit,
    }
  }
})

export const getDailyTargetsPaginated = cache(async (
  clinicId?: number,
  polyId?: number,
  startDate?: string,
  endDate?: string,
  page: number = 1,
  limit: number = 10
) => {
  try {
    const offset = (page - 1) * limit
    
    // Build query dengan kondisi dinamis - menggunakan parallel fetching
    if (clinicId && polyId && startDate && endDate) {
      const [targets, countResultRaw] = await Promise.all([
        sql`
          SELECT 
            cdt.*,
            c.name as clinic_name,
            mp.name as poly_name,
            s.name as source_name,
            mit.name as insurance_type_name,
            COALESCE(ctc.base_rate, 0) as base_rate
          FROM clinic_daily_targets cdt
          JOIN clinics c ON c.id = cdt.clinic_id
          JOIN master_polies mp ON mp.id = cdt.master_poly_id
          JOIN sources s ON s.id = cdt.source_id
          LEFT JOIN master_insurance_types mit ON mit.id = cdt.insurance_type_id
          LEFT JOIN clinic_target_configs ctc ON ctc.clinic_id = cdt.clinic_id
            AND ctc.master_poly_id = cdt.master_poly_id
            AND ctc.target_year = COALESCE(EXTRACT(YEAR FROM cdt.target_date), cdt.target_year)
            AND ctc.is_active = true
          WHERE cdt.clinic_id = ${clinicId} 
            AND cdt.master_poly_id = ${polyId}
            AND cdt.target_date >= ${startDate} 
            AND cdt.target_date <= ${endDate}
          ORDER BY cdt.id ASC
          LIMIT ${limit} OFFSET ${offset}
        `,
        sql`
          SELECT COUNT(*) as total
          FROM clinic_daily_targets cdt
          WHERE cdt.clinic_id = ${clinicId} 
            AND cdt.master_poly_id = ${polyId}
            AND cdt.target_date >= ${startDate} 
            AND cdt.target_date <= ${endDate}
        `
      ])
      const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
      return {
        targets: Array.isArray(targets) ? targets : [],
        total: Number((countResult as any)?.total || 0),
        page,
        limit,
      }
    } else if (clinicId && startDate && endDate) {
      const [targets, countResultRaw] = await Promise.all([
        sql`
          SELECT 
            cdt.*,
            c.name as clinic_name,
            mp.name as poly_name,
            s.name as source_name,
            mit.name as insurance_type_name,
            COALESCE(ctc.base_rate, 0) as base_rate
          FROM clinic_daily_targets cdt
          JOIN clinics c ON c.id = cdt.clinic_id
          JOIN master_polies mp ON mp.id = cdt.master_poly_id
          JOIN sources s ON s.id = cdt.source_id
          LEFT JOIN master_insurance_types mit ON mit.id = cdt.insurance_type_id
          LEFT JOIN clinic_target_configs ctc ON ctc.clinic_id = cdt.clinic_id
            AND ctc.master_poly_id = cdt.master_poly_id
            AND ctc.target_year = COALESCE(EXTRACT(YEAR FROM cdt.target_date), cdt.target_year)
            AND ctc.is_active = true
          WHERE cdt.clinic_id = ${clinicId} 
            AND cdt.target_date >= ${startDate} 
            AND cdt.target_date <= ${endDate}
          ORDER BY cdt.id ASC
          LIMIT ${limit} OFFSET ${offset}
        `,
        sql`
          SELECT COUNT(*) as total
          FROM clinic_daily_targets cdt
          WHERE cdt.clinic_id = ${clinicId} 
            AND cdt.target_date >= ${startDate} 
            AND cdt.target_date <= ${endDate}
        `
      ])
      const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
      return {
        targets: Array.isArray(targets) ? targets : [],
        total: Number((countResult as any)?.total || 0),
        page,
        limit,
      }
    } else if (clinicId) {
      const [targets, countResultRaw] = await Promise.all([
        sql`
          SELECT 
            cdt.*,
            c.name as clinic_name,
            mp.name as poly_name,
            s.name as source_name,
            mit.name as insurance_type_name,
            COALESCE(ctc.base_rate, 0) as base_rate
          FROM clinic_daily_targets cdt
          JOIN clinics c ON c.id = cdt.clinic_id
          JOIN master_polies mp ON mp.id = cdt.master_poly_id
          JOIN sources s ON s.id = cdt.source_id
          LEFT JOIN master_insurance_types mit ON mit.id = cdt.insurance_type_id
          LEFT JOIN clinic_target_configs ctc ON ctc.clinic_id = cdt.clinic_id
            AND ctc.master_poly_id = cdt.master_poly_id
            AND ctc.target_year = COALESCE(EXTRACT(YEAR FROM cdt.target_date), cdt.target_year)
            AND ctc.is_active = true
          WHERE cdt.clinic_id = ${clinicId}
          ORDER BY cdt.id ASC
          LIMIT ${limit} OFFSET ${offset}
        `,
        sql`
          SELECT COUNT(*) as total
          FROM clinic_daily_targets cdt
          WHERE cdt.clinic_id = ${clinicId}
        `
      ])
      const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
      return {
        targets: Array.isArray(targets) ? targets : [],
        total: Number((countResult as any)?.total || 0),
        page,
        limit,
      }
    } else {
      const [targets, countResultRaw] = await Promise.all([
        sql`
          SELECT 
            cdt.*,
            c.name as clinic_name,
            mp.name as poly_name,
            s.name as source_name,
            mit.name as insurance_type_name,
            COALESCE(ctc.base_rate, 0) as base_rate
          FROM clinic_daily_targets cdt
          JOIN clinics c ON c.id = cdt.clinic_id
          JOIN master_polies mp ON mp.id = cdt.master_poly_id
          JOIN sources s ON s.id = cdt.source_id
          LEFT JOIN master_insurance_types mit ON mit.id = cdt.insurance_type_id
          LEFT JOIN clinic_target_configs ctc ON ctc.clinic_id = cdt.clinic_id
            AND ctc.master_poly_id = cdt.master_poly_id
            AND ctc.target_year = COALESCE(EXTRACT(YEAR FROM cdt.target_date), cdt.target_year)
            AND ctc.is_active = true
          ORDER BY cdt.id ASC
          LIMIT ${limit} OFFSET ${offset}
        `,
        sql`
          SELECT COUNT(*) as total FROM clinic_daily_targets
        `
      ])
      const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
      return {
        targets: Array.isArray(targets) ? targets : [],
        total: Number((countResult as any)?.total || 0),
        page,
        limit,
      }
    }
  } catch (error) {
    console.error('Error fetching daily targets:', error)
    return {
      targets: [],
      total: 0,
      page,
      limit,
    }
  }
})

export const getUsersPaginated = cache(async (page: number = 1, limit: number = 10) => {
  try {
    const offset = (page - 1) * limit
    
    // Parallel fetching untuk performa maksimal
    const [users, countResultRaw] = await Promise.all([
      sql`
        SELECT 
          u.*,
          c.name as clinic_name
        FROM users u
        LEFT JOIN clinics c ON c.id = u.clinic_id
        ORDER BY u.id ASC
        LIMIT ${limit} OFFSET ${offset}
      `,
      sql`
        SELECT COUNT(*) as total FROM users
      `
    ])
    const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
    
    return {
      users: Array.isArray(users) ? users : [],
      total: Number((countResult as any)?.total || 0),
      page,
      limit,
    }
  } catch (error) {
    console.error('Error fetching users:', error)
    return {
      users: [],
      total: 0,
      page,
      limit,
    }
  }
})

export const getSystemLogsPaginated = cache(async (
  clinicId?: number,
  processType?: string,
  status?: string,
  startDate?: string,
  endDate?: string,
  search?: string,
  page: number = 1,
  limit: number = 10
) => {
  try {
    const offset = (page - 1) * limit
    
    // Normalize dates - hanya gunakan jika bukan empty string
    const validStartDate = startDate && startDate.trim() !== '' ? startDate : undefined
    const validEndDate = endDate && endDate.trim() !== '' ? endDate : undefined
    const validSearch = search && search.trim() !== '' ? search : undefined

    // Parallel fetching untuk performa maksimal
    const [logs, countResultRaw] = await Promise.all([
      sql`
        SELECT 
          sl.*,
          c.name as clinic_name
        FROM system_logs sl
        LEFT JOIN clinics c ON c.id = sl.clinic_id
        WHERE
          (${!clinicId} OR sl.clinic_id = ${clinicId})
          AND (${!processType} OR sl.process_type = ${processType})
          AND (${!status} OR sl.status = ${status})
          AND (${!validStartDate} OR sl.created_at::date >= ${validStartDate})
          AND (${!validEndDate} OR sl.created_at::date <= ${validEndDate})
          AND (
            ${!validSearch}
            OR sl.message ILIKE ${validSearch ? `%${validSearch}%` : null}
            OR sl.process_type ILIKE ${validSearch ? `%${validSearch}%` : null}
            OR sl.status ILIKE ${validSearch ? `%${validSearch}%` : null}
            OR (sl.payload IS NOT NULL AND sl.payload::text ILIKE ${validSearch ? `%${validSearch}%` : null})
          )
        ORDER BY sl.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `,
      sql`
        SELECT COUNT(*) as total
        FROM system_logs sl
        LEFT JOIN clinics c ON c.id = sl.clinic_id
        WHERE
          (${!clinicId} OR sl.clinic_id = ${clinicId})
          AND (${!processType} OR sl.process_type = ${processType})
          AND (${!status} OR sl.status = ${status})
          AND (${!validStartDate} OR sl.created_at::date >= ${validStartDate})
          AND (${!validEndDate} OR sl.created_at::date <= ${validEndDate})
          AND (
            ${!validSearch}
            OR sl.message ILIKE ${validSearch ? `%${validSearch}%` : null}
            OR sl.process_type ILIKE ${validSearch ? `%${validSearch}%` : null}
            OR sl.status ILIKE ${validSearch ? `%${validSearch}%` : null}
            OR (sl.payload IS NOT NULL AND sl.payload::text ILIKE ${validSearch ? `%${validSearch}%` : null})
          )
      `
    ])

    const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw

    return {
      logs: Array.isArray(logs) ? logs : [],
      total: Number((countResult as any)?.total || 0),
      page,
      limit,
    }
  } catch (error) {
    console.error('Error fetching system logs:', error)
    return {
      logs: [],
      total: 0,
      page,
      limit,
    }
  }
})
