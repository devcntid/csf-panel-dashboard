'use server'

import { sql } from '@/lib/db'
import { cache } from 'react'

export interface SystemLogsFilter {
  search?: string
  clinicId?: number
  status?: string
  processType?: string
  startDate?: string
  endDate?: string
  page?: number
  limit?: number
}

export const getSystemLogsPaginated = cache(async ({
  search,
  clinicId,
  status,
  processType,
  startDate,
  endDate,
  page = 1,
  limit = 10,
}: SystemLogsFilter) => {
  try {
    const offset = (page - 1) * limit

    // Build query dengan conditional blocks untuk menghindari nested sql template literals
    let logs: any
    let countResultRaw: any

    if (clinicId && status && processType && search && startDate && endDate) {
      const searchPattern = `%${search}%`
      logs = await sql`
        SELECT 
          sl.*,
          c.name as clinic_name
        FROM system_logs sl
        LEFT JOIN clinics c ON c.id = sl.clinic_id
        WHERE sl.clinic_id = ${clinicId}
          AND sl.status = ${status}
          AND sl.process_type = ${processType}
          AND (
            sl.process_type ILIKE ${searchPattern} OR
            sl.status ILIKE ${searchPattern} OR
            sl.message ILIKE ${searchPattern}
          )
          AND sl.created_at::date BETWEEN ${startDate} AND ${endDate}
        ORDER BY sl.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `
      countResultRaw = await sql`
        SELECT COUNT(*) as total
        FROM system_logs sl
        WHERE sl.clinic_id = ${clinicId}
          AND sl.status = ${status}
          AND sl.process_type = ${processType}
          AND (
            sl.process_type ILIKE ${searchPattern} OR
            sl.status ILIKE ${searchPattern} OR
            sl.message ILIKE ${searchPattern}
          )
          AND sl.created_at::date BETWEEN ${startDate} AND ${endDate}
      `
    } else if (clinicId && status && processType && search) {
      const searchPattern = `%${search}%`
      logs = await sql`
        SELECT 
          sl.*,
          c.name as clinic_name
        FROM system_logs sl
        LEFT JOIN clinics c ON c.id = sl.clinic_id
        WHERE sl.clinic_id = ${clinicId}
          AND sl.status = ${status}
          AND sl.process_type = ${processType}
          AND (
            sl.process_type ILIKE ${searchPattern} OR
            sl.status ILIKE ${searchPattern} OR
            sl.message ILIKE ${searchPattern}
          )
        ORDER BY sl.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `
      countResultRaw = await sql`
        SELECT COUNT(*) as total
        FROM system_logs sl
        WHERE sl.clinic_id = ${clinicId}
          AND sl.status = ${status}
          AND sl.process_type = ${processType}
          AND (
            sl.process_type ILIKE ${searchPattern} OR
            sl.status ILIKE ${searchPattern} OR
            sl.message ILIKE ${searchPattern}
          )
      `
    } else if (clinicId && status && processType && startDate && endDate) {
      logs = await sql`
        SELECT 
          sl.*,
          c.name as clinic_name
        FROM system_logs sl
        LEFT JOIN clinics c ON c.id = sl.clinic_id
        WHERE sl.clinic_id = ${clinicId}
          AND sl.status = ${status}
          AND sl.process_type = ${processType}
          AND sl.created_at::date BETWEEN ${startDate} AND ${endDate}
        ORDER BY sl.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `
      countResultRaw = await sql`
        SELECT COUNT(*) as total
        FROM system_logs sl
        WHERE sl.clinic_id = ${clinicId}
          AND sl.status = ${status}
          AND sl.process_type = ${processType}
          AND sl.created_at::date BETWEEN ${startDate} AND ${endDate}
      `
    } else if (clinicId && status && processType) {
      logs = await sql`
        SELECT 
          sl.*,
          c.name as clinic_name
        FROM system_logs sl
        LEFT JOIN clinics c ON c.id = sl.clinic_id
        WHERE sl.clinic_id = ${clinicId}
          AND sl.status = ${status}
          AND sl.process_type = ${processType}
        ORDER BY sl.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `
      countResultRaw = await sql`
        SELECT COUNT(*) as total
        FROM system_logs sl
        WHERE sl.clinic_id = ${clinicId}
          AND sl.status = ${status}
          AND sl.process_type = ${processType}
      `
    } else if (clinicId && status && search) {
      const searchPattern = `%${search}%`
      logs = await sql`
        SELECT 
          sl.*,
          c.name as clinic_name
        FROM system_logs sl
        LEFT JOIN clinics c ON c.id = sl.clinic_id
        WHERE sl.clinic_id = ${clinicId}
          AND sl.status = ${status}
          AND (
            sl.process_type ILIKE ${searchPattern} OR
            sl.status ILIKE ${searchPattern} OR
            sl.message ILIKE ${searchPattern}
          )
        ORDER BY sl.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `
      countResultRaw = await sql`
        SELECT COUNT(*) as total
        FROM system_logs sl
        WHERE sl.clinic_id = ${clinicId}
          AND sl.status = ${status}
          AND (
            sl.process_type ILIKE ${searchPattern} OR
            sl.status ILIKE ${searchPattern} OR
            sl.message ILIKE ${searchPattern}
          )
      `
    } else if (clinicId && status && startDate && endDate) {
      logs = await sql`
        SELECT 
          sl.*,
          c.name as clinic_name
        FROM system_logs sl
        LEFT JOIN clinics c ON c.id = sl.clinic_id
        WHERE sl.clinic_id = ${clinicId}
          AND sl.status = ${status}
          AND sl.created_at::date BETWEEN ${startDate} AND ${endDate}
        ORDER BY sl.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `
      countResultRaw = await sql`
        SELECT COUNT(*) as total
        FROM system_logs sl
        WHERE sl.clinic_id = ${clinicId}
          AND sl.status = ${status}
          AND sl.created_at::date BETWEEN ${startDate} AND ${endDate}
      `
    } else if (clinicId && status) {
      logs = await sql`
        SELECT 
          sl.*,
          c.name as clinic_name
        FROM system_logs sl
        LEFT JOIN clinics c ON c.id = sl.clinic_id
        WHERE sl.clinic_id = ${clinicId}
          AND sl.status = ${status}
        ORDER BY sl.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `
      countResultRaw = await sql`
        SELECT COUNT(*) as total
        FROM system_logs sl
        WHERE sl.clinic_id = ${clinicId}
          AND sl.status = ${status}
      `
    } else if (clinicId && processType && search) {
      const searchPattern = `%${search}%`
      logs = await sql`
        SELECT 
          sl.*,
          c.name as clinic_name
        FROM system_logs sl
        LEFT JOIN clinics c ON c.id = sl.clinic_id
        WHERE sl.clinic_id = ${clinicId}
          AND sl.process_type = ${processType}
          AND (
            sl.process_type ILIKE ${searchPattern} OR
            sl.status ILIKE ${searchPattern} OR
            sl.message ILIKE ${searchPattern}
          )
        ORDER BY sl.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `
      countResultRaw = await sql`
        SELECT COUNT(*) as total
        FROM system_logs sl
        WHERE sl.clinic_id = ${clinicId}
          AND sl.process_type = ${processType}
          AND (
            sl.process_type ILIKE ${searchPattern} OR
            sl.status ILIKE ${searchPattern} OR
            sl.message ILIKE ${searchPattern}
          )
      `
    } else if (clinicId && processType && startDate && endDate) {
      logs = await sql`
        SELECT 
          sl.*,
          c.name as clinic_name
        FROM system_logs sl
        LEFT JOIN clinics c ON c.id = sl.clinic_id
        WHERE sl.clinic_id = ${clinicId}
          AND sl.process_type = ${processType}
          AND sl.created_at::date BETWEEN ${startDate} AND ${endDate}
        ORDER BY sl.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `
      countResultRaw = await sql`
        SELECT COUNT(*) as total
        FROM system_logs sl
        WHERE sl.clinic_id = ${clinicId}
          AND sl.process_type = ${processType}
          AND sl.created_at::date BETWEEN ${startDate} AND ${endDate}
      `
    } else if (clinicId && processType) {
      logs = await sql`
        SELECT 
          sl.*,
          c.name as clinic_name
        FROM system_logs sl
        LEFT JOIN clinics c ON c.id = sl.clinic_id
        WHERE sl.clinic_id = ${clinicId}
          AND sl.process_type = ${processType}
        ORDER BY sl.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `
      countResultRaw = await sql`
        SELECT COUNT(*) as total
        FROM system_logs sl
        WHERE sl.clinic_id = ${clinicId}
          AND sl.process_type = ${processType}
      `
    } else if (clinicId && search && startDate && endDate) {
      const searchPattern = `%${search}%`
      logs = await sql`
        SELECT 
          sl.*,
          c.name as clinic_name
        FROM system_logs sl
        LEFT JOIN clinics c ON c.id = sl.clinic_id
        WHERE sl.clinic_id = ${clinicId}
          AND (
            sl.process_type ILIKE ${searchPattern} OR
            sl.status ILIKE ${searchPattern} OR
            sl.message ILIKE ${searchPattern}
          )
          AND sl.created_at::date BETWEEN ${startDate} AND ${endDate}
        ORDER BY sl.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `
      countResultRaw = await sql`
        SELECT COUNT(*) as total
        FROM system_logs sl
        WHERE sl.clinic_id = ${clinicId}
          AND (
            sl.process_type ILIKE ${searchPattern} OR
            sl.status ILIKE ${searchPattern} OR
            sl.message ILIKE ${searchPattern}
          )
          AND sl.created_at::date BETWEEN ${startDate} AND ${endDate}
      `
    } else if (clinicId && search) {
      const searchPattern = `%${search}%`
      logs = await sql`
        SELECT 
          sl.*,
          c.name as clinic_name
        FROM system_logs sl
        LEFT JOIN clinics c ON c.id = sl.clinic_id
        WHERE sl.clinic_id = ${clinicId}
          AND (
            sl.process_type ILIKE ${searchPattern} OR
            sl.status ILIKE ${searchPattern} OR
            sl.message ILIKE ${searchPattern}
          )
        ORDER BY sl.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `
      countResultRaw = await sql`
        SELECT COUNT(*) as total
        FROM system_logs sl
        WHERE sl.clinic_id = ${clinicId}
          AND (
            sl.process_type ILIKE ${searchPattern} OR
            sl.status ILIKE ${searchPattern} OR
            sl.message ILIKE ${searchPattern}
          )
      `
    } else if (clinicId && startDate && endDate) {
      logs = await sql`
        SELECT 
          sl.*,
          c.name as clinic_name
        FROM system_logs sl
        LEFT JOIN clinics c ON c.id = sl.clinic_id
        WHERE sl.clinic_id = ${clinicId}
          AND sl.created_at::date BETWEEN ${startDate} AND ${endDate}
        ORDER BY sl.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `
      countResultRaw = await sql`
        SELECT COUNT(*) as total
        FROM system_logs sl
        WHERE sl.clinic_id = ${clinicId}
          AND sl.created_at::date BETWEEN ${startDate} AND ${endDate}
      `
    } else if (clinicId) {
      logs = await sql`
        SELECT 
          sl.*,
          c.name as clinic_name
        FROM system_logs sl
        LEFT JOIN clinics c ON c.id = sl.clinic_id
        WHERE sl.clinic_id = ${clinicId}
        ORDER BY sl.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `
      countResultRaw = await sql`
        SELECT COUNT(*) as total
        FROM system_logs sl
        WHERE sl.clinic_id = ${clinicId}
      `
    } else if (status && processType && search && startDate && endDate) {
      const searchPattern = `%${search}%`
      logs = await sql`
        SELECT 
          sl.*,
          c.name as clinic_name
        FROM system_logs sl
        LEFT JOIN clinics c ON c.id = sl.clinic_id
        WHERE sl.status = ${status}
          AND sl.process_type = ${processType}
          AND (
            sl.process_type ILIKE ${searchPattern} OR
            sl.status ILIKE ${searchPattern} OR
            sl.message ILIKE ${searchPattern}
          )
          AND sl.created_at::date BETWEEN ${startDate} AND ${endDate}
        ORDER BY sl.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `
      countResultRaw = await sql`
        SELECT COUNT(*) as total
        FROM system_logs sl
        WHERE sl.status = ${status}
          AND sl.process_type = ${processType}
          AND (
            sl.process_type ILIKE ${searchPattern} OR
            sl.status ILIKE ${searchPattern} OR
            sl.message ILIKE ${searchPattern}
          )
          AND sl.created_at::date BETWEEN ${startDate} AND ${endDate}
      `
    } else if (status && processType && search) {
      const searchPattern = `%${search}%`
      logs = await sql`
        SELECT 
          sl.*,
          c.name as clinic_name
        FROM system_logs sl
        LEFT JOIN clinics c ON c.id = sl.clinic_id
        WHERE sl.status = ${status}
          AND sl.process_type = ${processType}
          AND (
            sl.process_type ILIKE ${searchPattern} OR
            sl.status ILIKE ${searchPattern} OR
            sl.message ILIKE ${searchPattern}
          )
        ORDER BY sl.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `
      countResultRaw = await sql`
        SELECT COUNT(*) as total
        FROM system_logs sl
        WHERE sl.status = ${status}
          AND sl.process_type = ${processType}
          AND (
            sl.process_type ILIKE ${searchPattern} OR
            sl.status ILIKE ${searchPattern} OR
            sl.message ILIKE ${searchPattern}
          )
      `
    } else if (status && processType && startDate && endDate) {
      logs = await sql`
        SELECT 
          sl.*,
          c.name as clinic_name
        FROM system_logs sl
        LEFT JOIN clinics c ON c.id = sl.clinic_id
        WHERE sl.status = ${status}
          AND sl.process_type = ${processType}
          AND sl.created_at::date BETWEEN ${startDate} AND ${endDate}
        ORDER BY sl.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `
      countResultRaw = await sql`
        SELECT COUNT(*) as total
        FROM system_logs sl
        WHERE sl.status = ${status}
          AND sl.process_type = ${processType}
          AND sl.created_at::date BETWEEN ${startDate} AND ${endDate}
      `
    } else if (status && processType) {
      logs = await sql`
        SELECT 
          sl.*,
          c.name as clinic_name
        FROM system_logs sl
        LEFT JOIN clinics c ON c.id = sl.clinic_id
        WHERE sl.status = ${status}
          AND sl.process_type = ${processType}
        ORDER BY sl.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `
      countResultRaw = await sql`
        SELECT COUNT(*) as total
        FROM system_logs sl
        WHERE sl.status = ${status}
          AND sl.process_type = ${processType}
      `
    } else if (status && search && startDate && endDate) {
      const searchPattern = `%${search}%`
      logs = await sql`
        SELECT 
          sl.*,
          c.name as clinic_name
        FROM system_logs sl
        LEFT JOIN clinics c ON c.id = sl.clinic_id
        WHERE sl.status = ${status}
          AND (
            sl.process_type ILIKE ${searchPattern} OR
            sl.status ILIKE ${searchPattern} OR
            sl.message ILIKE ${searchPattern}
          )
          AND sl.created_at::date BETWEEN ${startDate} AND ${endDate}
        ORDER BY sl.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `
      countResultRaw = await sql`
        SELECT COUNT(*) as total
        FROM system_logs sl
        WHERE sl.status = ${status}
          AND (
            sl.process_type ILIKE ${searchPattern} OR
            sl.status ILIKE ${searchPattern} OR
            sl.message ILIKE ${searchPattern}
          )
          AND sl.created_at::date BETWEEN ${startDate} AND ${endDate}
      `
    } else if (status && search) {
      const searchPattern = `%${search}%`
      logs = await sql`
        SELECT 
          sl.*,
          c.name as clinic_name
        FROM system_logs sl
        LEFT JOIN clinics c ON c.id = sl.clinic_id
        WHERE sl.status = ${status}
          AND (
            sl.process_type ILIKE ${searchPattern} OR
            sl.status ILIKE ${searchPattern} OR
            sl.message ILIKE ${searchPattern}
          )
        ORDER BY sl.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `
      countResultRaw = await sql`
        SELECT COUNT(*) as total
        FROM system_logs sl
        WHERE sl.status = ${status}
          AND (
            sl.process_type ILIKE ${searchPattern} OR
            sl.status ILIKE ${searchPattern} OR
            sl.message ILIKE ${searchPattern}
          )
      `
    } else if (status && startDate && endDate) {
      logs = await sql`
        SELECT 
          sl.*,
          c.name as clinic_name
        FROM system_logs sl
        LEFT JOIN clinics c ON c.id = sl.clinic_id
        WHERE sl.status = ${status}
          AND sl.created_at::date BETWEEN ${startDate} AND ${endDate}
        ORDER BY sl.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `
      countResultRaw = await sql`
        SELECT COUNT(*) as total
        FROM system_logs sl
        WHERE sl.status = ${status}
          AND sl.created_at::date BETWEEN ${startDate} AND ${endDate}
      `
    } else if (status) {
      logs = await sql`
        SELECT 
          sl.*,
          c.name as clinic_name
        FROM system_logs sl
        LEFT JOIN clinics c ON c.id = sl.clinic_id
        WHERE sl.status = ${status}
        ORDER BY sl.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `
      countResultRaw = await sql`
        SELECT COUNT(*) as total
        FROM system_logs sl
        WHERE sl.status = ${status}
      `
    } else if (processType && search && startDate && endDate) {
      const searchPattern = `%${search}%`
      logs = await sql`
        SELECT 
          sl.*,
          c.name as clinic_name
        FROM system_logs sl
        LEFT JOIN clinics c ON c.id = sl.clinic_id
        WHERE sl.process_type = ${processType}
          AND (
            sl.process_type ILIKE ${searchPattern} OR
            sl.status ILIKE ${searchPattern} OR
            sl.message ILIKE ${searchPattern}
          )
          AND sl.created_at::date BETWEEN ${startDate} AND ${endDate}
        ORDER BY sl.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `
      countResultRaw = await sql`
        SELECT COUNT(*) as total
        FROM system_logs sl
        WHERE sl.process_type = ${processType}
          AND (
            sl.process_type ILIKE ${searchPattern} OR
            sl.status ILIKE ${searchPattern} OR
            sl.message ILIKE ${searchPattern}
          )
          AND sl.created_at::date BETWEEN ${startDate} AND ${endDate}
      `
    } else if (processType && search) {
      const searchPattern = `%${search}%`
      logs = await sql`
        SELECT 
          sl.*,
          c.name as clinic_name
        FROM system_logs sl
        LEFT JOIN clinics c ON c.id = sl.clinic_id
        WHERE sl.process_type = ${processType}
          AND (
            sl.process_type ILIKE ${searchPattern} OR
            sl.status ILIKE ${searchPattern} OR
            sl.message ILIKE ${searchPattern}
          )
        ORDER BY sl.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `
      countResultRaw = await sql`
        SELECT COUNT(*) as total
        FROM system_logs sl
        WHERE sl.process_type = ${processType}
          AND (
            sl.process_type ILIKE ${searchPattern} OR
            sl.status ILIKE ${searchPattern} OR
            sl.message ILIKE ${searchPattern}
          )
      `
    } else if (processType && startDate && endDate) {
      logs = await sql`
        SELECT 
          sl.*,
          c.name as clinic_name
        FROM system_logs sl
        LEFT JOIN clinics c ON c.id = sl.clinic_id
        WHERE sl.process_type = ${processType}
          AND sl.created_at::date BETWEEN ${startDate} AND ${endDate}
        ORDER BY sl.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `
      countResultRaw = await sql`
        SELECT COUNT(*) as total
        FROM system_logs sl
        WHERE sl.process_type = ${processType}
          AND sl.created_at::date BETWEEN ${startDate} AND ${endDate}
      `
    } else if (processType) {
      logs = await sql`
        SELECT 
          sl.*,
          c.name as clinic_name
        FROM system_logs sl
        LEFT JOIN clinics c ON c.id = sl.clinic_id
        WHERE sl.process_type = ${processType}
        ORDER BY sl.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `
      countResultRaw = await sql`
        SELECT COUNT(*) as total
        FROM system_logs sl
        WHERE sl.process_type = ${processType}
      `
    } else if (search && startDate && endDate) {
      const searchPattern = `%${search}%`
      logs = await sql`
        SELECT 
          sl.*,
          c.name as clinic_name
        FROM system_logs sl
        LEFT JOIN clinics c ON c.id = sl.clinic_id
        WHERE (
          sl.process_type ILIKE ${searchPattern} OR
          sl.status ILIKE ${searchPattern} OR
          sl.message ILIKE ${searchPattern}
        )
          AND sl.created_at::date BETWEEN ${startDate} AND ${endDate}
        ORDER BY sl.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `
      countResultRaw = await sql`
        SELECT COUNT(*) as total
        FROM system_logs sl
        WHERE (
          sl.process_type ILIKE ${searchPattern} OR
          sl.status ILIKE ${searchPattern} OR
          sl.message ILIKE ${searchPattern}
        )
          AND sl.created_at::date BETWEEN ${startDate} AND ${endDate}
      `
    } else if (search) {
      const searchPattern = `%${search}%`
      logs = await sql`
        SELECT 
          sl.*,
          c.name as clinic_name
        FROM system_logs sl
        LEFT JOIN clinics c ON c.id = sl.clinic_id
        WHERE (
          sl.process_type ILIKE ${searchPattern} OR
          sl.status ILIKE ${searchPattern} OR
          sl.message ILIKE ${searchPattern}
        )
        ORDER BY sl.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `
      countResultRaw = await sql`
        SELECT COUNT(*) as total
        FROM system_logs sl
        WHERE (
          sl.process_type ILIKE ${searchPattern} OR
          sl.status ILIKE ${searchPattern} OR
          sl.message ILIKE ${searchPattern}
        )
      `
    } else if (startDate && endDate) {
      logs = await sql`
        SELECT 
          sl.*,
          c.name as clinic_name
        FROM system_logs sl
        LEFT JOIN clinics c ON c.id = sl.clinic_id
        WHERE sl.created_at::date BETWEEN ${startDate} AND ${endDate}
        ORDER BY sl.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `
      countResultRaw = await sql`
        SELECT COUNT(*) as total
        FROM system_logs sl
        WHERE sl.created_at::date BETWEEN ${startDate} AND ${endDate}
      `
    } else {
      // No filters - get all logs
      logs = await sql`
        SELECT 
          sl.*,
          c.name as clinic_name
        FROM system_logs sl
        LEFT JOIN clinics c ON c.id = sl.clinic_id
        ORDER BY sl.created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `
      countResultRaw = await sql`
        SELECT COUNT(*) as total
        FROM system_logs sl
      `
    }

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
