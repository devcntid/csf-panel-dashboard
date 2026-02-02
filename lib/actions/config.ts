'use server'

import { sql } from '@/lib/db'
import { cache } from 'react'

export const getPolyMappings = cache(async () => {
  try {
    const mappings = await sql`
      SELECT 
        cpm.*,
        c.name as clinic_name,
        mp.name as master_poly_name
      FROM clinic_poly_mappings cpm
      JOIN clinics c ON c.id = cpm.clinic_id
      LEFT JOIN master_polies mp ON mp.id = cpm.master_poly_id
      ORDER BY c.name, cpm.raw_poly_name
    `
    return Array.isArray(mappings) ? mappings : []
  } catch (error) {
    console.error('Error fetching poly mappings:', error)
    return []
  }
})

export const getMasterPolies = cache(async () => {
  try {
    const polies = await sql`
      SELECT * FROM master_polies
      ORDER BY name
    `
    return Array.isArray(polies) ? polies : []
  } catch (error) {
    console.error('Error fetching master polies:', error)
    return []
  }
})

export const getMasterInsuranceTypes = cache(async () => {
  try {
    const insuranceTypes = await sql`
      SELECT * FROM master_insurance_types
      ORDER BY name
    `
    return Array.isArray(insuranceTypes) ? insuranceTypes : []
  } catch (error) {
    console.error('Error fetching master insurance types:', error)
    return []
  }
})

export const getUsers = cache(async () => {
  try {
    const users = await sql`
      SELECT 
        u.*,
        c.name as clinic_name
      FROM users u
      LEFT JOIN clinics c ON c.id = u.clinic_id
      ORDER BY u.created_at DESC
    `
    return Array.isArray(users) ? users : []
  } catch (error) {
    console.error('Error fetching users:', error)
    return []
  }
})

export const getAllClinics = cache(async () => {
  try {
    const clinics = await sql`
      SELECT id, name FROM clinics
      WHERE is_active = true
      ORDER BY name
    `
    return Array.isArray(clinics) ? clinics : []
  } catch (error) {
    console.error('Error fetching clinics:', error)
    return []
  }
})

export const getSources = cache(async () => {
  try {
    const sources = await sql`
      SELECT id, name FROM sources
      ORDER BY name
    `
    return Array.isArray(sources) ? sources : []
  } catch (error) {
    console.error('Error fetching sources:', error)
    return []
  }
})
