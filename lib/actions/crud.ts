'use server'

import { sql } from '@/lib/db'
import { revalidatePath } from 'next/cache'

// ============ CRUD KLINIK ============

export async function createClinic(data: {
  name: string
  location?: string
  login_url?: string
  username: string
  password_encrypted: string
  kode_coa?: string
  id_kantor_zains?: string
  coa_qris?: string
  id_rekening?: string
  summary_alias?: string
  summary_order?: number
  include_in_se_summary?: boolean
  se_receipt_coa_debet?: string
  se_receipt_coa_kredit?: string
}) {
  try {
    const result = await sql`
      INSERT INTO clinics (
        name, 
        location, 
        login_url, 
        username, 
        password_encrypted, 
        kode_coa, 
        id_kantor_zains, 
        coa_qris, 
        id_rekening,
        summary_alias,
        summary_order,
        include_in_se_summary,
        se_receipt_coa_debet,
        se_receipt_coa_kredit
      )
      VALUES (
        ${data.name},
        ${data.location || null},
        ${data.login_url || 'https://csf.eclinic.id/login'},
        ${data.username},
        ${data.password_encrypted},
        ${data.kode_coa || null},
        ${data.id_kantor_zains || null},
        ${data.coa_qris || null},
        ${data.id_rekening || null},
        ${data.summary_alias || null},
        ${data.summary_order ?? null},
        ${data.include_in_se_summary ?? true},
        ${data.se_receipt_coa_debet || null},
        ${data.se_receipt_coa_kredit || null}
      )
      RETURNING *
    `
    const clinic = Array.isArray(result) ? result[0] : result
    revalidatePath('/dashboard/konfigurasi')
    return { success: true, data: clinic }
  } catch (error: any) {
    console.error('Error creating clinic:', error)
    return { success: false, error: error.message }
  }
}

export async function updateClinic(id: number, data: {
  name?: string
  location?: string
  login_url?: string
  username?: string
  password_encrypted?: string
  kode_coa?: string
  id_kantor_zains?: string
  coa_qris?: string
  id_rekening?: string
  is_active?: boolean
  summary_alias?: string
  summary_order?: number | null
  include_in_se_summary?: boolean
  se_receipt_coa_debet?: string | null
  se_receipt_coa_kredit?: string | null
}) {
  try {
    if (data.name !== undefined) {
      await sql`UPDATE clinics SET name = ${data.name}, updated_at = NOW() WHERE id = ${id}`
    }
    if (data.location !== undefined) {
      await sql`UPDATE clinics SET location = ${data.location}, updated_at = NOW() WHERE id = ${id}`
    }
    if (data.login_url !== undefined) {
      await sql`UPDATE clinics SET login_url = ${data.login_url}, updated_at = NOW() WHERE id = ${id}`
    }
    if (data.username !== undefined) {
      await sql`UPDATE clinics SET username = ${data.username}, updated_at = NOW() WHERE id = ${id}`
    }
    if (data.password_encrypted !== undefined && data.password_encrypted) {
      await sql`UPDATE clinics SET password_encrypted = ${data.password_encrypted}, updated_at = NOW() WHERE id = ${id}`
    }
    if (data.kode_coa !== undefined) {
      await sql`UPDATE clinics SET kode_coa = ${data.kode_coa}, updated_at = NOW() WHERE id = ${id}`
    }
    if (data.id_kantor_zains !== undefined) {
      await sql`UPDATE clinics SET id_kantor_zains = ${data.id_kantor_zains}, updated_at = NOW() WHERE id = ${id}`
    }
    if (data.coa_qris !== undefined) {
      await sql`UPDATE clinics SET coa_qris = ${data.coa_qris}, updated_at = NOW() WHERE id = ${id}`
    }
    if (data.id_rekening !== undefined) {
      await sql`UPDATE clinics SET id_rekening = ${data.id_rekening}, updated_at = NOW() WHERE id = ${id}`
    }
    if (data.is_active !== undefined) {
      await sql`UPDATE clinics SET is_active = ${data.is_active}, updated_at = NOW() WHERE id = ${id}`
    }
    if (data.summary_alias !== undefined) {
      await sql`UPDATE clinics SET summary_alias = ${data.summary_alias}, updated_at = NOW() WHERE id = ${id}`
    }
    if (data.summary_order !== undefined) {
      await sql`UPDATE clinics SET summary_order = ${data.summary_order}, updated_at = NOW() WHERE id = ${id}`
    }
    if (data.include_in_se_summary !== undefined) {
      await sql`UPDATE clinics SET include_in_se_summary = ${data.include_in_se_summary}, updated_at = NOW() WHERE id = ${id}`
    }
    if (data.se_receipt_coa_debet !== undefined) {
      await sql`UPDATE clinics SET se_receipt_coa_debet = ${data.se_receipt_coa_debet}, updated_at = NOW() WHERE id = ${id}`
    }
    if (data.se_receipt_coa_kredit !== undefined) {
      await sql`UPDATE clinics SET se_receipt_coa_kredit = ${data.se_receipt_coa_kredit}, updated_at = NOW() WHERE id = ${id}`
    }
    
    revalidatePath('/dashboard/konfigurasi')
    return { success: true }
  } catch (error: any) {
    console.error('Error updating clinic:', error)
    return { success: false, error: error.message }
  }
}

export async function deleteClinic(id: number) {
  try {
    await sql`DELETE FROM clinics WHERE id = ${id}`
    revalidatePath('/dashboard/konfigurasi')
    return { success: true }
  } catch (error: any) {
    console.error('Error deleting clinic:', error)
    return { success: false, error: error.message }
  }
}

// ============ CRUD MASTER TARGET CATEGORIES ============

export async function createTargetCategory(data: {
  name: string
  kode_coa?: string
  id_program_zains?: string
  description?: string
}) {
  try {
    const result = await sql`
      INSERT INTO master_target_categories (name, kode_coa, id_program_zains, description)
      VALUES (${data.name}, ${data.kode_coa || null}, ${data.id_program_zains || null}, ${data.description || null})
      RETURNING *
    `
    const category = Array.isArray(result) ? result[0] : result
    revalidatePath('/dashboard/konfigurasi')
    return { success: true, data: category }
  } catch (error: any) {
    console.error('Error creating target category:', error)
    return { success: false, error: error.message }
  }
}

export async function updateTargetCategory(id: number, data: {
  name?: string
  kode_coa?: string
  id_program_zains?: string
  description?: string
}) {
  try {
    if (data.name !== undefined) {
      await sql`UPDATE master_target_categories SET name = ${data.name} WHERE id = ${id}`
    }
    if (data.kode_coa !== undefined) {
      await sql`UPDATE master_target_categories SET kode_coa = ${data.kode_coa} WHERE id = ${id}`
    }
    if (data.id_program_zains !== undefined) {
      await sql`UPDATE master_target_categories SET id_program_zains = ${data.id_program_zains} WHERE id = ${id}`
    }
    if (data.description !== undefined) {
      await sql`UPDATE master_target_categories SET description = ${data.description} WHERE id = ${id}`
    }
    
    revalidatePath('/dashboard/konfigurasi')
    return { success: true }
  } catch (error: any) {
    console.error('Error updating target category:', error)
    return { success: false, error: error.message }
  }
}

export async function deleteTargetCategory(id: number) {
  try {
    await sql`DELETE FROM master_target_categories WHERE id = ${id}`
    revalidatePath('/dashboard/konfigurasi')
    return { success: true }
  } catch (error: any) {
    console.error('Error deleting target category:', error)
    return { success: false, error: error.message }
  }
}

// ============ CRUD TARGET CONFIG (Sekarang menggunakan master_poly_id) ============

export async function createTargetConfig(data: {
  clinic_id: number
  master_poly_id: number
  target_year: number
  base_rate: number
  is_active?: boolean
}) {
  try {
    const result = await sql`
      INSERT INTO clinic_target_configs (clinic_id, master_poly_id, target_year, base_rate, is_active)
      VALUES (${data.clinic_id}, ${data.master_poly_id}, ${data.target_year}, ${data.base_rate}, ${data.is_active ?? true})
      RETURNING *
    `
    const config = Array.isArray(result) ? result[0] : result
    revalidatePath('/dashboard/konfigurasi')
    return { success: true, data: config }
  } catch (error: any) {
    console.error('Error creating target config:', error)
    return { success: false, error: error.message }
  }
}

export async function updateTargetConfig(id: number, data: {
  target_year?: number
  base_rate?: number
  is_active?: boolean
}) {
  try {
    if (data.target_year !== undefined) {
      await sql`UPDATE clinic_target_configs SET target_year = ${data.target_year}, updated_at = NOW() WHERE id = ${id}`
    }
    if (data.base_rate !== undefined) {
      await sql`UPDATE clinic_target_configs SET base_rate = ${data.base_rate}, updated_at = NOW() WHERE id = ${id}`
    }
    if (data.is_active !== undefined) {
      await sql`UPDATE clinic_target_configs SET is_active = ${data.is_active}, updated_at = NOW() WHERE id = ${id}`
    }
    
    revalidatePath('/dashboard/konfigurasi')
    return { success: true }
  } catch (error: any) {
    console.error('Error updating target config:', error)
    return { success: false, error: error.message }
  }
}

export async function deleteTargetConfig(id: number) {
  try {
    await sql`DELETE FROM clinic_target_configs WHERE id = ${id}`
    revalidatePath('/dashboard/konfigurasi')
    return { success: true }
  } catch (error: any) {
    console.error('Error deleting target config:', error)
    return { success: false, error: error.message }
  }
}

// ============ CRUD DAILY TARGET (Mendukung mode harian dan kumulatif) ============

export async function createDailyTarget(data: {
  clinic_id?: number | null
  master_poly_id?: number | null
  source_id: number
  insurance_type_id?: number | null
  target_type: 'daily' | 'cumulative'
  target_date?: string | null  // Opsional, jika diisi akan sync dengan bulan/tahun
  target_month?: number | null  // Wajib (1-12)
  target_year?: number | null   // Wajib
  target_visits: number
  target_revenue: number
  tipe_donatur?: 'retail' | 'corporate' | 'community'
}) {
  try {
    // Validasi: target_month dan target_year wajib diisi
    if (!data.target_month || data.target_month < 1 || data.target_month > 12 || !data.target_year) {
      return { success: false, error: 'target_month (1-12) dan target_year wajib diisi' }
    }
    
    // Jika target_date diisi, validasi konsistensi dengan bulan dan tahun
    if (data.target_date) {
      const date = new Date(data.target_date)
      const dateMonth = date.getMonth() + 1
      const dateYear = date.getFullYear()
      
      if (dateMonth !== data.target_month || dateYear !== data.target_year) {
        return { success: false, error: 'target_date, target_month, dan target_year harus konsisten' }
      }
    }

    const result = await sql`
      INSERT INTO clinic_daily_targets (
        clinic_id, 
        master_poly_id, 
        source_id,
        insurance_type_id,
        target_type,
        target_date,
        target_month,
        target_year,
        target_visits, 
        target_revenue, 
        tipe_donatur
      )
      VALUES (
        ${data.clinic_id ?? null},
        ${data.master_poly_id ?? null},
        ${data.source_id},
        ${data.insurance_type_id ?? null},
        ${data.target_type},
        ${data.target_date || null},
        ${data.target_month},
        ${data.target_year},
        ${data.target_visits},
        ${data.target_revenue},
        ${data.tipe_donatur || null}
      )
      RETURNING *
    `
    const target = Array.isArray(result) ? result[0] : result
    revalidatePath('/dashboard/konfigurasi')
    return { success: true, data: target }
  } catch (error: any) {
    console.error('Error creating daily target:', error)
    return { success: false, error: error.message }
  }
}

export async function updateDailyTarget(id: number, data: {
  target_type?: 'daily' | 'cumulative'
  target_date?: string | null
  target_month?: number | null
  target_year?: number | null
  target_visits?: number
  target_revenue?: number
  tipe_donatur?: 'retail' | 'corporate' | 'community' | ''
  insurance_type_id?: number | null
}) {
  try {
    // Validasi: jika target_month atau target_year diupdate, pastikan valid
    if (data.target_month !== undefined && (data.target_month < 1 || data.target_month > 12)) {
      return { success: false, error: 'target_month harus antara 1-12' }
    }

    // Ambil data existing untuk kebutuhan validasi lanjut (termasuk cek duplikasi)
    const existingRaw = await sql`
      SELECT 
        id,
        clinic_id,
        master_poly_id,
        source_id,
        target_type,
        target_month,
        target_year
      FROM clinic_daily_targets 
      WHERE id = ${id}
      LIMIT 1
    `
    const existing = Array.isArray(existingRaw) ? existingRaw[0] : existingRaw

    if (!existing) {
      return { success: false, error: 'Data target harian tidak ditemukan' }
    }
    
    // Hitung nilai final yang akan dipakai setelah update
    const finalMonth = data.target_month !== undefined ? data.target_month : existing.target_month
    const finalYear = data.target_year !== undefined ? data.target_year : existing.target_year
    const finalType = data.target_type !== undefined ? data.target_type : existing.target_type
    
    // Validasi: jika target_date diisi, pastikan konsisten dengan bulan dan tahun
    if (data.target_date !== undefined && data.target_date !== null) {
      const date = new Date(data.target_date)
      const dateMonth = date.getMonth() + 1
      const dateYear = date.getFullYear()

      if (finalMonth && finalYear && (dateMonth !== finalMonth || dateYear !== finalYear)) {
        return { success: false, error: 'target_date, target_month, dan target_year harus konsisten' }
      }
    }

    // Cek duplikasi untuk target kumulatif:
    // kombinasi (clinic_id, master_poly_id, source_id, target_month, target_year) harus unik
    if (finalType === 'cumulative' && finalMonth && finalYear) {
      const duplicateRaw = await sql`
        SELECT id
        FROM clinic_daily_targets
        WHERE clinic_id = ${existing.clinic_id}
          AND master_poly_id = ${existing.master_poly_id}
          AND source_id = ${existing.source_id}
          AND target_month = ${finalMonth}
          AND target_year = ${finalYear}
          AND id <> ${id}
        LIMIT 1
      `
      const duplicate = Array.isArray(duplicateRaw) ? duplicateRaw[0] : duplicateRaw

      if (duplicate) {
        return { 
          success: false, 
          error: 'Target kumulatif untuk kombinasi Klinik, Poli, Source, Bulan, dan Tahun ini sudah ada. Silakan gunakan kombinasi lain atau edit data yang sudah ada.' 
        }
      }
    }

    // Update fields satu per satu seperti pattern di updateClinic
    if (data.target_type !== undefined) {
      await sql`UPDATE clinic_daily_targets SET target_type = ${data.target_type}, updated_at = NOW() WHERE id = ${id}`
    }
    if (data.target_date !== undefined) {
      await sql`UPDATE clinic_daily_targets SET target_date = ${data.target_date || null}, updated_at = NOW() WHERE id = ${id}`
    }
    if (data.target_month !== undefined) {
      await sql`UPDATE clinic_daily_targets SET target_month = ${data.target_month}, updated_at = NOW() WHERE id = ${id}`
    }
    if (data.target_year !== undefined) {
      await sql`UPDATE clinic_daily_targets SET target_year = ${data.target_year}, updated_at = NOW() WHERE id = ${id}`
    }
    if (data.target_visits !== undefined) {
      await sql`UPDATE clinic_daily_targets SET target_visits = ${data.target_visits}, updated_at = NOW() WHERE id = ${id}`
    }
    if (data.target_revenue !== undefined) {
      await sql`UPDATE clinic_daily_targets SET target_revenue = ${data.target_revenue}, updated_at = NOW() WHERE id = ${id}`
    }
    if (data.tipe_donatur !== undefined) {
      await sql`UPDATE clinic_daily_targets SET tipe_donatur = ${data.tipe_donatur || null}, updated_at = NOW() WHERE id = ${id}`
    }
    if (data.insurance_type_id !== undefined) {
      await sql`
        UPDATE clinic_daily_targets
        SET insurance_type_id = ${data.insurance_type_id ?? null},
            updated_at = NOW()
        WHERE id = ${id}
      `
    }
    
    revalidatePath('/dashboard/konfigurasi')
    return { success: true }
  } catch (error: any) {
    console.error('Error updating daily target:', error)
    return { success: false, error: error.message }
  }
}

export async function deleteDailyTarget(id: number) {
  try {
    await sql`DELETE FROM clinic_daily_targets WHERE id = ${id}`
    revalidatePath('/dashboard/konfigurasi')
    return { success: true }
  } catch (error: any) {
    console.error('Error deleting daily target:', error)
    return { success: false, error: error.message }
  }
}

// ============ GETTERS ============

export async function getTargetConfigByClinicPolyYear(clinicId: number, polyId: number, year: number) {
  try {
    const configRaw = await sql`
      SELECT base_rate
      FROM clinic_target_configs
      WHERE clinic_id = ${clinicId}
        AND master_poly_id = ${polyId}
        AND target_year = ${year}
        AND is_active = true
      LIMIT 1
    `
    const config = Array.isArray(configRaw) ? configRaw[0] : configRaw
    return config ? Number((config as any).base_rate || 0) : 0
  } catch (error) {
    console.error('Error fetching target config:', error)
    return 0
  }
}

// Alias untuk backward compatibility (akan dihapus nanti)
export async function getTargetConfigByClinicCategoryYear(clinicId: number, polyId: number, year: number) {
  return getTargetConfigByClinicPolyYear(clinicId, polyId, year)
}

export async function getTargetConfigs(clinicId?: number, polyId?: number, year?: number, page: number = 1, limit: number = 10) {
  try {
    const offset = (page - 1) * limit
    
    // Build query dengan kondisi dinamis - menggunakan parallel fetching
    if (clinicId && polyId && year) {
      const [configs, countResultRaw] = await Promise.all([
        sql`
          SELECT 
            ctc.*,
            c.name as clinic_name,
            mp.name as poly_name
          FROM clinic_target_configs ctc
          JOIN clinics c ON c.id = ctc.clinic_id
          JOIN master_polies mp ON mp.id = ctc.master_poly_id
          WHERE ctc.clinic_id = ${clinicId} 
            AND ctc.master_poly_id = ${polyId}
            AND ctc.target_year = ${year}
          ORDER BY c.name, ctc.target_year DESC, mp.name
          LIMIT ${limit} OFFSET ${offset}
        `,
        sql`
          SELECT COUNT(*) as total
          FROM clinic_target_configs ctc
          WHERE ctc.clinic_id = ${clinicId} 
            AND ctc.master_poly_id = ${polyId}
            AND ctc.target_year = ${year}
        `
      ])
      const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
      return {
        configs: Array.isArray(configs) ? configs : [],
        total: Number((countResult as any)?.total || 0),
        page,
        limit,
      }
    } else if (clinicId && polyId) {
      const [configs, countResultRaw] = await Promise.all([
        sql`
          SELECT 
            ctc.*,
            c.name as clinic_name,
            mp.name as poly_name
          FROM clinic_target_configs ctc
          JOIN clinics c ON c.id = ctc.clinic_id
          JOIN master_polies mp ON mp.id = ctc.master_poly_id
          WHERE ctc.clinic_id = ${clinicId} 
            AND ctc.master_poly_id = ${polyId}
          ORDER BY c.name, ctc.target_year DESC, mp.name
          LIMIT ${limit} OFFSET ${offset}
        `,
        sql`
          SELECT COUNT(*) as total
          FROM clinic_target_configs ctc
          WHERE ctc.clinic_id = ${clinicId} 
            AND ctc.master_poly_id = ${polyId}
        `
      ])
      const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
      return {
        configs: Array.isArray(configs) ? configs : [],
        total: Number((countResult as any)?.total || 0),
        page,
        limit,
      }
    } else if (clinicId && year) {
      const [configs, countResultRaw] = await Promise.all([
        sql`
          SELECT 
            ctc.*,
            c.name as clinic_name,
            mp.name as poly_name
          FROM clinic_target_configs ctc
          JOIN clinics c ON c.id = ctc.clinic_id
          JOIN master_polies mp ON mp.id = ctc.master_poly_id
          WHERE ctc.clinic_id = ${clinicId} 
            AND ctc.target_year = ${year}
          ORDER BY c.name, ctc.target_year DESC, mp.name
          LIMIT ${limit} OFFSET ${offset}
        `,
        sql`
          SELECT COUNT(*) as total
          FROM clinic_target_configs ctc
          WHERE ctc.clinic_id = ${clinicId} 
            AND ctc.target_year = ${year}
        `
      ])
      const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
      return {
        configs: Array.isArray(configs) ? configs : [],
        total: Number((countResult as any)?.total || 0),
        page,
        limit,
      }
    } else if (polyId && year) {
      const [configs, countResultRaw] = await Promise.all([
        sql`
          SELECT 
            ctc.*,
            c.name as clinic_name,
            mp.name as poly_name
          FROM clinic_target_configs ctc
          JOIN clinics c ON c.id = ctc.clinic_id
          JOIN master_polies mp ON mp.id = ctc.master_poly_id
          WHERE ctc.master_poly_id = ${polyId}
            AND ctc.target_year = ${year}
          ORDER BY c.name, ctc.target_year DESC, mp.name
          LIMIT ${limit} OFFSET ${offset}
        `,
        sql`
          SELECT COUNT(*) as total
          FROM clinic_target_configs ctc
          WHERE ctc.master_poly_id = ${polyId}
            AND ctc.target_year = ${year}
        `
      ])
      const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
      return {
        configs: Array.isArray(configs) ? configs : [],
        total: Number((countResult as any)?.total || 0),
        page,
        limit,
      }
    } else if (clinicId) {
      const [configs, countResultRaw] = await Promise.all([
        sql`
          SELECT 
            ctc.*,
            c.name as clinic_name,
            mp.name as poly_name
          FROM clinic_target_configs ctc
          JOIN clinics c ON c.id = ctc.clinic_id
          JOIN master_polies mp ON mp.id = ctc.master_poly_id
          WHERE ctc.clinic_id = ${clinicId}
          ORDER BY c.name, ctc.target_year DESC, mp.name
          LIMIT ${limit} OFFSET ${offset}
        `,
        sql`
          SELECT COUNT(*) as total
          FROM clinic_target_configs ctc
          WHERE ctc.clinic_id = ${clinicId}
        `
      ])
      const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
      return {
        configs: Array.isArray(configs) ? configs : [],
        total: Number((countResult as any)?.total || 0),
        page,
        limit,
      }
    } else if (polyId) {
      const [configs, countResultRaw] = await Promise.all([
        sql`
          SELECT 
            ctc.*,
            c.name as clinic_name,
            mp.name as poly_name
          FROM clinic_target_configs ctc
          JOIN clinics c ON c.id = ctc.clinic_id
          JOIN master_polies mp ON mp.id = ctc.master_poly_id
          WHERE ctc.master_poly_id = ${polyId}
          ORDER BY c.name, ctc.target_year DESC, mp.name
          LIMIT ${limit} OFFSET ${offset}
        `,
        sql`
          SELECT COUNT(*) as total
          FROM clinic_target_configs ctc
          WHERE ctc.master_poly_id = ${polyId}
        `
      ])
      const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
      return {
        configs: Array.isArray(configs) ? configs : [],
        total: Number((countResult as any)?.total || 0),
        page,
        limit,
      }
    } else if (year) {
      const [configs, countResultRaw] = await Promise.all([
        sql`
          SELECT 
            ctc.*,
            c.name as clinic_name,
            mp.name as poly_name
          FROM clinic_target_configs ctc
          JOIN clinics c ON c.id = ctc.clinic_id
          JOIN master_polies mp ON mp.id = ctc.master_poly_id
          WHERE ctc.target_year = ${year}
          ORDER BY c.name, ctc.target_year DESC, mp.name
          LIMIT ${limit} OFFSET ${offset}
        `,
        sql`
          SELECT COUNT(*) as total
          FROM clinic_target_configs ctc
          WHERE ctc.target_year = ${year}
        `
      ])
      const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
      return {
        configs: Array.isArray(configs) ? configs : [],
        total: Number((countResult as any)?.total || 0),
        page,
        limit,
      }
    } else {
      // Default: Get all configs
      const [configs, countResultRaw] = await Promise.all([
        sql`
          SELECT 
            ctc.*,
            c.name as clinic_name,
            mp.name as poly_name
          FROM clinic_target_configs ctc
          JOIN clinics c ON c.id = ctc.clinic_id
          JOIN master_polies mp ON mp.id = ctc.master_poly_id
          ORDER BY c.name, ctc.target_year DESC, mp.name
          LIMIT ${limit} OFFSET ${offset}
        `,
        sql`
          SELECT COUNT(*) as total FROM clinic_target_configs
        `
      ])
      const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
      return {
        configs: Array.isArray(configs) ? configs : [],
        total: Number((countResult as any)?.total || 0),
        page,
        limit,
      }
    }
  } catch (error) {
    console.error('Error fetching target configs:', error)
    return {
      configs: [],
      total: 0,
      page,
      limit,
    }
  }
}

export async function getDailyTargets(clinicId?: number, startDate?: string, endDate?: string, sourceId?: number) {
  try {
    if (clinicId && startDate && endDate && sourceId) {
      const targets = await sql`
        SELECT 
          cdt.*,
          c.name as clinic_name,
          mp.name as poly_name,
          s.name as source_name
        FROM clinic_daily_targets cdt
        LEFT JOIN clinics c ON c.id = cdt.clinic_id
        LEFT JOIN master_polies mp ON mp.id = cdt.master_poly_id
        JOIN sources s ON s.id = cdt.source_id
        WHERE cdt.clinic_id = ${clinicId} 
          AND cdt.target_date >= ${startDate} 
          AND cdt.target_date <= ${endDate}
          AND cdt.source_id = ${sourceId}
        ORDER BY cdt.target_date DESC, cdt.id ASC
      `
      return targets
    } else if (clinicId && startDate && endDate) {
      const targets = await sql`
        SELECT 
          cdt.*,
          c.name as clinic_name,
          mp.name as poly_name,
          s.name as source_name
        FROM clinic_daily_targets cdt
        LEFT JOIN clinics c ON c.id = cdt.clinic_id
        LEFT JOIN master_polies mp ON mp.id = cdt.master_poly_id
        JOIN sources s ON s.id = cdt.source_id
        WHERE cdt.clinic_id = ${clinicId}
          AND cdt.target_date >= ${startDate} 
          AND cdt.target_date <= ${endDate}
        ORDER BY cdt.target_date DESC, cdt.id ASC
      `
      return targets
    } else if (clinicId) {
      const targets = await sql`
        SELECT 
          cdt.*,
          c.name as clinic_name,
          mp.name as poly_name,
          s.name as source_name
        FROM clinic_daily_targets cdt
        LEFT JOIN clinics c ON c.id = cdt.clinic_id
        LEFT JOIN master_polies mp ON mp.id = cdt.master_poly_id
        JOIN sources s ON s.id = cdt.source_id
        WHERE cdt.clinic_id = ${clinicId}
        ORDER BY cdt.target_date DESC, cdt.id ASC
      `
      return targets
    } else {
      const targets = await sql`
        SELECT 
          cdt.*,
          c.name as clinic_name,
          mp.name as poly_name,
          s.name as source_name
        FROM clinic_daily_targets cdt
        LEFT JOIN clinics c ON c.id = cdt.clinic_id
        LEFT JOIN master_polies mp ON mp.id = cdt.master_poly_id
        JOIN sources s ON s.id = cdt.source_id
        ORDER BY cdt.target_date DESC, cdt.id ASC
      `
      return targets
    }
  } catch (error) {
    console.error('Error fetching daily targets:', error)
    return []
  }
}

// ============ CRUD USERS ============

export async function createUser(data: {
  email: string
  full_name?: string
  role: string
  clinic_id?: number
}) {
  try {
    let result: any
    try {
      result = await sql`
        INSERT INTO users (email, full_name, role, clinic_id)
        VALUES (${data.email}, ${data.full_name || null}, ${data.role}, ${data.clinic_id || null})
        RETURNING *
      `
    } catch (insertError: any) {
      // Duplicate key on users.id (sequence out of sync) - e.g. setelah restore/import data
      const isPkeyConflict = insertError?.code === '23505' &&
        (insertError?.constraint === 'users_pkey' || (insertError?.table === 'users' && insertError?.detail?.includes('(id)')))
      if (isPkeyConflict) {
        await sql`
          SELECT setval(
            pg_get_serial_sequence('users', 'id'),
            COALESCE((SELECT MAX(id) FROM users), 1)
          )
        `
        result = await sql`
          INSERT INTO users (email, full_name, role, clinic_id)
          VALUES (${data.email}, ${data.full_name || null}, ${data.role}, ${data.clinic_id || null})
          RETURNING *
        `
      } else {
        throw insertError
      }
    }
    const user = Array.isArray(result) ? result[0] : result
    revalidatePath('/dashboard/konfigurasi')
    return { success: true, data: user }
  } catch (error: any) {
    console.error('Error creating user:', error)
    return { success: false, error: error.message }
  }
}

export async function updateUser(id: number, data: {
  email?: string
  full_name?: string
  role?: string
  clinic_id?: number | null
}) {
  try {
    if (data.email !== undefined) {
      await sql`UPDATE users SET email = ${data.email} WHERE id = ${id}`
    }
    if (data.full_name !== undefined) {
      await sql`UPDATE users SET full_name = ${data.full_name} WHERE id = ${id}`
    }
    if (data.role !== undefined) {
      await sql`UPDATE users SET role = ${data.role} WHERE id = ${id}`
    }
    if (data.clinic_id !== undefined) {
      await sql`UPDATE users SET clinic_id = ${data.clinic_id} WHERE id = ${id}`
    }
    
    revalidatePath('/dashboard/konfigurasi')
    return { success: true }
  } catch (error: any) {
    console.error('Error updating user:', error)
    return { success: false, error: error.message }
  }
}

export async function deleteUser(id: number) {
  try {
    await sql`DELETE FROM users WHERE id = ${id}`
    revalidatePath('/dashboard/konfigurasi')
    return { success: true }
  } catch (error: any) {
    console.error('Error deleting user:', error)
    return { success: false, error: error.message }
  }
}

// ============ CRUD PUBLIC HOLIDAYS ============

export async function createPublicHoliday(data: {
  holiday_date: string
  year: number
  description: string
  is_national_holiday?: boolean
}) {
  try {
    const result = await sql`
      INSERT INTO public_holidays (holiday_date, year, description, is_national_holiday)
      VALUES (${data.holiday_date}, ${data.year}, ${data.description}, ${data.is_national_holiday ?? true})
      RETURNING *
    `
    const holiday = Array.isArray(result) ? result[0] : result
    revalidatePath('/dashboard/konfigurasi')
    return { success: true, data: holiday }
  } catch (error: any) {
    console.error('Error creating public holiday:', error)
    return { success: false, error: error.message }
  }
}

export async function updatePublicHoliday(id: number, data: {
  holiday_date?: string
  year?: number
  description?: string
  is_national_holiday?: boolean
}) {
  try {
    if (data.holiday_date !== undefined) {
      await sql`UPDATE public_holidays SET holiday_date = ${data.holiday_date}, updated_at = NOW() WHERE id = ${id}`
    }
    if (data.year !== undefined) {
      await sql`UPDATE public_holidays SET year = ${data.year}, updated_at = NOW() WHERE id = ${id}`
    }
    if (data.description !== undefined) {
      await sql`UPDATE public_holidays SET description = ${data.description}, updated_at = NOW() WHERE id = ${id}`
    }
    if (data.is_national_holiday !== undefined) {
      await sql`UPDATE public_holidays SET is_national_holiday = ${data.is_national_holiday}, updated_at = NOW() WHERE id = ${id}`
    }
    
    revalidatePath('/dashboard/konfigurasi')
    return { success: true }
  } catch (error: any) {
    console.error('Error updating public holiday:', error)
    return { success: false, error: error.message }
  }
}

export async function deletePublicHoliday(id: number) {
  try {
    await sql`DELETE FROM public_holidays WHERE id = ${id}`
    revalidatePath('/dashboard/konfigurasi')
    return { success: true }
  } catch (error: any) {
    console.error('Error deleting public holiday:', error)
    return { success: false, error: error.message }
  }
}

export async function getPublicHolidays(year?: number, page: number = 1, limit: number = 10) {
  try {
    const offset = (page - 1) * limit
    
    if (year) {
      const [holidays, countResultRaw] = await Promise.all([
        sql`
          SELECT *
          FROM public_holidays
          WHERE year = ${year}
          ORDER BY holiday_date ASC
          LIMIT ${limit} OFFSET ${offset}
        `,
        sql`
          SELECT COUNT(*) as total
          FROM public_holidays
          WHERE year = ${year}
        `
      ])
      const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
      return {
        holidays: Array.isArray(holidays) ? holidays : [],
        total: Number((countResult as any)?.total || 0),
        page,
        limit,
      }
    } else {
      const [holidays, countResultRaw] = await Promise.all([
        sql`
          SELECT *
          FROM public_holidays
          ORDER BY year DESC, holiday_date ASC
          LIMIT ${limit} OFFSET ${offset}
        `,
        sql`
          SELECT COUNT(*) as total FROM public_holidays
        `
      ])
      const countResult = Array.isArray(countResultRaw) ? countResultRaw[0] : countResultRaw
      return {
        holidays: Array.isArray(holidays) ? holidays : [],
        total: Number((countResult as any)?.total || 0),
        page,
        limit,
      }
    }
  } catch (error) {
    console.error('Error fetching public holidays:', error)
    return {
      holidays: [],
      total: 0,
      page,
      limit,
    }
  }
}

// ============ CRUD MASTER POLIES ============

export async function createMasterPoly(data: {
  name: string
  code?: string
  description?: string
}) {
  try {
    const result = await sql`
      INSERT INTO master_polies (name, code, description)
      VALUES (${data.name}, ${data.code || null}, ${data.description || null})
      RETURNING *
    `
    const poly = Array.isArray(result) ? result[0] : result
    revalidatePath('/dashboard/konfigurasi')
    return { success: true, data: poly }
  } catch (error: any) {
    console.error('Error creating master poly:', error)
    return { success: false, error: error.message }
  }
}

export async function updateMasterPoly(id: number, data: {
  name?: string
  code?: string
  description?: string
}) {
  try {
    if (data.name !== undefined) {
      await sql`UPDATE master_polies SET name = ${data.name} WHERE id = ${id}`
    }
    if (data.code !== undefined) {
      await sql`UPDATE master_polies SET code = ${data.code} WHERE id = ${id}`
    }
    if (data.description !== undefined) {
      await sql`UPDATE master_polies SET description = ${data.description} WHERE id = ${id}`
    }
    
    revalidatePath('/dashboard/konfigurasi')
    return { success: true }
  } catch (error: any) {
    console.error('Error updating master poly:', error)
    return { success: false, error: error.message }
  }
}

export async function deleteMasterPoly(id: number) {
  try {
    await sql`DELETE FROM master_polies WHERE id = ${id}`
    revalidatePath('/dashboard/konfigurasi')
    return { success: true }
  } catch (error: any) {
    console.error('Error deleting master poly:', error)
    return { success: false, error: error.message }
  }
}

// ============ CRUD POLY MAPPINGS ============

export async function createPolyMapping(data: {
  clinic_id: number
  raw_poly_name: string
  master_poly_id?: number | null
  is_revenue_center?: boolean
}) {
  try {
    const result = await sql`
      INSERT INTO clinic_poly_mappings (clinic_id, raw_poly_name, master_poly_id, is_revenue_center)
      VALUES (${data.clinic_id}, ${data.raw_poly_name}, ${data.master_poly_id || null}, ${data.is_revenue_center ?? true})
      ON CONFLICT (clinic_id, raw_poly_name) DO UPDATE SET
        master_poly_id = EXCLUDED.master_poly_id,
        is_revenue_center = EXCLUDED.is_revenue_center
      RETURNING *
    `
    const mapping = Array.isArray(result) ? result[0] : result
    revalidatePath('/dashboard/konfigurasi')
    return { success: true, data: mapping }
  } catch (error: any) {
    console.error('Error creating poly mapping:', error)
    return { success: false, error: error.message }
  }
}

export async function updatePolyMapping(id: number, data: {
  raw_poly_name?: string
  master_poly_id?: number | null
  is_revenue_center?: boolean
}) {
  try {
    if (data.raw_poly_name !== undefined) {
      await sql`UPDATE clinic_poly_mappings SET raw_poly_name = ${data.raw_poly_name} WHERE id = ${id}`
    }
    if (data.master_poly_id !== undefined) {
      await sql`UPDATE clinic_poly_mappings SET master_poly_id = ${data.master_poly_id} WHERE id = ${id}`
    }
    if (data.is_revenue_center !== undefined) {
      await sql`UPDATE clinic_poly_mappings SET is_revenue_center = ${data.is_revenue_center} WHERE id = ${id}`
    }
    
    revalidatePath('/dashboard/konfigurasi')
    return { success: true }
  } catch (error: any) {
    console.error('Error updating poly mapping:', error)
    return { success: false, error: error.message }
  }
}

export async function deletePolyMapping(id: number) {
  try {
    await sql`DELETE FROM clinic_poly_mappings WHERE id = ${id}`
    revalidatePath('/dashboard/konfigurasi')
    return { success: true }
  } catch (error: any) {
    console.error('Error deleting poly mapping:', error)
    return { success: false, error: error.message }
  }
}

// ============ CRUD INSURANCE TYPE MAPPINGS ============

// ============ CRUD MASTER INSURANCE TYPE ============

export async function createInsuranceType(data: {
  name: string
  code?: string
  description?: string
}) {
  try {
    const result = await sql`
      INSERT INTO master_insurance_types (name, code, description)
      VALUES (${data.name}, ${data.code || null}, ${data.description || null})
      ON CONFLICT (name) DO UPDATE SET
        code = EXCLUDED.code,
        description = EXCLUDED.description
      RETURNING *
    `
    revalidatePath('/dashboard/konfigurasi')
    return { success: true, data: result[0] }
  } catch (error: any) {
    console.error('Error creating insurance type:', error)
    return { success: false, error: error.message }
  }
}

export async function updateInsuranceType(id: number, data: {
  name?: string
  code?: string
  description?: string
}) {
  try {
    if (data.name !== undefined) {
      await sql`UPDATE master_insurance_types SET name = ${data.name} WHERE id = ${id}`
    }
    if (data.code !== undefined) {
      await sql`UPDATE master_insurance_types SET code = ${data.code} WHERE id = ${id}`
    }
    if (data.description !== undefined) {
      await sql`UPDATE master_insurance_types SET description = ${data.description} WHERE id = ${id}`
    }
    revalidatePath('/dashboard/konfigurasi')
    return { success: true }
  } catch (error: any) {
    console.error('Error updating insurance type:', error)
    return { success: false, error: error.message }
  }
}

export async function deleteInsuranceType(id: number) {
  try {
    await sql`DELETE FROM master_insurance_types WHERE id = ${id}`
    revalidatePath('/dashboard/konfigurasi')
    return { success: true }
  } catch (error: any) {
    console.error('Error deleting insurance type:', error)
    return { success: false, error: error.message }
  }
}

// ============ CRUD CLINIC BPJS REALIZATIONS (Realisasi Kapitasi BPJS) ============

export async function createBpjsRealization(data: {
  clinic_id: number
  month: number
  year: number
  total_peserta_terdaftar: number
  total_kapitasi_diterima: number
  pbi_count?: number | null
  non_pbi_count?: number | null
}) {
  try {
    const result = await sql`
      INSERT INTO clinic_bpjs_realizations (
        clinic_id, month, year,
        total_peserta_terdaftar, total_kapitasi_diterima,
        pbi_count, non_pbi_count
      )
      VALUES (
        ${data.clinic_id}, ${data.month}, ${data.year},
        ${data.total_peserta_terdaftar}, ${data.total_kapitasi_diterima},
        ${data.pbi_count ?? null}, ${data.non_pbi_count ?? null}
      )
      ON CONFLICT (clinic_id, month, year) DO UPDATE SET
        total_peserta_terdaftar = EXCLUDED.total_peserta_terdaftar,
        total_kapitasi_diterima = EXCLUDED.total_kapitasi_diterima,
        pbi_count = EXCLUDED.pbi_count,
        non_pbi_count = EXCLUDED.non_pbi_count,
        updated_at = NOW()
      RETURNING *
    `
    const row = Array.isArray(result) ? result[0] : result
    revalidatePath('/dashboard/konfigurasi')
    return { success: true, data: row }
  } catch (error: any) {
    console.error('Error creating bpjs realization:', error)
    return { success: false, error: error.message }
  }
}

export async function updateBpjsRealization(id: number, data: {
  clinic_id?: number
  month?: number
  year?: number
  total_peserta_terdaftar?: number
  total_kapitasi_diterima?: number
  pbi_count?: number | null
  non_pbi_count?: number | null
}) {
  try {
    if (data.clinic_id !== undefined) {
      await sql`UPDATE clinic_bpjs_realizations SET clinic_id = ${data.clinic_id}, updated_at = NOW() WHERE id = ${id}`
    }
    if (data.month !== undefined) {
      await sql`UPDATE clinic_bpjs_realizations SET month = ${data.month}, updated_at = NOW() WHERE id = ${id}`
    }
    if (data.year !== undefined) {
      await sql`UPDATE clinic_bpjs_realizations SET year = ${data.year}, updated_at = NOW() WHERE id = ${id}`
    }
    if (data.total_peserta_terdaftar !== undefined) {
      await sql`UPDATE clinic_bpjs_realizations SET total_peserta_terdaftar = ${data.total_peserta_terdaftar}, updated_at = NOW() WHERE id = ${id}`
    }
    if (data.total_kapitasi_diterima !== undefined) {
      await sql`UPDATE clinic_bpjs_realizations SET total_kapitasi_diterima = ${data.total_kapitasi_diterima}, updated_at = NOW() WHERE id = ${id}`
    }
    if (data.pbi_count !== undefined) {
      await sql`UPDATE clinic_bpjs_realizations SET pbi_count = ${data.pbi_count}, updated_at = NOW() WHERE id = ${id}`
    }
    if (data.non_pbi_count !== undefined) {
      await sql`UPDATE clinic_bpjs_realizations SET non_pbi_count = ${data.non_pbi_count}, updated_at = NOW() WHERE id = ${id}`
    }
    revalidatePath('/dashboard/konfigurasi')
    return { success: true }
  } catch (error: any) {
    console.error('Error updating bpjs realization:', error)
    return { success: false, error: error.message }
  }
}

export async function deleteBpjsRealization(id: number) {
  try {
    await sql`DELETE FROM clinic_bpjs_realizations WHERE id = ${id}`
    revalidatePath('/dashboard/konfigurasi')
    return { success: true }
  } catch (error: any) {
    console.error('Error deleting bpjs realization:', error)
    return { success: false, error: error.message }
  }
}

// ============ CRUD INSURANCE MAPPING ============

export async function createInsuranceMapping(data: {
  clinic_id: number
  raw_insurance_name: string
  master_insurance_id?: number | null
}) {
  try {
    const result = await sql`
      INSERT INTO clinic_insurance_mappings (clinic_id, raw_insurance_name, master_insurance_id)
      VALUES (${data.clinic_id}, ${data.raw_insurance_name}, ${data.master_insurance_id || null})
      RETURNING *
    `
    const mapping = Array.isArray(result) ? result[0] : result
    revalidatePath('/dashboard/konfigurasi')
    return { success: true, data: mapping }
  } catch (error: any) {
    console.error('Error creating insurance mapping:', error)
    return { success: false, error: error.message }
  }
}

export async function updateInsuranceMapping(id: number, data: {
  raw_insurance_name?: string
  master_insurance_id?: number | null
}) {
  try {
    if (data.raw_insurance_name !== undefined) {
      await sql`UPDATE clinic_insurance_mappings SET raw_insurance_name = ${data.raw_insurance_name} WHERE id = ${id}`
    }
    if (data.master_insurance_id !== undefined) {
      await sql`UPDATE clinic_insurance_mappings SET master_insurance_id = ${data.master_insurance_id} WHERE id = ${id}`
    }
    revalidatePath('/dashboard/konfigurasi')
    return { success: true }
  } catch (error: any) {
    console.error('Error updating insurance mapping:', error)
    return { success: false, error: error.message }
  }
}

export async function deleteInsuranceMapping(id: number) {
  try {
    await sql`DELETE FROM clinic_insurance_mappings WHERE id = ${id}`
    revalidatePath('/dashboard/konfigurasi')
    return { success: true }
  } catch (error: any) {
    console.error('Error deleting insurance mapping:', error)
    return { success: false, error: error.message }
  }
}

// ============ CRUD SOURCES ============

export async function createSource(data: {
  name: string
  slug?: string | null
  category?: string | null
  mode?: string | null
  coa_debet?: string | null
  coa_kredit?: string | null
  summary_order?: number | null
}) {
  try {
    const result = await sql`
      INSERT INTO sources (name, slug, category, mode, coa_debet, coa_kredit, summary_order)
      VALUES (
        ${data.name},
        ${data.slug || null},
        ${data.category || null},
        ${data.mode || null},
        ${data.coa_debet || null},
        ${data.coa_kredit || null},
        ${data.summary_order ?? null}
      )
      ON CONFLICT (name) DO NOTHING
      RETURNING *
    `
    const source = Array.isArray(result) ? result[0] : result
    revalidatePath('/dashboard/konfigurasi')
    return { success: true, data: source }
  } catch (error: any) {
    console.error('Error creating source:', error)
    return { success: false, error: error.message }
  }
}

export async function updateSource(id: number, data: {
  name?: string
  slug?: string | null
  category?: string | null
  mode?: string | null
  coa_debet?: string | null
  coa_kredit?: string | null
  summary_order?: number | null
}) {
  try {
    if (data.name !== undefined) {
      await sql`UPDATE sources SET name = ${data.name}, created_at = created_at WHERE id = ${id}`
    }
    if (data.slug !== undefined) {
      await sql`UPDATE sources SET slug = ${data.slug}, created_at = created_at WHERE id = ${id}`
    }
    if (data.category !== undefined) {
      await sql`UPDATE sources SET category = ${data.category}, created_at = created_at WHERE id = ${id}`
    }
    if (data.mode !== undefined) {
      await sql`UPDATE sources SET mode = ${data.mode}, created_at = created_at WHERE id = ${id}`
    }
    if (data.coa_debet !== undefined) {
      await sql`UPDATE sources SET coa_debet = ${data.coa_debet}, created_at = created_at WHERE id = ${id}`
    }
    if (data.coa_kredit !== undefined) {
      await sql`UPDATE sources SET coa_kredit = ${data.coa_kredit}, created_at = created_at WHERE id = ${id}`
    }
    if (data.summary_order !== undefined) {
      await sql`UPDATE sources SET summary_order = ${data.summary_order}, created_at = created_at WHERE id = ${id}`
    }
    revalidatePath('/dashboard/konfigurasi')
    return { success: true }
  } catch (error: any) {
    console.error('Error updating source:', error)
    return { success: false, error: error.message }
  }
}

export async function deleteSource(id: number) {
  try {
    await sql`DELETE FROM sources WHERE id = ${id}`
    revalidatePath('/dashboard/konfigurasi')
    return { success: true }
  } catch (error: any) {
    console.error('Error deleting source:', error)
    return { success: false, error: error.message }
  }
}
