'use server'

import { sql } from '@/lib/db'
import { revalidatePath } from 'next/cache'
import * as XLSX from 'xlsx'

// Download template Excel untuk upload target harian
export async function downloadDailyTargetTemplate() {
  try {
    // Get all clinics dan polies yang ada di config
    const configs = await sql`
      SELECT DISTINCT
        c.id as clinic_id,
        c.name as clinic_name,
        mp.id as poly_id,
        mp.name as poly_name
      FROM clinic_target_configs ctc
      JOIN clinics c ON c.id = ctc.clinic_id
      JOIN master_polies mp ON mp.id = ctc.master_poly_id
      ORDER BY c.name, mp.name
    `

    // Ambil semua sources
    const sources = await sql`
      SELECT id, name FROM sources ORDER BY name
    `;

    // Prepare data untuk Excel
    const today = new Date().toISOString().split('T')[0]
    const excelData = [
      // Header
      [
        'clinic_id',
        'master_poly_id',
        'source_id',
        'target_type',    // daily | cumulative
        'target_date',    // Untuk mode daily (YYYY-MM-DD)
        'target_month',   // Untuk mode cumulative (1-12)
        'target_year',    // Untuk mode cumulative (YYYY)
        'target_visits',
        'target_revenue',
        'tipe_donatur',   // retail | corporate | community
        'nama_klinik',    // Helper column, akan di-skip saat upload
        'nama_poli',      // Helper column, akan di-skip saat upload
        'nama_source',    // Helper column, akan di-skip saat upload
      ],
      // Sample data - untuk setiap kombinasi klinik-poli, buat 1 baris per source
      ...configs.flatMap((config: any) => {
        const todayDate = new Date(today)
        const currentMonth = todayDate.getMonth() + 1
        const currentYear = todayDate.getFullYear()
        
        return sources.map((source: any, index: number) => {
          // Alternatif antara daily dan cumulative untuk contoh
          const isDaily = index % 2 === 0
          
          if (isDaily) {
            return [
              config.clinic_id,
              config.poly_id,
              source.id,
              'daily',         // Sample target_type
              today,           // Sample tanggal (untuk daily)
              currentMonth,    // target_month (extract dari tanggal)
              currentYear,     // target_year (extract dari tanggal)
              10,              // Sample visits
              500000,          // Sample revenue
              'retail',        // Sample tipe donatur
              config.clinic_name,
              config.poly_name,
              source.name,
            ]
          } else {
            return [
              config.clinic_id,
              config.poly_id,
              source.id,
              'cumulative',    // Sample target_type
              '',              // target_date (kosong untuk cumulative)
              currentMonth,    // target_month (wajib)
              currentYear,     // target_year (wajib)
              10,              // Sample visits
              500000,          // Sample revenue
              'retail',        // Sample tipe donatur
              config.clinic_name,
              config.poly_name,
              source.name,
            ]
          }
        })
      }),
      // Empty rows untuk user input (opsional)
      ...Array(10).fill(null).map(() => [
        '', '', '', '', '', '', '', '', '', '', '', '', '',
      ]),
    ]

    // Create workbook
    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.aoa_to_sheet(excelData)

    // Set column widths
    worksheet['!cols'] = [
      { wch: 12 }, // clinic_id
      { wch: 15 }, // master_poly_id
      { wch: 12 }, // source_id
      { wch: 12 }, // target_type
      { wch: 12 }, // target_date
      { wch: 12 }, // target_month
      { wch: 12 }, // target_year
      { wch: 15 }, // target_visits
      { wch: 15 }, // target_revenue
      { wch: 15 }, // tipe_donatur
      { wch: 30 }, // nama_klinik
      { wch: 25 }, // nama_poli
      { wch: 25 }, // nama_source
    ]

    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Target Harian')

    // Generate Excel buffer
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

    return {
      success: true,
      buffer: excelBuffer,
      filename: `template-upload-target-harian-${new Date().toISOString().split('T')[0]}.xlsx`
    }
  } catch (error: any) {
    console.error('Error generating template:', error)
    return { success: false, error: error.message }
  }
}

// Upload dan parse Excel untuk target harian
export async function uploadDailyTargets(file: File) {
  try {
    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })
    const worksheet = workbook.Sheets[workbook.SheetNames[0]]
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][]

    if (data.length < 2) {
      return { success: false, error: 'File Excel kosong atau tidak valid' }
    }

    // Get header row
    const headers = data[0] as string[]
    const expectedHeaders = [
      'clinic_id',
      'master_poly_id',
      'source_id',
      'target_type',
      'target_date',
      'target_month',
      'target_year',
      'target_visits',
      'target_revenue',
      'tipe_donatur',
    ]
    
    // Validate headers (skip nama_klinik, nama_poli, nama_source)
    const requiredHeaders = expectedHeaders.filter(h => headers.includes(h))
    if (requiredHeaders.length !== expectedHeaders.length) {
      return { 
        success: false, 
        error: `Header tidak valid. Header yang diperlukan: ${expectedHeaders.join(', ')}` 
      }
    }

    // Get column indices
    const clinicIdIdx = headers.indexOf('clinic_id')
    const polyIdIdx = headers.indexOf('master_poly_id')
    const sourceIdIdx = headers.indexOf('source_id')
    const typeIdx = headers.indexOf('target_type')
    const dateIdx = headers.indexOf('target_date')
    const monthIdx = headers.indexOf('target_month')
    const yearIdx = headers.indexOf('target_year')
    const visitsIdx = headers.indexOf('target_visits')
    const revenueIdx = headers.indexOf('target_revenue')
    const tipeIdx = headers.indexOf('tipe_donatur')

    // Validate all clinics, polies, and sources exist
    const allClinics = await sql`SELECT id FROM clinics`
    const allPolies = await sql`SELECT id FROM master_polies`
    const allSources = await sql`SELECT id FROM sources`
    const clinicIds = new Set(allClinics.map((c: any) => c.id.toString()))
    const polyIds = new Set(allPolies.map((p: any) => p.id.toString()))
    const sourceIds = new Set(allSources.map((s: any) => s.id.toString()))

    // Process rows (skip header)
    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[]
    }

    for (let i = 1; i < data.length; i++) {
      const row = data[i]
      
      // Skip empty rows
      if (!row[sourceIdIdx] || !row[typeIdx]) {
        continue
      }

      const clinicId = row[clinicIdIdx] ? parseInt(row[clinicIdIdx]) : null
      const polyId = row[polyIdIdx] ? parseInt(row[polyIdIdx]) : null
      const sourceId = parseInt(row[sourceIdIdx])
      const targetType = String(row[typeIdx]).trim().toLowerCase()
      const targetDate = row[dateIdx] ? String(row[dateIdx]).trim() : null
      let targetMonth = row[monthIdx] ? parseInt(row[monthIdx]) : null
      let targetYear = row[yearIdx] ? parseInt(row[yearIdx]) : null
      const targetVisits = parseFloat(row[visitsIdx] || '0')
      const targetRevenue = parseFloat(row[revenueIdx] || '0')
      const rawTipe = tipeIdx >= 0 && row[tipeIdx] != null ? String(row[tipeIdx]).trim().toLowerCase() : ''
      let tipeDonatur: 'retail' | 'corporate' | 'community' | null = null

      // Validate target_type
      if (targetType !== 'daily' && targetType !== 'cumulative') {
        results.failed++
        results.errors.push(`Baris ${i + 1}: target_type harus 'daily' atau 'cumulative'`)
        continue
      }

      // Validasi: target_month dan target_year selalu wajib
      if (!targetMonth || !targetYear) {
        results.failed++
        results.errors.push(`Baris ${i + 1}: target_month dan target_year wajib diisi`)
        continue
      }
      
      // Jika target_date diisi, extract bulan dan tahun untuk validasi konsistensi
      let dateMonth: number | null = null
      let dateYear: number | null = null
      if (targetDate) {
        const dateObj = new Date(targetDate)
        if (!isNaN(dateObj.getTime())) {
          dateMonth = dateObj.getMonth() + 1
          dateYear = dateObj.getFullYear()
          
          // Validasi konsistensi
          if (dateMonth !== targetMonth || dateYear !== targetYear) {
            results.failed++
            results.errors.push(`Baris ${i + 1}: target_date, target_month, dan target_year harus konsisten. Bulan dan tahun akan disesuaikan dengan tanggal.`)
            // Auto-correct: gunakan bulan dan tahun dari tanggal
            targetMonth = dateMonth
            targetYear = dateYear
          }
        }
      }

      if (rawTipe) {
        if (rawTipe === 'retail' || rawTipe === 'corporate' || rawTipe === 'community') {
          tipeDonatur = rawTipe as 'retail' | 'corporate' | 'community'
        } else {
          results.failed++
          results.errors.push(`Baris ${i + 1}: tipe_donatur harus salah satu dari retail, corporate, community atau kosong`)
          continue
        }
      }

      // Validate clinic_id (optional)
      if (clinicId && !clinicIds.has(clinicId.toString())) {
        results.failed++
        results.errors.push(`Baris ${i + 1}: clinic_id ${clinicId} tidak ditemukan`)
        continue
      }

      // Validate poly_id (optional)
      if (polyId && !polyIds.has(polyId.toString())) {
        results.failed++
        results.errors.push(`Baris ${i + 1}: master_poly_id ${polyId} tidak ditemukan`)
        continue
      }

      // Validate source_id (required)
      if (!sourceIds.has(sourceId.toString())) {
        results.failed++
        results.errors.push(`Baris ${i + 1}: source_id ${sourceId} tidak ditemukan`)
        continue
      }

      // Validate date format untuk daily
      if (targetType === 'daily' && targetDate && !/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
        results.failed++
        results.errors.push(`Baris ${i + 1}: Format tanggal tidak valid (harus YYYY-MM-DD)`)
        continue
      }

      // Validate month (selalu wajib dan harus 1-12)
      if (targetMonth && (targetMonth < 1 || targetMonth > 12)) {
        results.failed++
        results.errors.push(`Baris ${i + 1}: target_month harus antara 1-12`)
        continue
      }

      // Validate numbers
      if (isNaN(targetVisits) || targetVisits < 0) {
        results.failed++
        results.errors.push(`Baris ${i + 1}: target_visits harus berupa angka >= 0`)
        continue
      }

      if (isNaN(targetRevenue) || targetRevenue < 0) {
        results.failed++
        results.errors.push(`Baris ${i + 1}: target_revenue harus berupa angka >= 0`)
        continue
      }

      // Insert or update (ON CONFLICT)
      try {
        // Untuk mode daily, jika target_date ada, extract bulan dan tahun
        let finalMonth = targetMonth
        let finalYear = targetYear
        if (targetType === 'daily' && targetDate) {
          const dateObj = new Date(targetDate)
          if (!isNaN(dateObj.getTime())) {
            finalMonth = dateObj.getMonth() + 1
            finalYear = dateObj.getFullYear()
          }
        }
        
        if (targetType === 'daily') {
          await sql`
            INSERT INTO clinic_daily_targets (
              clinic_id, 
              master_poly_id, 
              source_id,
              target_type,
              target_date,
              target_month,
              target_year,
              target_visits, 
              target_revenue,
              tipe_donatur
            )
            VALUES (
              ${clinicId},
              ${polyId},
              ${sourceId},
              ${targetType},
              ${targetDate || null},
              ${finalMonth},
              ${finalYear},
              ${targetVisits},
              ${targetRevenue},
              ${tipeDonatur}
            )
            ON CONFLICT (clinic_id, master_poly_id, target_date, source_id) 
            WHERE target_type = 'daily' AND target_date IS NOT NULL
            DO UPDATE SET
              target_month = EXCLUDED.target_month,
              target_year = EXCLUDED.target_year,
              target_visits = EXCLUDED.target_visits,
              target_revenue = EXCLUDED.target_revenue,
              tipe_donatur = EXCLUDED.tipe_donatur,
              updated_at = NOW()
          `
        } else {
          await sql`
            INSERT INTO clinic_daily_targets (
              clinic_id, 
              master_poly_id, 
              source_id,
              target_type,
              target_date,
              target_month,
              target_year,
              target_visits, 
              target_revenue,
              tipe_donatur
            )
            VALUES (
              ${clinicId},
              ${polyId},
              ${sourceId},
              ${targetType},
              NULL,
              ${finalMonth},
              ${finalYear},
              ${targetVisits},
              ${targetRevenue},
              ${tipeDonatur}
            )
            ON CONFLICT (clinic_id, master_poly_id, target_month, target_year, source_id) 
            WHERE target_type = 'cumulative' AND target_month IS NOT NULL AND target_year IS NOT NULL
            DO UPDATE SET
              target_visits = EXCLUDED.target_visits,
              target_revenue = EXCLUDED.target_revenue,
              tipe_donatur = EXCLUDED.tipe_donatur,
              updated_at = NOW()
          `
        }
        results.success++
      } catch (error: any) {
        results.failed++
        results.errors.push(`Baris ${i + 1}: ${error.message}`)
      }
    }

    revalidatePath('/dashboard/konfigurasi')

    return {
      success: results.success > 0,
      successCount: results.success,
      failedCount: results.failed,
      errors: results.errors.slice(0, 20) // Limit errors to first 20
    }
  } catch (error: any) {
    console.error('Error uploading daily targets:', error)
    return { success: false, error: error.message }
  }
}
